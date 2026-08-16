#!/usr/bin/env python3
"""
Automated Lead-Triage & Qualification Engine (v3.0)
Task 1 - Koya AI Automation Academy Assessment

Author: Awaji-Iyaham Simeon Atteng
Architecture:
  STAGE 1 -- Python Cleaner    : Normalise & structure all raw CSV fields. No classification.
  STAGE 2 -- Gemini Flash Lite : Semantic classification of lead notes -> constrained JSON labels.
  STAGE 3 -- Score Assembler   : Deterministic scoring on clean numbers + Gemini enum labels.

Key design decisions:
  - Regex is used ONLY on clean, predictable data formats (numbers, dates, email structure).
  - Regex is NEVER used to classify free-form human text.
  - Gemini receives pre-structured JSON objects, not raw CSV.
  - Gemini outputs a strict constrained schema -- no free text responses.
  - Python scores deterministically against those fixed enum values.
  - asyncio + concurrent batching keeps API latency minimal.
"""

import csv
import re
import json
import os
import sys
import asyncio
import time
from datetime import datetime
from typing import Optional

# -- Gemini SDK -----------------------------------------------------------------
try:
    from google import genai as genai_client
    from google.genai import types as genai_types
    _GEMINI_SDK = True
except ImportError:
    _GEMINI_SDK = False

# -- Constants ------------------------------------------------------------------
GEMINI_MODEL       = "gemini-3.1-flash-lite"
GEMINI_CONCURRENCY = 2
GEMINI_TIMEOUT_S   = 12
CACHE_FILE_PATH    = os.path.join(os.path.dirname(__file__), ".gemini_cache.json")

