from __future__ import annotations
import random
import string

CIPHER_CHARS = string.ascii_uppercase + string.digits + "!@#$%&*+-=?<>"

def generate_encrypted_text(length: int = None) -> str:
    """랜덤 암호화 문자열 생성"""
    if length is None:
        length = random.randint(9, 14)
    return "".join(random.choice(CIPHER_CHARS) for _ in range(length))

def generate_decoding_text(target_text: str, progress: float) -> str:
    """
    progress (0.0 ~ 1.0)에 따라 일부는 원본 글자, 나머지는 난수 암호문으로 조합된 문자열 생성
    """
    if not target_text:
        return ""
    if progress >= 1.0:
        return target_text

    total_len = len(target_text)
    revealed_count = int(total_len * progress)
    
    result = []
    for i in range(total_len):
        if i < revealed_count:
            result.append(target_text[i])
        else:
            if target_text[i] == " ":
                result.append(" ")
            else:
                result.append(random.choice(CIPHER_CHARS))
    return "".join(result)

def generate_dots_display(total_dots: int = 3, current_timer: float = 0.0) -> str:
    """비프음 재생 중 출력되는 점(dot) 표시"""
    # 0.5초 주기로 점이 채워짐
    active_count = int((current_timer * 2) % (total_dots + 1))
    return "• " * active_count + "◦ " * (total_dots - active_count)
