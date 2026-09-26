@echo off
cd /d "%~dp0"
rem OneDrive klasordeki dosyalari kilitledigi icin Git'in otomatik bakim/toparlama islerini kapat
git config gc.auto 0
git config maintenance.auto false
echo Degisiklikler GitHub'a gonderiliyor...
git add .
git commit -m "guncelleme %date% %time%"
git push
echo.
echo Islem tamamlandi.
pause
