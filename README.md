# yaparmi.com

Berkay hakkında ne sorulursa sorulsun, kâhin (site) hep olumsuz ama esprili
bir cevap veriyor — cevapları gerçek zamanlı olarak Google Gemini AI üretiyor.
Arka planda 2 ses dosyası sırayla çalıyor, isteyen sağ alttaki butondan
kapatabiliyor. Sorular istersen Firebase'e kaydediliyor.

## Dosya yapısı

```
yaparmi-site/
├─ index.html
├─ css/style.css
├─ js/firebase-config.js   <- kendi Firebase bilgilerini buraya yapıştır
├─ js/script.js
├─ api/ask.js              <- Vercel serverless function, Gemini AI'ya soru gönderir
├─ audio/
│  ├─ track1.mp3
│  └─ track2.mp3
├─ robots.txt              <- arama motorlarına kapalı (sadece link ile girilsin diye)
├─ vercel.json
├─ push.bat                <- kodu tek tıkla GitHub'a gönderir
└─ .gitignore
```

## 0) AI cevapları için Gemini API key al (yeni)

1. https://aistudio.google.com/apikey adresine git, Google hesabınla giriş yap.
2. **Create API key** butonuna bas, ücretsiz bir key oluşacak (Gemini'nin
   ücretsiz kullanım kotası var, küçük bir şaka sitesi için fazlasıyla yeterli).
3. Oluşan key'i kopyala.
4. Vercel'de projenin içine gir → **Settings > Environment Variables**.
5. Key adı: `GEMINI_API_KEY`, Value: kopyaladığın key. **Save**.
6. Kaydettikten sonra projeyi bir kere yeniden deploy et (Deployments sekmesinden
   son deployment'ın yanındaki "..." menüsünden **Redeploy**) ki değişken aktif olsun.

Not: Bu key'i asla `js/` klasöründeki dosyalara veya GitHub'a yapıştırma —
sadece Vercel'in Environment Variables kısmına eklenir, orada gizli kalır.
API key eklemezsen site bozulmaz, sadece sabit/rastgele yedek cevapları kullanır.

## 1) Ses dosyalarını ekle

`audio/` klasörüne iki mp3 dosyasını **track1.mp3** ve **track2.mp3** isimleriyle koy.
(Bu sohbette gönderdiğini söylediğin dosyalar bana ulaşmadı, o yüzden şu an
placeholder olarak duruyor — `audio/README-SES-DOSYALARI.txt` dosyasına bak.)

## 2) Firebase kurulumu (opsiyonel ama istedin)

1. https://console.firebase.google.com → **Add project** → proje adı ver (ör. `yaparmi`).
2. Sol menü → **Build > Firestore Database** → **Create database** → "test mode" ile başlat, sonra aşağıdaki kuralları uygula.
3. Sol üstteki dişli ⚙️ → **Project settings** → **Your apps** → **</>** (Web) simgesine tıkla, bir isim ver, "Also set up Firebase Hosting" kutusunu **işaretleme**.
4. Sana verilen `firebaseConfig` objesini kopyala, `js/firebase-config.js` içindeki `BURAYA_...` yerlerine yapıştır.

### Önerilen Firestore güvenlik kuralları

Firebase Console → Firestore Database → **Rules** sekmesine şunu yapıştır
(herkes soru **ekleyebilsin** ama kimse başkalarının sorularını
**okuyamasın**, sadece sen konsoldan görebilirsin):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sorular/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }
  }
}
```

Firebase eklemezsen de site bozulmaz, sadece sorular hiçbir yere kaydedilmez.

## 3) GitHub'a yükle

Bu klasörün içindeyken:

```bash
git init
git add .
git commit -m "yaparmi.com ilk versiyon"
git branch -M main
git remote add origin https://github.com/<kullanici-adin>/yaparmi-site.git
git push -u origin main
```

(Önce GitHub'da boş bir repo oluşturman gerekiyor: New repository, README/gitignore eklemeden.)

## 4) Vercel'e deploy et

1. https://vercel.com → **Add New > Project**.
2. Az önce push ettiğin GitHub reposunu seç, **Import** de.
3. Framework Preset: **Other** (statik site, build ayarı gerekmiyor).
4. **Deploy** butonuna bas. Birkaç saniyede `xxx.vercel.app` linkin hazır olur.

## 5) yaparmi.com domainini bağla

1. Vercel'de projenin içine gir → **Settings > Domains** → `yaparmi.com` yaz, **Add**.
2. Vercel sana bir A kaydı veya CNAME (genelde `76.76.21.21` A kaydı, alt alan adları için CNAME) gösterecek.
3. Domaini aldığın yerin (GoDaddy, Namecheap, Natro vb.) DNS ayarlarına gidip bu kaydı ekle.
4. DNS yayılması genelde birkaç dakika–birkaç saat sürer; Vercel domain durumunu otomatik "Valid" yapınca site `yaparmi.com` üzerinden açılır.

## Notlar

- `robots.txt` ile Google gibi arama motorlarına "indexleme" dedik, yani sadece
  linki bilenler bulabilir, rastgele aramalarda çıkmaz.
- Otomatik ses: tarayıcılar sesli otomatik oynatmayı bazen engelliyor. Öyle
  olursa ekranda "🔊 Sesi başlat" düğmesi belirir, bir tıkla başlar. Sağ alttaki
  yuvarlak buton sesi istediğin an kapatıp açar.
- Cevap havuzunu (`js/script.js` içindeki `RESPONSES` dizisi) istediğin an
  değiştirip yeni cümleler ekleyebilirsin.
