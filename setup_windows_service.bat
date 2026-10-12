@echo off
title Cai dat Mosquitto Service co xac thuc tren Windows
echo ====================================================================
echo  CAU HINH MOSQUITTO BROKER TREN WINDOWS CO XAC THUC (AUTHENTICATION)
echo ====================================================================

:: Kiem tra quyen Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [!] CHU Y: File nay can quyen Administrator de cap nhat Windows Service.
    echo     Hay click chuot phai vao file nay va chon "Run as administrator"!
    echo.
    pause
    exit /b 1
)

echo [1/3] Sao chep file cau hinh va file mat khau vao thu muc Mosquitto...
copy /Y "%~dp0passwd" "C:\Program Files\mosquitto\passwd" >nul
(
echo listener 1884 0.0.0.0
echo allow_anonymous false
echo password_file C:\Program Files\mosquitto\passwd
) > "C:\Program Files\mosquitto\mosquitto.conf"

echo [2/3] Dang khoi dong lai Windows Service Mosquitto...
net stop mosquitto >nul 2>&1
net start mosquitto

echo [3/3] Kiem tra trang thai dich vu...
sc query mosquitto | findstr STATE

echo.
echo ====================================================================
echo  HOAN TAT! Mosquitto Broker tren Windows da bat xac thuc:
echo  - Port: 1884 (Lắng nghe 0.0.0.0 cho ca ESP8266 ket noi Wi-Fi)
echo  - Anonymous: DA CHAN
echo  - Username: tainguyen / Password: tainguyen
echo ====================================================================
pause
