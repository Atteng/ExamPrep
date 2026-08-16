#!/usr/bin/env python3
"""
Vercel Python Serverless Endpoint: /api/triage
Processes uploaded raw CSV files via the 3-Stage Lead Triage Engine.
"""

import json
import re
import os
import sys
import io
import csv
from http.server import BaseHTTPRequestHandler

# Import triage engine functions if available in same directory
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

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
    cleaned = re.sub(r'[^0-9.]', '', str(val_str))
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0

def process_triage_csv(csv_text):
    f = io.StringIO(csv_text)
    reader = csv.DictReader(f)
    rows = list(reader)
    
    scored_leads = []
    
    for idx, r in enumerate(rows):
        # Normalize header lookup
        row = {k.strip().lower().replace(' ', '_'): v for k, v in r.items() if k}
        
        email = clean_str(row.get('email') or row.get('contact_email') or '')
        domain = email.split('@')[1].lower() if '@' in email else ''
        is_corp = domain and domain not in FREE_EMAIL_DOMAINS
        
        name = clean_str(row.get('full_name') or row.get('name') or f"Prospect {idx+1}")
        company = clean_str(row.get('company') or row.get('organization') or (domain.split('.')[0] if domain else '—'))
        title = clean_str(row.get('job_title') or row.get('title') or 'Decision Maker')
        notes = clean_str(row.get('notes') or row.get('message') or row.get('pain') or '')
        
        budget_num = parse_budget(row.get('monthly_budget') or row.get('budget'))
        budget_fmt = f"${budget_num:,.0f}" if budget_num > 0 else "TBD"
        
        title_lower = title.lower()
        notes_lower = notes.lower()
        
        title_pts = 25
        title_label = "Ops Leader (Tier 2)"
        if any(k in title_lower for k in ['ceo', 'owner', 'founder', 'director', 'vp', 'chief', 'president']):
            title_pts = 30
            title_label = "Executive Buyer (Tier 1)"
        elif any(k in title_lower for k in ['manager', 'lead', 'head']):
            title_pts = 20
            title_label = "Manager / Team Lead"
            
        budget_pts = 15
        if budget_num >= 10000:
            budget_pts = 25
        elif budget_num >= 5000:
            budget_pts = 20
            
        intent_pts = 25
        rec = "CONTACT NOW"
        
        is_disqualified = (
            any(k in title_lower for k in ['student', 'intern', 'job seeker']) or
            any(k in notes_lower for k in ['career', 'hiring', 'internship', 'looking for a job'])
        )
        
        if is_disqualified:
            rec = "DISQUALIFY"
            title_label = "Non-Buyer / Job Seeker"
            intent_pts = 0
            title_pts = 0
            budget_pts = 0
        elif budget_num < 2000 and title_pts < 25:
            rec = "NURTURE"
            
        total_score = min(100, title_pts + budget_pts + intent_pts + (10 if is_corp else 5) + 10)
        if rec == "DISQUALIFY":
            total_score = min(30, total_score)
            
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
            "estimated_arr_fmt": f"${(budget_num * 12):,.0f}",
            "total_score": total_score,
            "recommendation": rec,
            "sales_sla": "< 1 Hour SLA" if rec == "CONTACT NOW" else ("24 Hour SLA" if rec == "NURTURE" else "N/A"),
            "intent_level": "HIGH" if rec == "CONTACT NOW" else ("MEDIUM" if rec == "NURTURE" else "LOW"),
            "urgency": "IMMEDIATE",
            "pain_category": "OTHER",
            "pain_summary": notes[:70] if notes else "Custom Projects",
            "notes": notes
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
            # If JSON wrapped
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
