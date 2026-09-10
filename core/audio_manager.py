from __future__ import annotations
import os
import math
import pygame

class AudioManager:
    """비프음 및 효과음 재생 관리자"""
    def __init__(self, resource_dir: str):
        self.resource_dir = resource_dir
        self.volume = 0.8
        self.sound = None
        self._init_mixer()
        self._load_sound()

    def _init_mixer(self):
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
        except Exception as e:
            print(f"오디오 믹서 초기화 오류: {e}")

    def _load_sound(self):
        candidates = ["beep.wav", "beep.mp3", "beep.ogg"]
        for name in candidates:
            path = os.path.join(self.resource_dir, name)
            if os.path.exists(path):
                try:
                    self.sound = pygame.mixer.Sound(path)
                    self.sound.set_volume(self.volume)
                    return
                except Exception as e:
                    print(f"사운드 파일 로드 실패 ({name}): {e}")
        
        # 파일이 없을 경우 신디사이징 비프음 생성
        self.sound = self._generate_synth_beep()
        if self.sound:
            self.sound.set_volume(self.volume)

    def _generate_synth_beep(self) -> pygame.mixer.Sound:
        sample_rate = 44100
        freq = 1000
        duration_sec = 2.0
        n_samples = int(sample_rate * duration_sec)

        buf = bytearray(n_samples * 2)
        for i in range(n_samples):
            t = i / sample_rate
            envelope = max(0.0, 1.0 - (i / n_samples) * 0.3)
            value = int(16000 * envelope * math.sin(2 * math.pi * freq * t))
            buf[i * 2] = value & 0xFF
            buf[i * 2 + 1] = (value >> 8) & 0xFF
        return pygame.mixer.Sound(buffer=bytes(buf))

    def set_volume(self, volume_percent: int):
        """0 ~ 100 사이의 정수 볼륨 설정"""
        self.volume = max(0.0, min(1.0, volume_percent / 100.0))
        if self.sound:
            self.sound.set_volume(self.volume)

    def play_beep(self):
        if self.sound:
            self.sound.stop()
            self.sound.play()

    def stop(self):
        if self.sound:
            self.sound.stop()
