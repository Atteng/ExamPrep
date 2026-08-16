#!/usr/bin/env python3
"""
Vercel Python Serverless Endpoint: /api/triage
Processes uploaded raw CSV files via the 3-Stage Lead Triage Engine with live Gemini 2.0 Flash REST API support.
"""

import json
import re
import os
import sys
import io
import csv
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

FREE_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'mail.com', 'protonmail.com', 'zoho.com', 'gmx.com'
}

def clean_str(val):
    if not val:
        return ""
    return str(val).strip().replace('"', '').replace("'", "")

def parse_budget(val_str):
    if not val_str:
        return 0.0
    s = str(val_str).strip().upper().replace(',', '')
    if any(k in s.lower() for k in ['tbd', 'unknown', 'n/a', 'varies']):
        return 0.0
    
    # Simple FX approximation for REST serverless
    multiplier = 1.0
    if '€' in s or 'EUR' in s: multiplier = 1.15
    elif '£' in s or 'GBP' in s: multiplier = 1.35
    elif '₦' in s or 'NGN' in s: multiplier = 0.00074
    
    clean_num = re.sub(r'[^0-9.]', '', s)
    try:
        native = float(clean_num) if clean_num else 0.0
        return native * multiplier
    except ValueError:
        return 0.0

def classify_lead_with_gemini(lead_context, api_key):
    """
    Direct Gemini REST API call using standard urllib (zero dependencies required on Vercel).
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
    
    prompt = f"""You are a B2B lead qualification specialist. Analyze the lead below and classify it accurately based strictly on context.

LEAD CONTEXT:
{lead_context}

RULES:
- is_genuine_buyer: true if real purchasing opportunity. False ONLY if looking for employment, internship, submitting homework, or spam.
- red_flag_type: ONE of ["JOB_SEEKER", "STUDENT", "SPAM", "WRONG_CONTACT", "NOT_BUYING", "DISINTERESTED", "NONE"]
- intent_level: ONE of ["HIGH", "MEDIUM", "LOW"]
- urgency: ONE of ["IMMEDIATE", "THIS_QUARTER", "WATCHING", "NONE"]
- pain_category: ONE of ["INBOX_TRIAGE", "AD_OPS", "REPORTING", "OUTREACH", "CUSTOMER_SUPPORT", "DATA_PIPELINE", "OTHER", "NONE"]
- pain_summary: One sentence (max 15 words) on their pain point. Write "N/A" if not genuine.

Return ONLY a valid JSON object:
{{
  "is_genuine_buyer": true,
  "red_flag_type": "NONE",
  "intent_level": "HIGH",
  "urgency": "IMMEDIATE",
  "pain_category": "INBOX_TRIAGE",
  "pain_summary": "Inbox flooded; team wastes hours triaging manually."
}}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json"
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            text = data['candidates'][0]['content']['parts'][0]['text']
            return json.loads(text)
    except Exception as e:
        return None

