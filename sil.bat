@echo off
cd /d "%~dp0"
echo Kullanilmayan dosyalar siliniyor...
echo.
for %%f in (spor.html ehliyet.html ders.html bingo.html js\spor.js js\spor-admin.js js\rekor.js js\ehliyet.js js\ehliyet-admin.js js\ders.js js\bingo.js tahmin.html soz.html js\topluluk.js js\topluluk-admin.js js\tahmin.js js\soz.js js\olasi.js js\harita.js) do (
  if exist "%%f" (
    del "%%f"
    echo Silindi: %%f
  ) else (
    echo Zaten yok: %%f
  )
)
echo.
echo Bitti. Simdi push.bat calistir.
pause
del "%~f0"