# Persistent Cache Handler
def _load_cache():
    if os.path.exists(CACHE_FILE_PATH):
        try:
            with open(CACHE_FILE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_cache(cache):
    try:
        with open(CACHE_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(cache, f, indent=2)
    except Exception:
        pass

_CLASSIFICATION_CACHE = _load_cache()

FREE_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'mail.com', 'protonmail.com', 'zoho.com', 'gmx.com',
    'ymail.com', 'live.com', 'me.com',
}

# -- Default Configurable Scoring Rules (Overridable via Frontend/API) -----------
DEFAULT_SCORING_RULES = {
    "title_weights": {
        "Executive Buyer (Tier 1)": 30,
        "Growth & Ops Leader (Tier 2)": 25,
        "Manager / Specialist (Tier 3)": 15,
        "Individual Contributor": 10,
        "Student / Early Founder": 5,
        "Non-Buyer": 0
    },
    "budget_brackets_usd": [
        {"min": 10000, "pts": 25, "label": "Enterprise ($10k+)"},
        {"min": 5000,  "pts": 20, "label": "Mid-Market ($5k-$9.9k)"},
        {"min": 2000,  "pts": 15, "label": "Growth ($2k-$4.9k)"},
        {"min": 1,     "pts": 5,  "label": "Starter (<$2k)"},
        {"min": 0,     "pts": 0,  "label": "$0 Budget"}
    ],
    "tbd_budget_baseline_pts": 10,
    "source_weights": {
        "referral": 15,
        "event": 12,
        "webform": 10,
        "linkedin": 8,
        "cold": 5,
        "invalid": 0
    },
    "intent_weights": {
        "HIGH": 30,
        "MEDIUM": 18,
        "LOW": 8,
        "DEFAULT": 10
    },
    "urgency_bonus": {
        "IMMEDIATE": 5,
        "THIS_QUARTER": 3,
        "WATCHING": 1,
        "NONE": 0
    },
    "corporate_domain_bonus": 5,
    "employee_scale_bonus": 5,
    "min_employees_for_bonus": 10,
    "score_thresholds": {
        "contact_now": 70,
        "nurture": 40
    }
}

# Currency Conversion Engine (Live FX API with Fallback Rates)
DEFAULT_FX_RATES_TO_USD = {
    "USD": 1.0, "EUR": 1.15, "GBP": 1.35, "NGN": 0.00074,
    "CAD": 0.72, "AUD": 0.71, "JPY": 0.0066, "CHF": 1.12
}

def fetch_live_fx_rates():
    """Fetch live exchange rates to USD from open.er-api.com with local fallback."""
    import urllib.request
    try:
        url = "https://open.er-api.com/v6/latest/USD"
        req = urllib.request.urlopen(url, timeout=3)
        data = json.loads(req.read().decode())
        rates = data.get("rates", {})
        # Convert base USD rates (which are 1 USD = X Foreign) to USD multipliers (1 Foreign = Y USD)
        usd_multipliers = {"USD": 1.0}
        for code, rate in rates.items():
            if rate > 0:
                usd_multipliers[code] = 1.0 / rate
        return usd_multipliers
    except Exception:
        return DEFAULT_FX_RATES_TO_USD

LIVE_FX_RATES = fetch_live_fx_rates()

# Gemini MUST return one of these exact enum strings. Python scores them.
INTENT_LEVELS   = {"HIGH", "MEDIUM", "LOW"}
URGENCY_LEVELS  = {"IMMEDIATE", "THIS_QUARTER", "WATCHING", "NONE"}
RED_FLAG_TYPES  = {"JOB_SEEKER", "STUDENT", "SPAM", "WRONG_CONTACT",
                   "NOT_BUYING", "DISINTERESTED", "NONE"}
PAIN_CATEGORIES = {"INBOX_TRIAGE", "AD_OPS", "REPORTING", "OUTREACH",
                   "CUSTOMER_SUPPORT", "DATA_PIPELINE", "OTHER", "NONE"}

GEMINI_PROMPT = """\
You are a B2B lead qualification specialist. Analyse the lead below and classify it accurately based strictly on the provided context.

CRITICAL INSTRUCTIONS TO PREVENT HALLUCINATION:
1. Base all judgments strictly on the provided text. Do not invent details not present in the lead notes.
2. If uncertain, set confidence_score lower (e.g. 0.5) and intent_level to "MEDIUM" or "LOW".

LEAD CONTEXT:
{lead_context}

CLASSIFICATION TASK:
Return ONLY a valid JSON object. No markdown, no prose, no extra keys.

RULES:
- is_genuine_buyer: true if this lead represents a real purchasing opportunity for our agency.
  * If student/early founder has budget or active business need, mark true!
  * Mark false ONLY if looking for employment, requesting job/internship, submitting homework, or spam.
- red_flag_type: ONE of {red_flag_types} or "NONE" if genuine.
- intent_level: How ready is this lead to spend money? {intent_levels}
- urgency: How soon do they need a solution? {urgency_levels}
- pain_category: What is their core problem? {pain_categories}
- pain_summary: One sentence (max 15 words) on their specific pain point. Write "N/A" if not genuine.
- confidence_score: A float between 0.0 and 1.0 indicating how confident you are in this classification.

OUTPUT FORMAT (strict):
{{
  "is_genuine_buyer": true,
  "red_flag_type": "NONE",
  "intent_level": "HIGH",
  "urgency": "IMMEDIATE",
  "pain_category": "INBOX_TRIAGE",
  "pain_summary": "Inbox flooded; team wastes hours triaging manually each week.",
  "confidence_score": 0.95
}}
"""

# ==============================================================================
# STAGE 1 -- CLEAN & STRUCTURE  (pure data normalisation, zero classification)
# ==============================================================================

def _clean(val) -> str:
    return str(val).encode('utf-8', 'ignore').decode('utf-8').strip()


def _parse_email(raw: str):
    email = raw.strip().lower()
    if '@' not in email:
        return email or "unknown", "unknown", False
    domain = email.split('@')[1].strip()
    is_corp = domain not in FREE_EMAIL_DOMAINS and '.' in domain
    return email, domain, is_corp


def _parse_budget(val: str) -> tuple[Optional[float], Optional[float], str, str]:
    """
    Multi-Currency Budget Parser & Live FX Normalizer.
    Detects ISO codes (EUR, GBP, NGN, CAD, AUD) and symbols (€, £, ₦, $).
    Converts foreign values to USD using live/fallback FX rates.
    Returns: (native_amount, usd_normalized_amount, detected_currency, formatted_label)
    """
    if not val or not str(val).strip():
        return None, None, "USD", "TBD"
    
    s = str(val).strip().upper().replace(',', '')
    
    if s in {'0', 'ZERO', 'NONE', 'NO BUDGET', '0/MO', '$0', '₦0', '€0', '£0'}:
        return 0.0, 0.0, "USD", "$0"
        
    if any(k in s.lower() for k in ['tbd', 'depend', 'unknown', 'n/a', 'not sure', 'varies']):
        return None, None, "USD", "TBD"

    # Detect currency symbol or code
    currency = "USD"
    symbol_str = "$"
    if '€' in s or 'EUR' in s:
        currency, symbol_str = "EUR", "€"
    elif '£' in s or 'GBP' in s:
        currency, symbol_str = "GBP", "£"
    elif '₦' in s or 'NGN' in s or 'NAIRA' in s:
        currency, symbol_str = "NGN", "₦"
    elif 'CAD' in s:
        currency, symbol_str = "CAD", "CAD $"
    elif 'AUD' in s:
        currency, symbol_str = "AUD", "AUD $"

    # Clean numeric string for parsing
    clean_s = re.sub(r'[^0-9\.\-K]', '', s)
    
    # Range parsing e.g. 6-8k, 5000-8000
    m_range = re.search(r'(\d+(?:\.\d+)?)\s*K?\s*-\s*(\d+(?:\.\d+)?)\s*K?', clean_s)
    native_num = None
    if m_range:
        lo, hi = float(m_range.group(1)), float(m_range.group(2))
        if 'K' in clean_s or lo < 500:
            lo, hi = lo * 1000, hi * 1000
        native_num = (lo + hi) / 2.0
    else:
        # Thousands notation: 15k
        m_k = re.search(r'(\d+(?:\.\d+)?)\s*K', clean_s)
        if m_k:
            native_num = float(m_k.group(1)) * 1000.0
        else:
            # Plain numeric
            m_num = re.search(r'(\d+(?:\.\d+)?)', clean_s)
            if m_num:
                native_num = float(m_num.group(1))

    if native_num is None:
        return None, None, currency, val.strip()

    # Convert to USD using live FX rates
    fx_multiplier = LIVE_FX_RATES.get(currency, 1.0)
    usd_num = native_num * fx_multiplier

    if currency != "USD":
        fmt_label = f"{symbol_str}{native_num:,.0f} (~${usd_num:,.0f} USD)"
    else:
        fmt_label = f"${usd_num:,.0f}"

    return native_num, usd_num, currency, fmt_label


def _parse_employees(val: str):
    if not val or not val.strip():
        return None
    m = re.search(r'(\d+)\s*-\s*(\d+)', val)
    if m:
        return (int(m.group(1)) + int(m.group(2))) // 2
    m = re.search(r'(\d+)', val)
    return int(m.group(1)) if m else None


def _title_score(raw: str):
    if not raw or not raw.strip():
        return "Unspecified", 10
    t = raw.strip().lower()
    # Note: Soft keyword flag for titles; Gemini makes final call on whether student/job seeker is a true buyer.
    for kw in ['job seeker', 'developer looking', 'recruiter']:
        if kw in t:
            return f"Non-Buyer ({raw})", 0
    for kw in ['owner', 'founder', 'ceo', 'co-founder', 'managing director',
               'managing partner', 'partner', 'coo', 'cto', 'cmo', 'president', 'chief']:
        if kw in t:
            return "Executive Buyer (Tier 1)", 30
    for kw in ['head of growth', 'vp growth', 'head of ops', 'head of revops',
               'director of ops', 'vp ops', 'vice president', 'director', 'vp']:
        if kw in t:
            return "Growth & Ops Leader (Tier 2)", 25
    for kw in ['manager', 'consultant', 'head', 'strategist']:
        if kw in t:
            return "Manager / Specialist (Tier 3)", 15
    if 'student' in t:
        return "Student / Early Founder", 5
    return "Individual Contributor", 10


def _source_score(raw: str):
    if not raw:
        return 8, "Unknown"
    s = raw.strip().lower()
    if 'referral' in s: return 15, "Referral"
    if 'event' in s:    return 12, "Event"
    if 'webform' in s:  return 10, "Inbound Webform"
    if 'linkedin' in s: return 8,  "LinkedIn"
    if 'cold' in s:     return 5,  "Cold Outreach"
    if s in {'test', 'source'}: return 0, "Invalid / Test"
    return 8, raw.strip().capitalize()


def stage1_clean(rows: list) -> list:
    """Pure normalisation. No classification, no scoring of intent."""
    out = []
    for idx, row in enumerate(rows):
        email, domain, is_corp = _parse_email(row.get('email', '') or '')
        company_raw = _clean(row.get('company', '') or '')
        
        # Domain Enrichment: If company name is missing/unspecified, format corporate domain nicely
        if not company_raw or company_raw.lower() in {'unspecified', 'n/a', 'none', 'unknown'}:
            if is_corp and domain not in {'unknown', ''}:
                # Convert 'growthworks.ng' -> 'Growthworks'
                company = domain.split('.')[0].replace('-', ' ').replace('_', ' ').title()
            else:
                company = "Unspecified Company"
        else:
            company = company_raw

        native_b, usd_b, currency_code, budget_fmt = _parse_budget(row.get('monthly_budget', '') or '')
        title_raw = _clean(row.get('title', '') or '')
        title_label, title_pts = _title_score(title_raw)
        source_raw = _clean(row.get('source', '') or '')
        source_pts, source_label = _source_score(source_raw)

        out.append({
            "lead_id":       _clean(row.get('lead_id', '')) or f"L-AUTO-{idx+1}",
            "created":       _clean(row.get('created', '') or ''),
            "name":          _clean(row.get('name', '') or 'Unspecified'),
            "email":         email,
            "domain":        domain,
            "is_corporate":  is_corp,
            "company":       company,
            "website":       _clean(row.get('website', '') or ''),
            "title_raw":     title_raw,
            "title_label":   title_label,
            "title_pts":     title_pts,
            "employees":     _parse_employees(row.get('employees', '') or ''),
            "source_raw":    source_raw,
            "source_label":  source_label,
            "source_pts":    source_pts,
            "native_budget_amount": native_b,
            "budget_num":    usd_b,  # Normalized USD amount for consistent scoring
            "currency_code": currency_code,
            "budget_fmt":    budget_fmt,
            "notes":         _clean(row.get('notes', '') or ''),
            # Stage 2 placeholders
            "gemini_ok":        False,
            "is_genuine_buyer": None,
            "red_flag_type":    None,
            "intent_level":     None,
            "urgency":          None,
            "pain_category":    None,
            "pain_summary":     None,
        })
    return out


# ==============================================================================
# STAGE 2 -- GEMINI FLASH LITE  (semantic classification, structured output only)
# ==============================================================================

def _build_context(lead: dict) -> str:
    return (
        f"Title: {lead['title_raw'] or 'Not provided'}\n"
        f"Authority tier (pre-assessed): {lead['title_label']}\n"
        f"Company: {lead['company']} ({lead['employees'] or 'unknown'} employees)\n"
        f"Email domain type: {'Corporate' if lead['is_corporate'] else 'Free webmail'}\n"
        f"Lead source: {lead['source_label']}\n"
        f"Monthly budget: {lead['budget_fmt']}\n"
        f"Notes: {lead['notes'] or '(none provided)'}"
    )


def _build_prompt(lead: dict) -> str:
    return GEMINI_PROMPT.format(
        lead_context    = _build_context(lead),
        red_flag_types  = ", ".join(sorted(RED_FLAG_TYPES)),
        intent_levels   = ", ".join(sorted(INTENT_LEVELS)),
        urgency_levels  = ", ".join(sorted(URGENCY_LEVELS)),
        pain_categories = ", ".join(sorted(PAIN_CATEGORIES)),
    )


def _parse_response(text: str):
    text = re.sub(r'```(?:json)?', '', text).strip().strip('`')
    s, e = text.find('{'), text.rfind('}')
    if s == -1 or e == -1:
        return None
    try:
        obj = json.loads(text[s:e+1])
    except json.JSONDecodeError:
        return None
    required = {'is_genuine_buyer', 'red_flag_type', 'intent_level',
                'urgency', 'pain_category', 'pain_summary'}
    if not required.issubset(obj.keys()):
        return None
    if obj.get('intent_level')  not in INTENT_LEVELS:  return None
    if obj.get('urgency')       not in URGENCY_LEVELS:  return None
    if obj.get('red_flag_type') not in RED_FLAG_TYPES:  return None
    if obj.get('pain_category') not in PAIN_CATEGORIES: return None
    
    # Ensure confidence score is valid float 0.0 - 1.0
    conf = obj.get('confidence_score', 0.9)
    try:
        obj['confidence_score'] = max(0.0, min(1.0, float(conf)))
    except (ValueError, TypeError):
        obj['confidence_score'] = 0.8
        
    return obj


async def _classify_one(client, lead: dict, sem: asyncio.Semaphore) -> dict:
    import hashlib
    # Compute unique MD5 cache key based on title + notes + budget context
    cache_key_raw = f"{lead.get('title_raw')}|{lead.get('budget_fmt')}|{lead.get('notes')}"
    cache_key = hashlib.md5(cache_key_raw.encode('utf-8')).hexdigest()

    # 1. Check local persistent cache to prevent redundant API calls
    if cache_key in _CLASSIFICATION_CACHE:
        cached = _CLASSIFICATION_CACHE[cache_key]
        lead.update(cached)
        lead["gemini_ok"] = True
        lead["from_cache"] = True
        return lead

    async with sem:
        prompt = _build_prompt(lead)
        loop = asyncio.get_event_loop()
        max_retries = 3
        
        # Zero-temperature & JSON mime-type config to prevent hallucination
        config = genai_types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json"
        )
        
        for attempt in range(max_retries):
            try:
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: client.models.generate_content(
                            model=GEMINI_MODEL,
                            contents=prompt,
                            config=config
                        )
                    ),
                    timeout=GEMINI_TIMEOUT_S
                )
                parsed = _parse_response(response.text or '')
                if parsed:
                    res_data = {
                        "gemini_ok":        True,
                        "is_genuine_buyer": bool(parsed["is_genuine_buyer"]),
                        "red_flag_type":    parsed["red_flag_type"],
                        "intent_level":     parsed["intent_level"],
                        "urgency":          parsed["urgency"],
                        "pain_category":    parsed["pain_category"],
                        "pain_summary":     parsed["pain_summary"],
                        "confidence_score": parsed["confidence_score"],
                        "needs_human_review": parsed["confidence_score"] < 0.65
                    }
                    lead.update(res_data)
                    # Save to cache memory & persistent disk
                    _CLASSIFICATION_CACHE[cache_key] = res_data
                    _save_cache(_CLASSIFICATION_CACHE)
                    return lead
            except Exception as ex:
                if "429" in str(ex) or "RESOURCE_EXHAUSTED" in str(ex):
                    await asyncio.sleep(5 * (attempt + 1))
                else:
                    lead["gemini_error"] = str(ex)
                    break
                    
        # Fallback if Gemini quota is exhausted: safe heuristic
        if not lead.get("gemini_ok"):
            notes_lower = (lead.get("notes") or "").lower()
            is_buyer = not any(rf in notes_lower for rf in ["looking for a job", "attaching my cv", "student project", "spam"])
            lead.update({
                "gemini_ok": False,
                "is_genuine_buyer": is_buyer,
                "red_flag_type": "NONE" if is_buyer else "JOB_SEEKER",
                "intent_level": "HIGH" if any(k in notes_lower for k in ["budget approved", "ready", "urgent", "start"]) else "MEDIUM",
                "urgency": "IMMEDIATE" if "urgent" in notes_lower or "start" in notes_lower else "THIS_QUARTER",
                "pain_category": "OTHER",
                "pain_summary": lead.get("notes")[:60] if lead.get("notes") else "N/A",
                "confidence_score": 0.5,
                "needs_human_review": True
            })
    return lead


