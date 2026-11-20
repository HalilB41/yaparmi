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
├─ spor.html       <- boks makinesi, penaltı, kasksız 85, spor karnesi, Berkay olimpiyatı
├─ oyun.html       <- oyun sayfası (2048, Yılan, Hafıza, XOX, Taş Kağıt Makas)
├─ tahmin.html      <- Tahmin Pazarı: iddialara BERKAY yatır
├─ profil.html      <- /profil?k=ad: cüzdan, sıralama, rekorlar, borsa karnesi
├─ borsa.html       <- Berkay Borsası: BERKAY grafiği, spot, 20x kaldıraç, Berkay Market
├─ sosyal.html      <- "hikaye seç" oyunu (İzmir'e gitsin / evde kalsın ...)
├─ galeri.html      <- yatay kaydırmalı fotoğraf galerisi + fotoğraf öner
├─ admin.html       <- sadece "admin" kullanıcı adına giriş yapınca görünür
├─ css/style.css
├─ js/firebase-config.js   <- kendi Firebase bilgilerini buraya yapıştır
├─ js/site.js       <- TÜM sayfalarda ortak: hamburger menü + giriş/kayıt widget'ı
├─ js/script.js     <- sadece index.html: soru-cevap kutusu + Berkayın Ahırı
├─ js/gallery.js    <- sadece galeri.html
├─ js/admin.js      <- sadece admin.html
├─ js/games.js      <- sadece oyun.html (5 oyun)
├─ js/ekonomi.js    <- her sayfada: günlük giriş ödülü, oyun rekoru ödülü, isim süsleri
├─ js/tahmin.js     <- sadece tahmin.html
├─ js/profil.js     <- sadece profil.html
├─ js/cark-berkay.js <- cark.html: 💰 BERKAY çarkı
├─ js/ekonomi-admin.js <- admin.html: 💰 Ekonomi sekmesi
├─ js/kahin-paylas.js <- admin.html: Kâhin sorusunu "soran" bilgisiyle paylaş
├─ js/sosyal-hikaye.js  <- Sosyal Hayat hikayesinin varsayılan hali + Firestore'dan okuma
├─ js/sosyal.js     <- sadece sosyal.html (hikaye oynatıcı)
├─ js/spor.js       <- sadece spor.html (5 bölüm)
├─ js/spor-admin.js <- admin.html: motor oyunu kaza resmi
├─ js/sosyal-editor.js  <- admin.html'deki "Sosyal Hayat Düzenle" (algoritma şeması + editör)
├─ api/ask.js              <- Vercel serverless function, Nous Research'e soru gönderir
├─ api/borsa.js            <- BERKAY borsasının sunucusu (bakiyeler burada değişir)
├─ js/borsa-grafik.js      <- borsa grafiği + ortak hesaplar (borsa.html ve admin.html)
├─ js/borsa.js             <- sadece borsa.html
├─ js/borsa-admin.js       <- admin.html: Borsa sekmesi
├─ package.json            <- sadece firebase-admin (api/borsa.js için)
├─ audio/
│  └─ kubi85.mp3           <- spor oyununda 85'i geçince çalan efekt
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

## 1) Müzik

Sitede arka plan müziği yok (kaldırıldı). `audio/` klasöründe sadece spor
oyununun efekt sesi `kubi85.mp3` duruyor.

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

    // Söz Defteri için: gerçek (anonim olmayan) hesap ve o hesabın kullanıcı adı.
    function hesapli() {
      return request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous';
    }
    function kullaniciAdim() {
      return get(/databases/$(database)/documents/kullanicilar/$(request.auth.uid)).data.kullaniciAdi;
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
    // Spor sayfası: "karne" (Berkay'ın spor istatistikleri), "olimpiyat"
    // (haftanın rezilliği adayları + geçmiş kazananlar) ve "motor" (Kasksız 85
    // oyununda kaza anında çıkan resim). Herkes okur, admin yazar.
    match /spor/{docId} {
      allow read: if true;
      allow write: if isAdmin() && docId in ['karne', 'olimpiyat', 'motor'];
    }

    // Olimpiyat oyları: belge ID'si = hafta + "_" + uid, yani herkes her hafta
    // TEK oy verebilir, oyunu değiştiremez/silemez.
    match /spor_oylar/{oyId} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['hafta', 'secim', 'uid'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.hafta is string
        && oyId == request.resource.data.hafta + '_' + request.auth.uid
        && request.resource.data.secim is int
        && request.resource.data.secim >= 0
        && request.resource.data.secim < 10;
      allow update, delete: if false;
    }

    match /galeri_oneriler/{oneriId} {
      allow read, update, delete: if isAdmin();
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['resim', 'gonderenUid', 'gonderenKullaniciAdi', 'tarih'])
        && request.resource.data.resim is string
        && request.resource.data.resim.size() < 900000
        && request.resource.data.gonderenUid == request.auth.uid
        && request.resource.data.tarih == request.time;
    }

    // Ortak rekor tablosu (spor): herkes kendi kaydını yazar, skor sadece yükselebilir.
    match /rekorlar/{id} {
      allow read: if true;
      allow create, update: if request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && request.resource.data.keys().hasOnly(['oyun', 'uid', 'ad', 'skor', 'tarih'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.oyun in ['boks', 'penalti', 'motor']
        && id == request.resource.data.oyun + '_' + request.auth.uid
        && request.resource.data.skor is int && request.resource.data.skor > 0
        && ((request.resource.data.oyun == 'boks' && request.resource.data.skor <= 999)
          || (request.resource.data.oyun == 'motor' && request.resource.data.skor <= 1500)
          || (request.resource.data.oyun == 'penalti' && request.resource.data.skor <= 1000))
        && request.resource.data.ad == get(/databases/$(database)/documents/kullanicilar/$(request.auth.uid)).data.kullaniciAdi
        && (resource == null || request.resource.data.skor > resource.data.skor);
      allow delete: if isAdmin();
    }

    // Davetler: davet linkiyle kayıt olan kişi kendi kaydını bir kez yazar.
    match /davetler/{uid} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['davetEden', 'davetEdilen', 'tarih'])
        && request.resource.data.davetEden is string && request.resource.data.davetEden.size() <= 20
        && request.resource.data.davetEdilen == get(/databases/$(database)/documents/kullanicilar/$(uid)).data.kullaniciAdi
        && request.resource.data.davetEden != request.resource.data.davetEdilen;
      allow update, delete: if false;
    }

    // Sayaçlar: ana sayfadaki "Berkay ehliyet alalı X gün" kartları.
    // Herkes okur, sadece admin panelinden düzenlenir.
    // "liste": ana sayfa zaman sayaçları; "grup": topluluk sayfasındaki grup sayaçları.
    match /sayaclar/{docId} {
      allow read: if true;
      allow write: if isAdmin() && docId in ['liste', 'grup'];
    }

    // Topluluk: anketler (günün sorusu / anket / haftanın rezili). Admin açar, herkes okur.
    match /anketler/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    // Oylar: belge ID = anketId_uid → kişi başı tek oy, anket açıkken, kendi adıyla.
    match /anket_oylar/{id} {
      allow read: if true;
      allow create: if request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && request.resource.data.keys().hasOnly(['anketId', 'uid', 'kullaniciAdi', 'secim', 'tarih'])
        && request.resource.data.uid == request.auth.uid
        && id == request.resource.data.anketId + '_' + request.auth.uid
        && request.resource.data.kullaniciAdi == get(/databases/$(database)/documents/kullanicilar/$(request.auth.uid)).data.kullaniciAdi
        && request.resource.data.secim is int && request.resource.data.secim >= 0 && request.resource.data.secim < 10
        && get(/databases/$(database)/documents/anketler/$(request.resource.data.anketId)).data.acik == true
        && request.resource.data.tarih == request.time;
      allow update: if false;
      allow delete: if isAdmin();
    }
    // Vardiya takvimi: belge ID = tarih_uid → günde bir kayıt; kişi kendi kaydını yazar/siler, admin hepsini.
    match /vardiyalar/{id} {
      allow read: if true;
      allow create, update: if request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && request.resource.data.keys().hasOnly(['uid', 'kullaniciAdi', 'tarih', 'vardiya', 'bolum', 'tl', 'not', 'olusturma'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.kullaniciAdi == get(/databases/$(database)/documents/kullanicilar/$(request.auth.uid)).data.kullaniciAdi
        && request.resource.data.tarih is string && request.resource.data.tarih.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && id == request.resource.data.tarih + '_' + request.auth.uid
        && request.resource.data.vardiya in ['gece', 'gunduz', 'sabah']
        && request.resource.data.tl is int && request.resource.data.tl >= 0 && request.resource.data.tl <= 99999
        && request.resource.data.bolum is string && request.resource.data.bolum.size() <= 30
        && request.resource.data.not is string && request.resource.data.not.size() <= 120;
      allow update: if isAdmin() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['tl']);
      allow delete: if request.auth != null && (resource.data.uid == request.auth.uid || isAdmin());
    }


    // Sınırsız Çark ayarları (açık/kapalı, tur, hak, dilimler).
    // Herkes okur, sadece admin değiştirir.
    match /cark/{docId} {
      allow read: if true;
      allow write: if isAdmin() && docId == 'ayarlar';
    }

    // Çark sonuçları: kime ne çıktı. Sadece gerçek hesabı olan (kullanıcı
    // adı olan) yazabilir, sadece çark açıkken, turda hakkı kadar. Maximus
    // ancak kendi Maximus biletiyle ve bilet başına BİR kez çevrilir.
    // Kişi kendi sonuçlarını görür, admin hepsini görür.
    match /cark_sonuclari/{id} {
      function carkAyar() {
        return get(/databases/$(database)/documents/cark/ayarlar).data;
      }
      // Liderlik tablosu için giriş yapmış herkes okuyabilir (kim ne kazandı görünür).
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && carkAyar().acik == true
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.kullaniciAdi == get(/databases/$(database)/documents/kullanicilar/$(request.auth.uid)).data.kullaniciAdi
        && request.resource.data.odul is string
        && request.resource.data.odul.size() > 0
        && request.resource.data.odul.size() <= 80
        && request.resource.data.istendi == false
        && request.resource.data.tarih == request.time
        && (
          (request.resource.data.cark == 'sinirsiz'
            && request.resource.data.keys().hasOnly(['uid', 'kullaniciAdi', 'cark', 'odul', 'maximusBileti', 'tur', 'sira', 'tarih', 'istendi'])
            && request.resource.data.maximusBileti is bool
            && request.resource.data.tur == carkAyar().tur
            && request.resource.data.sira is int
            && request.resource.data.sira >= 0
            && request.resource.data.sira < carkAyar().hak
            && carkAyar().get('sifirTur', -1) != carkAyar().tur
            && id == string(carkAyar().tur) + '_' + request.auth.uid + '_s' + string(request.resource.data.sira))
          ||
          (request.resource.data.cark == 'maximus'
            && request.resource.data.keys().hasOnly(['uid', 'kullaniciAdi', 'cark', 'odul', 'maximusBileti', 'bilet', 'tarih', 'istendi'])
            && request.resource.data.maximusBileti == false
            && request.resource.data.bilet is string
            && id == 'mx_' + request.resource.data.bilet
            && get(/databases/$(database)/documents/cark_sonuclari/$(request.resource.data.bilet)).data.uid == request.auth.uid
            && get(/databases/$(database)/documents/cark_sonuclari/$(request.resource.data.bilet)).data.maximusBileti == true
            && (!('sifirZaman' in carkAyar())
              || get(/databases/$(database)/documents/cark_sonuclari/$(request.resource.data.bilet)).data.tarih > carkAyar().sifirZaman))
        );
      // Kişi sadece "ödülü iste" diyebilir; admin sadece "verildi" işaretler.
      allow update: if request.auth != null && (
        (resource.data.uid == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['istendi', 'istenmeTarihi'])
          && request.resource.data.istendi == true
          && request.resource.data.istenmeTarihi == request.time)
        || (isAdmin() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['verildi']))
      );
      allow delete: if isAdmin();
    }

    // ---------------- Söz Defteri (soz.html) ----------------
    // Sadece gerçek hesabı olan (anonim değil) yazabilir, herkes okuyabilir.
    // Durum geçişleri: bekliyor → borc | yandi, borc → odendi (kanıt şart).
    // Admin her şeyi değiştirip silebilir (geri alma vb.).

    match /sozler/{id} {
      allow read: if true;
      allow create: if hesapli()
        && request.resource.data.keys().hasOnly(['veren', 'kime', 'metin', 'kosul', 'sonTarih', 'durum', 'kaydeden', 'kaydedenUid', 'sahitler', 'tarih', 'guncelleme', 'borcTarihi'])
        && request.resource.data.veren is string && request.resource.data.veren.size() > 0 && request.resource.data.veren.size() <= 30
        && request.resource.data.kime is string && request.resource.data.kime.size() <= 30
        && request.resource.data.metin is string && request.resource.data.metin.size() > 0 && request.resource.data.metin.size() <= 200
        && request.resource.data.kosul is string && request.resource.data.kosul.size() <= 200
        && request.resource.data.sonTarih is string
        && (request.resource.data.sonTarih == '' || request.resource.data.sonTarih.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
        && request.resource.data.kaydedenUid == request.auth.uid
        && request.resource.data.kaydeden == kullaniciAdim()
        && request.resource.data.sahitler == []
        && request.resource.data.tarih == request.time
        && request.resource.data.guncelleme == request.time
        && ((request.resource.data.durum == 'bekliyor' && !('borcTarihi' in request.resource.data))
          || (request.resource.data.durum == 'borc' && request.resource.data.borcTarihi == request.time));
      allow update: if isAdmin() || (hesapli() && (
        // Durum değişikliği
        (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['durum', 'guncelleme', 'degistiren', 'borcTarihi'])
          && request.resource.data.guncelleme == request.time
          && request.resource.data.degistiren == kullaniciAdim()
          && (
            (resource.data.durum == 'bekliyor' && request.resource.data.durum == 'borc'
              && request.resource.data.borcTarihi == request.time)
            || (resource.data.durum == 'bekliyor' && request.resource.data.durum == 'yandi'
              && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['borcTarihi']))
            || (resource.data.durum == 'borc' && request.resource.data.durum == 'odendi'
              && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['borcTarihi'])
              && exists(/databases/$(database)/documents/soz_kanitlar/$(id)))
          ))
        ||
        // "Ben de duydum": kişi sadece kendi adını şahitlere ekleyebilir
        (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sahitler'])
          && resource.data.durum in ['bekliyor', 'borc']
          && !(kullaniciAdim() in resource.data.sahitler)
          && request.resource.data.sahitler.size() == resource.data.sahitler.size() + 1
          && request.resource.data.sahitler.hasAll(resource.data.sahitler)
          && kullaniciAdim() in request.resource.data.sahitler)
      ));
      // Yazan kişi, henüz şahidi olmayan bekleyen sözünü silebilir; admin hepsini.
      allow delete: if isAdmin() || (hesapli()
        && resource.data.kaydedenUid == request.auth.uid
        && resource.data.durum == 'bekliyor'
        && resource.data.sahitler.size() == 0);
    }

    // Ödeme kanıtı fotoğrafı (base64). Sadece borç durumundaki söz için,
    // bir kez yüklenir, değiştirilemez. Admin silebilir.
    match /soz_kanitlar/{id} {
      allow read: if true;
      allow create: if hesapli()
        && get(/databases/$(database)/documents/sozler/$(id)).data.durum == 'borc'
        && request.resource.data.keys().hasOnly(['resim', 'yukleyen', 'yukleyenUid', 'tarih'])
        && request.resource.data.resim is string
        && request.resource.data.resim.size() < 900000
        && request.resource.data.yukleyenUid == request.auth.uid
        && request.resource.data.yukleyen == kullaniciAdim()
        && request.resource.data.tarih == request.time;
      allow update: if false;
      allow delete: if isAdmin();
    }

    // ===== BERKAY BORSASI (BERKAYCOIN) =====
    // Bakiyeleri SADECE sunucu (api/borsa.js, firebase-admin) yazar; firebase-admin
    // bu kurallara takılmaz. Tarayıcıdan hiçbir borsa belgesi yazılamaz.
    match /borsa/{docId} {
      // "durum" / "durum_KURBAN" vb. (her coinin fiyatı, mumları, açık pozisyonları), "coinler" (coin listesi)
      // ve "ekonomi" (ödül ayarları, çark dilimleri) giriş yapan herkese açık;
      // "gizli" / "gizli_KURBAN" vb. (adminin çizdiği rota + MM ayarları) sadece admine.
      allow read: if ((docId in ['durum', 'ekonomi', 'coinler'] || docId.matches('durum_[A-Z0-9]+')) && request.auth != null) || isAdmin();
      allow write: if false;
    }
    match /borsa_grafik/{gun} {
      allow read: if true;
      allow write: if false;
    }
    match /borsa_market/{id} {
      allow read: if true;
      allow write: if false;
    }
    // Cüzdanlar ve kapanan pozisyonlar giriş yapan herkese açık: zenginler listesi ve profiller için.
    match /borsa_cuzdan/{uid} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /borsa_gecmis/{id} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /borsa_siparis/{id} {
      allow read: if request.auth != null && (resource.data.uid == request.auth.uid || isAdmin());
      allow write: if false;
    }
    // ===== EKONOMİ: Tahmin pazarı (yazan sadece sunucu) =====
    match /tahmin/{id} {
      allow read: if true;
      allow write: if false;
    }
    match /tahmin_bahis/{id} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /borsa_log/{id} {
      allow read: if isAdmin();
      allow write: if false;
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
- Sol üstteki ☰ butonu Spor/Sosyal Hayat/Galeri/Borsa/Tahmin linklerini
  içeren bir menü açar, sağ üstte Giriş Yap/Kayıt Ol duruyor. Sol altta
  Berkayın Ahırı, sağ altta ses açma/kapama butonu sabit duruyor. Dördü de
  gerçek ekran köşesine sabitlenmiş durumda (sayfa içeriği ortalanmış olsa bile).
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

## Berkay Borsası (BERKAY)

`/borsa` sayfası. Kayıt olan herkese bir kere **200 BERKAY** verilir. Toplam arz
**1.000.000 BERKAY**; dağıtılmayan kısım "kasa"da (admin) durur.

- **BERKAY** = coin, **TL** = nakit. BERKAY'ın fiyatı TL cinsinden.
- **Spot:** TL ile BERKAY al, BERKAY satıp TL al. Her alım fiyatı yükseltir, her satış düşürür.
- **Kaldıraç:** 1x–20x long/short, teminat TL. Kaldıraçla açılan pozisyon da fiyatı iter
  (long yükseltir, short düşürür), kapatınca geri iter. K/Z = "şimdi kapatsan eline geçecek".
  Teminatın %90'ı erirse pozisyon likide olur; likidasyonlar zincirleme düşüş yapabilir.
- **Piyasa yapıcı (MM):** admin açarsa dakikada bir kasa adına alım/satım yapar. Denge modunda
  fiyatı hedef ±bant içinde tutmaya çalışır, ya da her dakika sabit miktar alır/satar.
- **Grafik** Firestore'da (`borsa/durum` + `borsa_grafik/{gün}`) kalıcı. F5 atınca sıfırlanmaz.
  Sayfa açıkken her 10 saniyede bir küçük oynaklıkla çizmeye devam eder.
- **Berkay Market:** BERKAY ile ürün alınır (başlangıçta Alihan'ın kahvesi 1 aylık ve Coca-Cola).
  Sipariş admin panelinde görünür, admin "Teslim edildi" ya da "İptal + iade" der.
- **Paylaş:** Kapanan ya da açık pozisyonun kâr kartı resim olarak WhatsApp'a paylaşılır.

**Admin paneli → 📈 Borsa:** özet (arz, kasa, dolaşım), cüzdanlar (kimde ne kadar),
canlı kaldıraç pozisyonları ve K/Z'ler (kapat / likide et), piyasa yapıcı (MM) botu, kullanıcıya BERKAY/TL gönder ya da
geri al, toplam arzı bas/yak, derinlik/oynaklık/maksimum kaldıraç, piyasayı aç/kapat,
market ürünleri, siparişler ve tüm para hareketleri. **Grafiği sıfırla:** tüm mum geçmişini ve
son işlemler akışını siler, fiyatı 1 TL'ye (ya da girilen değere) çeker; bakiyeler ve açık pozisyonlar
kalır (pozisyonların girişleri aynı oranda ölçeklenir, K/Z'leri değişmez). **Fiyatı yönet:** çizim modunu aç,
grafiğin sağındaki gelecek alanına çizgi çiz, "Rotayı uygula" de. Fiyat o çizgiyi izler.
Rota sadece adminde görünür.

### Kurulum (bir kerelik, şart)

Bakiyeler hile yapılamasın diye sadece sunucu yazar. Sunucunun Firebase'e yazabilmesi için:

1. Firebase Console → ⚙️ **Proje ayarları** → **Hizmet hesapları** (Service accounts) →
   **Yeni özel anahtar oluştur** (Generate new private key). Bir `.json` dosyası iner.
   Bu dosya şifre gibidir: kimseyle paylaşma, GitHub'a koyma.
2. Vercel → `yaparmi` projesi → **Settings > Environment Variables** →
   Key: `FIREBASE_SERVICE_ACCOUNT`, Value: indirdiğin json dosyasının **tüm içeriği**
   (Not Defteri'yle aç, hepsini kopyala). **Save**.
3. Firestore **Rules**'a yukarıdaki kuralları (BERKAY BORSASI bloğu dahil) yapıştırıp **Publish**.
4. `push.bat` ile gönder (Vercel `package.json`'daki `firebase-admin`'i kendisi kurar),
   ya da zaten gönderdiysen **Deployments → Redeploy**.

Bu yapılmazsa borsa sayfası "Borsa sunucusu henüz ayarlanmamış" der, sitenin geri kalanı etkilenmez.

## Ekonomi: BERKAY her yerde

Bütün ödüller **kasadan** gelir, ücretler ve bahisler **kasaya** gider; toplam arz değişmez.
Hepsi sunucuda (`api/borsa.js`) yapılır, ayarları **Admin → 💰 Ekonomi** sekmesinde.

- **Günlük giriş ödülü:** kayıtlı kullanıcı siteye girince günde 1 kez (varsayılan 10 BERKAY).
  Üst üste her 7. günde seri bonusu (+50). Gün atlanırsa seri sıfırlanır.
- **Oyun ödülü:** Boks, Penaltı, Kasksız 85, 2048 ve Yılan'da kişisel rekor kırınca 15 BERKAY,
  oyun başına günde en fazla 30. (Skoru tarayıcı bildirir; hile yapılabilir, günlük sınır bu yüzden var.)
- **💰 BERKAY çarkı** (Çark sayfasında, Sınırsız Çark'tan bağımsız): günde 1 bedava, sonrası 10 BERKAY.
  Dilimler admin'den. Sonucu sunucu seçer. Admin panelinde "ortalama getiri" gösterilir:
  ücretten büyükse insanlar durmadan çevirip kasayı boşaltabilir.
- **🎲 Tahmin pazarı** (`/tahmin`): admin iddia açar, herkes bir seçeneğe BERKAY yatırır. Sonuç girilince
  havuz bilenlere yatırdıkları oranda dağıtılır; kimse bilemezse ya da iptal edilirse herkese iade.
- **👤 Profil** (`/profil?k=ad`): cüzdan, zenginler sırası, günlük seri, oyun rekorları, borsa karnesi
  (en iyi işlem, en büyük likidasyon), tahmin sonuçları. Giriş panelinde "Profilim".
- **🐳 Zenginler listesi** ve **📰 Bu hafta** (en kârlı işlem, haftanın likide olanı) borsa sayfasında.
- **Market dijital ürünleri:** isim rengi, rozet, özel unvan (7 gün). Anında uygulanır; profil,
  zenginler listesi, borsa ve tahmin listelerinde görünür. Admin uygunsuz süsü
  Borsa → Cüzdanlar'dan silebilir.

Ders, Ehliyet ve Bingo sayfaları kaldırıldı (`/ders`, `/ehliyet`, `/bingo` ana sayfaya yönlenir).
