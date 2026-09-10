#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[BUILD] Android APK 빌드 시작..."

# 1. 최신 웹 에셋을 Android assets 디렉토리로 동기화
mkdir -p "$SCRIPT_DIR/android/app/src/main/assets/assets"
cp "$SCRIPT_DIR/index.html" "$SCRIPT_DIR/android/app/src/main/assets/index.html"
cp "$SCRIPT_DIR/style.css" "$SCRIPT_DIR/android/app/src/main/assets/style.css"
cp "$SCRIPT_DIR/app.js" "$SCRIPT_DIR/android/app/src/main/assets/app.js"
cp -r "$SCRIPT_DIR/assets/"* "$SCRIPT_DIR/android/app/src/main/assets/assets/"

# 2. JAVA_HOME 자동 탐색 (환경 변수가 지정되지 않은 경우)
if [ -z "$JAVA_HOME" ]; then
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null)
  elif [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  elif [ -d "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
    export JAVA_HOME="/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  elif [ -d "/usr/lib/jvm/java-17-openjdk" ]; then
    export JAVA_HOME="/usr/lib/jvm/java-17-openjdk"
  fi
fi

# 3. ANDROID_HOME / ANDROID_SDK_ROOT 자동 탐색
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  elif [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
  elif [ -d "/usr/local/share/android-sdk" ]; then
    export ANDROID_HOME="/usr/local/share/android-sdk"
  fi
fi

if [ -n "$ANDROID_HOME" ]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  if [ ! -f "$SCRIPT_DIR/android/local.properties" ]; then
    echo "sdk.dir=$ANDROID_HOME" > "$SCRIPT_DIR/android/local.properties"
  fi
fi

# 4. Gradle 실행기 결정 (프로젝트 내 gradlew 우선, 없으면 시스템 gradle)
cd "$SCRIPT_DIR/android"
if [ -f "./gradlew" ]; then
  chmod +x ./gradlew
  GRADLE_CMD="./gradlew"
elif command -v gradle >/dev/null 2>&1; then
  GRADLE_CMD="gradle"
else
  echo "[ERROR] Gradle을 찾을 수 없습니다. ./gradlew 또는 시스템 gradle이 필요합니다."
  exit 1
fi

$GRADLE_CMD clean assembleDebug

# 5. dist 디렉토리로 APK 복사
cd "$SCRIPT_DIR"
mkdir -p "$SCRIPT_DIR/dist"
APK_SOURCE="$SCRIPT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_SOURCE" ]; then
  cp "$APK_SOURCE" "$SCRIPT_DIR/dist/LimbusBeep-v2.1.1.apk"
  cp "$APK_SOURCE" "$SCRIPT_DIR/dist/LimbusBeep-v2.1.0.apk"
  cp "$APK_SOURCE" "$SCRIPT_DIR/dist/LimbusBeep-latest.apk"
  echo "[SUCCESS] Android APK 빌드 완료: dist/LimbusBeep-v2.1.1.apk"
else
  echo "[ERROR] 빌드 결과물 APK를 찾을 수 없습니다: $APK_SOURCE"
  exit 1
fi
