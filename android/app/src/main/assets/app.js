/**
 * Limbus Beep - 단테 삐삐 시뮬레이터 v2.1.0
 */

// ── 상태 정의 ──
const STATE = {
  IDLE: 'IDLE',
  BEEPING: 'BEEPING',
  DECODING: 'DECODING',
  REVEALED: 'REVEALED',
  CLEAR: 'CLEAR',
  COMPLETE: 'COMPLETE'
};

const CIPHER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+-=?<>";

// ── 기본 설정 및 초기 메시지 ──
const DEFAULT_CONFIG = {
  volume: 80,
  orientation: 'landscape', // landscape | portrait | sensor (가로 모드 기본)
  ics_url: '',
  auto_sync_min: 60,
  decode_speed: 'normal',   // fast: 0.5s, normal: 0.9s, slow: 1.5s
  sound_type: 'file',       // file | synth
  font_color: '#2fbffc',    // 단테 블루 기본
  bg_color: '#000000',      // 딥 블랙 기본
  scanlines: true,
  vignette: true,
  alarm_enabled: true, // 등록된 시간에 알람 울리기 (기본 활성화)
};

const DEFAULT_MESSAGES = [
  {
    stage: 1,
    messages: [
      { text: "관리자님, 오늘의 일정을 확인하십시오.", time_info: "09:00 - 10:00" },
      { text: "설정에서 구글 캘린더 iCal을 연동할 수 있습니다.", time_info: "11:00 - 12:00" }
    ]
  },
  {
    stage: 2,
    messages: [
      { text: "수감자들의 상태를 점검할 시간입니다.", time_info: "14:00 - 15:30" },
      { text: "황금가지를 향한 여정을 계속하십시오.", time_info: "16:00 - 18:00" }
    ]
  },
  {
    stage: 3,
    messages: [
      { text: "오늘 하루도 수고하셨습니다.", time_info: "20:00 - 21:00" }
    ]
  }
];

class PagerApp {
  constructor() {
    this.state = STATE.IDLE;
    this.currentStageIdx = 0;
    this.currentMsgIdx = 0;
    
    this.config = this.loadConfig();
    this.messages = this.loadStoredMessages();
    this.customStages = JSON.parse(JSON.stringify(this.messages));
    
    this.animInterval = null;
    this.beepTimeout = null;
    this.audioCtx = null;
    this.todayKey = this.getTodayKey();
    this.firedAlarms = this.loadFiredAlarms(this.todayKey);
    this.pendingAlarmTarget = null;
    
    this.initDOM();
    this.initCustomColorPicker();
    this.bindEvents();
    this.applySettings();
    this.startClock();
    this.updateDisplay();
    this.startAlarmWatcher();
    this.scheduleAlarms();

    // 초기 자동 동기화
    if (this.config.ics_url && this.config.auto_sync_min > 0) {
      setTimeout(() => this.syncCalendar(this.config.ics_url, true), 3000);
      setInterval(() => {
        if (this.config.ics_url && this.config.auto_sync_min > 0) {
          this.syncCalendar(this.config.ics_url, true);
        }
      }, this.config.auto_sync_min * 60 * 1000);
    }
  }