async def _stage2_async(leads: list) -> list:
    api_key = os.environ.get("GOOGLE_GENAI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not _GEMINI_SDK or not api_key:
        print("[!] Gemini key not found -- Stage 2 skipped. Set GOOGLE_GENAI_API_KEY and re-run.")
        return leads
    client = genai_client.Client(api_key=api_key)
    sem    = asyncio.Semaphore(GEMINI_CONCURRENCY)
    print(f"[+] Stage 2: Classifying {len(leads)} leads via {GEMINI_MODEL} ({GEMINI_CONCURRENCY} concurrent)...")
    t0 = time.time()
    results = await asyncio.gather(*[_classify_one(client, lead, sem) for lead in leads])
    ok = sum(1 for r in results if r.get("gemini_ok"))
    print(f"[+] Stage 2 complete: {ok}/{len(results)} classified in {time.time()-t0:.1f}s")
    return list(results)


def stage2_classify(leads: list) -> list:
    return asyncio.run(_stage2_async(leads))


# ==============================================================================
# STAGE 3 -- SCORE ASSEMBLER  (deterministic scoring on clean + classified data)
# ==============================================================================

INTENT_PTS  = {"HIGH": 30, "MEDIUM": 18, "LOW": 8, None: 10}
URGENCY_PTS = {"IMMEDIATE": 5, "THIS_QUARTER": 3, "WATCHING": 1, "NONE": 0, None: 0}


def _budget_pts(n):
    if n is None:  return 10
    if n == 0:     return 0
    if n >= 10000: return 25
    if n >= 5000:  return 20
    if n >= 2000:  return 15
    return 5


def stage3_score(leads: list, custom_rules: dict = None) -> list:
    """
    Stage 3: Assemble final composite score and recommendation.
    Supports runtime custom rules overriding weights & brackets for frontend integration.
    """
    rules = DEFAULT_SCORING_RULES.copy()
    if custom_rules:
        rules.update(custom_rules)

    title_w  = rules.get("title_weights", DEFAULT_SCORING_RULES["title_weights"])
    source_w = rules.get("source_weights", DEFAULT_SCORING_RULES["source_weights"])
    intent_w = rules.get("intent_weights", DEFAULT_SCORING_RULES["intent_weights"])
    urgency_w = rules.get("urgency_bonus", DEFAULT_SCORING_RULES["urgency_bonus"])
    corp_bonus = rules.get("corporate_domain_bonus", 5)
    scale_bonus = rules.get("employee_scale_bonus", 5)
    min_emp = rules.get("min_employees_for_bonus", 10)
    thresholds = rules.get("score_thresholds", {"contact_now": 70, "nurture": 40})

    def _dynamic_budget_pts(usd_amt: Optional[float]) -> int:
        if usd_amt is None:
            return rules.get("tbd_budget_baseline_pts", 10)
        brackets = rules.get("budget_brackets_usd", DEFAULT_SCORING_RULES["budget_brackets_usd"])
        for b in brackets:
            if usd_amt >= b["min"]:
                return b["pts"]
        return 0

    for lead in leads:
        # Check absolute disqualifiers (Only true if explicitly marked False, NOT if None/pending)
        is_disq = (
            lead.get("is_genuine_buyer") is False
            or (lead.get("red_flag_type") not in (None, "NONE"))
            or lead["title_pts"] == 0
            or lead["source_pts"] == 0
        )
        if is_disq:
            total = 0
            rec = "DISQUALIFY"
            reason = f"Disqualified -- {lead.get('red_flag_type') or 'NON_BUYER'}"
            sla = "No Sales Contact (Auto-Archive)"
        else:
            # Look up dynamic weights
            t_label = lead.get("title_label", "Individual Contributor")
            t_pts = title_w.get(t_label, lead.get("title_pts", 10))
            b_pts = _dynamic_budget_pts(lead["budget_num"])
            
            src_key = lead.get("source_raw", "").lower()
            s_pts = 8
            for sk, sv in source_w.items():
                if sk in src_key:
                    s_pts = sv
                    break
                    
            i_pts = intent_w.get(lead.get("intent_level"), intent_w.get("DEFAULT", 10))
            u_pts = urgency_w.get(lead.get("urgency"), 0)
            d_pts = corp_bonus if lead["is_corporate"] else 0
            sc_pts = scale_bonus if (lead["employees"] or 0) >= min_emp else 0

            total = min(t_pts + b_pts + s_pts + i_pts + u_pts + d_pts + sc_pts, 100)

            if total >= thresholds["contact_now"]:
                rec = "CONTACT NOW"
                reason = f"High ICP Fit & Intent ({total}/100) -- Priority Sales SLA"
                sla = "< 1 Hour SLA (Immediate Phone/Email Outreach)"
            elif total >= thresholds["nurture"]:
                rec = "NURTURE"
                reason = f"Moderate Fit ({total}/100) -- Enroll in Drip Campaign"
                sla = "48 Hour SLA (Enroll in Automated Drip Sequence)"
            else:
                rec = "DISQUALIFY"
                reason = f"Below ICP Threshold ({total}/100)"
                sla = "No Sales Contact (Auto-Archive)"

        # Calculate Annual Recurring Revenue (ARR) potential in USD
        monthly_b_usd = lead["budget_num"] or 0.0
        estimated_arr = monthly_b_usd * 12.0

        lead.update({
            "total_score":         total,
            "recommendation":      rec,
            "rec_reason":          reason,
            "sales_sla":           sla,
            "estimated_arr_usd":   estimated_arr,
            "estimated_arr_fmt":   f"${estimated_arr:,.0f} USD" if estimated_arr > 0 else "TBD",
            "score_breakdown": {
                "title_authority":      t_pts if not is_disq else 0,
                "budget_magnitude":     b_pts if not is_disq else 0,
                "lead_source":          s_pts if not is_disq else 0,
                "notes_intent":         i_pts if not is_disq else 0,
                "urgency_bonus":        u_pts if not is_disq else 0,
                "corporate_domain_bonus": d_pts if not is_disq else 0,
                "total_score":          total,
            }
        })

    leads.sort(key=lambda x: (x["total_score"], x["budget_num"] or 0), reverse=True)
    for i, lead in enumerate(leads, 1):
        lead["rank"] = i
    return leads


# ==============================================================================
# MAIN ORCHESTRATOR
# ==============================================================================

def run(input_csv: str, output_csv: str = None, output_json: str = None):
    if not os.path.exists(input_csv):
        print(f"[ERROR] File not found: {input_csv}")
        return None

    print(f"[+] Stage 1: Loading & cleaning {input_csv} ...")
    with open(input_csv, encoding='utf-8', errors='ignore') as f:
        rows = list(csv.DictReader(f))
    leads = stage1_clean(rows)
    print(f"[+] Stage 1 complete: {len(leads)} leads structured.")

    leads = stage2_classify(leads)

    print("[+] Stage 3: Assembling scores & recommendations ...")
    leads = stage3_score(leads)

    total = len(leads)
    contact   = sum(1 for l in leads if l["recommendation"] == "CONTACT NOW")
    nurture   = sum(1 for l in leads if l["recommendation"] == "NURTURE")
    disqualify = sum(1 for l in leads if l["recommendation"] == "DISQUALIFY")

    print("\n=======================================================")
    print("         LEAD TRIAGE PIPELINE SUMMARY (v3.0)          ")
    print("=======================================================")
    print(f"  Total Processed : {total}")
    print(f"  CONTACT NOW     : {contact} ({contact/total*100:.1f}%)")
    print(f"  NURTURE         : {nurture} ({nurture/total*100:.1f}%)")
    print(f"  DISQUALIFY      : {disqualify} ({disqualify/total*100:.1f}%)")
    print("=======================================================\n")

    if output_csv:
        fields = [
            'rank', 'lead_id', 'recommendation', 'total_score', 'sales_sla',
            'estimated_arr_fmt', 'name', 'email', 'company', 'title_raw',
            'title_label', 'budget_fmt', 'source_label', 'intent_level',
            'urgency', 'pain_category', 'pain_summary', 'rec_reason', 'notes'
        ]
        with open(output_csv, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
            w.writeheader()
            w.writerows(leads)
        print(f"[+] CSV exported -> {output_csv}")

    if output_json:
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump({
                "processed_at": datetime.now().isoformat(),
                "model": GEMINI_MODEL,
                "summary": {"total": total, "contact_now": contact,
                            "nurture": nurture, "disqualify": disqualify},
                "leads": leads,
            }, f, indent=2, default=str)
        print(f"[+] JSON exported -> {output_json}")

    # Generate Executive Summary Report (.md artifact)
    report_path = os.path.join(os.path.dirname(output_csv or input_csv), "triage_executive_report.md")
    total_arr = sum(l.get("estimated_arr_usd", 0.0) for l in leads if l.get("recommendation") == "CONTACT NOW")
    
    # Pain point breakdown count
    pains = {}
    for l in leads:
        p = l.get("pain_category", "OTHER")
        if p and p != "NONE":
            pains[p] = pains.get(p, 0) + 1

    report_content = f"""# Executive Lead Triage Report
**Generated at**: {datetime.now().strftime("%Y-%m-%d %H:%M UTC")}  
**Model Engine**: `{GEMINI_MODEL}` (Zero-Temperature Deterministic Pipeline)

## Pipeline Summary Metrics
- **Total Leads Analyzed**: {total}
- **CONTACT NOW Opportunities**: {contact} ({contact/total*100:.1f}%)
- **NURTURE Pipeline**: {nurture} ({nurture/total*100:.1f}%)
- **Disqualified Submissions**: {disqualify} ({disqualify/total*100:.1f}%)
- **Total Priority Pipeline ARR**: **${total_arr:,.0f} USD**

## Top Operational Pain Categories Identified
"""
    for pain_cat, count in sorted(pains.items(), key=lambda x: x[1], reverse=True):
        report_content += f"- **{pain_cat}**: {count} leads ({count/total*100:.1f}%)\n"

    report_content += "\n## Top 5 High-Priority Sales SLA Opportunities\n"
    for l in leads[:5]:
        report_content += (
            f"1. **{l['name'].title()}** ({l['title_label']}) - **{l['company']}**\n"
            f"   - **Score**: {l['total_score']}/100 | **ARR Potential**: {l['estimated_arr_fmt']}\n"
            f"   - **Pain Summary**: *\"{l.get('pain_summary', 'N/A')}\"*\n"
            f"   - **SLA Routing**: `{l['sales_sla']}`\n\n"
        )

    with open(report_path, 'w', encoding='utf-8') as rf:
        rf.write(report_content)
    print(f"[+] Executive Report generated -> {report_path}")

    return leads


if __name__ == '__main__':
    import glob as _glob
    # Resolve input path: accept explicit arg or auto-detect via glob (handles em-dash encoding)
    if len(sys.argv) > 1:
        _in = sys.argv[1]
    else:
        _candidates = _glob.glob(r"C:\Users\Administrator\Downloads\Kora Leads\Cohort 3 Assessment*Leads (messy).csv")
        _in = _candidates[0] if _candidates else r"C:\Users\Administrator\Downloads\Kora Leads\Cohort 3 Assessment - Task 1 Leads (messy).csv"
    _csv  = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\Administrator\Downloads\Kora Leads\Cohort_3_Task_1_Leads_Scored_Ranked.csv"
    _json = sys.argv[3] if len(sys.argv) > 3 else r"C:\Users\Administrator\Downloads\Kora Leads\Cohort_3_Task_1_Leads_Scored_Ranked.json"
    run(_in, _csv, _json)
