from __future__ import annotations
import flet as ft
from ui.theme import (
    FONT_FAMILY, CYAN_PRIMARY, CYAN_ACCENT, CYAN_DIM, CYAN_DARK,
    CARD_BG, CARD_BORDER, SCREEN_BG, AMBER_ACCENT, TEXT_MUTED, TEXT_PRIMARY, TEXT_SUCCESS
)

class SettingsDialog:
    """단테 삐삐 사이버펑크 탭 기반 환경설정 모달"""
    def __init__(self, page: ft.Page, initial_config: dict, on_save_callback, on_test_beep_callback, on_sync_callback):
        self.page = page
        self.config = initial_config.copy()
        self.on_save = on_save_callback
        self.on_test_beep = on_test_beep_callback
        self.on_sync = on_sync_callback

        self.current_tab = 0  # 0: iCal, 1: Google OAuth, 2: 일반/볼륨

        # ── 탭 1: iCal 연동 컨트롤 ──
        self.ics_input = ft.TextField(
            label="Google Calendar 비공개 iCal(ICS) 주소",
            value=self.config.get("ics_url", ""),
            hint_text="https://calendar.google.com/calendar/ical/.../basic.ics",
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            text_size=12,
            dense=True,
            expand=True,
        )

        self.sync_button = ft.ElevatedButton(
            text="즉시 동기화",
            icon=ft.Icons.SYNC,
            style=ft.ButtonStyle(
                color=ft.Colors.BLACK,
                bgcolor=AMBER_ACCENT,
                text_style=ft.TextStyle(font_family=FONT_FAMILY, size=12, weight=ft.FontWeight.BOLD),
            ),
            on_click=self._handle_sync_click,
        )

        # ── 탭 2: Google OAuth 컨트롤 ──
        self.client_id_input = ft.TextField(
            label="Google OAuth Client ID",
            value=self.config.get("google_client_id", ""),
            hint_text="xxxxx.apps.googleusercontent.com",
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            text_size=12,
            dense=True,
        )
        self.client_secret_input = ft.TextField(
            label="Google OAuth Client Secret",
            value=self.config.get("google_client_secret", ""),
            password=True,
            can_reveal_password=True,
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            text_size=12,
            dense=True,
        )

        # ── 탭 3: 볼륨 및 자동화 컨트롤 ──
        current_volume = self.config.get("volume", 80)
        self.volume_label = ft.Text(f"{current_volume}%", size=13, color=CYAN_PRIMARY, font_family=FONT_FAMILY)
        self.volume_slider = ft.Slider(
            min=0, max=100, divisions=20,
            value=current_volume,
            active_color=CYAN_PRIMARY,
            inactive_color=CYAN_DIM,
            on_change=self._handle_volume_change,
            expand=True,
        )
        self.test_beep_btn = ft.ElevatedButton(
            text="소리 테스트",
            icon=ft.Icons.VOLUME_UP,
            style=ft.ButtonStyle(
                color=ft.Colors.BLACK,
                bgcolor=CYAN_PRIMARY,
                text_style=ft.TextStyle(font_family=FONT_FAMILY, size=12),
            ),
            on_click=lambda e: self.on_test_beep(int(self.volume_slider.value)),
        )

        self.auto_sync_switch = ft.Switch(
            label="주기적 자동 캘린더 동기화",
            value=self.config.get("auto_sync", True),
            active_color=CYAN_PRIMARY,
        )

        self.interval_dropdown = ft.Dropdown(
            label="동기화 주기",
            width=140,
            options=[
                ft.dropdown.Option("10", "10분마다"),
                ft.dropdown.Option("30", "30분마다"),
                ft.dropdown.Option("60", "1시간마다"),
                ft.dropdown.Option("120", "2시간마다"),
            ],
            value=str(self.config.get("sync_interval_min", 60)),
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            dense=True,
        )

        # 탭 네비게이션 버튼 3개
        self.tab_btn_ical = self._create_tab_button("📅 iCal 연동", 0)
        self.tab_btn_oauth = self._create_tab_button("🔑 Google OAuth", 1)
        self.tab_btn_general = self._create_tab_button("⚙️ 일반 / 볼륨", 2)

        # 탭 본문 컨테이너
        self.tab_content_area = ft.Container(expand=True, padding=ft.padding.only(top=10))

        self.dialog = ft.AlertDialog(
            modal=True,
            bgcolor=CARD_BG,
            shape=ft.RoundedRectangleBorder(radius=10),
            title=ft.Row([
                ft.Icon(ft.Icons.SETTINGS_APPLICATIONS, color=CYAN_PRIMARY, size=24),
                ft.Text("DANTE PDA ENVIRONMENT SETTINGS", size=16, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY, font_family=FONT_FAMILY),
            ], alignment=ft.MainAxisAlignment.START),
            content=ft.Container(
                width=580,
                height=380,
                content=ft.Column(
                    [
                        # 상단 커스텀 사이버 탭 바
                        ft.Container(
                            bgcolor=SCREEN_BG,
                            border=ft.border.all(1, CARD_BORDER),
                            border_radius=8,
                            padding=4,
                            content=ft.Row(
                                [
                                    self.tab_btn_ical,
                                    self.tab_btn_oauth,
                                    self.tab_btn_general,
                                ],
                                spacing=6,
                                alignment=ft.MainAxisAlignment.SPACE_EVENLY,
                            ),
                        ),
                        self.tab_content_area,
                    ],
                    spacing=8,
                    expand=True,
                ),
            ),
            actions=[
                ft.TextButton(
                    "취소",
                    style=ft.ButtonStyle(color=TEXT_MUTED),
                    on_click=self.close
                ),
                ft.ElevatedButton(
                    "설정 저장",
                    icon=ft.Icons.SAVE,
                    style=ft.ButtonStyle(
                        color=ft.Colors.BLACK,
                        bgcolor=CYAN_PRIMARY,
                        text_style=ft.TextStyle(font_family=FONT_FAMILY, weight=ft.FontWeight.BOLD),
                    ),
                    on_click=self._handle_save_click
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )

        self._switch_tab(0)

    def _create_tab_button(self, label: str, tab_idx: int) -> ft.Container:
        return ft.Container(
            content=ft.Text(
                label,
                size=12,
                weight=ft.FontWeight.BOLD,
                font_family=FONT_FAMILY,
                text_align=ft.TextAlign.CENTER,
            ),
            padding=ft.padding.symmetric(horizontal=12, vertical=8),
            border_radius=6,
            on_click=lambda e, idx=tab_idx: self._switch_tab(idx),
            expand=True,
            alignment=ft.alignment.center,
        )

    def _switch_tab(self, tab_idx: int):
        self.current_tab = tab_idx

        # 탭 버튼 스타일 갱신
        for idx, btn in enumerate([self.tab_btn_ical, self.tab_btn_oauth, self.tab_btn_general]):
            if idx == tab_idx:
                btn.bgcolor = CYAN_PRIMARY
                btn.content.color = ft.Colors.BLACK
                btn.border = ft.border.all(1, CYAN_ACCENT)
            else:
                btn.bgcolor = ft.Colors.TRANSPARENT
                btn.content.color = TEXT_MUTED
                btn.border = None

        # 탭 컨텐츠 구성
        if tab_idx == 0:
            self.tab_content_area.content = ft.Column(
                [
                    ft.Text("📅 Google Calendar 비공개 iCal 주소 연동", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Text(
                        "Google Calendar 설정 > 캘린더 설정 > 'iCal 형식의 비공개 주소'를 복사하여 입력합니다.",
                        size=11, color=TEXT_MUTED, font_family=FONT_FAMILY
                    ),
                    ft.Row([self.ics_input, self.sync_button], alignment=ft.MainAxisAlignment.SPACE_BETWEEN, spacing=8),
                    ft.Container(
                        bgcolor=SCREEN_BG,
                        border=ft.border.all(1, CYAN_DARK),
                        padding=12,
                        border_radius=8,
                        content=ft.Column([
                            ft.Text("💡 비공개 iCal 연동의 장점", size=11, weight=ft.FontWeight.BOLD, color=AMBER_ACCENT, font_family=FONT_FAMILY),
                            ft.Text(
                                "• 복잡한 Google Cloud OAuth 콘솔 설정 없이 URL 하나로 즉시 연동됩니다.\n• 캘린더 일정 변경 시 5분~1시간 주기로 최신 일정이 자동 반영됩니다.",
                                size=11, color=TEXT_PRIMARY, font_family=FONT_FAMILY
                            ),
                        ], spacing=4),
                    ),
                ],
                spacing=12,
            )
        elif tab_idx == 1:
            self.tab_content_area.content = ft.Column(
                [
                    ft.Text("🔑 Google Cloud OAuth 2.0 직접 연동 (고급)", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Text(
                        "Google Cloud Console에서 생성한 OAuth Client ID / Secret 정보를 입력하여 계정 인증을 진행합니다.",
                        size=11, color=TEXT_MUTED, font_family=FONT_FAMILY
                    ),
                    self.client_id_input,
                    self.client_secret_input,
                    ft.Container(
                        bgcolor=SCREEN_BG,
                        border=ft.border.all(1, CYAN_DARK),
                        padding=10,
                        border_radius=6,
                        content=ft.Text(
                            "🌐 OAuth 리다이렉트 URI: http://localhost:8080\n권한 스코프: https://www.googleapis.com/auth/calendar.readonly",
                            size=10, color=CYAN_DIM, font_family=FONT_FAMILY
                        )
                    )
                ],
                spacing=10,
            )
        else:
            self.tab_content_area.content = ft.Column(
                [
                    ft.Text("🔊 삐삐 사운드 & 볼륨", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Row([
                        self.volume_slider,
                        self.volume_label,
                        self.test_beep_btn
                    ], alignment=ft.MainAxisAlignment.CENTER, spacing=10),
                    ft.Divider(color=CARD_BORDER),
                    ft.Text("⏱️ 백그라운드 자동화 주기", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Row([
                        self.auto_sync_switch,
                        self.interval_dropdown
                    ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                ],
                spacing=12,
            )

        try:
            self.page.update()
        except Exception:
            pass

    def _handle_volume_change(self, e):
        vol = int(self.volume_slider.value)
        self.volume_label.value = f"{vol}%"
        self.page.update()

    def _handle_sync_click(self, e):
        url = self.ics_input.value.strip()
        self.on_sync(url)

    def _handle_save_click(self, e):
        self.config["ics_url"] = self.ics_input.value.strip()
        self.config["google_client_id"] = self.client_id_input.value.strip()
        self.config["google_client_secret"] = self.client_secret_input.value.strip()
        self.config["volume"] = int(self.volume_slider.value)
        self.config["auto_sync"] = self.auto_sync_switch.value
        self.config["sync_interval_min"] = int(self.interval_dropdown.value or 60)
        self.on_save(self.config)
        self.close(e)

    def open(self, current_config: dict = None):
        if current_config:
            self.config = current_config.copy()
            self.ics_input.value = self.config.get("ics_url", "")
            self.client_id_input.value = self.config.get("google_client_id", "")
            self.client_secret_input.value = self.config.get("google_client_secret", "")
            self.volume_slider.value = self.config.get("volume", 80)
            self.volume_label.value = f"{int(self.volume_slider.value)}%"
            self.auto_sync_switch.value = self.config.get("auto_sync", True)
            self.interval_dropdown.value = str(self.config.get("sync_interval_min", 60))
        
        self._switch_tab(self.current_tab)
        if self.dialog not in self.page.overlay:
            self.page.overlay.append(self.dialog)
        self.dialog.open = True
        self.page.update()

    def close(self, e=None):
        self.dialog.open = False
        self.page.update()
