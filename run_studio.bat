@echo off
title LEDCanvas Studio Starter
cd /d "%~dp0"

echo ==============================================
echo       LEDCanvas Studio 자동 실행기
echo ==============================================

echo [1/3] Python 설치 여부 확인 중...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python이 설치되어 있지 않습니다.
    echo [!] Microsoft Store로 이동하여 Python을 설치합니다.
    echo [!] 설치 완료 후 이 파일을 다시 실행해 주세요.
    timeout /t 3
    start ms-windows-store://pdp/?ProductId=9PJPW5LDXLZ5
    pause
    exit /b
)

echo [2/3] 기본 브라우저에서 프로그램 실행 중...
start "" "http://localhost:8000"

echo [3/3] 로컬 서버 가동 중 (포트: 8000)...
echo.
echo ----------------------------------------------
echo  서버를 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo ----------------------------------------------
echo.

python -m http.server 8000