def process_triage_csv(csv_text):
    api_key = os.environ.get("GOOGLE_GENAI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    
    f = io.StringIO(csv_text)
    reader = csv.DictReader(f)
    rows = list(reader)
    
    scored_leads = []
    
    for idx, r in enumerate(rows):
        row = {k.strip().lower().replace(' ', '_'): v for k, v in r.items() if k}
        
        email = clean_str(row.get('email') or row.get('contact_email') or '')
        domain = email.split('@')[1].lower() if '@' in email else ''
        is_corp = domain and domain not in FREE_EMAIL_DOMAINS
        
        name = clean_str(row.get('full_name') or row.get('name') or f"Prospect {idx+1}")
        company = clean_str(row.get('company') or row.get('organization') or (domain.split('.')[0].title() if domain else 'Unspecified'))
        title = clean_str(row.get('job_title') or row.get('title') or 'Decision Maker')
        notes = clean_str(row.get('notes') or row.get('notes_/_problem') or row.get('message') or row.get('pain') or '')
        
        budget_num = parse_budget(row.get('monthly_budget') or row.get('budget'))
        budget_fmt = f"${budget_num:,.0f}" if budget_num > 0 else "TBD"
        
        title_lower = title.lower()
        title_pts = 10
        title_label = "Individual Contributor"
        if any(k in title_lower for k in ['ceo', 'owner', 'founder', 'co-founder', 'managing director', 'president', 'chief']):
            title_pts = 30
            title_label = "Executive Buyer (Tier 1)"
        elif any(k in title_lower for k in ['director', 'vp', 'head of growth', 'head of ops']):
            title_pts = 25
            title_label = "Growth & Ops Leader (Tier 2)"
        elif any(k in title_lower for k in ['manager', 'lead', 'specialist', 'consultant']):
            title_pts = 15
            title_label = "Manager / Specialist (Tier 3)"
        elif 'student' in title_lower:
            title_pts = 5
            title_label = "Student / Early Founder"

        budget_pts = 10
        if budget_num >= 10000: budget_pts = 25
        elif budget_num >= 5000: budget_pts = 20
        elif budget_num >= 2000: budget_pts = 15
        elif budget_num > 0: budget_pts = 5
        
        # Default classification heuristics
        is_buyer = not any(k in notes.lower() or k in title_lower for k in ['student', 'intern', 'career', 'hiring', 'looking for a job', 'not looking', 'do not contact'])
        intent_level = "HIGH" if budget_num >= 5000 else "MEDIUM"
        urgency = "IMMEDIATE"
        pain_cat = "OTHER"
        pain_summary = notes[:70] if notes else "Custom Automation"
        red_flag = "NONE" if is_buyer else "JOB_SEEKER"
        ai_used = False

        # Execute Live Gemini AI if API Key is present
        if api_key:
            lead_ctx = f"Title: {title}\nCompany: {company}\nBudget: {budget_fmt}\nNotes: {notes}"
            ai_res = classify_lead_with_gemini(lead_ctx, api_key)
            if ai_res:
                ai_used = True
                is_buyer = bool(ai_res.get('is_genuine_buyer', is_buyer))
                red_flag = ai_res.get('red_flag_type', red_flag)
                intent_level = ai_res.get('intent_level', intent_level)
                urgency = ai_res.get('urgency', urgency)
                pain_cat = ai_res.get('pain_category', pain_cat)
                pain_summary = ai_res.get('pain_summary', pain_summary)

        intent_pts = 30 if intent_level == "HIGH" else (18 if intent_level == "MEDIUM" else 8)
        urgency_pts = 5 if urgency == "IMMEDIATE" else (3 if urgency == "THIS_QUARTER" else 0)
        corp_pts = 5 if is_corp else 0

        total_score = title_pts + budget_pts + intent_pts + urgency_pts + corp_pts
        if not is_buyer or red_flag != "NONE":
            total_score = 0
            rec = "DISQUALIFY"
            sla = "No Sales Contact (Auto-Archive)"
        elif total_score >= 70:
            rec = "CONTACT NOW"
            sla = "< 1 Hour SLA (Immediate Phone/Email Outreach)"
        elif total_score >= 40:
            rec = "NURTURE"
            sla = "48 Hour SLA (Automated Drip Sequence)"
        else:
            rec = "DISQUALIFY"
            sla = "No Sales Contact (Auto-Archive)"

        scored_leads.append({
            "rank": idx + 1,
            "lead_id": row.get('lead_id') or f"L-{1000 + idx}",
            "name": name,
            "company": company,
            "email": email,
            "domain": domain,
            "title_raw": title,
            "title_label": title_label,
            "budget_fmt": budget_fmt,
            "budget_num": budget_num,
            "estimated_arr_usd": budget_num * 12,
            "estimated_arr_fmt": f"${(budget_num * 12):,.0f} USD" if budget_num > 0 else "TBD",
            "total_score": total_score,
            "recommendation": rec,
            "sales_sla": sla,
            "intent_level": intent_level,
            "urgency": urgency,
            "pain_category": pain_cat,
            "pain_summary": pain_summary,
            "notes": notes,
            "ai_engine_used": ai_used
        })
        
    scored_leads.sort(key=lambda x: x['total_score'], reverse=True)
    for idx, l in enumerate(scored_leads):
        l['rank'] = idx + 1
        
    return {
        "status": "success",
        "processed_count": len(scored_leads),
        "leads": scored_leads
    }

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8', errors='ignore')
        
        try:
            if body.strip().startswith('{'):
                data = json.loads(body)
                csv_text = data.get('csv_text', '')
            else:
                csv_text = body
                
            result = process_triage_csv(csv_text)
            response_bytes = json.dumps(result).encode('utf-8')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(response_bytes)))
            self.end_headers()
            self.wfile.write(response_bytes)
        except Exception as e:
            err_resp = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(err_resp)))
            self.end_headers()
            self.wfile.write(err_resp)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
