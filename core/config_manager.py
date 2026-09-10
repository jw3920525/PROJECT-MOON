from __future__ import annotations
import json
import os
import sys

def get_base_dir() -> str:
    """애플리케이션 기본 실행 경로 반환"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

BASE_DIR = get_base_dir()
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
MESSAGES_FILE = os.path.join(BASE_DIR, "messages.json")

DEFAULT_CONFIG = {
    "volume": 80,
    "auto_start": True,
    "theme_mode": "dark",
    "ics_url": "",
    "auto_sync": True,
    "sync_interval_min": 60,
    "beep_interval_sec": 1.5,
    "accent_color": "cyan",
}

def load_config() -> dict:
    """설정 파일(config.json) 로드"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {**DEFAULT_CONFIG, **data}
        except Exception as e:
            print(f"설정 로드 실패, 기본값 사용: {e}")
            return DEFAULT_CONFIG.copy()
    return DEFAULT_CONFIG.copy()

def save_config(config: dict) -> bool:
    """설정 파일(config.json) 저장"""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"설정 저장 실패: {e}")
        return False

def get_setting(key: str, default=None):
    """단일 설정값 조회"""
    config = load_config()
    return config.get(key, default)

def set_setting(key: str, value) -> bool:
    """단일 설정값 변경 및 저장"""
    config = load_config()
    config[key] = value
    return save_config(config)