  // ── DOM 캐싱 ──
  initDOM() {
    this.dom = {
      app: document.getElementById('pager-app'),
      displayDots: document.getElementById('display-dots'),
      displaySubLabel: document.getElementById('display-sub-label'),
      displayMain: document.getElementById('display-main'),
      displayTime: document.getElementById('display-time'),
      progressBar: document.getElementById('progress-container'),
      progressFill: document.getElementById('progress-fill'),
      clock: document.getElementById('clock-display'),
      hintText: document.getElementById('hint-text'),

      // 인앱 알람 배너
      alarmBanner: document.getElementById('alarm-banner'),
      alarmTimeText: document.getElementById('alarm-time-text'),
      alarmDescText: document.getElementById('alarm-desc-text'),
      btnAlarmJump: document.getElementById('btn-alarm-jump'),
      btnAlarmDismiss: document.getElementById('btn-alarm-dismiss'),
      
      // 모달 & 폼 컨트롤
      modal: document.getElementById('settings-modal'),
      btnOpenSettings: document.getElementById('btn-open-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnCancelSettings: document.getElementById('btn-cancel-settings'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      btnResetDefault: document.getElementById('btn-reset-default'),
      btnSyncNow: document.getElementById('btn-sync-now'),
      btnTestSound: document.getElementById('btn-test-sound'),
      
      // 메시지 & STAGE 조절기
      btnAddStage: document.getElementById('btn-add-stage'),
      btnLoadSample: document.getElementById('btn-load-sample'),
      btnClearMessages: document.getElementById('btn-clear-messages'),
      btnApplyCustom: document.getElementById('btn-apply-custom-messages'),
      labelCustomStageCount: document.getElementById('label-custom-stage-count'),
      stageCardsContainer: document.getElementById('stage-cards-container'),
      
      // 설정 필드
      selectOrientation: document.getElementById('select-orientation'),
      inputIcsUrl: document.getElementById('input-ics-url'),
      selectAutoSync: document.getElementById('select-auto-sync'),
      selectDecodeSpeed: document.getElementById('select-decode-speed'),
      selectSoundType: document.getElementById('select-sound-type'),
      sliderVolume: document.getElementById('slider-volume'),
      labelVolume: document.getElementById('label-volume'),
      toggleScanlines: document.getElementById('toggle-scanlines'),
      toggleVignette: document.getElementById('toggle-vignette'),
      toggleAlarm: document.getElementById('toggle-alarm'),

      // 커스텀 사이버 컬러 모달
      colorModal: document.getElementById('custom-color-modal'),
      colorModalTitle: document.getElementById('color-modal-title'),
      btnCloseColorModal: document.getElementById('btn-close-color-modal'),
      btnCancelColorModal: document.getElementById('btn-cancel-color-modal'),
      btnApplyColorModal: document.getElementById('btn-apply-color-modal'),
      btnOpenColorPickerFont: document.getElementById('btn-open-color-picker-font'),
      btnOpenColorPickerBg: document.getElementById('btn-open-color-picker-bg'),
      pickerSvBox: document.getElementById('picker-sv-box'),
      pickerSvCursor: document.getElementById('picker-sv-cursor'),
      pickerHueTrack: document.getElementById('picker-hue-track'),
      pickerHueThumb: document.getElementById('picker-hue-thumb'),
      pickerLiveSwatch: document.getElementById('picker-live-swatch'),
      pickerHexInput: document.getElementById('picker-hex-input'),
      pickerRInput: document.getElementById('picker-r-input'),
      pickerGInput: document.getElementById('picker-g-input'),
      pickerBInput: document.getElementById('picker-b-input'),
      quickPresetGrid: document.getElementById('quick-preset-grid'),
      
      audio: document.getElementById('beep-audio'),
      toast: document.getElementById('toast'),
      crtOverlay: document.getElementById('crt-overlay'),
      crtVignette: document.getElementById('crt-vignette'),
      tabBtns: document.querySelectorAll('.tab-btn'),
      tabPanes: document.querySelectorAll('.tab-pane'),
    };
  }

  // ── 이벤트 바인딩 ──
  bindEvents() {
    // 1. 화면 클릭 / 터치로 다음 단계 진행
    this.dom.app.addEventListener('click', (e) => {
      if (e.target.closest('#btn-open-settings') || e.target.closest('#alarm-banner') || !this.dom.modal.classList.contains('hidden')) {
        return;
      }
      this.advance();
    });

    // 1-1. 인앱 알람 배너 액션 버튼
    if (this.dom.btnAlarmJump) {
      this.dom.btnAlarmJump.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pendingAlarmTarget) {
          this.jumpToMessage(this.pendingAlarmTarget.stageIdx, this.pendingAlarmTarget.msgIdx);
        } else {
          this.dismissAlarmBanner();
        }
      });
    }

    if (this.dom.btnAlarmDismiss) {
      this.dom.btnAlarmDismiss.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissAlarmBanner();
      });
    }

    // 2. 키보드 단축키
    window.addEventListener('keydown', (e) => {
      if (!this.dom.modal.classList.contains('hidden')) {
        if (e.key === 'Escape') this.closeModal();
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.advance();
      } else if (e.key.toLowerCase() === 'r') {
        this.replay();
      } else if (e.key.toLowerCase() === 's') {
        this.openModal();
      }
    });

    // 3. 설정 모달 열기/닫기
    this.dom.btnOpenSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal();
    });

    this.dom.btnCloseSettings.addEventListener('click', () => this.closeModal());
    this.dom.btnCancelSettings.addEventListener('click', () => this.closeModal());
    this.dom.modal.addEventListener('click', (e) => {
      if (e.target === this.dom.modal) this.closeModal();
    });

    // 4. 모달 탭 전환
    this.dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.tabBtns.forEach(b => b.classList.remove('active'));
        this.dom.tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // 5. STAGE 동적 추가
    this.dom.btnAddStage.addEventListener('click', () => {
      this.syncCustomBufferFromDOM();
      const newStageNum = this.customStages.length + 1;
      this.customStages.push({
        stage: newStageNum,
        messages: [{ text: `새 일정 메시지`, time_info: "" }]
      });
      this.renderCustomStageCards();
      this.showToast(`단계 ${newStageNum} 추가됨`);
    });

    // 6. 볼륨 슬라이더 및 사운드 설정
    this.dom.sliderVolume.addEventListener('input', (e) => {
      this.dom.labelVolume.textContent = `${e.target.value}%`;
    });
    this.dom.sliderVolume.addEventListener('change', (e) => {
      this.saveConfig({ volume: parseInt(e.target.value, 10) });
    });

    this.dom.selectSoundType.addEventListener('change', (e) => {
      this.saveConfig({ sound_type: e.target.value });
    });

    this.dom.btnTestSound.addEventListener('click', () => {
      const vol = parseInt(this.dom.sliderVolume.value, 10);
      const soundType = this.dom.selectSoundType.value;
      if (soundType === 'synth') {
        this.playSynthBeep(vol / 100.0);
      } else {
        this.playBeep(vol);
      }
    });

    // 7. 실시간 글자/배경 색상 프리셋 원형 칩 클릭 (클릭 즉시 자동 저장)
    document.querySelectorAll('.color-circle-chip[data-color]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        const color = e.currentTarget.dataset.color;
        if (type === 'font') {
          this.config.font_color = color;
          this.applyCustomColors(color, this.config.bg_color || '#000000');
          this.saveConfig({ font_color: color });
        } else if (type === 'bg') {
          this.config.bg_color = color;
          this.applyCustomColors(this.config.font_color || '#2FBFFC', color);
          this.saveConfig({ bg_color: color });
        }
        this.showToast(`색상이 저장되었습니다: ${color}`);
      });
    });

    // 8. 맨 마지막 무지개 원형 칩 클릭 시 커스텀 팝업 열기
    if (this.dom.btnOpenColorPickerFont) {
      this.dom.btnOpenColorPickerFont.addEventListener('click', () => {
        this.openCustomColorModal('font');
      });
    }
    if (this.dom.btnOpenColorPickerBg) {
      this.dom.btnOpenColorPickerBg.addEventListener('click', () => {
        this.openCustomColorModal('bg');
      });
    }

    // 9. 화면 방향 변경 (즉시 자동 저장)
    this.dom.selectOrientation.addEventListener('change', (e) => {
      this.applyOrientation(e.target.value);
      this.saveConfig({ orientation: e.target.value });
      this.showToast("화면 방향 설정이 저장되었습니다.");
    });

    // 10. CRT 스캔라인 & 비네팅 토글 시 실시간 미니 프리뷰 업데이트 및 자동 저장
    if (this.dom.toggleScanlines) {
      this.dom.toggleScanlines.addEventListener('change', (e) => {
        this.updateMiniCrtPreview();
        this.saveConfig({ scanlines: e.target.checked });
      });
    }
    if (this.dom.toggleVignette) {
      this.dom.toggleVignette.addEventListener('change', (e) => {
        this.updateMiniCrtPreview();
        this.saveConfig({ vignette: e.target.checked });
      });
    }

    // 일정 알람 토글 자동 저장
    if (this.dom.toggleAlarm) {
      this.dom.toggleAlarm.addEventListener('change', (e) => {
        this.saveConfig({ alarm_enabled: e.target.checked });
        this.showToast(e.target.checked ? "일정 알람이 활성화되었습니다." : "일정 알람이 비활성화되었습니다.");
      });
    }

    // 자동 동기화 주기 및 디코드 속도 자동 저장
    this.dom.selectAutoSync.addEventListener('change', (e) => {
      this.saveConfig({ auto_sync_min: parseInt(e.target.value, 10) });
    });
    this.dom.selectDecodeSpeed.addEventListener('change', (e) => {
      this.saveConfig({ decode_speed: e.target.value });
    });

    // 11. 설정 저장 및 기본값 복원
    this.dom.btnSaveSettings.addEventListener('click', () => this.saveSettingsFromModal());
    this.dom.btnResetDefault.addEventListener('click', () => this.resetDefaults());

    // 12. 캘린더 URL 즉시 동기화
    this.dom.btnSyncNow.addEventListener('click', () => {
      const url = this.dom.inputIcsUrl.value.trim();
      this.syncCalendar(url);
    });

    // 13. 메시지 에디터 툴바
    this.dom.btnLoadSample.addEventListener('click', () => {
      this.customStages = JSON.parse(JSON.stringify(DEFAULT_MESSAGES));
      this.renderCustomStageCards();
      this.showToast("기본 예시 메시지가 로드되었습니다.");
    });

    this.dom.btnClearMessages.addEventListener('click', () => {
      this.customStages = [{ stage: 1, messages: [{ text: "새 메시지", time_info: "" }] }];
      this.renderCustomStageCards();
      this.showToast("메시지 입력란을 초기화했습니다.");
    });

    // 14. 작성된 STAGE 삐삐 적용
    this.dom.btnApplyCustom.addEventListener('click', () => this.applyCustomStages());
  }

  // ── 설정 로드 및 저장 ──
  loadConfig() {
    try {
      const stored = localStorage.getItem('limbus_beep_config');
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_CONFIG };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('limbus_beep_config', JSON.stringify(this.config));
    this.applySettings();
  }

  loadStoredMessages() {
    try {
      const stored = localStorage.getItem('limbus_beep_messages');
      return stored ? JSON.parse(stored) : DEFAULT_MESSAGES;
    } catch {
      return DEFAULT_MESSAGES;
    }
  }

  saveStoredMessages(messages) {
    this.messages = messages;
    this.customStages = JSON.parse(JSON.stringify(messages));
    localStorage.setItem('limbus_beep_messages', JSON.stringify(messages));
    this.currentStageIdx = 0;
    this.currentMsgIdx = 0;
    this.updateDisplay();
    this.renderCustomStageCards();
    this.scheduleAlarms();
  }

  applyCustomColors(fontColor, bgColor) {
    const fc = (fontColor || this.config.font_color || '#2fbffc').toUpperCase();
    const bc = (bgColor || this.config.bg_color || '#000000').toUpperCase();

    document.documentElement.style.setProperty('--cyan-primary', fc);
    document.documentElement.style.setProperty('--cyan-accent', fc);
    document.documentElement.style.setProperty('--cyan-dim', `${fc}88`);
    document.documentElement.style.setProperty('--cyan-glow', `${fc}88`);
    document.documentElement.style.setProperty('--bg-color', bc);
    document.body.style.backgroundColor = bc;
    if (this.dom.app) this.dom.app.style.backgroundColor = bc;

    // 모달 내 실시간 미니 프리뷰 스크린 & Hex 태그 연동
    const miniPreview = document.getElementById('theme-mini-preview');
    const miniText = document.getElementById('mini-preview-text');
    const tagFontHex = document.getElementById('tag-font-hex');
    const tagBgHex = document.getElementById('tag-bg-hex');

    if (miniPreview) miniPreview.style.backgroundColor = bc;
    if (miniText) {
      miniText.style.color = fc;
      miniText.style.textShadow = `0 0 10px ${fc}88`;
    }
    if (tagFontHex) tagFontHex.textContent = fc;
    if (tagBgHex) tagBgHex.textContent = bc;

    // 글자 색상 원형 칩 활성화 상태 표시
    let fontPresetMatched = false;
    document.querySelectorAll('.color-circle-chip[data-type="font"][data-color]').forEach(chip => {
      const isMatch = chip.dataset.color.toUpperCase() === fc;
      chip.classList.toggle('active', isMatch);
      if (isMatch) fontPresetMatched = true;
    });
    if (this.dom.btnOpenColorPickerFont) {
      this.dom.btnOpenColorPickerFont.classList.toggle('active', !fontPresetMatched);
    }

    // 배경 색상 원형 칩 활성화 상태 표시
    let bgPresetMatched = false;
    document.querySelectorAll('.color-circle-chip[data-type="bg"][data-color]').forEach(chip => {
      const isMatch = chip.dataset.color.toUpperCase() === bc;
      chip.classList.toggle('active', isMatch);
      if (isMatch) bgPresetMatched = true;
    });
    if (this.dom.btnOpenColorPickerBg) {
      this.dom.btnOpenColorPickerBg.classList.toggle('active', !bgPresetMatched);
    }

    this.updateMiniCrtPreview();
  }

  updateMiniCrtPreview() {
    const miniScan = document.getElementById('mini-crt-scanlines');
    const miniVig = document.getElementById('mini-crt-vignette');
    const isScanOn = this.dom.toggleScanlines ? this.dom.toggleScanlines.checked : this.config.scanlines;
    const isVigOn = this.dom.toggleVignette ? this.dom.toggleVignette.checked : (this.config.vignette !== false);

    if (miniScan) {
      miniScan.style.display = isScanOn ? 'block' : 'none';
      miniScan.classList.toggle('hidden', !isScanOn);
    }
    if (miniVig) {
      miniVig.style.display = isVigOn ? 'block' : 'none';
      miniVig.classList.toggle('hidden', !isVigOn);
    }
  }

  applyOrientation(mode) {
    const targetMode = mode || this.config.orientation || 'landscape';
    // 1. Android Native Bridge 호출
    if (window.AndroidBridge && typeof window.AndroidBridge.setOrientation === 'function') {
      window.AndroidBridge.setOrientation(targetMode);
    }
    // 2. Web Screen Orientation API
    try {
      if (screen.orientation && screen.orientation.lock) {
        if (targetMode === 'landscape') screen.orientation.lock('landscape').catch(() => {});
        else if (targetMode === 'portrait') screen.orientation.lock('portrait').catch(() => {});
        else if (targetMode === 'sensor') screen.orientation.unlock();
      }
    } catch (e) {}
  }

  applySettings() {
    if (this.dom.crtOverlay) {
      this.dom.crtOverlay.style.display = this.config.scanlines ? 'block' : 'none';
    }
    if (this.dom.crtVignette) {
      this.dom.crtVignette.style.display = (this.config.vignette !== false) ? 'block' : 'none';
    }
    this.applyCustomColors(this.config.font_color, this.config.bg_color);
    this.applyOrientation(this.config.orientation || 'landscape');
    this.scheduleAlarms();
  }

  // ── 일정 알람 스케줄링 & 감시 엔진 ──
  getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  loadFiredAlarms(todayKey) {
    try {
      const stored = localStorage.getItem(`limbus_fired_alarms_${todayKey}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  saveFiredAlarms(todayKey) {
    try {
      localStorage.setItem(`limbus_fired_alarms_${todayKey}`, JSON.stringify(Array.from(this.firedAlarms)));
    } catch {}
  }

  scheduleAlarms() {
    const isEnabled = this.config.alarm_enabled !== false;
    if (!isEnabled) {
      if (window.AndroidBridge && typeof window.AndroidBridge.cancelAllAlarms === 'function') {
        window.AndroidBridge.cancelAllAlarms();
      }
      return;
    }

    const now = new Date();
    const alarmsList = [];

    this.messages.forEach((stage, sIdx) => {
      if (!stage.messages) return;
      stage.messages.forEach((msg, mIdx) => {
        const match = (msg.time_info || '').match(/\b(\d{1,2}):(\d{2})\b/);
        if (!match) return;

        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

        if (triggerDate.getTime() > now.getTime()) {
          alarmsList.push({
            id: alarmsList.length + 1,
            title: "단테 삐삐 일정 알람",
            message: msg.text,
            time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
            triggerAtMillis: triggerDate.getTime()
          });
        }
      });
    });

    // Android Native 알림 권한 및 AlarmManager 동기화
    if (window.AndroidBridge) {
      try {
        if (typeof window.AndroidBridge.requestNotificationPermission === 'function') {
          window.AndroidBridge.requestNotificationPermission();
        }
        if (typeof window.AndroidBridge.syncAlarms === 'function') {
          window.AndroidBridge.syncAlarms(JSON.stringify(alarmsList));
        }
      } catch (e) {
        console.warn("AndroidBridge alarm sync error:", e);
      }
    }

    // 웹 브라우저 Notification 권한 사전 요청
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) {}
  }

  startAlarmWatcher() {
    setInterval(() => {
      this.checkAlarms();
    }, 1000);
  }

  checkAlarms() {
    if (this.config.alarm_enabled === false) return;

    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();
    const curTimeStr = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
    const todayKey = this.getTodayKey();

    // 날짜가 바뀌었을 경우 firedAlarms 새로고침
    if (this.todayKey !== todayKey) {
      this.todayKey = todayKey;
      this.firedAlarms = this.loadFiredAlarms(todayKey);
    }

    this.messages.forEach((stage, sIdx) => {
      if (!stage.messages) return;
      stage.messages.forEach((msg, mIdx) => {
        const match = (msg.time_info || '').match(/\b(\d{1,2}):(\d{2})\b/);
        if (!match) return;

        const msgH = parseInt(match[1], 10);
        const msgM = parseInt(match[2], 10);
        const msgTimeStr = `${String(msgH).padStart(2, '0')}:${String(msgM).padStart(2, '0')}`;

        if (msgTimeStr === curTimeStr) {
          const alarmKey = `${todayKey}_${msgTimeStr}_${msg.text}`;
          if (!this.firedAlarms.has(alarmKey)) {
            this.firedAlarms.add(alarmKey);
            this.saveFiredAlarms(todayKey);
            this.triggerInAppAlarm(msg, sIdx, mIdx, msgTimeStr);
          }
        }
      });
    });
  }

  triggerInAppAlarm(msg, sIdx, mIdx, timeStr) {
    // 1. 단테 비프음 3회 연속 재생 (인앱 알람 시퀀스)
    this.playBeep();
    setTimeout(() => this.playBeep(), 250);
    setTimeout(() => this.playBeep(), 500);

    // 2. 디바이스 진동
    if (navigator.vibrate) {
      navigator.vibrate([350, 150, 350, 150, 600]);
    }
    if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
      window.AndroidBridge.vibrate(800);
    }

    // 3. 상단 인앱 알람 배너 노출
    if (this.dom.alarmBanner) {
      if (this.dom.alarmTimeText) this.dom.alarmTimeText.textContent = timeStr;
      if (this.dom.alarmDescText) this.dom.alarmDescText.textContent = msg.text;
      this.dom.alarmBanner.classList.remove('hidden');
      this.pendingAlarmTarget = { stageIdx: sIdx, msgIdx: mIdx };
    }

    // 4. 웹 브라우저 환경에서만 Notification (안드로이드 네이티브 앱은 AlarmManager가 담당하여 중복 방지)
    if (!window.AndroidBridge && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`단테 삐삐 알람 [${timeStr}]`, {
          body: msg.text,
          icon: 'assets/icon-192.png',
          tag: `limbus-alarm-${timeStr}`
        });
      } catch (e) {}
    }
  }

  dismissAlarmBanner() {
    if (this.dom.alarmBanner) {
      this.dom.alarmBanner.classList.add('hidden');
    }
    this.pendingAlarmTarget = null;
  }

  jumpToMessage(stageIdx, msgIdx) {
    this.dismissAlarmBanner();
    if (stageIdx >= 0 && stageIdx < this.messages.length) {
      this.currentStageIdx = stageIdx;
      if (msgIdx >= 0 && msgIdx < this.messages[stageIdx].messages.length) {
        this.currentMsgIdx = msgIdx;
      } else {
        this.currentMsgIdx = 0;
      }
      this.startBeeping();
    }
  }

  // ── 오디오 재생 ──
  playBeep(volumePercent = null) {
    const vol = (volumePercent !== null ? volumePercent : this.config.volume) / 100.0;
    if (vol <= 0) return;

    if (this.config.sound_type === 'synth') {
      this.playSynthBeep(vol);
      return;
    }

    try {
      this.dom.audio.volume = vol;
      this.dom.audio.currentTime = 0;
      const playPromise = this.dom.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => this.playSynthBeep(vol));
      }
    } catch {
      this.playSynthBeep(vol);
    }
  }

  playSynthBeep(vol) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(vol * 0.35, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn("오디오 재생 실패:", e);
    }
  }

  // ── 데이터 헬퍼 ──
  truncateText(text, maxLen = 30) {
    if (!text) return "";
    const str = String(text).trim();
    if (str.length > maxLen) {
      return str.substring(0, maxLen).trim() + "...";
    }
    return str;
  }

  getCurrentStage() {
    return this.messages[this.currentStageIdx] || null;
  }

  getCurrentMessage() {
    const stage = this.getCurrentStage();
    if (!stage || !stage.messages) return null;
    const msg = stage.messages[this.currentMsgIdx] || null;
    if (!msg) return null;
    return {
      ...msg,
      text: this.truncateText(msg.text, 30)
    };
  }

  getRandomCipher(len = 10) {
    let res = "";
    for (let i = 0; i < len; i++) {
      res += CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
    }
    return res;
  }

  // ── 상태 머신 컨트롤 ──
  advance() {
    this.clearTimers();

    if (this.state === STATE.IDLE) {
      this.currentMsgIdx = 0;
      this.startBeeping();
    } else if (this.state === STATE.BEEPING) {
      this.startDecoding();
    } else if (this.state === STATE.DECODING) {
      this.startRevealed();
    } else if (this.state === STATE.REVEALED) {
      const stage = this.getCurrentStage();
      if (stage && this.currentMsgIdx + 1 < stage.messages.length) {
        this.currentMsgIdx++;
        this.startBeeping();
      } else {
        const isLastStage = (this.currentStageIdx + 1 >= this.messages.length);
        if (isLastStage) {
          this.startComplete();
        } else {
          this.startClear();
        }
      }
    } else if (this.state === STATE.CLEAR) {
      this.currentStageIdx++;
      this.currentMsgIdx = 0;
      this.startBeeping();
    } else if (this.state === STATE.COMPLETE) {
      this.currentStageIdx = 0;
      this.currentMsgIdx = 0;
      this.updateDisplayIdle();
    }
  }

  replay() {
    this.clearTimers();
    this.startBeeping();
  }

  clearTimers() {
    if (this.animInterval) clearInterval(this.animInterval);
    if (this.beepTimeout) clearTimeout(this.beepTimeout);
    this.animInterval = null;
    this.beepTimeout = null;
  }

  // ── 상태 1: BEEPING ──
  startBeeping() {
    this.state = STATE.BEEPING;
    this.playBeep();

    this.dom.progressBar.classList.remove('visible');
    this.dom.displayTime.classList.remove('visible');
    this.dom.displayMain.className = 'main-text dimmed';
    this.dom.displaySubLabel.textContent = "신호 수신 중...";

    const msg = this.getCurrentMessage();
    const cipherLen = msg ? Math.max(9, msg.text.length) : 11;
    let dotStep = 0;

    this.animInterval = setInterval(() => {
      dotStep = (dotStep + 1) % 4;
      const dots = "• ".repeat(dotStep) + "◦ ".repeat(3 - dotStep);
      this.dom.displayDots.textContent = dots;
      this.dom.displayMain.textContent = this.getRandomCipher(cipherLen);
    }, 100);

    this.beepTimeout = setTimeout(() => {
      this.startDecoding();
    }, 1100);
  }

  // ── 상태 2: DECODING ──
  startDecoding() {
    this.clearTimers();
    this.state = STATE.DECODING;

    const msg = this.getCurrentMessage();
    if (!msg) {
      this.updateDisplayIdle();
      return;
    }

    const targetText = msg.text;
    this.dom.displayDots.textContent = "• • •";
    this.dom.displaySubLabel.textContent = "▼ 데이터 복호화 진행 중... ▼";
    this.dom.progressBar.classList.add('visible');
    this.dom.displayTime.classList.remove('visible');

    let durations = { fast: 500, normal: 900, slow: 1500 };
    let totalTime = durations[this.config.decode_speed] || 900;
    let steps = 18;
    let stepTime = totalTime / steps;
    let currentStep = 0;

    this.animInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(1.0, currentStep / steps);
      this.dom.progressFill.style.width = `${progress * 100}%`;

      const revealedCount = Math.floor(targetText.length * progress);
      let frame = "";
      for (let i = 0; i < targetText.length; i++) {
        if (i < revealedCount) {
          frame += targetText[i];
        } else {
          frame += (targetText[i] === ' ') ? ' ' : CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
        }
      }
      this.dom.displayMain.textContent = frame;
      this.dom.displayMain.className = (progress > 0.6) ? 'main-text accent' : 'main-text dimmed';

      if (currentStep >= steps) {
        this.clearTimers();
        this.startRevealed();
      }
    }, stepTime);
  }

  // ── 상태 3: REVEALED ──
  startRevealed() {
    this.clearTimers();
    this.state = STATE.REVEALED;

    const msg = this.getCurrentMessage();
    if (!msg) return;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.progressBar.classList.remove('visible');
    
    this.dom.displayMain.textContent = msg.text;
    this.dom.displayMain.className = 'main-text accent';

    if (msg.time_info) {
      this.dom.displayTime.textContent = msg.time_info;
      this.dom.displayTime.classList.add('visible');
    } else {
      this.dom.displayTime.classList.remove('visible');
    }
  }

  // ── 상태 4: CLEAR ──
  startClear() {
    this.clearTimers();
    this.state = STATE.CLEAR;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');

    this.dom.displayMain.textContent = "_CLEAR._";
    this.dom.displayMain.className = 'main-text amber';
  }

  // ── 상태 5: COMPLETE ──
  startComplete() {
    this.clearTimers();
    this.state = STATE.COMPLETE;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');

    this.dom.displayMain.textContent = "_ALL_CLEAR._";
    this.dom.displayMain.className = 'main-text amber';
  }

  updateDisplayIdle() {
    this.clearTimers();
    this.state = STATE.IDLE;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.displayMain.textContent = "SPACE 를 눌러 시작";
    this.dom.displayMain.className = 'main-text';
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
  }

  updateDisplay() {
    this.updateDisplayIdle();
  }

  // ── 시계 ──
  startClock() {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      this.dom.clock.textContent = `${h}:${m}:${s} KST`;
    };
    update();
    setInterval(update, 1000);
  }

  // ── 설정 모달 열기/닫기 ──
  openModal() {
    this.dom.selectOrientation.value = this.config.orientation || 'landscape';
    this.dom.inputIcsUrl.value = this.config.ics_url || '';
    this.dom.sliderVolume.value = this.config.volume;
    this.dom.labelVolume.textContent = `${this.config.volume}%`;
    this.dom.selectAutoSync.value = String(this.config.auto_sync_min);
    this.dom.selectDecodeSpeed.value = this.config.decode_speed;
    this.dom.selectSoundType.value = this.config.sound_type || 'file';
    this.dom.toggleScanlines.checked = this.config.scanlines;
    this.dom.toggleVignette.checked = this.config.vignette !== false;
    if (this.dom.toggleAlarm) {
      this.dom.toggleAlarm.checked = this.config.alarm_enabled !== false;
    }
    this.applyCustomColors(this.config.font_color, this.config.bg_color);

    // 사용자가 추가/편집한 STAGE 목록 복원 및 렌더링
    this.customStages = JSON.parse(JSON.stringify(this.messages));
    this.renderCustomStageCards();

    this.dom.modal.classList.remove('hidden');
  }

  closeModal() {
    this.applySettings();
    this.dom.modal.classList.add('hidden');
  }

  // ── 동적 STAGE 카드 렌더링 (각 메시지가 개별 카드로 분리됨) ──
  renderCustomStageCards() {
    this.dom.stageCardsContainer.innerHTML = '';
    this.dom.labelCustomStageCount.textContent = `${this.customStages.length} STAGES`;

    const pillClasses = ['stage-pill-cyan', 'stage-pill-amber', 'stage-pill-green'];

    this.customStages.forEach((stage, sIdx) => {
      const stageNum = sIdx + 1;
      const pillClass = pillClasses[sIdx % pillClasses.length];
      const stageCard = document.createElement('div');
      stageCard.className = 'stage-edit-card';

      const messages = stage.messages || [];

      let msgCardsHtml = '';
      messages.forEach((m, mIdx) => {
        msgCardsHtml += `
          <div class="msg-card-item" data-sidx="${sIdx}" data-midx="${mIdx}">
            <div class="msg-card-row">
              <input type="text" class="msg-time-input" data-sidx="${sIdx}" data-midx="${mIdx}" value="${m.time_info || ''}" placeholder="시간 (예: 09:00 - 10:00)">
              <button class="btn-del-msg" data-sidx="${sIdx}" data-midx="${mIdx}" title="메시지 삭제">&times;</button>
            </div>
            <input type="text" class="msg-text-input" data-sidx="${sIdx}" data-midx="${mIdx}" value="${m.text || ''}" placeholder="메시지 내용 입력">
          </div>
        `;
      });

      stageCard.innerHTML = `
        <div class="stage-edit-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="stage-pill ${pillClass}">STAGE ${stageNum}</span>
            <span class="stage-sub-hint">메시지 ${messages.length}개</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn-add-msg-to-stage btn-sm-text" data-sidx="${sIdx}">+ 메시지 추가</button>
            ${this.customStages.length > 1 ? `<button class="btn-del-stage" data-sidx="${sIdx}">삭제</button>` : ''}
          </div>
        </div>
        <div class="stage-msg-list" id="stage-msg-list-${sIdx}">
          ${msgCardsHtml || '<div class="empty-msg-notice">등록된 메시지가 없습니다. [+ 메시지 추가]를 눌러 추가하세요.</div>'}
        </div>
      `;

      // STAGE 삭제 버튼
      const delStageBtn = stageCard.querySelector('.btn-del-stage');
      if (delStageBtn) {
        delStageBtn.addEventListener('click', (e) => {
          this.syncCustomBufferFromDOM();
          const targetIdx = parseInt(e.target.dataset.sidx, 10);
          this.customStages.splice(targetIdx, 1);
          this.renderCustomStageCards();
          this.showToast(`STAGE 삭제됨 (현재 ${this.customStages.length}개)`);
        });
      }

      // 메시지 추가 버튼
      const addMsgBtn = stageCard.querySelector('.btn-add-msg-to-stage');
      if (addMsgBtn) {
        addMsgBtn.addEventListener('click', (e) => {
          this.syncCustomBufferFromDOM();
          const targetSIdx = parseInt(e.target.dataset.sidx, 10);
          if (!this.customStages[targetSIdx].messages) this.customStages[targetSIdx].messages = [];
          this.customStages[targetSIdx].messages.push({ text: `새 메시지`, time_info: "" });
          this.renderCustomStageCards();
        });
      }

      // 개별 메시지 삭제 버튼
      stageCard.querySelectorAll('.btn-del-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.syncCustomBufferFromDOM();
          const targetSIdx = parseInt(e.target.dataset.sidx, 10);
          const targetMIdx = parseInt(e.target.dataset.midx, 10);
          this.customStages[targetSIdx].messages.splice(targetMIdx, 1);
          this.renderCustomStageCards();
        });
      });

      this.dom.stageCardsContainer.appendChild(stageCard);
    });
  }

  syncCustomBufferFromDOM() {
    this.customStages.forEach((stage, sIdx) => {
      stage.stage = sIdx + 1;
      const msgItems = document.querySelectorAll(`.msg-card-item[data-sidx="${sIdx}"]`);
      if (msgItems && msgItems.length > 0) {
        const parsedMessages = [];
        msgItems.forEach(item => {
          const timeInput = item.querySelector('.msg-time-input');
          const textInput = item.querySelector('.msg-text-input');
          const time_info = timeInput ? timeInput.value.trim() : "";
          const rawText = textInput ? textInput.value.trim() : "";
          const text = this.truncateText(rawText, 30);
          if (text || time_info) {
            parsedMessages.push({ text: text || "(빈 메시지)", time_info });
          }
        });
        stage.messages = parsedMessages;
      }
    });
  }

  applyCustomStages() {
    this.syncCustomBufferFromDOM();
    const validStages = this.customStages.filter(s => s.messages && s.messages.length > 0);

    if (!validStages.length) {
      alert("최소 1개 이상의 메시지를 작성해야 합니다.");
      return;
    }

    this.saveStoredMessages(validStages);
    this.showToast(`${validStages.length}개 단계 메시지가 시뮬레이터에 적용되었습니다.`);
    this.closeModal();
  }

  saveSettingsFromModal() {
    this.syncCustomBufferFromDOM();
    const validStages = this.customStages.filter(s => s.messages && s.messages.length > 0);
    if (validStages.length > 0) {
      this.saveStoredMessages(validStages);
    }

    const newConfig = {
      orientation: this.dom.selectOrientation.value || 'landscape',
      ics_url: this.dom.inputIcsUrl.value.trim(),
      volume: parseInt(this.dom.sliderVolume.value, 10),
      auto_sync_min: parseInt(this.dom.selectAutoSync.value, 10),
      decode_speed: this.dom.selectDecodeSpeed.value,
      sound_type: this.dom.selectSoundType.value,
      font_color: this.config.font_color || '#2FBFFC',
      bg_color: this.config.bg_color || '#000000',
      scanlines: this.dom.toggleScanlines.checked,
      vignette: this.dom.toggleVignette.checked,
      alarm_enabled: this.dom.toggleAlarm ? this.dom.toggleAlarm.checked : true,
    };
    this.saveConfig(newConfig);
    this.showToast("환경 설정이 저장되었습니다.");
    this.closeModal();
  }

  resetDefaults() {
    if (confirm("모든 설정을 기본값으로 초기화하시겠습니까?")) {
      this.saveConfig(DEFAULT_CONFIG);
      this.saveStoredMessages(DEFAULT_MESSAGES);
      this.openModal();
      this.showToast("기본값으로 복원되었습니다.");
    }
  }

  // ── Google Calendar ICS 파싱 & 동기화 ──
  async fetchIcsContent(rawUrl) {
    let cleanUrl = rawUrl.trim();
    if (cleanUrl.startsWith("webcal://")) {
      cleanUrl = "https://" + cleanUrl.substring(9);
    }

    // 1. Android Native Bridge: 안드로이드 네이티브 HTTP 연결로 직접 다운로드
    if (window.AndroidBridge && typeof window.AndroidBridge.fetchIcsDirect === 'function') {
      try {
        const result = window.AndroidBridge.fetchIcsDirect(cleanUrl);
        if (result && !result.startsWith("ERROR:") && result.includes("BEGIN:VCALENDAR")) {
          return result;
        } else if (result && result.startsWith("ERROR: HTTP 404")) {
          throw new Error("404 오류: 캘린더 주소가 존재하지 않습니다. Google 캘린더 설정에서 '비공개 주소(iCal)'를 다시 확인해주세요.");
        } else if (result && result.startsWith("ERROR: HTTP 403")) {
          throw new Error("403 오류: 접근 권한이 없습니다. '비공개 주소(iCal)'가 올바른지 확인해주세요.");
        }
      } catch (err) {
        if (err.message && (err.message.includes("404") || err.message.includes("403"))) throw err;
        console.warn("AndroidBridge fetch failed, trying web fallbacks...", err);
      }
    }

    // 2. 브라우저 Direct fetch 시도
    try {
      const resp = await fetch(cleanUrl, { cache: 'no-cache' });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes("BEGIN:VCALENDAR")) return text;
      }
    } catch (e) {}

    // 3. 다중 고신뢰도 CORS 프록시 풀 순차 시도
    const proxyGenerators = [
      (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      (u) => `https://thingproxy.freeboard.io/fetch/${u}`
    ];

    for (const makeProxy of proxyGenerators) {
      try {
        const pUrl = makeProxy(cleanUrl);
        const resp = await fetch(pUrl, { cache: 'no-cache' });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.includes("BEGIN:VCALENDAR")) {
            return text;
          }
        }
      } catch (err) {}
    }

    throw new Error("캘린더 주소(iCal)를 불러오지 못했습니다. Google 캘린더 설정의 [캘린더 통합] ➔ [iCal 형식의 비공개 주소]가 올바른지 확인해주세요.");
  }

  async syncCalendar(url, isSilent = false) {
    if (!url || url.trim().length < 10) {
      if (!isSilent) alert("유효한 Google Calendar 비공개 iCal 주소를 입력해주세요.");
      return;
    }

    const cleanUrl = url.trim().replace(/^webcal:\/\//, 'https://');
    if (!cleanUrl.includes("calendar.google.com") && !cleanUrl.endsWith(".ics")) {
      if (!isSilent) {
        const proceed = confirm("입력된 주소가 일반적인 Google 캘린더 iCal 주소(.ics)와 다릅니다. 계속 진행하시겠습니까?");
        if (!proceed) return;
      }
    }

    if (!isSilent && this.dom.btnSyncNow) {
      this.dom.btnSyncNow.textContent = "동기화 중...";
      this.dom.btnSyncNow.disabled = true;
    }

    try {
      const icsText = await this.fetchIcsContent(cleanUrl);

      if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
        throw new Error("올바른 iCal/ICS 파일 형식이 아닙니다.");
      }

      const events = this.parseIcsText(icsText);
      const stages = this.distributeEventsTo3Stages(events.map(e => this.formatEvent(e)));

      this.saveStoredMessages(stages);
      this.config.ics_url = cleanUrl;
      this.saveConfig(this.config);

      if (!isSilent) {
        if (events.length > 0) {
          this.showToast(`오늘 일정 ${events.length}개를 성공적으로 가져왔습니다.`);
        } else {
          this.showToast("동기화 완료: 오늘(KST) 등록된 일정이 없습니다 (0건).");
        }
        if (this.dom.btnSyncNow) {
          this.dom.btnSyncNow.textContent = "동기화";
          this.dom.btnSyncNow.disabled = false;
        }
      }
    } catch (e) {
      console.error("캘린더 동기화 실패:", e);
      if (!isSilent) {
        alert(`캘린더 동기화 실패:\n${e.message}`);
        if (this.dom.btnSyncNow) {
          this.dom.btnSyncNow.textContent = "동기화";
          this.dom.btnSyncNow.disabled = false;
        }
      }
    }
  }

  // ── 한국 표준시(KST) 순수 오늘 일정 파싱 ──
  parseIcsText(icsText) {
    const now = new Date();
    // KST 시간 계산 (UTC + 9)
    const kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 3600 * 1000));
    const todayY = kst.getFullYear();
    const todayM = kst.getMonth() + 1;
    const todayD = kst.getDate();

    const events = [];
    const cleanIcs = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r[ \t]/g, '');
    const lines = cleanIcs.split(/\r\n|\n|\r/);
    
    let inEvent = false;
    let curEvent = {};

    for (let line of lines) {
      line = line.trim();
      if (line === "BEGIN:VEVENT") {
        inEvent = true;
        curEvent = {};
      } else if (line === "END:VEVENT") {
        inEvent = false;
        if (this.isEventToday(curEvent, todayY, todayM, todayD)) {
          events.push(curEvent);
        }
      } else if (inEvent && line.includes(":")) {
        const idx = line.indexOf(":");
        const rawKey = line.substring(0, idx);
        const val = line.substring(idx + 1);
        const key = rawKey.split(";")[0].toUpperCase();
        curEvent[key] = val;
      }
    }

    events.sort((a, b) => (a.DTSTART || '').localeCompare(b.DTSTART || ''));
    return events;
  }

  isEventToday(ev, y, m, d) {
    const dtstart = ev.DTSTART || "";
    if (!dtstart) return false;

    // 1. 종일 일정 (YYYYMMDD) - 오늘과 같은 년도, 같은 월, 같은 일
    if (dtstart.length === 8) {
      const ey = parseInt(dtstart.substr(0, 4), 10);
      const em = parseInt(dtstart.substr(4, 2), 10);
      const ed = parseInt(dtstart.substr(6, 2), 10);
      return ey === y && em === m && ed === d;
    }

    // 2. 시간 지정 일정 (YYYYMMDDTHHMMSS)
    if (dtstart.includes("T")) {
      const raw = dtstart.replace("Z", "");
      const ey = parseInt(raw.substr(0, 4), 10);
      const em = parseInt(raw.substr(4, 2), 10);
      const ed = parseInt(raw.substr(6, 2), 10);
      const eh = parseInt(raw.substr(9, 2), 10) || 0;
      const emn = parseInt(raw.substr(11, 2), 10) || 0;

      if (dtstart.endsWith("Z")) {
        // UTC 시간 -> 한국 시간(KST, UTC+9)으로 환산 후 오늘(y년 m월 d일)과 일치하는지 비교
        const utcDate = new Date(Date.UTC(ey, em - 1, ed, eh, emn));
        const kstDate = new Date(utcDate.getTime() + 9 * 3600 * 1000);
        return kstDate.getUTCFullYear() === y && (kstDate.getUTCMonth() + 1) === m && kstDate.getUTCDate() === d;
      }

      // 로컬 시간
      return ey === y && em === m && ed === d;
    }

    return false;
  }

  formatEvent(ev) {
    const rawSummary = (ev.SUMMARY || "(제목 없음)").replace(/\\([,;Nn\\])/g, (m, c) => (c === 'n' || c === 'N') ? ' ' : c);
    const summary = this.truncateText(rawSummary, 30);
    const dtstart = ev.DTSTART || "";
    const dtend = ev.DTEND || "";
    let timeInfo = "오늘 종일";

    if (dtstart.includes("T")) {
      const rawS = dtstart.replace("Z", "");
      let sh = parseInt(rawS.substr(9, 2), 10);
      let sm = rawS.substr(11, 2);
      if (dtstart.endsWith("Z")) sh = (sh + 9) % 24;
      const startStr = `${String(sh).padStart(2, '0')}:${sm}`;

      if (dtend && dtend.includes("T")) {
        const rawE = dtend.replace("Z", "");
        let eh = parseInt(rawE.substr(9, 2), 10);
        let em = rawE.substr(11, 2);
        if (dtend.endsWith("Z")) eh = (eh + 9) % 24;
        const endStr = `${String(eh).padStart(2, '0')}:${em}`;
        timeInfo = `${startStr} - ${endStr}`;
      } else {
        timeInfo = startStr;
      }
    }

    return { text: summary, time_info: timeInfo };
  }

  distributeEventsTo3Stages(formattedEvents) {
    if (!formattedEvents || formattedEvents.length === 0) {
      return [{ stage: 1, messages: [{ text: "오늘 등록된 일정이 없습니다.", time_info: "오늘" }] }];
    }

    const n = 3;
    const stages = [];
    const total = formattedEvents.length;

    if (total <= 3) {
      for (let s = 0; s < total; s++) {
        stages.push({
          stage: s + 1,
          messages: [formattedEvents[s]]
        });
      }
    } else {
      const base = Math.floor(total / n);
      const extra = total % n;
      let idx = 0;

      for (let s = 0; s < n; s++) {
        const count = base + (s < extra ? 1 : 0);
        if (count === 0) continue;
        stages.push({
          stage: s + 1,
          messages: formattedEvents.slice(idx, idx + count)
        });
        idx += count;
      }
    }

    return stages;
  }

  // ── 프리미엄 사이버 컬러 피커 시스템 ──
  initCustomColorPicker() {
    this.colorPickerTarget = 'font';
    this.currentColorH = 198;
    this.currentColorS = 81;
    this.currentColorV = 99;
    this.currentColorHex = '#2FBFFC';

    // 1. 2D 채도/명도 캔버스 인터랙션
    let isDraggingSV = false;
    const handleSVMove = (e) => {
      if (!this.dom.pickerSvBox) return;
      const rect = this.dom.pickerSvBox.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const s = Math.round(x * 100);
      const v = Math.round((1 - y) * 100);
      this.updateColorFromHSV(this.currentColorH, s, v);
    };

    if (this.dom.pickerSvBox) {
      this.dom.pickerSvBox.addEventListener('pointerdown', (e) => {
        isDraggingSV = true;
        this.dom.pickerSvBox.setPointerCapture(e.pointerId);
        handleSVMove(e);
      });
      this.dom.pickerSvBox.addEventListener('pointermove', (e) => {
        if (isDraggingSV) handleSVMove(e);
      });
      this.dom.pickerSvBox.addEventListener('pointerup', (e) => {
        if (isDraggingSV) {
          isDraggingSV = false;
          try { this.dom.pickerSvBox.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      });
      this.dom.pickerSvBox.addEventListener('pointercancel', () => {
        isDraggingSV = false;
      });
    }

    // 2. 1D HUE 바 인터랙션
    let isDraggingHue = false;
    const handleHueMove = (e) => {
      if (!this.dom.pickerHueTrack) return;
      const rect = this.dom.pickerHueTrack.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const h = Math.round(x * 360) % 360;
      this.updateColorFromHSV(h, this.currentColorS, this.currentColorV);
    };

    if (this.dom.pickerHueTrack) {
      this.dom.pickerHueTrack.addEventListener('pointerdown', (e) => {
        isDraggingHue = true;
        this.dom.pickerHueTrack.setPointerCapture(e.pointerId);
        handleHueMove(e);
      });
      this.dom.pickerHueTrack.addEventListener('pointermove', (e) => {
        if (isDraggingHue) handleHueMove(e);
      });
      this.dom.pickerHueTrack.addEventListener('pointerup', (e) => {
        if (isDraggingHue) {
          isDraggingHue = false;
          try { this.dom.pickerHueTrack.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      });
      this.dom.pickerHueTrack.addEventListener('pointercancel', () => {
        isDraggingHue = false;
      });
    }

    // 3. HEX 텍스트 인풋
    if (this.dom.pickerHexInput) {
      this.dom.pickerHexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.updateColorFromHex(val);
        }
      });
    }

    // 4. RGB 숫자 인풋
    const handleRgbChange = () => {
      const r = parseInt(this.dom.pickerRInput.value, 10) || 0;
      const g = parseInt(this.dom.pickerGInput.value, 10) || 0;
      const b = parseInt(this.dom.pickerBInput.value, 10) || 0;
      this.updateColorFromRgb(r, g, b);
    };

    if (this.dom.pickerRInput) this.dom.pickerRInput.addEventListener('input', handleRgbChange);
    if (this.dom.pickerGInput) this.dom.pickerGInput.addEventListener('input', handleRgbChange);
    if (this.dom.pickerBInput) this.dom.pickerBInput.addEventListener('input', handleRgbChange);

    // 5. 모달 버튼 액션
    if (this.dom.btnCloseColorModal) {
      this.dom.btnCloseColorModal.addEventListener('click', () => this.closeCustomColorModal());
    }
    if (this.dom.btnCancelColorModal) {
      this.dom.btnCancelColorModal.addEventListener('click', () => this.closeCustomColorModal());
    }
    if (this.dom.btnApplyColorModal) {
      this.dom.btnApplyColorModal.addEventListener('click', () => this.applyChosenCustomColor());
    }
    if (this.dom.colorModal) {
      this.dom.colorModal.addEventListener('click', (e) => {
        if (e.target === this.dom.colorModal) this.closeCustomColorModal();
      });
    }
  }

  openCustomColorModal(target = 'font') {
    this.colorPickerTarget = target;
    if (this.dom.colorModalTitle) {
      this.dom.colorModalTitle.textContent = target === 'font' ? '🎨 글자 색상 사용자 지정' : '🎨 배경 색상 사용자 지정';
    }

    const currentHex = target === 'font' ? (this.config.font_color || '#2FBFFC') : (this.config.bg_color || '#000000');
    this.updateColorFromHex(currentHex);
    this.renderQuickPresets();

    if (this.dom.colorModal) this.dom.colorModal.classList.remove('hidden');
  }

  closeCustomColorModal() {
    if (this.dom.colorModal) this.dom.colorModal.classList.add('hidden');
  }

  updateColorFromHSV(h, s, v) {
    this.currentColorH = Math.max(0, Math.min(360, h));
    this.currentColorS = Math.max(0, Math.min(100, s));
    this.currentColorV = Math.max(0, Math.min(100, v));

    const rgb = this.hsvToRgb(this.currentColorH, this.currentColorS, this.currentColorV);
    const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
    this.currentColorHex = hex;

    // 1. SV 박스 틴트 & 커서 위치
    if (this.dom.pickerSvBox) {
      this.dom.pickerSvBox.style.backgroundColor = `hsl(${this.currentColorH}, 100%, 50%)`;
    }
    if (this.dom.pickerSvCursor) {
      this.dom.pickerSvCursor.style.left = `${this.currentColorS}%`;
      this.dom.pickerSvCursor.style.top = `${100 - this.currentColorV}%`;
    }

    // 2. Hue 썸 위치
    if (this.dom.pickerHueThumb) {
      this.dom.pickerHueThumb.style.left = `${(this.currentColorH / 360) * 100}%`;
    }

    // 3. 라이브 스와치 & 발광
    if (this.dom.pickerLiveSwatch) {
      this.dom.pickerLiveSwatch.style.backgroundColor = hex;
      this.dom.pickerLiveSwatch.style.borderColor = hex;
      this.dom.pickerLiveSwatch.style.boxShadow = `0 0 14px ${hex}99`;
    }

    // 4. 인풋 필드 동기화 (포커스 중이 아닐 때만)
    if (this.dom.pickerHexInput && document.activeElement !== this.dom.pickerHexInput) {
      this.dom.pickerHexInput.value = hex;
    }
    if (this.dom.pickerRInput && document.activeElement !== this.dom.pickerRInput) this.dom.pickerRInput.value = rgb.r;
    if (this.dom.pickerGInput && document.activeElement !== this.dom.pickerGInput) this.dom.pickerGInput.value = rgb.g;
    if (this.dom.pickerBInput && document.activeElement !== this.dom.pickerBInput) this.dom.pickerBInput.value = rgb.b;

    // 5. 퀵 프리셋 칩 활성화 표시
    document.querySelectorAll('.quick-preset-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.color.toUpperCase() === hex);
    });
  }

  updateColorFromHex(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return;
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.updateColorFromHSV(hsv.h, hsv.s, hsv.v);
  }

  updateColorFromRgb(r, g, b) {
    const hsv = this.rgbToHsv(r, g, b);
    this.updateColorFromHSV(hsv.h, hsv.s, hsv.v);
  }

  renderQuickPresets() {
    if (!this.dom.quickPresetGrid) return;
    this.dom.quickPresetGrid.innerHTML = '';

    const presets = [
      "#2FBFFC", "#00E5FF", "#38C5FF", "#5CD0FF",
      "#00E676", "#69F0AE", "#B2FF59", "#76FF03",
      "#FF9D00", "#FFC107", "#FFD600", "#FFAB00",
      "#FF5252", "#FF1744", "#F50057", "#D500F9",
      "#7C4DFF", "#651FFF", "#3D5AFE", "#2979FF",
      "#FFFFFF", "#B0BEC5", "#050E18", "#000000"
    ];

    presets.forEach(color => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quick-preset-chip';
      chip.dataset.color = color;
      chip.style.backgroundColor = color;
      chip.style.color = color;
      chip.title = color;
      if (color.toUpperCase() === this.currentColorHex) {
        chip.classList.add('active');
      }
      chip.addEventListener('click', () => {
        this.updateColorFromHex(color);
      });
      this.dom.quickPresetGrid.appendChild(chip);
    });
  }

  applyChosenCustomColor() {
    const chosen = this.currentColorHex;
    if (this.colorPickerTarget === 'font') {
      this.config.font_color = chosen;
      this.applyCustomColors(chosen, this.config.bg_color || '#000000');
      this.saveConfig({ font_color: chosen });
    } else {
      this.config.bg_color = chosen;
      this.applyCustomColors(this.config.font_color || '#2FBFFC', chosen);
      this.saveConfig({ bg_color: chosen });
    }
    this.closeCustomColorModal();
    this.showToast(`색상이 적용 및 저장되었습니다: ${chosen}`);
  }

  // ── 색상 변환 헬퍼 함수 ──
  hsvToRgb(h, s, v) {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
  }

  rgbToHex(r, g, b) {
    const toHex = (n) => {
      const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
  }

  hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return null;
    const num = parseInt(c, 16);
    if (isNaN(num)) return null;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  // ── 토스트 알림 ──
  showToast(msg) {
    this.dom.toast.textContent = msg;
    this.dom.toast.classList.remove('hidden');
    setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, 2800);
  }
}

// 앱 실행
document.addEventListener('DOMContentLoaded', () => {
  window.pagerApp = new PagerApp();
});
