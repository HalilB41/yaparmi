# yaparmi.com

Berkay hakkında ne sorulursa sorulsun, kâhin (site) hep olumsuz ama esprili
bir cevap veriyor — cevapları gerçek zamanlı olarak Nous Research üzerinden
bir yapay zeka üretiyor. Arka planda 2 ses dosyası sırayla çalıyor, isteyen
sağ alttaki butondan kapatabiliyor. Sorular istersen Firebase'e kaydediliyor.

**Berkayın Ahırı** ayrı bir şey: orada yapay zeka YOK, sadece siteye giren
gerçek ziyaretçiler Firebase üzerinden birbiriyle gerçek zamanlı yazışıyor.
Ahır'da kullanılan takma ad, aşağıdaki gerçek **Kayıt Ol** hesabıyla
**eşdeğer değil** — biri şifresiz/geçici bir takma ad, diğeri kullanıcı
adı + şifre ile gerçek bir hesap. İkisi de tamamen opsiyonel, hiçbir şey
için kayıt olmak zorunlu değil.

## Dosya yapısı

```
yaparmi-site/
├─ index.html
├─ spor.html, oyun.html   <- spor "çok yakında", oyun sayfası
├─ ders.html        <- şakadan optik form: telefonu karekoda tut, 85-99 arası rastgele puan
├─ sosyal.html      <- "hikaye seç" oyunu (İzmir'e gitsin / evde kalsın ...)
├─ galeri.html      <- yatay kaydırmalı fotoğraf galerisi + fotoğraf öner
├─ admin.html       <- sadece "admin" kullanıcı adına giriş yapınca görünür
├─ css/style.css
├─ js/firebase-config.js   <- kendi Firebase bilgilerini buraya yapıştır
├─ js/site.js       <- TÜM sayfalarda ortak: hamburger menü + giriş/kayıt widget'ı
├─ js/script.js     <- sadece index.html: soru-cevap kutusu + Berkayın Ahırı
├─ js/gallery.js    <- sadece galeri.html
├─ js/admin.js      <- sadece admin.html
├─ js/ders.js       <- sadece ders.html (sahte karekod, deklanşör sesi, rastgele puan)
├─ js/sosyal-hikaye.js  <- Sosyal Hayat hikayesinin varsayılan hali + Firestore'dan okuma
├─ js/sosyal.js     <- sadece sosyal.html (hikaye oynatıcı)
├─ js/sosyal-editor.js  <- admin.html'deki "Sosyal Hayat Düzenle" (algoritma şeması + editör)
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

Firebase; "Genel" kutusundaki soruları kaydetmek, **Berkayın Ahırı**'nın
gerçek zamanlı sohbetini çalıştırmak, **Giriş Yap / Kayıt Ol** hesap
sistemini ve **Galeri**'yi çalıştırmak için kullanılıyor. Firebase
eklemezsen site bozulmaz: "Genel" kutusu normal çalışır, geri kalanı
(Ahır, giriş/kayıt, galeri) "bağlı değil" uyarısı gösterir.

1. https://console.firebase.google.com → **Add project** → proje adı ver (ör. `yaparmi`).
2. Sol menü → **Build > Firestore Database** → **Create database** → "test mode" ile başlat, sonra aşağıdaki kuralları uygula.
3. Sol menü → **Build > Authentication** → **Get started** → **Sign-in method** sekmesinden **Anonymous**'u ve **Email/Password**'ü aç, ikisini de **Enable** yap.
   - **Anonymous**: Ahır'daki (ve galerideki fotoğraf önerisi gönderme) spam korumasının çalışması için şart — her ziyaretçiye görünmez, isimsiz bir kimlik veriyor.
   - **Email/Password**: sağ üstteki **Giriş Yap / Kayıt Ol** için şart. Kullanıcı sadece bir kullanıcı adı + şifre giriyor; arka planda bu, `kullaniciadi@yaparmi.local` gibi sahte bir e-postaya çevrilip Firebase'in kendi (güvenli, şifreleri düz metin tutmayan) e-posta/şifre girişiyle işleniyor — gerçek bir e-posta adresi değil, hiçbir yere mail atılmıyor.
4. Sol üstteki dişli ⚙️ → **Project settings** → **Your apps** → **</>** (Web) simgesine tıkla, bir isim ver, "Also set up Firebase Hosting" kutusunu **işaretleme**.
5. Sana verilen `firebaseConfig` objesini kopyala, `js/firebase-config.js` içine yapıştır.

Not: **Storage'a hiç gerek yok** — galeri de dahil her şey Firestore
üzerinden (ücretsiz plan) çalışıyor, aşağıda anlatılıyor.

### Firestore güvenlik kuralları (spam/saldırı koruması dahil)

Firebase Console → Firestore Database → **Rules** sekmesine şunu yapıştır ve
**Publish** de:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && get(/databases/$(database)/documents/kullanicilar/$(request.auth.uid)).data.rol == 'admin';
    }

    // "Genel" kutusundaki sorular — herkes ekleyebilir, sadece admin okuyabilir
    // (admin panelinden "kim ne zaman ne sormuş" diye görmek için).
    match /sorular/{docId} {
      allow create: if true;
      allow read: if isAdmin();
      allow update, delete: if false;
    }

    // Kayıtlı hesaplar (kullanıcı adı + şifre, sağ üstteki Giriş Yap/Kayıt Ol).
    // Belge ID'si = uid. "admin" kullanıcı adını İLK ALAN kişi otomatik
    // admin rolü alır ve tüm yetkilere sahip olur.
    match /kullanicilar/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
      allow create: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['kullaniciAdi', 'rol', 'olusturulmaTarihi'])
        && request.resource.data.kullaniciAdi is string
        && request.resource.data.kullaniciAdi.size() > 0
        && request.resource.data.kullaniciAdi.size() <= 20
        && request.resource.data.rol == (request.resource.data.kullaniciAdi == 'admin' ? 'admin' : 'kullanici')
        && request.resource.data.olusturulmaTarihi == request.time;
      allow update, delete: if false;
    }

    // Berkayın Ahırı'ndaki takma ad rezervasyonu (kayıt olmakla eşdeğer
    // DEĞİL). Belge ID'si = takma adın kendisi (boşluksuz, küçük harf, en
    // fazla 12 karakter), bu yüzden aynı isim ikinci kez "create"
    // edilemez (Firestore bunu "update" sayar ve update kapalı olduğu
    // için istek reddedilir) — yani aynı isimden 2. kişi asla giremez.
    match /ahir_kullanicilar/{kullaniciAdi} {
      allow read: if false;
      allow create: if request.auth != null
        && kullaniciAdi.matches('^[^\\s]{1,12}$')
        && request.resource.data.keys().hasOnly(['uid'])
        && request.resource.data.uid == request.auth.uid;
      allow update: if request.auth != null
        && request.auth.uid == resource.data.uid
        && request.resource.data.keys().hasOnly(['uid'])
        && request.resource.data.uid == request.auth.uid;
      allow delete: if false;
    }

    // Berkayın Ahırı — gerçek kullanıcı mesajları. Sadece (anonim de olsa)
    // giriş yapmış biri yazabilir, kendi kimliği (uid) dışında birini taklit
    // edemez, sadece kendi rezerve ettiği takma adla yazabilir, isim
    // boşluksuz + en fazla 12 karakter, mesaj uzunluğu sınırlı, ve son
    // mesajından en az 3 saniye geçmeden yeni mesaj atamaz (aşağıdaki
    // ahir_limits koleksiyonuyla).
    match /ahir_mesajlar/{mesajId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(['uid', 'kullaniciAdi', 'mesaj', 'tarih'])
        && request.resource.data.kullaniciAdi is string
        && request.resource.data.kullaniciAdi.matches('^[^\\s]{1,12}$')
        && get(/databases/$(database)/documents/ahir_kullanicilar/$(request.resource.data.kullaniciAdi)).data.uid == request.auth.uid
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

    // Galeri — herkes bakabilir, sadece admin ekleyip çıkarabilir.
    // Fotoğraf, Firebase Storage KULLANILMADAN (ücretli Blaze planı
    // istiyor), site.js'te küçültülüp base64 metne çevrilerek doğrudan
    // "resim" alanına yazılıyor — bu yüzden ~900KB üst sınırı var.
    match /galeri/{fotoId} {
      allow read: if true;
      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly(['resim', 'tarih'])
        && request.resource.data.resim is string
        && request.resource.data.resim.size() < 900000
        && request.resource.data.tarih == request.time;
      allow update, delete: if isAdmin();
    }

    // Sosyal Hayat hikayesi (admin panelindeki "Sosyal Hayat Düzenle").
    // "ana" belgesi hikayenin kendisi, "resim" belgesi ortadaki Berkay resmi.
    // Herkes okuyabilir (oyun oynansın diye), sadece admin değiştirebilir.
    match /sosyal_hikaye/{docId} {
      allow read: if true;
      allow write: if isAdmin() && docId in ['ana', 'resim'];
    }

    // Galeri fotoğraf önerileri — giriş yapmış (anonim de olsa) herkes
    // önerebilir, sadece admin görüp onaylayabilir/silebilir.
    match /galeri_oneriler/{oneriId} {
      allow read, update, delete: if isAdmin();
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['resim', 'gonderenUid', 'gonderenKullaniciAdi', 'tarih'])
        && request.resource.data.resim is string
        && request.resource.data.resim.size() < 900000
        && request.resource.data.gonderenUid == request.auth.uid
        && request.resource.data.tarih == request.time;
    }
  }
}
```

