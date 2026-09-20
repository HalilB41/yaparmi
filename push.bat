@echo off
cd /d "%~dp0"
echo Degisiklikler GitHub'a gonderiliyor...
git add .
git commit -m "guncelleme %date% %time%"
git push
echo.
echo Islem tamamlandi.
pause
