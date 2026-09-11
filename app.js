/**
 * Limbus Beep - 단테 삐삐 시뮬레이터 v2.1.0
 */

// ── 상태 정의 ──
const STATE = {
  IDLE: 'IDLE',
  BEEPING: 'BEEPING',
  DECODING: 'DECODING',
  REVEALED: 'REVEALED'
};

const CIPHER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+-=?<>";

// ── [뤼엔의 이야기] 전용 대사 데이터 ──
// 여기에 원하는 만큼 줄을 추가/수정하세요. 순서대로 한 번 터치할 때마다 한 줄씩 나옵니다.
// text  : 화면에 표시될 대사
// voice : 그 대사와 함께 재생될 음성 파일 경로 (assets/ 폴더에 파일을 넣고 경로를 맞춰주세요)
//         음성이 없는 줄은 voice를 "" 로 비워두면 됩니다.
const RYUEN_STORY = [
  { text: "무아몽중", voice: "assets/Mua.m4a" },
  { text: "아비규환", voice: "assets/Abi.m4a" },
  { text: "지리멸렬", voice: "assets/giri.m4a" },
  { text: "하나", voice: "assets/hana.m4a" },
  { text: "둘", voice: "assets/dul.m4a" },
  { text: "트와", voice: "assets/twa.m4a" },
  { text: "넷", voice: "assets/net.m4a" },
  { text: "다섯", voice: "assets/dasut.m4a" },
  { text: "시스", voice: "assets/six.m4a" },
  { text: "일곱. 앞으로 둘.", voice: "assets/ilgob.m4a" },
  { text: "여덞. 앞으로 하나.", voice: "assets/yudulb.m4a" },
  { text: "네프. 완료.", voice: "assets/nerf.m4a" },
  { text: "심장으로 창을 찔러, 거꾸로 매달고.", voice: "assets/simjang.m4a" },
  { text: "둔기를 휘둘러, 무거움의 아래로 눌러서.", voice: "assets/dungi.m4a" },
  { text: "검으로 마구 쪼아, 뜯어 먹어라.", voice: "assets/gumuro.m4a" },
  { text: "그래, 결국.. 이런 날이 왔구나.", voice: "assets/gra.m4a" },
  { text: "딸, 알고 있지? 예측은, 의미 없다는 거.", voice: "assets/ddalyouknow.m4a" },
  { text: "떠날 이유는 없을 거야, 딸, 너는, 모든 것을 잃고, 모든 것을 잃었으니.", voice: "assets/leave.m4a" },
  { text: "얼어붙은 피를 길게 휘감고.", voice: "assets/cold.m4a" },
  { text: "소리 없이 손뼉 치고, 목소리 없이 베어서.", voice: "assets/novoice.m4a" },
  { text: "날카로운 날로, 낙엽 향 나듯 폭포 소리로 울어라.", voice: "assets/sharp.m4a" },
  { text: "그 운명은, 네 운명이 아니야.", voice: "assets/theunmyung.m4a" },
  { text: "그러니 거기서 빠져나오렴. 요시히데.", voice: "assets/bbagyu.m4a" },
  { text: "딸, 나를 원망하진 마. 그건 그거고. 이건 이거니까.", voice: "assets/ggee.m4a" },
  { text: "만들어진 생애를 살아온 아둔한 사람. 그게 너란다. 그리고 나이기도 하지.", voice: "assets/makinglife.m4a" },
  { text: "이제와서 자유롭게 살아갈 순 없어. 도망친들, 신의 병졸이 너를 잡으러 갈 테니.", voice: "assets/godarmy.m4a" },
  { text: "기행할 것도 없이, 여기가 네가 있을 지옥이잖니.", voice: "assets/giok.m4a" },
  { text: "하늘을 들춰.. 내 딸을 데려가려는 모든 걸 치워버릴 수 밖에.", voice: "assets/sky.m4a" },
  { text: "나갈 수 있는 길은 하나 뿐이야. 네가 여기로 온, 집으로 돌아가는 길이지.", voice: "assets/nagada.m4a" },
  { text: "끊어낼 수 없는 거야, 딸. 제멋대로 끊어버리면 안 되는 거라고.", voice: "assets/cantcut.m4a" },
];

