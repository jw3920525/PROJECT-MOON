from __future__ import annotations
"""
Google Calendar API (OAuth 2.0) 연동 모듈
==========================================
Google Cloud Console OAuth 2.0 클라이언트 정보를 통해
직접 Google Calendar API v3에서 오늘의 일정을 조회합니다.
"""

import os
import json
import urllib.parse
import urllib.request
import ssl
from datetime import datetime, time as dtime, timedelta
from core.config_manager import BASE_DIR, load_config, save_config

TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_API_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
SCOPES = "https://www.googleapis.com/auth/calendar.readonly"

def get_auth_url(client_id: str, redirect_uri: str = "http://localhost:8080") -> str:
    """OAuth 2.0 인증 요청 URL 생성"""
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

def exchange_code_for_token(code: str, client_id: str, client_secret: str, redirect_uri: str = "http://localhost:8080") -> dict:
    """인증 코드를 Access Token / Refresh Token으로 교환"""
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode("utf-8")

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(GOOGLE_TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        tokens = json.loads(resp.read().decode("utf-8"))
        save_tokens(tokens)
        return tokens

def save_tokens(tokens: dict):
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(tokens, f, indent=4)

def load_tokens() -> dict:
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> dict:
    """Refresh Token으로 새 Access Token 발급"""
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(GOOGLE_TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        tokens = json.loads(resp.read().decode("utf-8"))
        # refresh_token 유지
        current = load_tokens()
        current.update(tokens)
        save_tokens(current)
        return current

def fetch_today_events_api(access_token: str) -> list[dict]:
    """Google Calendar API v3를 호출하여 오늘 일정 가져오기"""
    today = datetime.now().date()
    # KST 기준 오늘 시작과 끝
    start_dt = datetime.combine(today, dtime.min) - timedelta(hours=9)
    end_dt = datetime.combine(today, dtime.max) - timedelta(hours=9)

    params = {
        "timeMin": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timeMax": end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "singleEvents": "true",
        "orderBy": "startTime",
    }
    url = f"{CALENDAR_API_URL}?{urllib.parse.urlencode(params)}"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {access_token}")

    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        items = data.get("items", [])
        
        events = []
        for item in items:
            summary = item.get("summary", "(제목 없음)")
            start = item.get("start", {})
            end = item.get("end", {})
            
            time_str = "종일"
            if "dateTime" in start:
                try:
                    s_dt = datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00"))
                    e_dt = datetime.fromisoformat(end["dateTime"].replace("Z", "+00:00"))
                    time_str = f"{s_dt.strftime('%H:%M')} - {e_dt.strftime('%H:%M')}"
                except Exception:
                    pass

            events.append({"text": summary, "time_info": time_str})
        return events