Bu kurallar şunları garanti eder: (1) biri Firestore'a doğrudan istek atsa
bile giriş yapmadan hiçbir şey yazamaz, (2) kendi kimliğinin dışında birini
taklit edip spam atamaz, (3) Ahır'da aynı takma adı 2. bir kişi asla alamaz,
(4) galeriye sadece admin fotoğraf ekleyip çıkarabilir, öneri kuyruğunu
sadece admin görebilir, (5) bot soru geçmişini sadece admin okuyabilir —
yani site "birileri saldırıp çökertsin" diye açık bir kapı bırakmıyor.

**Firebase Storage kullanılmıyor** — yeni Firebase projelerinde bir bucket
açmak artık ücretli (Blaze) plan istiyor. Bunun yerine galeri fotoğrafları
tarayıcıda 720×720'e küçültülüp bir metin (base64) olarak doğrudan
Firestore'a yazılıyor; Firestore'un ücretsiz (Spark) planı bunun için
yeterli. Tek kısıtı: bir fotoğrafın sıkıştırılmış hali ~900KB'ı geçemez —
kod bunu otomatik ayarlıyor (kaliteyi gerekirse kademeli düşürüyor), sen
bir şey yapmana gerek yok.

### İlk admin hesabını oluştur

Rules'ı yayınladıktan sonra siteye gir, sağ üstten **Kayıt Ol**'a bas ve
kullanıcı adı olarak **tam olarak `admin`** yaz (istediğin bir şifreyle).
Bu kullanıcı adını ilk alan kişi otomatik olarak admin olur ve
`/admin` sayfasından bot soru geçmişini ve galeri önerilerini
yönetebilir — bu yüzden bunu ilk sen yapmalısın, başkası "admin" adını
alırsa o kişi admin olur.

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
  olursa ekranda "🔊 Sesi başlat" düğmesi belirir, bir tıkla başlar. Sağ
  alttaki yuvarlak buton sesi istediğin an kapatıp açar.
