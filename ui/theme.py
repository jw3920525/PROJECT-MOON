from __future__ import annotations
import flet as ft

# 림버스 컴퍼니 단테 삐삐 테마 컬러
BG_MAIN = "#06090e"
CARD_BG = "#0c131a"
CARD_BORDER = "#1b2938"
SCREEN_BG = "#040608"
SCREEN_BORDER = "#00e5ff"

CYAN_PRIMARY = "#00e5ff"
CYAN_ACCENT = "#18ffff"
CYAN_DIM = "#005577"
CYAN_DARK = "#002b3d"

AMBER_ACCENT = "#ff9800"
AMBER_DIM = "#b26a00"

TEXT_PRIMARY = "#e0f7fa"
TEXT_MUTED = "#607d8b"
TEXT_WARN = "#ffab40"
TEXT_SUCCESS = "#00e676"
TEXT_DANGER = "#ff5252"

FONT_FAMILY = "NeoDGM"

def apply_app_theme(page: ft.Page):
    """Flet 페이지 전체 테마, 윈도우 크기 및 폰트 설정"""
    page.title = "Limbus Beep - Pager Simulator"
    page.bgcolor = BG_MAIN
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 16
    
    # 데스크톱 윈도우 기본 및 최소 해상도 설정
    page.window.width = 1040
    page.window.height = 680
    page.window.min_width = 720
    page.window.min_height = 500
    
    # 폰트 등록
    page.fonts = {
        FONT_FAMILY: "assets/neodgm.ttf"
    }
    page.theme = ft.Theme(
        font_family=FONT_FAMILY,
        color_scheme_seed=CYAN_PRIMARY
    )
