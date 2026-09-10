from __future__ import annotations
import json
import os
import sys
import ssl
import urllib.request
from datetime import datetime, timedelta

def load_cached_messages(filepath: str) -> list[dict]:
    """저장된 메시지 파일 로드 (구버전 호환 처리 포함)"""
    if not os.path.exists(filepath):
        return get_default_messages()
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data:
            if "messages" not in item and "message" in item:
                item["messages"] = [
                    {"text": line, "time_info": ""}
                    for line in item["message"].split("\n") if line.strip()
                ]
        data.sort(key=lambda x: x.get("stage", 1))
        return data if data else get_default_messages()
    except Exception as e:
        print(f"메시지 로드 오류: {e}")
        return get_default_messages()

def get_default_messages() -> list[dict]:
    """기본 예시 메시지 반환"""
    return [
        {
            "stage": 1,
            "messages": [
                {"text": "관리자님, 오늘의 일정을 확인하십시오.", "time_info": "INFO"},
                {"text": "캘린더 연동(설정)을 통해 구글 일정을 불러올 수 있습니다.", "time_info": "GUIDE"}
            ]
        },
        {
            "stage": 2,
            "messages": [
                {"text": "수감자들의 상태를 점검할 시간입니다.", "time_info": "SYSTEM"},
                {"text": "황금가지를 향한 여정을 계속하십시오.", "time_info": "MISSION"}
            ]
        },
        {
            "stage": 3,
            "messages": [
                {"text": "오늘 하루도 수고하셨습니다. _CLEAR._", "time_info": "COMPLETE"}
            ]
        }
    ]

def save_messages(messages: list[dict], filepath: str) -> bool:
    """메시지 파일 저장"""
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"메시지 저장 오류: {e}")
        return False

def fetch_ics_data(url: str) -> str:
    """ICS URL에서 캘린더 원본 데이터 다운로드"""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        url.strip(),
        headers={"User-Agent": "LimbusBeep/2.0"}
    )
    with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
        return response.read().decode("utf-8", errors="replace")

def _is_today_event(event: dict, today) -> bool:
    """이벤트가 오늘 날짜에 해당하는지 판정 (KST 한국 표준시 기준)"""
    dtstart = event.get("DTSTART", "")
    if not dtstart:
        return False
    try:
        if len(dtstart) == 8:
            return datetime.strptime(dtstart, "%Y%m%d").date() == today
        elif "T" in dtstart:
            dt_str = dtstart.replace("Z", "")
            event_dt = datetime.strptime(dt_str, "%Y%m%dT%H%M%S")
            if dtstart.endswith("Z"):
                event_dt = event_dt + timedelta(hours=9)
            return event_dt.date() == today
    except ValueError:
        pass
    return False

def parse_ics_events(ics_text: str) -> list[dict]:
    """ICS 포맷 텍스트 파싱하여 오늘의 이벤트 목록 추출"""
    today = datetime.now().date()
    events = []
    in_event = False
    current = {}

    for line in ics_text.replace("\r\n ", "").replace("\r\n\t", "").splitlines():
        line = line.strip()
        if line == "BEGIN:VEVENT":
            in_event = True
            current = {}
        elif line == "END:VEVENT":
            in_event = False
            if _is_today_event(current, today):
                events.append(current)
        elif in_event and ":" in line:
            key_part, _, value = line.partition(":")
            key = key_part.split(";")[0]
            current[key] = value

    events.sort(key=lambda e: e.get("DTSTART", ""))
    return events

def _format_event(event: dict) -> dict:
    """이벤트를 {text, time_info} 포맷으로 변환"""
    summary = event.get("SUMMARY", "(제목 없음)")
    dtstart = event.get("DTSTART", "")
    dtend = event.get("DTEND", "")
    time_info = ""

    try:
        if len(dtstart) == 8:
            time_info = "종일"
        elif "T" in dtstart:
            dt_str = dtstart.replace("Z", "")
            start_dt = datetime.strptime(dt_str, "%Y%m%dT%H%M%S")
            if dtstart.endswith("Z"):
                start_dt = start_dt + timedelta(hours=9)
            start_str = start_dt.strftime("%H:%M")

            if dtend and "T" in dtend:
                end_str_raw = dtend.replace("Z", "")
                end_dt = datetime.strptime(end_str_raw, "%Y%m%dT%H%M%S")
                if dtend.endswith("Z"):
                    end_dt = end_dt + timedelta(hours=9)
                end_str = end_dt.strftime("%H:%M")
                time_info = f"{start_str} - {end_str}"
            else:
                time_info = start_str
    except Exception:
        pass

    return {"text": summary, "time_info": time_info}

def events_to_stages(events: list[dict], num_stages: int = 3) -> list[dict]:
    """일정을 지정된 개수의 단계(기본 3단계)로 균등 분배"""
    if not events:
        return [
            {
                "stage": 1,
                "messages": [{"text": "오늘 등록된 일정이 없습니다.", "time_info": "오늘"}]
            }
        ]

    formatted = [_format_event(e) for e in events]
    base, extra = divmod(len(formatted), num_stages)
    stages = []
    idx = 0
    for s in range(num_stages):
        count = base + (1 if s < extra else 0)
        if count == 0:
            continue
        chunk = formatted[idx : idx + count]
        stages.append({
            "stage": s + 1,
            "messages": chunk
        })
        idx += count

    return stages

def sync_calendar(url: str, save_path: str) -> tuple[bool, str, list[dict]]:
    """캘린더 동기화 실행 함수"""
    if not url or len(url.strip()) < 10:
        return False, "유효한 Google Calendar 비공개 ICS URL을 입력해주세요.", []

    try:
        ics_text = fetch_ics_data(url)
        events = parse_ics_events(ics_text)
        stages = events_to_stages(events)
        save_messages(stages, save_path)
        return True, f"동기화 완료: 오늘 일정 {len(events)}개를 {len(stages)}단계로 반영했습니다.", stages
    except Exception as e:
        return False, f"동기화 실패: {str(e)}", []