// ── 기본 설정 ──
const DEFAULT_CONFIG = {
  volume: 80,
  orientation: 'landscape', // landscape | portrait | sensor (가로 모드 기본)
  gemini_api_key: '',
  gemini_hint: '',
  decode_speed: 'normal',   // fast: 0.5s, normal: 0.9s, slow: 1.5s
  sound_type: 'file',       // file | synth
  font_color: '#2fbffc',    // 단테 블루 기본
  bg_color: '#000000',      // 딥 블랙 기본
  scanlines: true,
  vignette: true,
};

class PagerApp {
  constructor() {
    this.state = STATE.IDLE;
    this.pendingMessageText = ''; // 이번 사이클에서 Gemini가 생성한 지령 텍스트

    // [뤼엔의 이야기] 모드 상태
    this.storyMode = false;
    this.storyIndex = -1;

    this.config = this.loadConfig();

    this.animInterval = null;
    this.beepTimeout = null;
    this.audioCtx = null;

    this.initDOM();
    this.initCustomColorPicker();
    this.bindEvents();
    this.applySettings();
    this.startClock();
    this.updateDisplay();
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
      // 모달 & 폼 컨트롤
      modal: document.getElementById('settings-modal'),
      btnOpenSettings: document.getElementById('btn-open-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnCancelSettings: document.getElementById('btn-cancel-settings'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      btnResetDefault: document.getElementById('btn-reset-default'),
      btnTestSound: document.getElementById('btn-test-sound'),

      // Gemini API 설정 (실시간 지령 생성용)
      inputGeminiKey: document.getElementById('input-gemini-key'),
      inputGeminiHint: document.getElementById('input-gemini-hint'),

      // 설정 필드
      selectOrientation: document.getElementById('select-orientation'),
      selectDecodeSpeed: document.getElementById('select-decode-speed'),
      selectSoundType: document.getElementById('select-sound-type'),
      sliderVolume: document.getElementById('slider-volume'),
      labelVolume: document.getElementById('label-volume'),
      toggleScanlines: document.getElementById('toggle-scanlines'),
      toggleVignette: document.getElementById('toggle-vignette'),

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
      ostAudio: document.getElementById('ryuen-ost-audio'),
      voiceAudio: document.getElementById('ryuen-voice-audio'),
      btnRyuenStory: document.getElementById('btn-ryuen-story'),
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
      if (e.target.closest('#btn-open-settings') || e.target.closest('#btn-ryuen-story') || !this.dom.modal.classList.contains('hidden')) {
        return;
      }
      if (this.storyMode) {
        this.advanceRyuenStory();
      } else {
        this.advance();
      }
    });