- Yedek cevap havuzunu (`js/script.js` içindeki `FALLBACK_RESPONSES` dizisi)
  istediğin an değiştirip yeni cümleler ekleyebilirsin.
- Berkayın Ahırı'ndaki mesajlar Firestore'da kalıcı olarak duruyor (sohbet
  ekranında sadece en son 50 mesaj gösteriliyor). Zamanla çok birikirse
  Firebase konsolundan elle temizleyebilirsin.
- Sol üstteki ☰ butonu Spor/Ders/Oyun/Sosyal Hayat/Galeri linklerini içeren
  bir menü açar, sağ üstte Giriş Yap/Kayıt Ol duruyor. Sol altta Berkayın
  Ahırı, sağ altta ses açma/kapama butonu sabit duruyor. Dördü de gerçek
  ekran köşesine sabitlenmiş durumda (sayfa içeriği ortalanmış olsa bile).
- Galerideki bütün fotoğraflar (hem admin'in direkt eklediği hem
  onaylanan öneriler) tarayıcıda otomatik olarak 720×720 kareye kırpılıp
  küçültülüyor, böylece hepsi aynı boyutta görünüyor.
- Kenar durumu: bir kişi önce Ahır'da (kayıt olmadan) bir takma ad seçip,
  sonra farklı bir tarayıcı/oturumda gerçek hesaba kayıt olursa, eski
  takma adı yeni hesaba otomatik taşınmaz — Ahır'a tekrar girip aynı adı
  (boşsa) yeniden seçmesi gerekir.

## Sosyal Hayat hikayesini düzenleme

`admin` hesabıyla giriş yap → **Admin Paneli** → **👥 Sosyal Hayat Düzenle**.
Önce hikayenin algoritma şeması (akış ağacı) açılır. Bir kutuya tıklayınca
altta o adımın metnini, emojisini ve seçeneklerini (her butonun hangi adıma
gideceğini) değiştirebilirsin. Seçeneği olmayan adım "SON" sayılır.
**💾 Kaydet ve yayınla** deyince Sosyal Hayat sayfası anında yeni hikayeyi
gösterir. Ortadaki Berkay resmini de aynı yerden yükleyebilirsin.
Hiç kaydetmediysen `js/sosyal-hikaye.js` içindeki varsayılan hikaye çalışır.

**Önemli:** Kaydetmenin çalışması için yukarıdaki Firestore kurallarındaki
`sosyal_hikaye` bloğunun Firebase Console → Firestore → Rules'a eklenip
**Publish** edilmesi gerekiyor.

## Bot cevap tarzı

`api/ask.js` içindeki `SYSTEM_PROMPT` artık Berkay hakkındaki bilgileri
sıralayıp dökmüyor. Her soruya o konuya özel yeni ve absürt bir espri
uyduruyor, bilinen olaylardan en fazla birini (alakalıysa) kullanıyor.
Cevaplar 1-3 cümle. Sadece hafif laf sokmalara (mal, aptal, salak...)
izin var. Aile, cinsel ve ağır küfürler yasak. Soru kutusunda artık sabit
"Berkay" öneki yok, soru yazıldığı gibi gidiyor.
