from __future__ import annotations
import threading
import time
from datetime import datetime
from typing import Optional, List, Dict
import flet as ft

from core.cipher_engine import generate_encrypted_text, generate_decoding_text, generate_dots_display
from ui.theme import (
    FONT_FAMILY, CYAN_PRIMARY, CYAN_ACCENT, CYAN_DIM, CYAN_DARK,
    SCREEN_BG, SCREEN_BORDER, CARD_BG, CARD_BORDER,
    AMBER_ACCENT, TEXT_MUTED, TEXT_PRIMARY, TEXT_WARN, TEXT_SUCCESS
)

STATE_IDLE = "IDLE"
STATE_BEEPING = "BEEPING"
STATE_DECODING = "DECODING"
STATE_REVEALED = "REVEALED"
STATE_CLEAR = "CLEAR"
STATE_COMPLETE = "COMPLETE"

class PagerView:
    """고급 사이버펑크 림버스 단테 삐삐 메인 터미널 뷰"""
    def __init__(self, page: ft.Page, audio_manager, messages: list[dict], on_open_settings_callback, on_sync_callback):
        self.page = page
        self.audio_manager = audio_manager
        self.messages = messages
        self.on_open_settings = on_open_settings_callback
        self.on_sync = on_sync_callback

        # 상태 관리
        self.state = STATE_IDLE
        self.current_stage_idx = 0
        self.current_msg_idx = 0
        self.anim_thread = None
        self.stop_anim = False

        # --- 상단 시계 & 실시간 상태 ---
        self.clock_text = ft.Text(
            datetime.now().strftime("%H:%M:%S KST"),
            size=13,
            color=AMBER_ACCENT,
            weight=ft.FontWeight.BOLD,
            font_family=FONT_FAMILY
        )

        # 1. 삐삐 스크린 헤더 배지들
        self.stage_badge = ft.Container(
            content=ft.Text("STAGE 1 / 3", size=11, color=CYAN_PRIMARY, weight=ft.FontWeight.BOLD, font_family=FONT_FAMILY),
            bgcolor="#0b1a26",
            border=ft.border.all(1, CYAN_DIM),
            border_radius=4,
            padding=ft.padding.symmetric(horizontal=8, vertical=3),
        )

        self.msg_badge = ft.Container(
            content=ft.Text("MSG 1 / 1", size=11, color=TEXT_PRIMARY, font_family=FONT_FAMILY),
            bgcolor="#0d141c",
            border=ft.border.all(1, CARD_BORDER),
            border_radius=4,
            padding=ft.padding.symmetric(horizontal=8, vertical=3),
        )

        self.status_badge = ft.Container(
            content=ft.Text("● READY", size=11, color=ft.Colors.BLACK, weight=ft.FontWeight.BOLD, font_family=FONT_FAMILY),
            bgcolor=CYAN_PRIMARY,
            padding=ft.padding.symmetric(horizontal=10, vertical=3),
            border_radius=4,
        )

        # 2. 메인 스크린 텍스트 컨트롤
        self.dots_text = ft.Text(
            "",
            size=22,
            color=AMBER_ACCENT,
            weight=ft.FontWeight.BOLD,
            font_family=FONT_FAMILY,
            text_align=ft.TextAlign.CENTER,
        )

        self.main_display_text = ft.Text(
            "SPACE 를 눌러 시작",
            size=34,
            color=CYAN_PRIMARY,
            weight=ft.FontWeight.BOLD,
            font_family=FONT_FAMILY,
            text_align=ft.TextAlign.CENTER,
            selectable=True,
        )

        self.time_info_card = ft.Container(
            content=ft.Row([
                ft.Icon(ft.Icons.ACCESS_TIME, size=15, color=AMBER_ACCENT),
                ft.Text("[ 단테 삐삐 대기 중 ]", size=14, color=TEXT_PRIMARY, font_family=FONT_FAMILY),
            ], alignment=ft.MainAxisAlignment.CENTER, spacing=6),
            bgcolor="#0a121a",
            border=ft.border.all(1, CARD_BORDER),
            border_radius=20,
            padding=ft.padding.symmetric(horizontal=16, vertical=6),
        )

        # 3. 터미널 스크린 박스 (네온 CRT 베젤)
        self.screen_box = ft.Container(
            bgcolor=SCREEN_BG,
            border=ft.border.all(2, CYAN_DIM),
            border_radius=10,
            padding=ft.padding.all(20),
            shadow=ft.BoxShadow(
                spread_radius=1,
                blur_radius=12,
                color="#1000e5ff",
            ),
            content=ft.Column(
                [
                    # 스크린 상단 상태바
                    ft.Row(
                        [
                            ft.Row([
                                ft.Icon(ft.Icons.RADIO_BUTTON_CHECKED, size=12, color=CYAN_ACCENT),
                                ft.Text("PDA TERMINAL", size=11, color=CYAN_ACCENT, weight=ft.FontWeight.BOLD, font_family=FONT_FAMILY),
                            ], spacing=6),
                            ft.Row([self.stage_badge, self.msg_badge, self.status_badge], spacing=6),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                    ft.Divider(color=CYAN_DARK, height=16),
                    # 중앙 텍스트 복호화 디스플레이 영역
                    ft.Container(
                        content=ft.Column(
                            [
                                self.dots_text,
                                self.main_display_text,
                                ft.Container(height=6),
                                self.time_info_card,
                            ],
                            alignment=ft.MainAxisAlignment.CENTER,
                            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                            spacing=8,
                        ),
                        alignment=ft.alignment.center,
                        expand=True,
                    ),
                    ft.Divider(color=CYAN_DARK, height=16),
                    # 스크린 하단 시스템 라벨
                    ft.Row(
                        [
                            ft.Text("SYSTEM: L.C.B. DANTE CORE v2.0", size=10, color=CYAN_DIM, font_family=FONT_FAMILY),
                            ft.Text("ENCRYPTION: 256-BIT QUANTUM CIPHER", size=10, color=CYAN_DIM, font_family=FONT_FAMILY),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                ],
                expand=True,
            ),
            expand=True,
        )

        # 4. 하단 컨트롤 버튼
        self.next_btn = ft.ElevatedButton(
            text="다음 진행 (SPACE)",
            icon=ft.Icons.PLAY_ARROW,
            style=ft.ButtonStyle(
                color=ft.Colors.BLACK,
                bgcolor=CYAN_PRIMARY,
                text_style=ft.TextStyle(font_family=FONT_FAMILY, weight=ft.FontWeight.BOLD, size=14),
                padding=ft.padding.symmetric(horizontal=24, vertical=16),
                shape=ft.RoundedRectangleBorder(radius=8),
            ),
            on_click=lambda e: self.advance(),
        )

        self.replay_btn = ft.OutlinedButton(
            text="다시 재생 (R)",
            icon=ft.Icons.REPLAY,
            style=ft.ButtonStyle(
                color=CYAN_PRIMARY,
                side=ft.BorderSide(1, CYAN_DIM),
                text_style=ft.TextStyle(font_family=FONT_FAMILY, size=13),
                padding=ft.padding.symmetric(horizontal=16, vertical=16),
                shape=ft.RoundedRectangleBorder(radius=8),
            ),
            on_click=lambda e: self.replay(),
        )

        self.sync_btn = ft.ElevatedButton(
            text="캘린더 동기화",
            icon=ft.Icons.SYNC,
            style=ft.ButtonStyle(
                color=ft.Colors.BLACK,
                bgcolor=AMBER_ACCENT,
                text_style=ft.TextStyle(font_family=FONT_FAMILY, size=13, weight=ft.FontWeight.BOLD),
                padding=ft.padding.symmetric(horizontal=14, vertical=10),
                shape=ft.RoundedRectangleBorder(radius=6),
            ),
            on_click=lambda e: self.on_sync(),
        )

        self.settings_btn = ft.IconButton(
            icon=ft.Icons.SETTINGS,
            icon_color=TEXT_PRIMARY,
            tooltip="환경 설정 (S)",
            on_click=lambda e: self.on_open_settings(),
        )

        # 5. 우측 분할 일정 타임라인 패널
        self.timeline_list = ft.ListView(
            spacing=8,
            padding=ft.padding.symmetric(vertical=6),
            expand=True,
        )

        self.timeline_stats_text = ft.Text("오늘 총 0개 일정", size=11, color=TEXT_MUTED, font_family=FONT_FAMILY)

        self.timeline_card = ft.Container(
            bgcolor=CARD_BG,
            border=ft.border.all(1, CARD_BORDER),
            border_radius=10,
            padding=ft.padding.all(16),
            content=ft.Column(
                [
                    ft.Row([
                        ft.Row([
                            ft.Icon(ft.Icons.EVENT_NOTE, color=AMBER_ACCENT, size=18),
                            ft.Text("오늘의 3-Stage 분할 일정", size=13, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY, font_family=FONT_FAMILY),
                        ], spacing=6),
                        self.timeline_stats_text,
                    ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                    ft.Divider(color=CARD_BORDER, height=12),
                    self.timeline_list,
                ],
                expand=True,
            ),
            expand=True,
        )

        self.refresh_timeline()
        self._start_clock_timer()

    def _start_clock_timer(self):
        def clock_loop():
            while True:
                time.sleep(1)
                self.clock_text.value = datetime.now().strftime("%H:%M:%S KST")
                try:
                    self.page.update()
                except Exception:
                    pass
        threading.Thread(target=clock_loop, daemon=True).start()

    def get_current_stage(self) -> dict | None:
        if 0 <= self.current_stage_idx < len(self.messages):
            return self.messages[self.current_stage_idx]
        return None

    def get_current_message(self) -> dict | None:
        stage = self.get_current_stage()
        if not stage:
            return None
        msgs = stage.get("messages", [])
        if 0 <= self.current_msg_idx < len(msgs):
            return msgs[self.current_msg_idx]
        return None

    def update_messages(self, new_messages: list[dict]):
        """새 캘린더 메시지 반영"""
        self.messages = new_messages
        self.current_stage_idx = 0
        self.current_msg_idx = 0
        self.state = STATE_IDLE
        self.refresh_timeline()
        self._update_display_idle()

    def refresh_timeline(self):
        """타임라인 카드 목록 갱신"""
        self.timeline_list.controls.clear()
        if not self.messages:
            self.timeline_list.controls.append(
                ft.Container(
                    padding=20,
                    alignment=ft.alignment.center,
                    content=ft.Text("등록된 일정이 없습니다.\n설정(S)에서 캘린더를 연동하세요.", size=12, color=TEXT_MUTED, font_family=FONT_FAMILY, text_align=ft.TextAlign.CENTER)
                )
            )
            self.timeline_stats_text.value = "오늘 0개 일정"
            return

        total_event_count = sum(len(s.get("messages", [])) for s in self.messages)
        self.timeline_stats_text.value = f"총 {total_event_count}개 일정 동기화됨"

        for s_idx, stage in enumerate(self.messages):
            stage_num = stage.get("stage", s_idx + 1)
            is_active_stage = (s_idx == self.current_stage_idx)
            
            stage_badge = ft.Container(
                content=ft.Text(
                    f"STAGE {stage_num}",
                    size=11,
                    weight=ft.FontWeight.BOLD,
                    color=CYAN_PRIMARY if is_active_stage else TEXT_MUTED,
                    font_family=FONT_FAMILY,
                ),
                bgcolor="#00354d" if is_active_stage else "#0c131a",
                border=ft.border.all(1, CYAN_DIM if is_active_stage else CARD_BORDER),
                padding=ft.padding.symmetric(horizontal=8, vertical=2),
                border_radius=4,
            )
            
            msg_items = []
            for m_idx, msg in enumerate(stage.get("messages", [])):
                is_active_msg = is_active_stage and (m_idx == self.current_msg_idx)
                msg_text = msg.get("text", "")
                time_str = msg.get("time_info", "")
                
                msg_items.append(
                    ft.Container(
                        padding=ft.padding.symmetric(horizontal=10, vertical=6),
                        border_radius=6,
                        bgcolor="#10202e" if is_active_msg else ft.Colors.TRANSPARENT,
                        border=ft.border.all(1, CYAN_DIM if is_active_msg else ft.Colors.TRANSPARENT),
                        content=ft.Row(
                            [
                                ft.Icon(
                                    ft.Icons.RADIO_BUTTON_CHECKED if is_active_msg else ft.Icons.RADIO_BUTTON_UNCHECKED,
                                    size=12,
                                    color=AMBER_ACCENT if is_active_msg else TEXT_MUTED
                                ),
                                ft.Text(
                                    msg_text,
                                    size=12,
                                    color=TEXT_PRIMARY if is_active_msg else TEXT_MUTED,
                                    weight=ft.FontWeight.BOLD if is_active_msg else ft.FontWeight.NORMAL,
                                    font_family=FONT_FAMILY,
                                    expand=True,
                                    no_wrap=True,
                                    overflow=ft.TextOverflow.ELLIPSIS,
                                ),
                                ft.Container(
                                    content=ft.Text(time_str, size=10, color=AMBER_ACCENT if is_active_msg else TEXT_MUTED, font_family=FONT_FAMILY),
                                    bgcolor="#0a121a" if is_active_msg else ft.Colors.TRANSPARENT,
                                    padding=ft.padding.symmetric(horizontal=6, vertical=2),
                                    border_radius=4,
                                ),
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        )
                    )
                )

            self.timeline_list.controls.append(
                ft.Container(
                    padding=8,
                    border_radius=8,
                    bgcolor="#080e14",
                    border=ft.border.all(1, CYAN_DARK if is_active_stage else CARD_BORDER),
                    content=ft.Column([
                        ft.Row([stage_badge], alignment=ft.MainAxisAlignment.START),
                        ft.Column(msg_items, spacing=2),
                    ], spacing=6)
                )
            )
        try:
            self.page.update()
        except Exception:
            pass

    def _update_badges(self):
        total_stages = len(self.messages) if self.messages else 1
        current_s = min(self.current_stage_idx + 1, total_stages)
        stage_data = self.get_current_stage()
        total_msgs = len(stage_data.get("messages", [])) if stage_data else 1
        current_m = min(self.current_msg_idx + 1, total_msgs)

        self.stage_badge.content.value = f"STAGE {current_s} / {total_stages}"
        self.msg_badge.content.value = f"MSG {current_m} / {total_msgs}"
        
        status_colors = {
            STATE_IDLE: (CYAN_PRIMARY, ft.Colors.BLACK, "● IDLE"),
            STATE_BEEPING: (AMBER_ACCENT, ft.Colors.BLACK, "🔊 BEEPING"),
            STATE_DECODING: (CYAN_ACCENT, ft.Colors.BLACK, "⚡ DECODING"),
            STATE_REVEALED: (TEXT_SUCCESS, ft.Colors.BLACK, "✓ REVEALED"),
            STATE_CLEAR: (AMBER_ACCENT, ft.Colors.BLACK, "★ CLEAR"),
            STATE_COMPLETE: (TEXT_SUCCESS, ft.Colors.BLACK, "🏆 COMPLETE"),
        }
        bg, fg, label = status_colors.get(self.state, (CYAN_PRIMARY, ft.Colors.BLACK, "● READY"))
        self.status_badge.bgcolor = bg
        self.status_badge.content.value = label
        self.status_badge.content.color = fg

    def _update_display_idle(self):
        self.state = STATE_IDLE
        self._update_badges()
        self.dots_text.value = ""
        self.main_display_text.value = "SPACE 를 눌러 시작"
        self.main_display_text.color = CYAN_PRIMARY
        self.time_info_card.content.controls[1].value = "[ 단테 삐삐 대기 중 ]"
        self.refresh_timeline()
        self.page.update()

    def advance(self):
        """다음 단계로 진행 (스페이스바 또는 버튼)"""
        if self.state == STATE_IDLE:
            if self.get_current_stage():
                self.current_msg_idx = 0
                self.start_beeping()
        elif self.state == STATE_BEEPING:
            # 비프 스킵 -> 디코딩 즉시 진행
            self.stop_anim = True
            self.start_decoding()
        elif self.state == STATE_DECODING:
            # 디코딩 스킵 -> 즉시 표시
            self.stop_anim = True
            self.start_revealed()
        elif self.state == STATE_REVEALED:
            # 다음 메시지 또는 CLEAR 단계로
            stage = self.get_current_stage()
            msgs = stage.get("messages", []) if stage else []
            if self.current_msg_idx + 1 < len(msgs):
                self.current_msg_idx += 1
                self.start_beeping()
            else:
                self.start_clear()
        elif self.state == STATE_CLEAR:
            self.current_stage_idx += 1
            self.current_msg_idx = 0
            if self.current_stage_idx >= len(self.messages):
                self.start_complete()
            else:
                self._update_display_idle()
        elif self.state == STATE_COMPLETE:
            # 처음부터 다시 시작
            self.current_stage_idx = 0
            self.current_msg_idx = 0
            self._update_display_idle()

    def replay(self):
        """현재 단계 다시 재생 (R)"""
        self.stop_anim = True
        self.start_beeping()

    def start_beeping(self):
        """비프음 재생 및 암호화 텍스트 출력"""
        self.stop_anim = True
        self.state = STATE_BEEPING
        self._update_badges()
        self.refresh_timeline()

        # 오디오 재생
        self.audio_manager.play_beep()

        cipher_sample = generate_encrypted_text()
        self.main_display_text.value = cipher_sample
        self.main_display_text.color = CYAN_DIM
        self.time_info_card.content.controls[1].value = "신호 수신 중 (RECEIVING)..."
        self.dots_text.value = "• ◦ ◦"
        self.page.update()

        # 백그라운드 타이머 스레드로 Dot 점진적 표시 후 자동 디코딩 전환
        self.stop_anim = False
        def beep_loop():
            start_t = time.time()
            while time.time() - start_t < 1.1:
                if self.stop_anim:
                    return
                elapsed = time.time() - start_t
                dot_str = generate_dots_display(3, elapsed)
                self.dots_text.value = dot_str
                self.main_display_text.value = generate_encrypted_text(len(cipher_sample))
                try:
                    self.page.update()
                except Exception:
                    pass
                time.sleep(0.08)
            if not self.stop_anim:
                self.start_decoding()

        self.anim_thread = threading.Thread(target=beep_loop, daemon=True)
        self.anim_thread.start()

    def start_decoding(self):
        """복호화 글리치 애니메이션 진행"""
        self.stop_anim = True
        self.state = STATE_DECODING
        self._update_badges()

        msg = self.get_current_message()
        if not msg:
            self._update_display_idle()
            return

        target_text = msg.get("text", "")
        self.dots_text.value = "• • • [ DECODING ]"
        self.time_info_card.content.controls[1].value = "데이터 복호화 진행 중..."
        self.page.update()

        self.stop_anim = False
        def decode_loop():
            steps = 15
            for i in range(steps + 1):
                if self.stop_anim:
                    return
                progress = i / float(steps)
                current_frame = generate_decoding_text(target_text, progress)
                self.main_display_text.value = current_frame
                self.main_display_text.color = CYAN_PRIMARY if progress > 0.6 else CYAN_DIM
                try:
                    self.page.update()
                except Exception:
                    pass
                time.sleep(0.06)
            if not self.stop_anim:
                self.start_revealed()

        self.anim_thread = threading.Thread(target=decode_loop, daemon=True)
        self.anim_thread.start()

    def start_revealed(self):
        """복호화 완료 메시지 출력"""
        self.stop_anim = True
        self.state = STATE_REVEALED
        self._update_badges()
        
        msg = self.get_current_message()
        if msg:
            self.dots_text.value = "✓ REVEALED"
            self.main_display_text.value = msg.get("text", "")
            self.main_display_text.color = CYAN_ACCENT
            time_info = msg.get("time_info", "")
            self.time_info_card.content.controls[1].value = f"{time_info}" if time_info else "일정 시간 정보 없음"
        self.refresh_timeline()
        self.page.update()

    def start_clear(self):
        """단계 완료 (_CLEAR._)"""
        self.stop_anim = True
        self.state = STATE_CLEAR
        self._update_badges()
        self.dots_text.value = ""
        self.main_display_text.value = "_CLEAR._"
        self.main_display_text.color = AMBER_ACCENT
        self.time_info_card.content.controls[1].value = "SPACE: 다음 STAGE로 진입"
        self.refresh_timeline()
        self.page.update()

    def start_complete(self):
        """전체 단계 완료"""
        self.stop_anim = True
        self.state = STATE_COMPLETE
        self._update_badges()
        self.dots_text.value = "★ MISSION ALL CLEAR ★"
        self.main_display_text.value = "모든 일정 확인 완료"
        self.main_display_text.color = TEXT_SUCCESS
        self.time_info_card.content.controls[1].value = "오늘 하루도 수고하셨습니다. (SPACE: 처음으로)"
        self.refresh_timeline()
        self.page.update()

    def get_layout(self) -> ft.Control:
        """반응형 레이아웃 반환 (12분할 Flexbox 그리드)"""
        # 상단 네비게이션 헤더
        header = ft.Container(
            bgcolor=CARD_BG,
            border=ft.border.all(1, CARD_BORDER),
            border_radius=10,
            padding=ft.padding.symmetric(horizontal=18, vertical=12),
            content=ft.Row(
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                controls=[
                    ft.Row([
                        ft.Icon(ft.Icons.WATCH_LATER, size=24, color=AMBER_ACCENT),
                        ft.Text("LIMBUS BEEP", size=20, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                        ft.Container(
                            content=ft.Text("v2.0", size=10, color=ft.Colors.BLACK, weight=ft.FontWeight.BOLD, font_family=FONT_FAMILY),
                            bgcolor=AMBER_ACCENT,
                            padding=ft.padding.symmetric(horizontal=6, vertical=2),
                            border_radius=4,
                        ),
                    ], spacing=8),
                    ft.Row([
                        self.clock_text,
                        ft.Container(width=10),
                        self.sync_btn,
                        self.settings_btn,
                    ], spacing=8),
                ],
            )
        )

        # 하단 컨트롤 바
        control_bar = ft.Container(
            bgcolor=CARD_BG,
            border=ft.border.all(1, CARD_BORDER),
            border_radius=10,
            padding=ft.padding.symmetric(horizontal=16, vertical=12),
            content=ft.Row(
                [
                    self.replay_btn,
                    self.next_btn,
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            )
        )

        left_panel = ft.Column(
            [
                self.screen_box,
                control_bar,
            ],
            spacing=12,
            expand=True,
        )

        # ResponsiveRow: 화면 너비에 따라 좌우 분할(md=7/5) 또는 상하 분할(sm=12)
        responsive_content = ft.ResponsiveRow(
            controls=[
                ft.Container(left_panel, col={"sm": 12, "md": 7, "lg": 7}, expand=True),
                ft.Container(self.timeline_card, col={"sm": 12, "md": 5, "lg": 5}, expand=True),
            ],
            expand=True,
        )

        return ft.Column(
            [
                header,
                responsive_content,
            ],
            expand=True,
            spacing=12,
        )
