@echo off
cd /d "%~dp0"
rem OneDrive klasordeki dosyalari kilitledigi icin Git'in otomatik toparlama isini kapat
git config gc.auto 0
echo Degisiklikler GitHub'a gonderiliyor...
git add .
git commit -m "guncelleme %date% %time%"
git push
echo.
echo Islem tamamlandi.
pause
