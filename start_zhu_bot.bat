@echo off
title ZHU Bot Launcher
echo ===================================================
echo 👑 Starting ZHU Bot and Elite Dashboard...
echo ===================================================

echo [1/2] Starting Discord Bot ^& Dashboard Server...
:: Membuka jendela CMD baru untuk menjalankan bot
start "ZHU Bot Server" cmd /k "npm run dev"

echo [2/2] Starting Cloudflare Tunnel...
echo Waiting 5 seconds for the server to initialize...
timeout /t 5 /nobreak >nul

:: Membuka jendela CMD baru untuk tunnel
start "ZHU Dashboard Tunnel" cmd /k "npm run tunnel"

echo ===================================================
echo ✅ All systems launched!
echo Periksa jendela "ZHU Dashboard Tunnel" untuk melihat
echo link publik Cloudflare Anda (https://...trycloudflare.com)
echo ===================================================
pause