    // 1-1. [뤼엔의 이야기] 버튼
    if (this.dom.btnRyuenStory) {
      this.dom.btnRyuenStory.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startRyuenStory();
      });
    }

    // 2. 키보드 단축키
    window.addEventListener('keydown', (e) => {
      if (!this.dom.modal.classList.contains('hidden')) {
        if (e.key === 'Escape') this.closeModal();
        return;
      }

      if (this.storyMode) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.advanceRyuenStory();
        }
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

    // 디코드 속도 자동 저장
    this.dom.selectDecodeSpeed.addEventListener('change', (e) => {
      this.saveConfig({ decode_speed: e.target.value });
    });

    // 11. 설정 저장 및 기본값 복원
    this.dom.btnSaveSettings.addEventListener('click', () => this.saveSettingsFromModal());
    this.dom.btnResetDefault.addEventListener('click', () => this.resetDefaults());
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

  // [뤼엔의 이야기] 대사 전환 효과음 ("뾰로로록" 느낌의 짧은 블립) — 현재는 미사용(기본 지령음으로 대체)
  playStoryBlip() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const vol = (this.config.volume || 80) / 100.0;
      const now = this.audioCtx.currentTime;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(1500, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.16);

      gain.gain.setValueAtTime(vol * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.warn("대사 전환음 재생 실패:", e);
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

  getRandomCipher(len = 10) {
    let res = "";
    for (let i = 0; i < len; i++) {
      res += CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
    }
    return res;
  }

  // ── 상태 머신 컨트롤 ──
  // 터치할 때마다: IDLE → (Gemini 호출) BEEPING → DECODING → REVEALED → (다시 터치) BEEPING(새 지령) → ...
  advance() {
    if (this.storyMode) return; // [뤼엔의 이야기] 진행 중에는 일반 지령 수신을 막는다.
    if (this.state === STATE.IDLE) {
      if (!this.config.gemini_api_key || !this.config.gemini_api_key.trim()) {
        this.showToast("설정에서 Gemini API 키를 먼저 입력해주세요.");
        this.openModal();
        return;
      }
      this.clearTimers();
      this.startBeeping();
    } else if (this.state === STATE.BEEPING) {
      // AI 응답 대기 중에는 중복 호출을 막기 위해 터치를 무시한다.
    } else if (this.state === STATE.DECODING) {
      this.clearTimers();
      this.startRevealed();
    } else if (this.state === STATE.REVEALED) {
      this.clearTimers();
      this.startBeeping();
    }
  }

  replay() {
    if (this.storyMode) return;
    if (this.state === STATE.BEEPING) return;
    this.clearTimers();
    this.startBeeping();
  }

  // ── [뤼엔의 이야기] 모드 ──
  // 시작: 평상시 AI 지령 수신을 멈추고 OST를 재생하며, 터치를 기다리는 상태로 전환한다.
  startRyuenStory() {
    if (this.storyMode) return; // 이미 진행 중이면 무시
    this.clearTimers();
    this.state = STATE.IDLE; // 일반 상태머신은 대기 상태로 묶어둔다.
    this.storyMode = true;
    this.storyIndex = -1;

    // 화면을 조용한 대기 화면으로 정리
    this.dom.displayDots.textContent = "";
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayTime.classList.remove('visible');
    this.dom.displaySubLabel.textContent = "뤼엔의 이야기";
    this.dom.displayMain.className = 'main-text dimmed';
    this.dom.displayMain.textContent = "화면을 터치하세요";

    // OST 재생 (반복)
    if (this.dom.ostAudio) {
      try {
        this.dom.ostAudio.currentTime = 0;
        this.dom.ostAudio.volume = ((this.config.volume || 80) / 100.0) * 0.7; // OST는 볼륨 설정의 70% 크기로
        const p = this.dom.ostAudio.play();
        if (p !== undefined) p.catch(() => {});
      } catch (e) {
        console.warn("OST 재생 실패:", e);
      }
    }
  }

  // 터치할 때마다 다음 대사를 보여주고, 대사에 지정된 음성을 재생한다.
  // 마지막 대사까지 다 보여준 뒤 한 번 더 터치하면 정상 모드로 돌아간다.
  advanceRyuenStory() {
    this.storyIndex++;

    if (this.storyIndex >= RYUEN_STORY.length) {
      this.endRyuenStory();
      return;
    }

    const line = RYUEN_STORY[this.storyIndex];

    this.playBeep(); // 기본 모드에서 지령 생성될 때와 같은 소리를 재사용

    this.dom.displaySubLabel.textContent = `뤼엔의 이야기 (${this.storyIndex + 1}/${RYUEN_STORY.length})`;
    this.dom.displayMain.textContent = line.text || "";
    this.dom.displayMain.className = 'main-text accent';

    if (line.voice && this.dom.voiceAudio) {
      try {
        this.dom.voiceAudio.pause();
        this.dom.voiceAudio.src = line.voice;
        this.dom.voiceAudio.currentTime = 0;
        this.dom.voiceAudio.volume = (this.config.volume || 80) / 100.0;
        const p = this.dom.voiceAudio.play();
        if (p !== undefined) p.catch(() => {});
      } catch (e) {
        console.warn("대사 음성 재생 실패:", e);
      }
    }
  }

  // 종료: OST를 멈추고 평상시 AI 지령 모드로 되돌린다.
  endRyuenStory() {
    this.storyMode = false;
    this.storyIndex = -1;

    if (this.dom.ostAudio) {
      try {
        this.dom.ostAudio.pause();
        this.dom.ostAudio.currentTime = 0;
      } catch (e) { /* noop */ }
    }
    if (this.dom.voiceAudio) {
      try {
        this.dom.voiceAudio.pause();
      } catch (e) { /* noop */ }
    }

    this.updateDisplayIdle();
    this.showToast("정상 모드로 돌아왔습니다.");
  }

  clearTimers() {
    if (this.animInterval) clearInterval(this.animInterval);
    if (this.beepTimeout) clearTimeout(this.beepTimeout);
    this.animInterval = null;
    this.beepTimeout = null;
  }

  // ── 상태 1: BEEPING (동시에 Gemini API로 새 지령을 실시간 생성) ──
  startBeeping() {
    this.state = STATE.BEEPING;
    this.playBeep();

    this.dom.progressBar.classList.remove('visible');
    this.dom.displayTime.classList.remove('visible');
    this.dom.displayMain.className = 'main-text dimmed';
    this.dom.displaySubLabel.textContent = "AI 지령 수신 중...";

    let dotStep = 0;
    this.animInterval = setInterval(() => {
      dotStep = (dotStep + 1) % 4;
      const dots = "• ".repeat(dotStep) + "◦ ".repeat(3 - dotStep);
      this.dom.displayDots.textContent = dots;
      this.dom.displayMain.textContent = this.getRandomCipher(11);
    }, 100);

    // 최소 대기 시간(비프 연출)과 Gemini 응답을 동시에 기다린 뒤 디코딩으로 넘어간다.
    const minWait = new Promise((resolve) => {
      this.beepTimeout = setTimeout(resolve, 1100);
    });
    const fetchPromise = this.generateGeminiMessage(this.config.gemini_hint);

    Promise.all([minWait, fetchPromise]).then(([, text]) => {
      if (this.state !== STATE.BEEPING) return; // 대기 중 사용자가 다른 조작을 했으면 무시
      this.pendingMessageText = text;
      this.startDecoding();
    }).catch((err) => {
      if (this.state !== STATE.BEEPING) return;
      console.error("AI 지령 생성 실패:", err);
      this.showGenerationError(err && err.message ? err.message : "AI 지령을 받아오지 못했습니다.");
    });
  }

  // Gemini 호출 실패 시 화면에 에러를 표시하고 IDLE로 되돌린다.
  showGenerationError(message) {
    this.clearTimers();
    this.state = STATE.IDLE;
    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayMain.textContent = "_SIGNAL LOST_";
    this.dom.displayMain.className = 'main-text amber';
    this.showToast(message);
  }

  // ── 상태 2: DECODING ──
  startDecoding() {
    this.clearTimers();
    this.state = STATE.DECODING;

    const targetText = this.pendingMessageText || "";
    if (!targetText) {
      this.updateDisplayIdle();
      return;
    }

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

    if (!this.pendingMessageText) return;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "터치하면 새 지령을 수신합니다";
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayTime.classList.remove('visible');

    this.dom.displayMain.textContent = this.pendingMessageText;
    this.dom.displayMain.className = 'main-text accent';
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
    this.dom.sliderVolume.value = this.config.volume;
    this.dom.labelVolume.textContent = `${this.config.volume}%`;
    this.dom.selectDecodeSpeed.value = this.config.decode_speed;
    this.dom.selectSoundType.value = this.config.sound_type || 'file';
    this.dom.toggleScanlines.checked = this.config.scanlines;
    this.dom.toggleVignette.checked = this.config.vignette !== false;
    if (this.dom.inputGeminiKey) {
      this.dom.inputGeminiKey.value = this.config.gemini_api_key || '';
    }
    if (this.dom.inputGeminiHint) {
      this.dom.inputGeminiHint.value = this.config.gemini_hint || '';
    }
    this.applyCustomColors(this.config.font_color, this.config.bg_color);

    this.dom.modal.classList.remove('hidden');
  }

  closeModal() {
    this.applySettings();
    this.dom.modal.classList.add('hidden');
  }

  saveSettingsFromModal() {
    const newConfig = {
      orientation: this.dom.selectOrientation.value || 'landscape',
      volume: parseInt(this.dom.sliderVolume.value, 10),
      decode_speed: this.dom.selectDecodeSpeed.value,
      sound_type: this.dom.selectSoundType.value,
      font_color: this.config.font_color || '#2FBFFC',
      bg_color: this.config.bg_color || '#000000',
      scanlines: this.dom.toggleScanlines.checked,
      vignette: this.dom.toggleVignette.checked,
      gemini_api_key: this.dom.inputGeminiKey ? this.dom.inputGeminiKey.value.trim() : (this.config.gemini_api_key || ''),
      gemini_hint: this.dom.inputGeminiHint ? this.dom.inputGeminiHint.value.trim() : (this.config.gemini_hint || ''),
    };
    this.saveConfig(newConfig);
    this.showToast("환경 설정이 저장되었습니다.");
    this.closeModal();
  }

  resetDefaults() {
    if (confirm("모든 설정을 기본값으로 초기화하시겠습니까?")) {
      this.saveConfig(DEFAULT_CONFIG);
      this.openModal();
      this.showToast("기본값으로 복원되었습니다.");
    }
  }

  // ── Gemini AI 실시간 지령 생성 ──
  // 사용자가 화면을 터치할 때마다 호출되어, '프로젝트 문' 세계관 관리부 톤의
  // 지령 한 줄을 실시간으로 생성한다(사전 작성/저장된 메시지를 쓰지 않음).
  buildGeminiSingleMessageRequestBody(hint) {
    const systemPrompt = [
      "너는 '프로젝트 문(Project Moon)' 세계관(로보토미 코퍼레이션, 라이브러리 오브 루이나, 림버스 컴퍼니)에 등장하는",
      "'검지(Index)'가 단말기로 하달하는 '지령' 한 줄을 작성하는 역할이다.",
      "",
      "규칙:",
      "- 이유는 알 수 없지만 절대적으로 순응해야 하는, 서늘하고 단호한 명령조로 쓴다. (예: '~할 것.', '~하라.')",
      "- 지령 문구는 45자 이내로 한두 문장으로 간결하게 작성한다.",
      "- 실존 캐릭터 이름이나 대사를 그대로 재현하지 말고, 분위기만 차용한 창작 지령을 만든다.",
      "- 매번 새롭고 다른, 다소 황당하더라도 그럴듯한 소재로 작성한다.",
      "- 반드시 한국어로만 작성한다.",
      "- 다른 설명이나 따옴표, 인사말 없이 지령 문구 텍스트 하나만 출력한다."
    ].join("\n");

    let userPrompt = "위 규칙에 맞는 지령을 하나 발급하라.";
    if (hint && hint.trim()) {
      userPrompt += ` (현재 상황 참고: ${hint.trim()})`;
    }

    return {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 1.1,
        maxOutputTokens: 500,
        thinkingConfig: {
          thinkingLevel: "minimal" // 아주 짧은 한 줄 지령이므로 사고 단계를 최소로 낮춰 토큰을 답변에 집중시킨다
        }
      }
    };
  }

  // Gemini API를 직접 호출해서 지령 텍스트 한 줄을 반환한다. 실패 시 예외를 던진다.
  async generateGeminiMessage(hint) {
    const apiKey = (this.config.gemini_api_key || "").trim();
    if (!apiKey || apiKey.length < 10) {
      throw new Error("Gemini API 키를 입력해주세요.");
    }

    const model = "gemini-3.6-flash"; // 필요시 최신 모델명으로 교체 가능
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = this.buildGeminiSingleMessageRequestBody(hint);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Gemini API 오류 (HTTP ${resp.status}): ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Gemini 응답에서 지령 내용을 찾을 수 없습니다.");
    }

    const cleaned = rawText.trim().replace(/^["'\s]+|["'\s]+$/g, "");
    return this.truncateText(cleaned, 60);
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
