# yaparmi.com

Berkay hakkında ne sorulursa sorulsun, kâhin (site) hep olumsuz ama esprili
bir cevap veriyor — cevapları gerçek zamanlı olarak Nous Research üzerinden
bir yapay zeka üretiyor. Arka planda 2 ses dosyası sırayla çalıyor, isteyen
sağ alttaki butondan kapatabiliyor. Sorular istersen Firebase'e kaydediliyor.

**Berkayın Ahırı** ayrı bir şey: orada yapay zeka YOK, sadece siteye giren
gerçek ziyaretçiler Firebase üzerinden birbiriyle gerçek zamanlı yazışıyor.

## Dosya yapısı

```
yaparmi-site/
├─ index.html
├─ spor.html, ders.html, oyun.html, sosyal.html, galeri.html   <- "çok yakında" sayfaları
├─ css/style.css
├─ js/firebase-config.js   <- kendi Firebase bilgilerini buraya yapıştır
├─ js/script.js
├─ api/ask.js              <- Vercel serverless function, Nous Research'e soru gönderir
├─ audio/
│  ├─ track1.mp3
│  └─ track2.mp3
├─ robots.txt              <- arama motorlarına kapalı (sadece link ile girilsin diye)
├─ vercel.json
├─ push.bat                <- kodu tek tıkla GitHub'a gönderir
└─ .gitignore
```

## 0) Nous Research (Hermes) API key ekle

Ana soru-cevap kutusunun ("Berkay ... yapar mı?") cevapları Nous Research
üzerinden üretiliyor. Key yoksa/başarısız olursa site kendi sabit yedek
cevaplarına döner, hiçbir zaman bozulmaz.

1. https://portal.nousresearch.com adresine git, hesabınla giriş yap.
2. API Keys kısmından yeni bir key oluştur.
3. Vercel'de `yaparmi` projesine gir → **Settings > Environment Variables**.
4. Key adı: `NOUS_API_KEY`, Value: oluşturduğun key. **Save**.
5. (İstersen) farklı bir model denemek istersen `NOUS_MODEL` adında ikinci bir
   değişken ekleyip Nous Portal panelindeki modellerden birinin adını
   (ör. `z-ai/glm-5.3-flash`) yazabilirsin.
6. **Deployments** sekmesinden **Redeploy** de.

## 1) Ses dosyalarını ekle

`audio/` klasörüne iki mp3 dosyasını **track1.mp3** ve **track2.mp3** isimleriyle koy.

## 2) Firebase kurulumu

Firebase hem "Genel" kutusundaki soruları kaydetmek hem de **Berkayın
Ahırı**'nın gerçek zamanlı, gerçek kullanıcı sohbetini çalıştırmak için
kullanılıyor. Ahır olmadan da site çalışır ama Ahır'a girildiğinde "Firebase
ayarlanmamış" uyarısı görünür.

1. https://console.firebase.google.com → **Add project** → proje adı ver (ör. `yaparmi`).
2. Sol menü → **Build > Firestore Database** → **Create database** → "test mode" ile başlat, sonra aşağıdaki kuralları uygula.
3. Sol menü → **Build > Authentication** → **Get started** → **Sign-in method** sekmesinden **Anonymous**'u aç ve **Enable** yap. (Ahır'daki spam korumasının çalışması için bu şart — her ziyaretçiye görünmez, isimsiz bir kimlik veriyor.)
4. Sol üstteki dişli ⚙️ → **Project settings** → **Your apps** → **</>** (Web) simgesine tıkla, bir isim ver, "Also set up Firebase Hosting" kutusunu **işaretleme**.
5. Sana verilen `firebaseConfig` objesini kopyala, `js/firebase-config.js` içindeki `BURAYA_...` yerlerine yapıştır.

### Firestore güvenlik kuralları (spam/saldırı koruması dahil)

Firebase Console → Firestore Database → **Rules** sekmesine şunu yapıştır ve
**Publish** de:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // "Genel" kutusundaki sorular — herkes ekleyebilir, kimse okuyamaz
    // (sadece sen Firebase konsolundan görebilirsin).
    match /sorular/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Berkayın Ahırı — gerçek kullanıcı mesajları. Sadece (anonim de olsa)
    // giriş yapmış biri yazabilir, kendi kimliği (uid) dışında birini taklit
    // edemez, mesaj/isim uzunluğu sınırlı, ve son mesajından en az 3 saniye
    // geçmeden yeni mesaj atamaz (aşağıdaki ahir_limits koleksiyonuyla).
    match /ahir_mesajlar/{mesajId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(['uid', 'kullaniciAdi', 'mesaj', 'tarih'])
        && request.resource.data.kullaniciAdi is string
        && request.resource.data.kullaniciAdi.size() > 0
        && request.resource.data.kullaniciAdi.size() <= 20
        && request.resource.data.mesaj is string
        && request.resource.data.mesaj.size() > 0
        && request.resource.data.mesaj.size() <= 300
        && request.resource.data.tarih == request.time
        && (
          !exists(/databases/$(database)/documents/ahir_limits/$(request.auth.uid))
          || request.time > get(/databases/$(database)/documents/ahir_limits/$(request.auth.uid)).data.sonMesajZamani + duration.value(3, 's')
        );
      allow update, delete: if false;
    }

    // Ahır hız sınırı kaydı — herkes SADECE kendi belgesini okuyup yazabilir.
    match /ahir_limits/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['sonMesajZamani'])
        && request.resource.data.sonMesajZamani == request.time;
    }
  }
}
```

Bu kurallar üç şeyi garanti eder: (1) biri Firestore'a doğrudan istek atsa
bile giriş yapmadan hiçbir şey yazamaz, (2) kendi kimliğinin dışında birini
taklit edip spam atamaz, (3) 3 saniyeden sık mesaj gönderemez — yani site
"birileri saldırıp çökertsin" diye açık bir kapı bırakmıyor.

Firebase eklemezsen site bozulmaz: "Genel" kutusu normal çalışmaya devam
eder, sorular hiçbir yere kaydedilmez ve Ahır'a girildiğinde bağlı olmadığını
söyleyen bir uyarı gösterilir.

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
- Yedek cevap havuzunu (`js/script.js` içindeki `FALLBACK_RESPONSES` dizisi)
  istediğin an değiştirip yeni cümleler ekleyebilirsin.
- Berkayın Ahırı'ndaki mesajlar Firestore'da kalıcı olarak duruyor (sohbet
  ekranında sadece en son 50 mesaj gösteriliyor). Zamanla çok birikirse
  Firebase konsolundan elle temizleyebilirsin.
