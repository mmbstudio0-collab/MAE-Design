@echo off
chcp 65001 >nul
setlocal
title Karantina Hatti - Windows EXE Olusturucu

echo ==================================================
echo   Karantina Hatti - Windows .EXE Paketleyici
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi. Lutfen https://nodejs.org adresinden LTS surumu kurun.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [UYARI] .env dosyasi bulunamadi!
  set /p MAPS_KEY="Google Maps API Anahtarinizi girin (VITE_GOOGLE_MAPS_API_KEY): "
  if "%MAPS_KEY%"=="" (
    echo [HATA] Google Maps uydu haritasi icin API anahtari gereklidir.
    pause
    exit /b 1
  )
  echo VITE_GOOGLE_MAPS_API_KEY=%MAPS_KEY%> .env
  echo .env dosyasi olusturuldu.
  echo.
)

echo [1/3] Proje bagimliliklari yukleniyor...
call npm install
if errorlevel 1 (
  echo [HATA] npm install basarisiz oldu.
  pause
  exit /b 1
)

echo.
echo [2/3] Electron masaustu paketleyicisi hazirlaniyor...
call npm install --no-save electron@^35.0.0 electron-builder@^25.1.8
if errorlevel 1 (
  echo [HATA] Electron kurulumu basarisiz oldu.
  pause
  exit /b 1
)

echo.
echo [3/3] Oyun derleniyor ve Portable .EXE olusturuluyor...
call npm run dist:win
if errorlevel 1 (
  echo [HATA] EXE olusturma sirasinda hata olustu.
  pause
  exit /b 1
)

echo.
echo ==================================================
echo   TAMAMLANDI!
echo   Cikti: release\KarantinaHatti-Portable.exe
echo   Bu dosyayi masaustunuze tasiyip cift tiklayarak oynayabilirsiniz.
echo ==================================================
pause
