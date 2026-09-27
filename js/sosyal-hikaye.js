// ============================================================
// sosyal-hikaye.js — Sosyal Hayat hikayesinin ORTAK parçaları.
// Hem sosyal.html (oynatıcı) hem admin.html (editör) bunu yükler.
//
// Hikaye yapısı:
// {
//   baslangic: "basla",                 // ilk gösterilen düğümün ID'si
//   dugumler: {
//     basla: {
//       emoji: "😴",                     // Berkay'ın resminin köşesinde çıkan küçük rozet
//       metin: "Cumartesi sabahı...",    // ekranda yazan metin
//       secenekler: [                    // boşsa bu düğüm bir SON'dur
//         { etiket: "İzmir'e gitsin", hedef: "izmir1" },
//         { etiket: "Evde kalsın",    hedef: "ev1" }
//       ]
//     },
//     ...
//   }
// }
//
// Admin panelinden kaydedilen hikaye Firestore'da
//   sosyal_hikaye/ana   -> { baslangic, dugumler, guncelleme }
//   sosyal_hikaye/resim -> { resim: "data:image/jpeg;base64,..." }  (Berkay'ın resmi)
// olarak duruyor. Firestore'da kayıt yoksa aşağıdaki varsayılan hikaye kullanılır.
// ============================================================

(function () {
  "use strict";

  // ================= GÖLCÜK KOLU (v3 — Cuma + Cumartesi) =================
  // Karakterler: Kurban (KPSS'ye 4 Ekim'de girecek, en mantıklısı), Alihan (kanzilerin lideri,
  // Enver Paşa/Sarıkamış hassasiyeti, depoda hiç çalışmadı), Burger (burger delisi, Alihan'ın
  // kahve haklarını bitirir), Halil (bedava stajyer, ULTRA MEGA DEPO AMELESİ).
  // Bu blok bir sahne listesinden otomatik üretildi: her ekran önce seçilen şeyin sonucunu,
  // sonra yeni durumu anlatır. "KUBİİİ OTOBÜSTEYİM" sonu aynen korunur.
  const GOLCUK = {
    "gk1": {
      "emoji": "⏰",
      "metin": "Bu hikâye aslında bir gün önce, Cuma sabahı başladı. Saat 08:00. Beşli grup (Berkay, Kurban, Alihan, Burger, Halil) kütüphanede buluşacak; Kurban'ın KPSS'sine 1 hafta var. Berkay'ın alarmı çalıyor.",
      "secenekler": [
        {
          "etiket": "⏰ Kalksın",
          "hedef": "gk_P1_1"
        },
        {
          "etiket": "😴 5 dakika daha",
          "hedef": "gk_P1_2"
        }
      ]
    },
    "gk_P1_1": {
      "emoji": "🏃",
      "metin": "Kalktı... yani yatakta doğruldu, telefondaki 14 cevapsız aramaya baktı ve tekrar uyudu. \"Kalk\" komutu 3 saniye çalıştı. Saat 11:00'i geçti. Berkay kütüphaneye bir saat geç kalıyor, gruba bir şey yazması lazım.",
      "secenekler": [
        {
          "etiket": "🌀 \"Trafik vardı\" desin",
          "hedef": "gk_P2_1"
        },
        {
          "etiket": "🙏 \"Uyuyakaldım\" desin",
          "hedef": "gk_P2_2"
        }
      ]
    },
    "gk_P1_2": {
      "emoji": "🏃",
      "metin": "5 dakika, 2 saat 40 dakika sürdü. Grup mesajları: Kurban \"nerdesin lan\", Alihan \"Enver Paşa sabah 5'te kalkardı\". Saat 11:00'i geçti. Berkay kütüphaneye bir saat geç kalıyor, gruba bir şey yazması lazım.",
      "secenekler": [
        {
          "etiket": "🌀 \"Trafik vardı\" desin",
          "hedef": "gk_P2_1"
        },
        {
          "etiket": "🙏 \"Uyuyakaldım\" desin",
          "hedef": "gk_P2_2"
        }
      ]
    },
    "gk_P2_1": {
      "emoji": "📚",
      "metin": "\"Trafik vardı\" yazdı. Halil: \"Kanka yürüyerek geliyorsun, 400 metre.\" Berkay \"yaya trafiği\" diye düzeltti. Kurban ekran görüntüsü aldı. Kütüphanede herkes kendi âleminde: Kurban KPSS denemesine gömülmüş, Alihan tarih kitabının Sarıkamış sayfasına sinirle bakıyor, Burger gizlice kahve almaya gitmiş, Halil vardiya öncesi kestiriyor. Berkay oturdu, kitabını açtı.",
      "secenekler": [
        {
          "etiket": "📖 Gerçekten çalışsın",
          "hedef": "gk_P3_1"
        },
        {
          "etiket": "📱 Telefonla oynasın",
          "hedef": "gk_P3_2"
        }
      ]
    },
    "gk_P2_2": {
      "emoji": "📚",
      "metin": "\"Uyuyakaldım\" yazdı. Kurban: \"Şaşırmadık.\" Alihan: \"Dürüstlük güzel, Enver Paşa da dürüsttü.\" Halil: \"Sana yer tuttum ama Burger üstüne burger koydu.\" Kütüphanede herkes kendi âleminde: Kurban KPSS denemesine gömülmüş, Alihan tarih kitabının Sarıkamış sayfasına sinirle bakıyor, Burger gizlice kahve almaya gitmiş, Halil vardiya öncesi kestiriyor. Berkay oturdu, kitabını açtı.",
      "secenekler": [
        {
          "etiket": "📖 Gerçekten çalışsın",
          "hedef": "gk_P3_1"
        },
        {
          "etiket": "📱 Telefonla oynasın",
          "hedef": "gk_P3_2"
        }
      ]
    },
    "gk_P3_1": {
      "emoji": "☕",
      "metin": "4. sayfada yoruldu, 5. sayfada uyudu. Kurban'ın deneme kitabının üstüne salya aktı. Kurban fısıltıyla bağırdı: \"KPSS KİTABIM!\" Burger elinde kahvelerle döndü. Kahveler Alihan'ın kütüphane kahve hakkıyla alınmış, Alihan'ın haberi yok. Burger Berkay'a da bir tane uzattı.",
      "secenekler": [
        {
          "etiket": "☕ Kahveyi alsın",
          "hedef": "gk_P4_1"
        },
        {
          "etiket": "🤫 Alihan'a ispiyonlasın",
          "hedef": "gk_P4_2"
        }
      ]
    },
    "gk_P3_2": {
      "emoji": "☕",
      "metin": "Ses açık kalmış: oyunun giriş müziği bütün kütüphanede çaldı. Görevli \"SESSİZLİK!\" dedi, herkes Berkay'a döndü. Alihan \"tanımıyorum\" deyip masayı değiştirdi. Burger elinde kahvelerle döndü. Kahveler Alihan'ın kütüphane kahve hakkıyla alınmış, Alihan'ın haberi yok. Burger Berkay'a da bir tane uzattı.",
      "secenekler": [
        {
          "etiket": "☕ Kahveyi alsın",
          "hedef": "gk_P4_1"
        },
        {
          "etiket": "🤫 Alihan'a ispiyonlasın",
          "hedef": "gk_P4_2"
        }
      ]
    },
    "gk_P4_1": {
      "emoji": "🍽️",
      "metin": "Kahveyi aldı. Az sonra Alihan kahve almaya gitti: \"Hakkınız bitmiş.\" Alihan masaya döndü, Berkay'ın elindeki kahveyi gördü. Suçlu belliydi. Burger ıslık çalıyordu. Saat 13:00. Burger: \"Acıktım, gömelim.\" Beşli esnaf lokantasına daldı. Berkay cüzdanına baktı: 17 TL.",
      "secenekler": [
        {
          "etiket": "🍛 En büyük tabağı söylesin",
          "hedef": "gk_P5_1"
        },
        {
          "etiket": "🥖 Sadece ekmek istesin",
          "hedef": "gk_P5_2"
        }
      ]
    },
    "gk_P4_2": {
      "emoji": "🍽️",
      "metin": "Alihan'a fısıldadı: \"Burger senin kahve haklarını bitiriyor.\" Burger ağzı dolu: \"Berkay yalan söylüyor.\" Alihan kime inandı? Tabii ki Burger'e. Berkay'a kimse inanmaz. Saat 13:00. Burger: \"Acıktım, gömelim.\" Beşli esnaf lokantasına daldı. Berkay cüzdanına baktı: 17 TL.",
      "secenekler": [
        {
          "etiket": "🍛 En büyük tabağı söylesin",
          "hedef": "gk_P5_1"
        },
        {
          "etiket": "🥖 Sadece ekmek istesin",
          "hedef": "gk_P5_2"
        }
      ]
    },
    "gk_P5_1": {
      "emoji": "💸",
      "metin": "Kuru-pilav-cacık-künefe söyledi, hepsi geldi. Hesap: 340 TL. Cüzdanda: 17 TL. Borç istemesi lazım ama bir bahane gerekiyor. Tam o sırada telefon titredi: kız arkadaşı \"Yarın ne yapıyorsun? 😊\" yazmış. Berkay \"sonra yazarım\" dedi, önce borç meselesi.",
      "secenekler": [
        {
          "etiket": "💳 \"Kartım bloke oldu\" desin",
          "hedef": "gk_P6_1"
        },
        {
          "etiket": "🪂 \"Airdrop gelince öderim\" desin",
          "hedef": "gk_P6_2"
        }
      ]
    },
    "gk_P5_2": {
      "emoji": "💸",
      "metin": "Sadece ekmek istedi. 2 dakika sonra Kurban'ın köftesine, Alihan'ın pilavına göz dikti; 5 dakika sonra kendi tabağını söyletti. Hesap: 340 TL. Cüzdanda: 17 TL. Borç istemesi lazım ama bir bahane gerekiyor. Tam o sırada telefon titredi: kız arkadaşı \"Yarın ne yapıyorsun? 😊\" yazmış. Berkay \"sonra yazarım\" dedi, önce borç meselesi.",
      "secenekler": [
        {
          "etiket": "💳 \"Kartım bloke oldu\" desin",
          "hedef": "gk_P6_1"
        },
        {
          "etiket": "🪂 \"Airdrop gelince öderim\" desin",
          "hedef": "gk_P6_2"
        }
      ]
    },
    "gk_P6_1": {
      "emoji": "🦅",
      "metin": "\"Kartım bloke oldu kanka.\" Halil: \"Banka uygulamasını göster.\" Berkay: \"Uygulama da bloke.\" Kurban iç çekip 340 TL'yi ödedi: \"Memur olunca faiziyle alırım.\" Yemekte herkesin kendi derdi var: Alihan Enver Paşa anlatıyor, Kurban KPSS soruları soruyor, Burger üçüncü porsiyonda, Halil depo hikâyesine hazırlanıyor. Ama muhabbet her seferinde Berkay'a dönüyor.",
      "secenekler": [
        {
          "etiket": "🦅 Enver Paşa'yı eleştirsin",
          "hedef": "gk_P7_1"
        },
        {
          "etiket": "📚 Kurban'ın KPSS sorusunu cevaplasın",
          "hedef": "gk_P7_2"
        }
      ]
    },
    "gk_P6_2": {
      "emoji": "🦅",
      "metin": "\"Haftaya airdrop düşüyor, çıkınca iki katı.\" Masa sustu. Alihan: \"Bir yıl ZKsync kastın, sıfır geldi.\" Parayı sonunda Kurban ödedi, üstüne \"memur olunca faiziyle alırım\" dedi. Yemekte herkesin kendi derdi var: Alihan Enver Paşa anlatıyor, Kurban KPSS soruları soruyor, Burger üçüncü porsiyonda, Halil depo hikâyesine hazırlanıyor. Ama muhabbet her seferinde Berkay'a dönüyor.",
      "secenekler": [
        {
          "etiket": "🦅 Enver Paşa'yı eleştirsin",
          "hedef": "gk_P7_1"
        },
        {
          "etiket": "📚 Kurban'ın KPSS sorusunu cevaplasın",
          "hedef": "gk_P7_2"
        }
      ]
    },
    "gk_P7_1": {
      "emoji": "📦",
      "metin": "\"Enver Paşa o kadar askeri neden kışın dağa yolladı? Beceriksiz! Adamın komutanlık yapmaya hakkı bile yoktu.\" Alihan çatalı bıraktı. Burger hayatında ilk kez burgerini bıraktı. İkisi aynı anda patladı: \"STRATEJİK SERİNLEME!\" \"DÖNEMİN ŞARTLARI!\" 15 dakika boyunca bütün lokanta onları dinledi, garson bile. Sonunda Alihan kendi hesabını da Berkay'a yazdırmaya çalıştı. Burger dördüncü porsiyonu isterken Halil başladı: \"Kanka bugün Hepsiburada deposunda 3 ton klima indirdim.\" Berkay bir şekilde ikisine de karışmak zorunda.",
      "secenekler": [
        {
          "etiket": "🍔 Burger'le yemek yarışsın",
          "hedef": "gk_P8_1"
        },
        {
          "etiket": "📦 \"Ben olsam 5 ton indirirdim\" desin",
          "hedef": "gk_P8_2"
        }
      ]
    },
    "gk_P7_2": {
      "emoji": "📦",
      "metin": "Kurban: \"Türkiye'nin en uzun nehri?\" Berkay: \"Popeyes.\" Masa dondu. Kurban: \"Seninle aynı salonda girsem rahat olurdum, sıralamada birini geçmiş olurdum.\" Burger dördüncü porsiyonu isterken Halil başladı: \"Kanka bugün Hepsiburada deposunda 3 ton klima indirdim.\" Berkay bir şekilde ikisine de karışmak zorunda.",
      "secenekler": [
        {
          "etiket": "🍔 Burger'le yemek yarışsın",
          "hedef": "gk_P8_1"
        },
        {
          "etiket": "📦 \"Ben olsam 5 ton indirirdim\" desin",
          "hedef": "gk_P8_2"
        }
      ]
    },
    "gk_P8_1": {
      "emoji": "🥊",
      "metin": "Burger'e meydan okudu. Burger 4. porsiyonu 2 dakikada bitirdi; Berkay 2. porsiyonda boğuldu, Kurban sırtına vurdu. Berkay: \"Dişim ağrıyordu zaten.\" Yemekten çıktılar. Çarşıdaki boks makinesinin ekranında rekor yazıyor: 999. Burger: \"Bunu kimse geçemez.\" Berkay'ın gözleri parladı.",
      "secenekler": [
        {
          "etiket": "🥊 Tüm gücüyle vursun",
          "hedef": "gk_P9_1"
        },
        {
          "etiket": "🔥 Önce ısınsın, sonra vursun",
          "hedef": "gk_P9_2"
        }
      ]
    },
    "gk_P8_2": {
      "emoji": "🥊",
      "metin": "Halil: \"Geçen sene Alihan'la depo yevmiyesine gelmiştiniz. Sen 1 koli kaldırıp 3 saat mola verdin.\" Alihan: \"Ben hiç kaldırmadım ama.\" Masa güldü. Berkay: \"O gün griptim.\" Yemekten çıktılar. Çarşıdaki boks makinesinin ekranında rekor yazıyor: 999. Burger: \"Bunu kimse geçemez.\" Berkay'ın gözleri parladı.",
      "secenekler": [
        {
          "etiket": "🥊 Tüm gücüyle vursun",
          "hedef": "gk_P9_1"
        },
        {
          "etiket": "🔥 Önce ısınsın, sonra vursun",
          "hedef": "gk_P9_2"
        }
      ]
    },
    "gk_P9_1": {
      "emoji": "🤕",
      "metin": "Koştu, zıpladı, vurdu. Makine: 312. Elinden \"çıt\" diye bir ses geldi, parmakları tuhaf bir açıyla duruyor. Berkay: \"Makine bozuk.\" Eli şişiyor. Kurban eczaneden sargı aldı, Halil depo usulü koli bandıyla sabitledi. Diğer elinde Burger'in aldığı kola var.",
      "secenekler": [
        {
          "etiket": "😎 \"Acımıyor\" desin",
          "hedef": "gk_P10_1"
        },
        {
          "etiket": "🏥 Hastaneye gitsin",
          "hedef": "gk_P10_2"
        }
      ]
    },
    "gk_P9_2": {
      "emoji": "🤕",
      "metin": "5 dakika ısındı, şınav çekti, gölge boksu yaptı, etrafa kalabalık toplandı. Vurdu. Makine: 312. Elinden \"çıt\" diye bir ses geldi. Kalabalık dağıldı. Berkay: \"Makine bozuk.\" Eli şişiyor. Kurban eczaneden sargı aldı, Halil depo usulü koli bandıyla sabitledi. Diğer elinde Burger'in aldığı kola var.",
      "secenekler": [
        {
          "etiket": "😎 \"Acımıyor\" desin",
          "hedef": "gk_P10_1"
        },
        {
          "etiket": "🏥 Hastaneye gitsin",
          "hedef": "gk_P10_2"
        }
      ]
    },
    "gk_P10_1": {
      "emoji": "🥤",
      "metin": "\"Acımıyor\" dedi ve göstermek için sargılı elini salladı. Acıdı. Öyle bir bağırdı ki çarşıdaki güvercinler havalandı. Kütüphaneye dönerken bir çay bahçesinde oturdular. Masa bardaklarla dolu. Berkay'ın elindeki kolayı bir yere koyması lazım.",
      "secenekler": [
        {
          "etiket": "⬇️ Yere koysun",
          "hedef": "gk_P11_1"
        },
        {
          "etiket": "🪑 Sandalyenin kenarına koysun",
          "hedef": "gk_P11_2"
        }
      ]
    },
    "gk_P10_2": {
      "emoji": "🥤",
      "metin": "Röntgen: parmakta çatlak. Doktor: \"Boks makinesi mi? Bu ay dördüncü vaka.\" Eline alçı yaptılar. Arkadaşlar dışarıda beklerken Burger bir burger daha yedi. Kütüphaneye dönerken bir çay bahçesinde oturdular. Masa bardaklarla dolu. Berkay'ın elindeki kolayı bir yere koyması lazım.",
      "secenekler": [
        {
          "etiket": "⬇️ Yere koysun",
          "hedef": "gk_P11_1"
        },
        {
          "etiket": "🪑 Sandalyenin kenarına koysun",
          "hedef": "gk_P11_2"
        }
      ]
    },
    "gk_P11_1": {
      "emoji": "🤬",
      "metin": "Kolayı masanın dibine, yere koydu. 10 saniye sonra Halil kalkarken ayağıyla kolaya çarptı, kola devrildi ve bütün yere döküldü. Kola gölü akıp Kurban'ın yerdeki çantasına girdi, KPSS kitabı kolaya bulandı. Yerde kola gölü, çantada kolaya bulanmış KPSS kitabı. Dördü aynı anda Berkay'a döndü: \"MAL MISIN LAN!\" \"GERİZEKALI!\" \"Bu kafayla nasıl yaşıyorsun!\" \"Enver Paşa bile kolayı yere koymazdı!\"",
      "secenekler": [
        {
          "etiket": "😡 \"BENİM SUÇUM YOK!\" diye çıldırsın",
          "hedef": "gk_P12_1"
        },
        {
          "etiket": "🌀 Suçu kolaya atsın",
          "hedef": "gk_P12_2"
        }
      ]
    },
    "gk_P11_2": {
      "emoji": "🤬",
      "metin": "Kolayı sandalyenin kenarına koydu. Halil çay almaya giderken sandalyeye çarptı, kola devrildi ve bütün yere döküldü. Kola gölü akıp Kurban'ın yerdeki çantasına girdi, KPSS kitabı kolaya bulandı. Yerde kola gölü, çantada kolaya bulanmış KPSS kitabı. Dördü aynı anda Berkay'a döndü: \"MAL MISIN LAN!\" \"GERİZEKALI!\" \"Bu kafayla nasıl yaşıyorsun!\" \"Enver Paşa bile kolayı yere koymazdı!\"",
      "secenekler": [
        {
          "etiket": "😡 \"BENİM SUÇUM YOK!\" diye çıldırsın",
          "hedef": "gk_P12_1"
        },
        {
          "etiket": "🌀 Suçu kolaya atsın",
          "hedef": "gk_P12_2"
        }
      ]
    },
    "gk_P12_1": {
      "emoji": "💌",
      "metin": "\"BENİM SUÇUM YOK! BU MASAYI KİM BU KADAR KÜÇÜK YAPTI!\" Sandalyeyi tekmeledi, sargılı eli masaya çarptı, bir daha bağırdı. Çay bahçesindeki amcalar okeyi bıraktı. Kütüphaneye geri döndüler. Berkay kız arkadaşının öğlen attığı mesajı hatırladı: \"Yarın ne yapıyorsun? 😊\" Hâlâ cevap vermemiş.",
      "secenekler": [
        {
          "etiket": "😍 \"Seninle buluşuyorum\" yazsın",
          "hedef": "gk_P13_1"
        },
        {
          "etiket": "🤔 Önce arkadaşlarına danışsın",
          "hedef": "gk_P13_2"
        }
      ]
    },
    "gk_P12_2": {
      "emoji": "💌",
      "metin": "\"Kola kaygan üretilmiş, dava açacağım.\" Kimse gülmedi. Kurban ıslak kitabı güneşe tuttu: \"Bu sayfada Anayasa vardı, şimdi yok.\" Berkay 10 kere \"benim suçum yok\" dedi. Kütüphaneye geri döndüler. Berkay kız arkadaşının öğlen attığı mesajı hatırladı: \"Yarın ne yapıyorsun? 😊\" Hâlâ cevap vermemiş.",
      "secenekler": [
        {
          "etiket": "😍 \"Seninle buluşuyorum\" yazsın",
          "hedef": "gk_P13_1"
        },
        {
          "etiket": "🤔 Önce arkadaşlarına danışsın",
          "hedef": "gk_P13_2"
        }
      ]
    },
    "gk_P13_1": {
      "emoji": "⚽",
      "metin": "Tek eliyle \"Seninle buluşuyorum\" yazdı, heyecandan 3 kere gönderdi. Kız arkadaşı: \"Yarın Gölcük'e gel, Popeyes'a gideriz ❤️\" Berkay kütüphanede ayağa kalkıp \"EVET!\" diye bağırdı. Görevli: \"SESSİZLİK!\" Akşam 21:00. Halil depoya vardiyaya gitti; Berkay, Kurban, Alihan ve Burger halı sahada. Berkay'ın bir eli sargılı ama \"ayakla oynanıyor zaten\" diyor.",
      "secenekler": [
        {
          "etiket": "⚽ Forvet oynasın",
          "hedef": "gk_P14_1"
        },
        {
          "etiket": "🧤 Kaleye geçsin",
          "hedef": "gk_P14_2"
        }
      ]
    },
    "gk_P13_2": {
      "emoji": "⚽",
      "metin": "Kurban: \"Git ama otobüsü öğren.\" Alihan: \"Enver Paşa aşk için...\" \"Sus Alihan.\" Burger: \"Gölcük'te Burger King var mı?\" Halil: \"Oraya Ekol'ün kamyonu gidiyor.\" Berkay yazdı, kız arkadaşı: \"Yarın Gölcük'e gel, Popeyes'a gideriz ❤️\" Akşam 21:00. Halil depoya vardiyaya gitti; Berkay, Kurban, Alihan ve Burger halı sahada. Berkay'ın bir eli sargılı ama \"ayakla oynanıyor zaten\" diyor.",
      "secenekler": [
        {
          "etiket": "⚽ Forvet oynasın",
          "hedef": "gk_P14_1"
        },
        {
          "etiket": "🧤 Kaleye geçsin",
          "hedef": "gk_P14_2"
        }
      ]
    },
    "gk_P14_1": {
      "emoji": "🥅",
      "metin": "Forvet oynadı: 11 pozisyon, 11 kaçan gol. Birinde kaleci bile yoktu, top direkten döndü. Alihan: \"Enver Paşa atardı.\" Maç bitti. Skor 18-4. Berkay'ın golü: 0. Takım arkadaşları ona bakıyor.",
      "secenekler": [
        {
          "etiket": "🌀 \"Zemin ıslaktı\" desin",
          "hedef": "gk_P15_1"
        },
        {
          "etiket": "😤 Topu tekmeleyip gitsin",
          "hedef": "gk_P15_2"
        }
      ]
    },
    "gk_P14_2": {
      "emoji": "🥅",
      "metin": "Kaleye geçti. Sargılı eliyle topa çıkamadı, 14 gol yedi. \"Forvete geçeyim\" dedi, orada da 1 gol bile atamadı. Burger kenarda burger yiyerek izledi. Maç bitti. Skor 18-4. Berkay'ın golü: 0. Takım arkadaşları ona bakıyor.",
      "secenekler": [
        {
          "etiket": "🌀 \"Zemin ıslaktı\" desin",
          "hedef": "gk_P15_1"
        },
        {
          "etiket": "😤 Topu tekmeleyip gitsin",
          "hedef": "gk_P15_2"
        }
      ]
    },
    "gk_P15_1": {
      "emoji": "🌙",
      "metin": "\"Zemin ıslaktı, top yamuktu, ayakkabım kaydı.\" Kurban: \"Top yamuk olsa biz de atamazdık.\" Berkay: \"Benim suçum yok.\" Bugün üçüncü kez. Gece eve döndü. Yarın büyük gün: Gölcük, kız arkadaşı, Popeyes. Alarm kurması lazım.",
      "secenekler": [
        {
          "etiket": "⏰ 09:00'a kursun",
          "hedef": "gk_P16_1"
        },
        {
          "etiket": "😴 Alarmsız uyusun",
          "hedef": "gk_P16_2"
        }
      ]
    },
    "gk_P15_2": {
      "emoji": "🌙",
      "metin": "Topu hırsla tekmeledi. Top tellere çarpıp kendi yüzüne döndü. Kurban gülmekten yere yattı. Günün tek isabetli şutu buydu. Gece eve döndü. Yarın büyük gün: Gölcük, kız arkadaşı, Popeyes. Alarm kurması lazım.",
      "secenekler": [
        {
          "etiket": "⏰ 09:00'a kursun",
          "hedef": "gk_P16_1"
        },
        {
          "etiket": "😴 Alarmsız uyusun",
          "hedef": "gk_P16_2"
        }
      ]
    },
    "gk_P16_1": {
      "emoji": "🚏",
      "metin": "09:00'a kurdu, sonra \"10:00 da olur\" dedi, sonra 11:00. Uyandığında saat 12:30. Neyse ki buluşma akşamüstü 5'te. Cumartesi. Yarım saat saçını düzeltti (düzelmedi), sargılı eliyle ayakkabı bağlamak 20 dakika sürdü. Durağa geldi. Bir sorun var: hangi otobüse bineceğini bilmiyor.",
      "secenekler": [
        {
          "etiket": "📞 Kurban'a sorsun",
          "hedef": "gk_G1_1"
        },
        {
          "etiket": "🧍 Sokaktan rastgele birine sorsun",
          "hedef": "gk_G1_2"
        }
      ]
    },
    "gk_P16_2": {
      "emoji": "🚏",
      "metin": "\"Nasılsa uyanırım\" dedi. Uyandığında saat 13:00, onun için sabahın köründe. Kız arkadaşından mesaj: \"Akşam 5'te Gölcük sahilde 😊\" Cumartesi. Yarım saat saçını düzeltti (düzelmedi), sargılı eliyle ayakkabı bağlamak 20 dakika sürdü. Durağa geldi. Bir sorun var: hangi otobüse bineceğini bilmiyor.",
      "secenekler": [
        {
          "etiket": "📞 Kurban'a sorsun",
          "hedef": "gk_G1_1"
        },
        {
          "etiket": "🧍 Sokaktan rastgele birine sorsun",
          "hedef": "gk_G1_2"
        }
      ]
    },
    "gk_G1_1": {
      "emoji": "📞",
      "metin": "Kurban 7. çalışta açtı: \"Ne var lan? KPSS'ye bir hafta var, dün kitabımı kolayla ıslattın. 1 dakikan var.\" Berkay: \"Gölcük'e hangi otobüs gidiyor kanka?\" Kurban derin bir iç çekti.",
      "secenekler": [
        {
          "etiket": "🙏 Yalvarsın",
          "hedef": "gk_G2_1"
        },
        {
          "etiket": "🍗 \"Popeyes ısmarlarım\" desin",
          "hedef": "gk_G2_2"
        }
      ]
    },
    "gk_G1_2": {
      "emoji": "👴",
      "metin": "Duraktaki amcaya sordu. Amca \"Gölcük mü? Ben orada askerlik yaptım evladım...\" diye başladı. 45 dakika geçti, amcanın hikâyesi hâlâ 1989'da. Otobüsler gelip geçiyor.",
      "secenekler": [
        {
          "etiket": "👂 Sonuna kadar dinlesin",
          "hedef": "gk_GA1_1"
        },
        {
          "etiket": "📞 Kaçıp Kurban'ı arasın",
          "hedef": "gk_GA1_2"
        }
      ]
    },
    "gk_GA1_1": {
      "emoji": "⏳",
      "metin": "Amca bitirdi: \"Gölcük otobüsü mü? O az önce kalktı evladım.\" Bir sonraki bir saat sonra. Bir saat beklemesi lazım. Birini arayıp dertleşmeli.",
      "secenekler": [
        {
          "etiket": "🦅 Alihan'ı arasın",
          "hedef": "gk_GA2_1"
        },
        {
          "etiket": "🍔 Burger'i arasın",
          "hedef": "gk_GA2_2"
        }
      ]
    },
    "gk_GA1_2": {
      "emoji": "🚌",
      "metin": "Amcaya \"telefon geldi\" deyip kaçtı. Kurban'a Popeyes sözü verdi. Kurban: \"Kırmızı otobüs, 7'yle başlıyor. Sen yaparsın Berkay!\" (Kurban da inanmıyor.) Durağa aynı anda iki kırmızı otobüs yanaştı, ikisi de 7'yle başlıyor.",
      "secenekler": [
        {
          "etiket": "🏃 İlk gelene atlasın",
          "hedef": "gk_G3_1"
        },
        {
          "etiket": "🧐 Şoföre sorsun",
          "hedef": "gk_G3_2"
        }
      ]
    },
    "gk_GA2_1": {
      "emoji": "🧶",
      "metin": "Alihan: \"Enver Paşa Sarıkamış'a yürüyerek gitti, sen otobüs mü bekleyemiyorsun?\" Berkay: \"Enver o kadar askeri kışın dağa yolladı, beceriksizin teki!\" Hata. Alihan 40 dakika bağırdı, Burger'i de hatta bağladı, ikisi birden Enver'i savundu. Bu arada otobüs geldi, Berkay telefon kulağında bindi. Berkay en arkaya oturdu. Yanında örgü ören bir teyze var. Otobüs Gölcük'e doğru yola çıktı.",
      "secenekler": [
        {
          "etiket": "🔊 Kurban'ı hoparlörden arasın",
          "hedef": "gk_G4_1"
        },
        {
          "etiket": "🎧 Kulaklık takıp uyusun",
          "hedef": "gk_G4_2"
        }
      ]
    },
    "gk_GA2_2": {
      "emoji": "🧶",
      "metin": "Burger kütüphaneden fısıldadı: \"Alihan'ın kahve haklarını bitiriyorum, çabuk.\" Durumu dinleyince: \"Gölcük'te Burger King var mı? Geliyorum.\" 20 dakikada iki kahveyle geldi. Birlikte otobüse bindiler, Burger ön koltukta kitabını açtı. Berkay en arkaya oturdu. Yanında örgü ören bir teyze var. Otobüs Gölcük'e doğru yola çıktı.",
      "secenekler": [
        {
          "etiket": "🔊 Kurban'ı hoparlörden arasın",
          "hedef": "gk_G4_1"
        },
        {
          "etiket": "🎧 Kulaklık takıp uyusun",
          "hedef": "gk_G4_2"
        }
      ]
    },
    "gk_G2_1": {
      "emoji": "📦",
      "metin": "5 dakika yalvardı. Kurban: \"Ben de bilmiyorum. Halil'e sor, bütün depoların bütün araçları ondan sorulur.\" Halil forklift sesinin arasından açtı: \"Kanka Hepsijet deposundayım, bedava stajdayım, çok konuşamam. Ekol'ün kamyonu Gölcük'e çıkıyor, arkaya atla. Ya da kırmızı otobüs, 7'yle başlıyor.\"",
      "secenekler": [
        {
          "etiket": "🚛 Kamyona atlasın",
          "hedef": "gk_GH1_1"
        },
        {
          "etiket": "🚌 Otobüse binsin",
          "hedef": "gk_GH1_2"
        }
      ]
    },
    "gk_G2_2": {
      "emoji": "🚌",
      "metin": "Popeyes lafını duyan Kurban anında uyandı: \"Kırmızı otobüs, 7'yle başlıyor. Sen yaparsın Berkay, sen bu işin hocasısın!\" (Kurban da inanmıyor.) Durağa aynı anda iki kırmızı otobüs yanaştı, ikisi de 7'yle başlıyor.",
      "secenekler": [
        {
          "etiket": "🏃 İlk gelene atlasın",
          "hedef": "gk_G3_1"
        },
        {
          "etiket": "🧐 Şoföre sorsun",
          "hedef": "gk_G3_2"
        }
      ]
    },
    "gk_GH1_1": {
      "emoji": "🚛",
      "metin": "Kamyonun kasasında klima kutularının arasına kuruldu. Kamyon her depoda duruyor, şoför Berkay'a bakıp \"hazır buradasın\" diyor. Kamyon bir depoya daha yanaştı. Şoför: \"Şu 12 koliyi indirirsen 50 lira.\"",
      "secenekler": [
        {
          "etiket": "💪 Tek eliyle koli taşısın",
          "hedef": "gk_GH2_1"
        },
        {
          "etiket": "💤 Kolilerin arasında uyusun",
          "hedef": "gk_GH2_2"
        }
      ]
    },
    "gk_GH1_2": {
      "emoji": "🧶",
      "metin": "7'yle başlayan kırmızı otobüsü buldu. Şoföre sordu: \"Gölcük, bin.\" Kart bip etti. Berkay en arkaya oturdu. Yanında örgü ören bir teyze var. Otobüs Gölcük'e doğru yola çıktı.",
      "secenekler": [
        {
          "etiket": "🔊 Kurban'ı hoparlörden arasın",
          "hedef": "gk_G4_1"
        },
        {
          "etiket": "🎧 Kulaklık takıp uyusun",
          "hedef": "gk_G4_2"
        }
      ]
    },
    "gk_GH2_1": {
      "emoji": "🕳️",
      "metin": "Sargılı eli yüzünden tek elle 12 koli taşıdı, 3 saat sürdü. Şoför 50 TL verdi. Berkay hayatında ilk kez alnının teriyle para kazandı. Halil'e yazdı: \"Ben de ameleyim artık.\" Kamyon Gölcük'te indirdi. Gölcük sokaklarında yürüyor. Telefonda harita açık, ileride kaldırımda bir çukur var.",
      "secenekler": [
        {
          "etiket": "📱 Telefona bakmaya devam etsin",
          "hedef": "gk_G6_1"
        },
        {
          "etiket": "👀 Etrafa baksın",
          "hedef": "gk_G6_2"
        }
      ]
    },
    "gk_GH2_2": {
      "emoji": "🕳️",
      "metin": "Kolilerin arasında uyudu. Gölcük'te boşaltırken işçiler \"bu koli neden horluyor?\" diye açtılar. İçinden Berkay çıktı, \"kargo benim\" deyip kaçtı. Gölcük sokaklarında yürüyor. Telefonda harita açık, ileride kaldırımda bir çukur var.",
      "secenekler": [
        {
          "etiket": "📱 Telefona bakmaya devam etsin",
          "hedef": "gk_G6_1"
        },
        {
          "etiket": "👀 Etrafa baksın",
          "hedef": "gk_G6_2"
        }
      ]
    },
    "gk_G3_1": {
      "emoji": "🏞️",
      "metin": "İlk gelene atladı. 40 dakika sonra tabelayı okudu: Sapanca. Göl var ama Gölcük değil, salak. Sapanca gölünün kenarında. Kurban'a konum attı. Kurban: \"KPSS'ye 7 gün var ve ben seninle uğraşıyorum.\"",
      "secenekler": [
        {
          "etiket": "🔁 Geri dönen otobüse binsin",
          "hedef": "gk_GS1_1"
        },
        {
          "etiket": "🦆 Ördeklere simit atsın",
          "hedef": "gk_GS1_2"
        }
      ]
    },
    "gk_G3_2": {
      "emoji": "🧶",
      "metin": "Şoför: \"Gölcük, bin.\" Kart bip etti. Berkay en arkaya oturdu. Yanında örgü ören bir teyze var. Otobüs Gölcük'e doğru yola çıktı.",
      "secenekler": [
        {
          "etiket": "🔊 Kurban'ı hoparlörden arasın",
          "hedef": "gk_G4_1"
        },
        {
          "etiket": "🎧 Kulaklık takıp uyusun",
          "hedef": "gk_G4_2"
        }
      ]
    },
    "gk_GS1_1": {
      "emoji": "🕳️",
      "metin": "Geri dönen otobüste yine uyudu. Ama bu sefer mucize: gözünü açtığında Gölcük'teydi. Şans da bir yetenektir. Gölcük sokaklarında yürüyor. Telefonda harita açık, ileride kaldırımda bir çukur var.",
      "secenekler": [
        {
          "etiket": "📱 Telefona bakmaya devam etsin",
          "hedef": "gk_G6_1"
        },
        {
          "etiket": "👀 Etrafa baksın",
          "hedef": "gk_G6_2"
        }
      ]
    },
    "gk_GS1_2": {
      "emoji": "🕳️",
      "metin": "Simit alıp ördeklere attı. Ördekler simidi değil Berkay'ı kovaladı. Kaçarken bir minibüse atladı; minibüs Gölcük'e gidiyormuş. Ördekler de şans getirir. Gölcük sokaklarında yürüyor. Telefonda harita açık, ileride kaldırımda bir çukur var.",
      "secenekler": [
        {
          "etiket": "📱 Telefona bakmaya devam etsin",
          "hedef": "gk_G6_1"
        },
        {
          "etiket": "👀 Etrafa baksın",
          "hedef": "gk_G6_2"
        }
      ]
    },
    "gk_G4_1": {
      "emoji": "📢",
      "metin": "\"KUBİİİ OTOBÜSTEYİM KANKA!\" Şoför otobüsü sağa çekti, Berkay'ı indirdi. Yolcular alkışladı, teyze örgüsüne devam etti. SON.",
      "secenekler": []
    },
    "gk_G4_2": {
      "emoji": "🗺️",
      "metin": "Uyudu, horladı. Teyze dürttü: \"Oğlum Gölcük'e geldik, horlamandan örgümü üç kere söktüm.\" İndi. Gölcük! Buluşmaya 1 saat var, sahile 2 km.",
      "secenekler": [
        {
          "etiket": "🚶 Yürüsün",
          "hedef": "gk_G5_1"
        },
        {
          "etiket": "🛴 Martı kiralasın",
          "hedef": "gk_G5_2"
        }
      ]
    },
    "gk_G5_1": {
      "emoji": "🕳️",
      "metin": "Haritayı açıp yürümeye başladı. Gölcük sokaklarında yürüyor. Telefonda harita açık, ileride kaldırımda bir çukur var.",
      "secenekler": [
        {
          "etiket": "📱 Telefona bakmaya devam etsin",
          "hedef": "gk_G6_1"
        },
        {
          "etiket": "👀 Etrafa baksın",
          "hedef": "gk_G6_2"
        }
      ]
    },
    "gk_G5_2": {
      "emoji": "🛴",
      "metin": "Martı'ya bindi: \"Kubiii 85'i göreceğim!\" Scooter 25'ten fazla gitmedi. Hırsından gaza asıldı, ön teker çukura girdi, Berkay uçtu. Yerde. Scooter devrik, Berkay devrik, sargılı eli havada.",
      "secenekler": [
        {
          "etiket": "📞 Martı'yı arayıp şikâyet etsin",
          "hedef": "gk_GM1_1"
        },
        {
          "etiket": "🦵 Hemen kalksın",
          "hedef": "gk_GM1_2"
        }
      ]
    },
    "gk_GM1_1": {
      "emoji": "🦶",
      "metin": "Müşteri hizmetleri: \"Hız sınırını aşmaya çalışan müşterimiz, 85 için uçağa binmeniz gerekir.\" 20 dakika beklemede kaldı, sonra kalkmaya çalıştı: ayağı \"kıtır.\" Ayağı portakal gibi şişti. Dünden kalma sargılı el, bugünden yamuk ayak. Buluşmaya 40 dakika var.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk_G7_1"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_G7_2"
        }
      ]
    },
    "gk_GM1_2": {
      "emoji": "🦶",
      "metin": "Hızlı kalktı. Çok hızlı: ayağı \"kıtır\" diye yamuldu. Ayağı portakal gibi şişti. Dünden kalma sargılı el, bugünden yamuk ayak. Buluşmaya 40 dakika var.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk_G7_1"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_G7_2"
        }
      ]
    },
    "gk_G6_1": {
      "emoji": "🦶",
      "metin": "Bakmaya devam etti. Çukur da ona bakmaya devam etti. Ayağı yamuldu: \"kıtır.\" Ayağı portakal gibi şişti. Dünden kalma sargılı el, bugünden yamuk ayak. Buluşmaya 40 dakika var.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk_G7_1"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_G7_2"
        }
      ]
    },
    "gk_G6_2": {
      "emoji": "🦶",
      "metin": "Etrafa baktı, çukuru gördü, etrafından dolaştı ve tam o sırada ikinci çukura bastı: \"kıtır.\" Gölcük'te çukur bol. Ayağı portakal gibi şişti. Dünden kalma sargılı el, bugünden yamuk ayak. Buluşmaya 40 dakika var.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk_G7_1"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_G7_2"
        }
      ]
    },
    "gk_G7_1": {
      "emoji": "🦩",
      "metin": "Tek ayak üstünde seke seke ilerliyor, flamingo gibi. Mahallenin çocukları arkasından \"flamingo abi!\" diye bağırıp taklidini yapıyor. Her sokakta çocukların sayısı artıyor, arkasında artık koca bir kalabalık var.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_G8_1"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk_G8_2"
        }
      ]
    },
    "gk_G7_2": {
      "emoji": "🧊",
      "metin": "Ambulans geldi, görevli 3 saniye baktı: \"Burkulma, buz koy. El de mi? Boks makinesi mi? Bu ay beşinci vaka.\" Ve gitti. Buz yok. Buz lazım. Aklına iki kişi geliyor.",
      "secenekler": [
        {
          "etiket": "🍔 Burger'den buzlu kola istesin",
          "hedef": "gk_GAMB_1"
        },
        {
          "etiket": "🦅 Alihan'dan tavsiye istesin",
          "hedef": "gk_GAMB_2"
        }
      ]
    },
    "gk_GAMB_1": {
      "emoji": "📱",
      "metin": "Burger tesadüfen Gölcük'teki Burger King'deymiş. Buzlu kolayı getirdi ama yarısını yolda içmiş, kalan buzları Berkay'ın bileğine döktü: \"Bir burger ye, iyileşirsin.\" Berkay yedi, Burger gururla gitti. Kız arkadaşından mesaj: \"Geldin mi? Ben sahildeyim 😊\" Sahile 500 metre var.",
      "secenekler": [
        {
          "etiket": "📸 Ayağının fotoğrafını atsın",
          "hedef": "gk_G9_1"
        },
        {
          "etiket": "😎 \"Geldim\" yazsın",
          "hedef": "gk_G9_2"
        }
      ]
    },
    "gk_GAMB_2": {
      "emoji": "📱",
      "metin": "Alihan: \"Sarıkamış'ta askerler buzla yaşadı, sen buz mu bulamıyorsun?\" Berkay ayağını mahalle çeşmesine soktu. Çeşmedeki amca: \"Abdest mi alıyon evlat?\" Kız arkadaşından mesaj: \"Geldin mi? Ben sahildeyim 😊\" Sahile 500 metre var.",
      "secenekler": [
        {
          "etiket": "📸 Ayağının fotoğrafını atsın",
          "hedef": "gk_G9_1"
        },
        {
          "etiket": "😎 \"Geldim\" yazsın",
          "hedef": "gk_G9_2"
        }
      ]
    },
    "gk_G8_1": {
      "emoji": "📱",
      "metin": "\"Ne bakıyonuz lan!\" Çocuklar top attı. Berkay topa vurmaya kalktı, sakat ayakla ıskalayıp yere yapıştı. Dünkü halı saha gibi. Çocuklar acıyıp onu bakkalın el arabasıyla sahile kadar götürdü. Kız arkadaşından mesaj: \"Geldin mi? Ben sahildeyim 😊\" Sahile 500 metre var.",
      "secenekler": [
        {
          "etiket": "📸 Ayağının fotoğrafını atsın",
          "hedef": "gk_G9_1"
        },
        {
          "etiket": "😎 \"Geldim\" yazsın",
          "hedef": "gk_G9_2"
        }
      ]
    },
    "gk_G8_2": {
      "emoji": "📱",
      "metin": "Umursamadı. Çocuklar sıkılıp dağıldı. Tek başına seke seke ilerledi. Kız arkadaşından mesaj: \"Geldin mi? Ben sahildeyim 😊\" Sahile 500 metre var.",
      "secenekler": [
        {
          "etiket": "📸 Ayağının fotoğrafını atsın",
          "hedef": "gk_G9_1"
        },
        {
          "etiket": "😎 \"Geldim\" yazsın",
          "hedef": "gk_G9_2"
        }
      ]
    },
    "gk_G9_1": {
      "emoji": "💞",
      "metin": "Fotoğrafı çekti, yanlışlıkla arkadaş grubuna attı. Alihan: \"Sarıkamış'ta bile böyle şişmedi.\" Burger: \"Burger ye geçer.\" Halil: \"Depoda klima düşse bu kadar ezilmez.\" Kurban: \"KPSS'ye 7 gün var.\" Sonra kız arkadaşına \"geliyorum\" yazıp seke seke sahile vardı. Sahildeler: Berkay ter içinde, tek ayak havada, bir eli sargılı. Kız arkadaşı baştan aşağı baktı: \"Ne oldu sana böyle?\"",
      "secenekler": [
        {
          "etiket": "🦸 \"Kavga ettim\" desin",
          "hedef": "gk_G10_1"
        },
        {
          "etiket": "😅 Dürüstçe anlatsın",
          "hedef": "gk_G10_2"
        }
      ]
    },
    "gk_G9_2": {
      "emoji": "💞",
      "metin": "\"Geldim 😎\" yazdı. 500 metreyi seke seke 25 dakikada aldı. Sahildeler: Berkay ter içinde, tek ayak havada, bir eli sargılı. Kız arkadaşı baştan aşağı baktı: \"Ne oldu sana böyle?\"",
      "secenekler": [
        {
          "etiket": "🦸 \"Kavga ettim\" desin",
          "hedef": "gk_G10_1"
        },
        {
          "etiket": "😅 Dürüstçe anlatsın",
          "hedef": "gk_G10_2"
        }
      ]
    },
    "gk_G10_1": {
      "emoji": "🌊",
      "metin": "\"Beş kişiydiler.\" Tam o sırada mahallenin çocukları \"flamingo abi!\" diye bağırarak geçti. Yalan tam 3 saniye yaşadı. Kız arkadaşı gülümsedi: \"Tamam kahraman.\" Kız arkadaşı koluna girdi: \"Yemekten önce sahilde biraz takılalım mı?\"",
      "secenekler": [
        {
          "etiket": "🌊 Sahilde yürüsünler",
          "hedef": "gk_G11_1"
        },
        {
          "etiket": "🍦 Önce dondurma alsın",
          "hedef": "gk_G11_2"
        }
      ]
    },
    "gk_G10_2": {
      "emoji": "🌊",
      "metin": "Boks makinesini, kolayı, halı sahayı, çukuru tek tek anlattı. Kız arkadaşı gülmemek için dudağını ısırdı: \"Geçmiş olsun... hepsi iki günde mi?\" Kız arkadaşı koluna girdi: \"Yemekten önce sahilde biraz takılalım mı?\"",
      "secenekler": [
        {
          "etiket": "🌊 Sahilde yürüsünler",
          "hedef": "gk_G11_1"
        },
        {
          "etiket": "🍦 Önce dondurma alsın",
          "hedef": "gk_G11_2"
        }
      ]
    },
    "gk_G11_1": {
      "emoji": "📸",
      "metin": "Sahilde yürüdüler. Berkay seke seke, kız arkadaşı yavaş yavaş. Martılar Berkay'ın etrafında dönüyor, sanki bir şey biliyorlar. İskeleye geldiler, manzara çok güzel. Kız arkadaşı: \"Bir fotoğraf çekelim mi?\"",
      "secenekler": [
        {
          "etiket": "🤳 Selfie çeksinler",
          "hedef": "gk_G12_1"
        },
        {
          "etiket": "🙋 Birine çektirsinler",
          "hedef": "gk_G12_2"
        }
      ]
    },
    "gk_G11_2": {
      "emoji": "🍦",
      "metin": "Maraş dondurmacısına gitti: \"İki top.\" Dondurmacı şov yaptı, külahı 4 kere geri çekti. Berkay sargılı eliyle yakalamaya çalışırken dondurma yere düştü. Dondurma yerde. Dondurmacı gülüyor, kız arkadaşı gülüyor, bir martı dondurmayı yiyor.",
      "secenekler": [
        {
          "etiket": "😤 Dondurmacıya çıkışsın",
          "hedef": "gk_GD1_1"
        },
        {
          "etiket": "🐦 Martıyla kavga etsin",
          "hedef": "gk_GD1_2"
        }
      ]
    },
    "gk_GD1_1": {
      "emoji": "📸",
      "metin": "\"Paramı geri ver!\" Dondurmacı: \"Şov dahil fiyat.\" Berkay: \"Benim suçum yok.\" (Dünden beri dördüncü kez.) Dondurmacı acıyıp bir top bedava verdi. İskeleye geldiler, manzara çok güzel. Kız arkadaşı: \"Bir fotoğraf çekelim mi?\"",
      "secenekler": [
        {
          "etiket": "🤳 Selfie çeksinler",
          "hedef": "gk_G12_1"
        },
        {
          "etiket": "🙋 Birine çektirsinler",
          "hedef": "gk_G12_2"
        }
      ]
    },
    "gk_GD1_2": {
      "emoji": "📸",
      "metin": "Martıya \"O benim!\" diye bağırdı. Martı Berkay'a baktı, kalan dondurmayı da alıp uçtu. Kız arkadaşı kendi dondurmasını Berkay'la paylaştı. İskeleye geldiler, manzara çok güzel. Kız arkadaşı: \"Bir fotoğraf çekelim mi?\"",
      "secenekler": [
        {
          "etiket": "🤳 Selfie çeksinler",
          "hedef": "gk_G12_1"
        },
        {
          "etiket": "🙋 Birine çektirsinler",
          "hedef": "gk_G12_2"
        }
      ]
    },
    "gk_G12_1": {
      "emoji": "😋",
      "metin": "Tek eliyle selfie çekmeye çalıştı. Telefon kaydı, iskeleden aşağı sallandı, son anda sargılı eliyle yakaladı: \"kıtır.\" Fotoğrafta Berkay acıdan buruşmuş, kız arkadaşı gülüyor. Yine de güzel çıktı. Saat 18:00. İkisi de acıktı. Berkay'ın gözleri Popeyes tabelasını çoktan görmüştü.",
      "secenekler": [
        {
          "etiket": "🍗 \"Popeyes!\" desin",
          "hedef": "gk_G13_1"
        },
        {
          "etiket": "🥗 \"Salata yiyelim\" desin",
          "hedef": "gk_G13_2"
        }
      ]
    },
    "gk_G12_2": {
      "emoji": "😋",
      "metin": "Yoldan geçen amcaya uzattı. Amca 40 fotoğraf çekti, hepsinde parmağı var. Amca \"Ben burada askerlik yaptım...\" diye başlamadan kaçtılar. Saat 18:00. İkisi de acıktı. Berkay'ın gözleri Popeyes tabelasını çoktan görmüştü.",
      "secenekler": [
        {
          "etiket": "🍗 \"Popeyes!\" desin",
          "hedef": "gk_G13_1"
        },
        {
          "etiket": "🥗 \"Salata yiyelim\" desin",
          "hedef": "gk_G13_2"
        }
      ]
    },
    "gk_G13_1": {
      "emoji": "🧾",
      "metin": "\"POPEYES!\" diye öyle bağırdı ki iskeledeki martılar havalandı. Popeyes. Kasaya abandı: \"En büyük menü hangisi?\" Kasiyer: \"1000 TL'lik aile menüsü var ama 6 kişilik.\" Berkay: \"Yeter.\" Dün lokantada bile borç almıştı...",
      "secenekler": [
        {
          "etiket": "💳 Kartla ödesin",
          "hedef": "gk_G14_1"
        },
        {
          "etiket": "📞 Kurban'dan borç istesin",
          "hedef": "gk_G14_2"
        }
      ]
    },
    "gk_G13_2": {
      "emoji": "🧾",
      "metin": "\"Salata\" derken kendi sesine yabancılaştı. Popeyes'ın önünden geçerken gözünden bir damla yaş süzüldü. Kız arkadaşı anladı: \"Hadi Popeyes'a gidelim.\" Popeyes. Kasaya abandı: \"En büyük menü hangisi?\" Kasiyer: \"1000 TL'lik aile menüsü var ama 6 kişilik.\" Berkay: \"Yeter.\" Dün lokantada bile borç almıştı...",
      "secenekler": [
        {
          "etiket": "💳 Kartla ödesin",
          "hedef": "gk_G14_1"
        },
        {
          "etiket": "📞 Kurban'dan borç istesin",
          "hedef": "gk_G14_2"
        }
      ]
    },
    "gk_G14_1": {
      "emoji": "🍗",
      "metin": "Kartı bastı. Bip. 1000 TL gitti, ay sonuna kadar bismillah. Garson 6 kişilik tepsiyi getirirken iki kere mola verdi. Masada tavuklar ve 3 kova patates. Kız arkadaşı bir parça aldı, Berkay'ın gözleri büyüdü.",
      "secenekler": [
        {
          "etiket": "🍗 Tavukla başlasın",
          "hedef": "gk_G15_1"
        },
        {
          "etiket": "🍟 Patatesle başlasın",
          "hedef": "gk_G15_2"
        }
      ]
    },
    "gk_G14_2": {
      "emoji": "🍗",
      "metin": "Kurban: \"Dün 340 verdim, kitabımı ıslattın, bugün 1000 mi?\" Berkay: \"Airdrop gelince...\" Kurban kapattı. Berkay kartı bastı: 1000 TL gitti. Garson 6 kişilik tepsiyi getirirken iki kere mola verdi. Masada tavuklar ve 3 kova patates. Kız arkadaşı bir parça aldı, Berkay'ın gözleri büyüdü.",
      "secenekler": [
        {
          "etiket": "🍗 Tavukla başlasın",
          "hedef": "gk_G15_1"
        },
        {
          "etiket": "🍟 Patatesle başlasın",
          "hedef": "gk_G15_2"
        }
      ]
    },
    "gk_G15_1": {
      "emoji": "🍟",
      "metin": "İlk tavuğu ısırdı, dili yandı. Çalışan buzlu su getirdi; Berkay buzları ayak bileğine koydu: iki sorun, tek hamle. Sonra birinci kova patatese daldı, 40 saniyede bitirdi. Kız arkadaşı şaşkın. Masada iki kova daha duruyor.",
      "secenekler": [
        {
          "etiket": "🛑 Dursun artık",
          "hedef": "gk_G16_1"
        },
        {
          "etiket": "🍟 İkinci kovaya geçsin",
          "hedef": "gk_G16_2"
        }
      ]
    },
    "gk_G15_2": {
      "emoji": "🍟",
      "metin": "Birinci kova patates: 40 saniye. Bitti. Kız arkadaşı daha 3 tane yemişti. Kız arkadaşı şaşkın. Masada iki kova daha duruyor.",
      "secenekler": [
        {
          "etiket": "🛑 Dursun artık",
          "hedef": "gk_G16_1"
        },
        {
          "etiket": "🍟 İkinci kovaya geçsin",
          "hedef": "gk_G16_2"
        }
      ]
    },
    "gk_G16_1": {
      "emoji": "🏆",
      "metin": "\"Dur\" kelimesi Berkay'ın sisteminde tanımlı değil. Beyni 30 saniye donup yeniden başladı. İlk sözü: \"Bir kova daha.\" İkinciyi de bitirdi. Üçüncü kova masada. Kasiyer mutfağa \"rekor kırılıyor!\" diye seslendi, bütün çalışanlar toplandı. Tam o sırada telefon titredi: Burger görüntülü arıyor.",
      "secenekler": [
        {
          "etiket": "📹 Burger'i açıp canlı yayın yapsın",
          "hedef": "gk_G17_1"
        },
        {
          "etiket": "🥤 Önce kolayla bastırsın",
          "hedef": "gk_G17_2"
        }
      ]
    },
    "gk_G16_2": {
      "emoji": "🏆",
      "metin": "İkinci kova da bitti. Parmaklar tuzdan kurudu, göz bebekleri büyüdü. Garson uzaktan endişeyle izliyor. Üçüncü kova masada. Kasiyer mutfağa \"rekor kırılıyor!\" diye seslendi, bütün çalışanlar toplandı. Tam o sırada telefon titredi: Burger görüntülü arıyor.",
      "secenekler": [
        {
          "etiket": "📹 Burger'i açıp canlı yayın yapsın",
          "hedef": "gk_G17_1"
        },
        {
          "etiket": "🥤 Önce kolayla bastırsın",
          "hedef": "gk_G17_2"
        }
      ]
    },
    "gk_G17_1": {
      "emoji": "🖼️",
      "metin": "Burger ekranda: \"Popeyes'ta mı rekor kırıyorsun? İhanet! ...Ama bitir.\" Burger'in gazıyla üçüncü kovayı bitirdi. Çalışanlar alkışladı, pantolon düğmesi uçup sos standına çarptı. Rekor kırıldı. Müdür yanına geldi: \"Ayın Müşterisi panosuna fotoğrafını asalım mı?\"",
      "secenekler": [
        {
          "etiket": "📸 Fotoğraf çektirsin",
          "hedef": "gk_G18_1"
        },
        {
          "etiket": "🙅 \"Mahremiyetim var\" desin",
          "hedef": "gk_G18_2"
        }
      ]
    },
    "gk_G17_2": {
      "emoji": "🖼️",
      "metin": "1 litre kolayı tek nefeste içti, öyle bir geğirdi ki yan masadaki bebek ağladı. Gidip bebekten özür diledi; bebek Berkay'ın yüzüne bakıp daha çok ağladı. Masaya dönüp üçüncü kovayı bitirdi. Çalışanlar alkışladı, pantolon düğmesi uçtu. Rekor kırıldı. Müdür yanına geldi: \"Ayın Müşterisi panosuna fotoğrafını asalım mı?\"",
      "secenekler": [
        {
          "etiket": "📸 Fotoğraf çektirsin",
          "hedef": "gk_G18_1"
        },
        {
          "etiket": "🙅 \"Mahremiyetim var\" desin",
          "hedef": "gk_G18_2"
        }
      ]
    },
    "gk_G18_1": {
      "emoji": "🎡",
      "metin": "Fotoğraf panoya asıldı. Altına küçük harflerle yazdılar: \"Bu kişiye ikinci kova verilmez.\" Gruba attı, Kurban: \"KPSS'de bu kadar soru çözsen...\" Dışarı çıktılar. Sahilde küçük bir lunapark kurulmuş. Kız arkadaşı: \"Hadi bir şeye binelim!\"",
      "secenekler": [
        {
          "etiket": "🎡 Dönme dolaba binsinler",
          "hedef": "gk_G19_1"
        },
        {
          "etiket": "🎯 Balon patlatıp ayı kazansın",
          "hedef": "gk_G19_2"
        }
      ]
    },
    "gk_G18_2": {
      "emoji": "🎡",
      "metin": "\"Mahremiyetim var\" dedi. Müdür yine de gizlice çekti. Berkay kalkarken ayağı \"kıtır\" dedi, kız arkadaşı koluna girdi. Dışarı çıktılar. Sahilde küçük bir lunapark kurulmuş. Kız arkadaşı: \"Hadi bir şeye binelim!\"",
      "secenekler": [
        {
          "etiket": "🎡 Dönme dolaba binsinler",
          "hedef": "gk_G19_1"
        },
        {
          "etiket": "🎯 Balon patlatıp ayı kazansın",
          "hedef": "gk_G19_2"
        }
      ]
    },
    "gk_G19_1": {
      "emoji": "🌆",
      "metin": "Dönme dolap en tepede durdu. Berkay korkudan titremeye başladı, kız arkadaşının elini sıktı, sargılı eliyle: \"kıtır.\" İnince \"rüzgâr gözüme kaçtı\" dedi. Hava karardı, kız arkadaşının eve dönmesi lazım. Durağa doğru yürüyorlar; Berkay seke seke, her sekişte karnından bir \"hık\" geliyor.",
      "secenekler": [
        {
          "etiket": "👋 Durakta vedalaşsınlar",
          "hedef": "gk_G20_1"
        },
        {
          "etiket": "🚕 Onu taksiye bindirsin",
          "hedef": "gk_G20_2"
        }
      ]
    },
    "gk_G19_2": {
      "emoji": "🌆",
      "metin": "10 atış, 0 isabet. Balon hariç her yeri vurdu, bir dart tezgâhtarın şapkasına saplandı. Tezgâhtar acıyıp teselli ödülü verdi: minicik bir ayı. Berkay ayıyı kız arkadaşına verip \"kazandım\" dedi. Hava karardı, kız arkadaşının eve dönmesi lazım. Durağa doğru yürüyorlar; Berkay seke seke, her sekişte karnından bir \"hık\" geliyor.",
      "secenekler": [
        {
          "etiket": "👋 Durakta vedalaşsınlar",
          "hedef": "gk_G20_1"
        },
        {
          "etiket": "🚕 Onu taksiye bindirsin",
          "hedef": "gk_G20_2"
        }
      ]
    },
    "gk_G20_1": {
      "emoji": "🪫",
      "metin": "Vedalaştılar. Kız arkadaşı \"Eve varınca yaz, bugün çok güldüm\" dedi ve gitti. Berkay \"çok güldüm\" kısmını 12 kere okudu. Berkay durakta tek başına. Otobüse 15 dakika var, telefon %8.",
      "secenekler": [
        {
          "etiket": "🎮 Telefonda oyun oynasın",
          "hedef": "gk_G21_1"
        },
        {
          "etiket": "🪑 Banka otursun",
          "hedef": "gk_G21_2"
        }
      ]
    },
    "gk_G20_2": {
      "emoji": "🪫",
      "metin": "Kız arkadaşını taksiyle evine yolladı, çok centilmen. Kendine de taksi çağıracaktı, cüzdana baktı: 12 TL. Taksi iptal. Berkay durakta tek başına. Otobüse 15 dakika var, telefon %8.",
      "secenekler": [
        {
          "etiket": "🎮 Telefonda oyun oynasın",
          "hedef": "gk_G21_1"
        },
        {
          "etiket": "🪑 Banka otursun",
          "hedef": "gk_G21_2"
        }
      ]
    },
    "gk_G21_1": {
      "emoji": "☎️",
      "metin": "Oyuna daldı, bir otobüs kaçırdı. Sinirle telefonu cebine koyarken kaldırıma takıldı, sargılı elinin üstüne düştü: \"kıtır.\" Aynı el, ikinci hasar. Ayak şiş, el iki kere hasarlı, mide 3 kova. Birini araması lazım.",
      "secenekler": [
        {
          "etiket": "📚 Kurban'ı arasın",
          "hedef": "gk_G22_1"
        },
        {
          "etiket": "📦 Halil'i arasın",
          "hedef": "gk_G22_2"
        }
      ]
    },
    "gk_G21_2": {
      "emoji": "☎️",
      "metin": "Banka oturmak için sargılı elini dayadı. Bank ıslaktı, eli kaydı, bileğinin üstüne düştü: \"kıtır.\" Aynı el, ikinci hasar. Ayak şiş, el iki kere hasarlı, mide 3 kova. Birini araması lazım.",
      "secenekler": [
        {
          "etiket": "📚 Kurban'ı arasın",
          "hedef": "gk_G22_1"
        },
        {
          "etiket": "📦 Halil'i arasın",
          "hedef": "gk_G22_2"
        }
      ]
    },
    "gk_G22_1": {
      "emoji": "🚌",
      "metin": "Kurban: \"Popeyes'ım nerede?\" Berkay: \"Elim yine yamuldu kanka.\" Kurban: \"Elin yamuldu da benim Popeyes'ımın ne suçu var?\" Berkay \"yarın iki menü\" dedi. Kurban: \"Yazılı söz istiyorum.\" Otobüs geldi! Berkay yamuk eliyle kartı aradı. Kart cüzdanın en dibinde, Popeyes fişlerinin arasında.",
      "secenekler": [
        {
          "etiket": "🪙 Bozuk parayla ödesin",
          "hedef": "gk_G23_1"
        },
        {
          "etiket": "💳 Kartı çıkarsın",
          "hedef": "gk_G23_2"
        }
      ]
    },
    "gk_G22_2": {
      "emoji": "🚌",
      "metin": "Halil depodan: \"Kanka yarın klima deposuna gelirsen 800 TL.\" Berkay sargılı elini düşündü: \"Gelirim.\" Halil: \"Tek elle mi?\" \"Tek elle.\" Halil listeye yazdı. Otobüs geldi! Berkay yamuk eliyle kartı aradı. Kart cüzdanın en dibinde, Popeyes fişlerinin arasında.",
      "secenekler": [
        {
          "etiket": "🪙 Bozuk parayla ödesin",
          "hedef": "gk_G23_1"
        },
        {
          "etiket": "💳 Kartı çıkarsın",
          "hedef": "gk_G23_2"
        }
      ]
    },
    "gk_G23_1": {
      "emoji": "🪙",
      "metin": "Şoföre avuç dolusu bozukluk uzattı. Şoför: \"1998'den mi geldin sen?\" Kapı kapandı, Berkay bozukluklarıyla durakta kaldı. SON.",
      "secenekler": []
    },
    "gk_G23_2": {
      "emoji": "💳",
      "metin": "Kartı çıkardı, yamuk eliyle okuyucuya bastırdı. Bip yok. Bir daha. Bip yok. Arkadaki kuyruk söylenmeye başladı. Kuyruk büyüyor, şoför bekliyor, kart okuyucuya yapışık.",
      "secenekler": [
        {
          "etiket": "💪 Bütün gücüyle bassın",
          "hedef": "gk_G24_1"
        },
        {
          "etiket": "🔄 Kartı ters çevirsin",
          "hedef": "gk_G24_2"
        }
      ]
    },
    "gk_G24_1": {
      "emoji": "😠",
      "metin": "ÇIT! Kart ikiye bölündü: yarısı elinde, yarısı okuyucunun içinde. Otobüs sustu. Şoför yavaşça başını çevirdi: \"Okuyucumu kim bozdu?\" Arkadan yolcular: \"Hadi be kardeşim!\"",
      "secenekler": [
        {
          "etiket": "😇 \"Kart zaten bozuktu abi\" desin",
          "hedef": "gk_G25_1"
        },
        {
          "etiket": "🏃 Kaçsın",
          "hedef": "gk_G25_2"
        }
      ]
    },
    "gk_G24_2": {
      "emoji": "🍗",
      "metin": "Ters çevirdi: BİP! Ama o otobüs kartı değil, Popeyes sadakat kartıymış. Okuyucu \"1 bedava patates kazandınız\" yazdı, şoför Berkay'ı indirdi. SON.",
      "secenekler": []
    },
    "gk_G25_1": {
      "emoji": "💺",
      "metin": "\"Kart zaten bozuktu abi, benim suçum yok.\" (Beşinci kez.) Şoför derin bir nefes aldı. Arkadaki abla acıdı: \"Benden bas.\" Otobüste! Tek ayak, iki kere hasarlı el, dolu mide, yarım kart. Tek boş koltuk en arkada.",
      "secenekler": [
        {
          "etiket": "🧍 Ayakta dursun",
          "hedef": "gk_G26_1"
        },
        {
          "etiket": "🧎 Emekleyerek arkaya gitsin",
          "hedef": "gk_G26_2"
        }
      ]
    },
    "gk_G25_2": {
      "emoji": "🐢",
      "metin": "Seke seke kaçmaya çalıştı. Otobüs 2 metre ileride durup bekledi. Kaçış 4 saniye sürdü, şoför ve yolcular hâlâ gülüyor. SON.",
      "secenekler": []
    },
    "gk_G26_1": {
      "emoji": "🩰",
      "metin": "İlk frende tek ayak üstünde bale yaptı, üç kişinin ayağına bastı, birinin çantasına tutundu. Çantanın sahibi sivil polis çıktı. SON.",
      "secenekler": []
    },
    "gk_G26_2": {
      "emoji": "🤢",
      "metin": "Emekleyerek koltuğa ulaştı, yolcular alkışladı. Oturur oturmaz 3 kova patates harekete geçti. Mide isyanda, otobüs sallanıyor.",
      "secenekler": [
        {
          "etiket": "🪟 Pencereyi açsın",
          "hedef": "gk_G27_1"
        },
        {
          "etiket": "😴 Uyusun, geçer",
          "hedef": "gk_G27_2"
        }
      ]
    },
    "gk_G27_1": {
      "emoji": "🌬️",
      "metin": "Pencereyi açtı, rüzgâr suratına vurdu, patatesler \"merhaba\" dedi. Detaylara girmiyoruz. Otobüs direkt yıkamaya gitti. SON.",
      "secenekler": []
    },
    "gk_G27_2": {
      "emoji": "🌃",
      "metin": "Uyudu. Kendi durağını tabii ki kaçırdı. Son durakta şoför dürttü: \"Kalk, Kandıra'dayız.\" Kandıra. Gece 23:00. Cepte 12 TL, yarım kart, şarj %1.",
      "secenekler": [
        {
          "etiket": "📚 Kurban'ı arasın",
          "hedef": "gk_G28_1"
        },
        {
          "etiket": "🦅 Alihan'ı arasın",
          "hedef": "gk_G28_2"
        }
      ]
    },
    "gk_G28_1": {
      "emoji": "🚗",
      "metin": "Kurban: \"KANDIRA MI? KPSS'ye 7 gün var!.. Tamam geliyorum ama bedeli ağır olacak.\" Kurban yolda. Bedel konuşulacak.",
      "secenekler": [
        {
          "etiket": "💸 \"Maaş gelince öderim\" desin",
          "hedef": "gk_G29_1"
        },
        {
          "etiket": "🎮 Oyun hesabını teklif etsin",
          "hedef": "gk_G29_2"
        }
      ]
    },
    "gk_G28_2": {
      "emoji": "🦅",
      "metin": "Alihan: \"Kandıra mı? Geliyorum!\" Geldi ama direksiyona Berkay'ı geçirdi: \"Depoda da ben çalışmamıştım, alışkanlık.\" Berkay tek eliyle sürdü, Alihan yol boyunca Sarıkamış anlattı. Eve 1 km kala Berkay dayanamadı: \"Enver beceriksizdi, o askerleri soğuğa o yolladı.\" Alihan el frenini çekti, Berkay'ı indirdi. Son 1 km'yi seke seke yürüdü. SON.",
      "secenekler": []
    },
    "gk_G29_1": {
      "emoji": "🫖",
      "metin": "Kurban: \"Senin maaşın mı var lan? Memur olacak olan benim.\" Telefon kapandı. Berkay Kandıra'da bir çay ocağında iş buldu, ilk maaşı 3 ay sonra. SON.",
      "secenekler": []
    },
    "gk_G29_2": {
      "emoji": "🏠",
      "metin": "Kurban: \"KPSS'ye kadar oyun oynamıyorum ama 5 Ekim'de hesap benim.\" 20 dakikada geldi. Arabada herkes var: Alihan Enver Paşa anlatıyor, Burger burger yiyor, Halil depo yeleğiyle uyuyor. Berkay'ı eve bıraktılar. Kapıda kız arkadaşına \"Vardım ❤️\" yazdı. İki günün sonu geldi.",
      "secenekler": [
        {
          "etiket": "🛌 Direkt yatsın",
          "hedef": "gk_G30_1"
        },
        {
          "etiket": "📝 İki günün hesabını yapsın",
          "hedef": "gk_G30_2"
        }
      ]
    },
    "gk_G30_1": {
      "emoji": "🛌",
      "metin": "Yatağa uzandı: el alçıda, ayak şiş, kart kırık, 1000 TL gitti, oyun hesabı Kurban'da, yarın klima deposu var. Ama kız arkadaşını gördü ve 3 kova patates yedi. Berkay'ın kariyerindeki en başarılı iki gün. SON.",
      "secenekler": []
    },
    "gk_G30_2": {
      "emoji": "📝",
      "metin": "Deftere yazdı. Kayıplar: 1 el, 1 ayak, 1 kart, 1340 TL, 1 KPSS kitabı (Kurban'ın), 1 oyun hesabı, 0 gol. Kazançlar: 3 kova patates, 1 minik ayı, 1 güzel gün. Altına \"değdi\" yazıp uyudu. SON.",
      "secenekler": []
    }
  };

  const VARSAYILAN = {
    baslangic: "basla",
    dugumler: {
      basla: {
        emoji: "😴",
        metin: "Cumartesi. Berkay saat 13:00'te uyandı (onun için sabahın köründe). Bugün ne yapsın?",
        secenekler: [
          { etiket: "🚌 İzmir'e gitsin", hedef: "izmir1" },
          { etiket: "🏠 Evde kalsın", hedef: "ev1" },
          { etiket: "🚗 Gölcük'e gitsin", hedef: "gk1" },
        ],
      },

      // ================= İZMİR KOLU (en uzun yol 15 adım) =================
      izmir1: {
        emoji: "🎫",
        metin: "Otogara geldi. İzmir bileti 400 TL, Berkay'ın cebinde 380 TL var. 20 TL eksik.",
        secenekler: [
          { etiket: "🎓 Öğrenci indirimi istesin", hedef: "iz_gise" },
          { etiket: "👍 Otostop çeksin", hedef: "iz_otostop" },
        ],
      },
      iz_gise: {
        emoji: "🧾",
        metin: "Gişedeki abla öğrenci belgesi istedi. Berkay okulu en son 3 ay önce görmüş.",
        secenekler: [
          { etiket: "🌀 Manifestten zoktay gibi kıvırsın", hedef: "iz_otobus" },
          { etiket: "🎮 Oyun hesabını göstersin", hedef: "son_gise" },
        ],
      },
      son_gise: {
        emoji: "👮",
        metin: "\"Bu ne?\" \"Level 312 abla, öğrenciden de öte.\" Güvenlik çağrıldı. Berkay otogardan eve yürüdü. SON.",
        secenekler: [],
      },
      iz_otostop: {
        emoji: "🚚",
        metin: "Bir kamyon durdu. Şoför \"Nereye?\" dedi, Berkay \"Kubiii İzmiiir!\" diye bağırdı ve bindi. 3 saat sonra kamyonun Afyon'a gittiğini fark etti.",
        secenekler: [
          { etiket: "🌭 Afyon'da sucuk yesin", hedef: "son_afyon" },
          { etiket: "🔁 Başka araca geçsin", hedef: "iz_varis" },
        ],
      },
      son_afyon: {
        emoji: "🌭",
        metin: "Sucuk ekmek, kaymaklı lokum, bir de ekmek kadayıfı. İzmir'i unuttu, Afyon'a yerleşmeyi düşünüyor. SON.",
        secenekler: [],
      },
      iz_otobus: {
        emoji: "🚌",
        metin: "10 dakika kıvırdı, gişe abla yorulup bileti verdi: \"Yeter ki git.\" Otobüste daha kalkmadan telefonu açıp bütün otobüse duyurarak konuşmaya başladı. Ön koltuktaki teyze dönüp bakıyor.",
        secenekler: [
          { etiket: "🤫 Susup uyusun", hedef: "izmir_uyu" },
          { etiket: "📢 Daha da bağırsın", hedef: "izmir_bagir" },
        ],
      },
      izmir_uyu: {
        emoji: "💤",
        metin: "Uyudu. Hem de nasıl uyudu. Gözünü açtığında otobüs Aydın'daydı, İzmir'i çoktan geçmişti.",
        secenekler: [
          { etiket: "↩️ Geri dönsün", hedef: "iz_varis" },
          { etiket: "🌴 Aydın'da takılsın", hedef: "son_aydin" },
        ],
      },
      son_aydin: {
        emoji: "🌴",
        metin: "\"Burası da İzmir sayılır\" dedi. Sayılmıyor. SON.",
        secenekler: [],
      },
      izmir_bagir: {
        emoji: "📢",
        metin: "Muavin üç kere uyardı. Dördüncüde Berkay'ı Manisa'da, yol kenarında indirdiler.",
        secenekler: [
          { etiket: "👍 Otostop çeksin", hedef: "iz_varis" },
          { etiket: "🌾 Manisa'da kalsın", hedef: "son_manisa" },
        ],
      },
      son_manisa: {
        emoji: "🌾",
        metin: "Manisa'da bir çay bahçesine oturdu, mesir macunu yedi, \"İzmir'e yakın sayılır\" dedi. Kıza \"Geldim sayılır\" diye mesaj attı. Engellendi. SON.",
        secenekler: [],
      },
      iz_varis: {
        emoji: "🌊",
        metin: "Sonunda İzmir! Kızla akşam 8'de Kordon'da buluşacaklar. Daha 4 saat var.",
        secenekler: [
          { etiket: "💇 Kuaföre gitsin", hedef: "iz_kuafor" },
          { etiket: "🌹 Kalan parayla gül alsın", hedef: "iz_gul" },
        ],
      },
      iz_kuafor: {
        emoji: "💇",
        metin: "Kuaför baktı, baktı... \"Kardeşim kesecek saç yok ki\" dedi. Yine de 150 TL aldı.",
        secenekler: [
          { etiket: "🧴 Parfüm sıksın", hedef: "iz_kordon" },
          { etiket: "😎 Doğal güzellikle gitsin", hedef: "iz_kordon" },
        ],
      },
      iz_gul: {
        emoji: "🌹",
        metin: "Tek bir gül aldı. Bankta beklerken üstüne oturdu, gül ezildi. Artık elinde bir sap var.",
        secenekler: [
          { etiket: "🥀 Yine de versin", hedef: "iz_kordon" },
          { etiket: "🗑️ Sapı atsın", hedef: "iz_kordon" },
        ],
      },
      iz_kordon: {
        emoji: "🌅",
        metin: "Saat 20:00, Kordon. Güneş batıyor, martılar uçuyor... Kız yok.",
        secenekler: [
          { etiket: "⏳ Beklesin", hedef: "iz_bekle" },
          { etiket: "📱 Mesaj atsın", hedef: "izmir_mesaj" },
        ],
      },
      izmir_mesaj: {
        emoji: "📱",
        metin: "\"Geldim ben, neredesin?\" İletildi. Görüldü. Yazıyor... yazmayı bıraktı.",
        secenekler: [
          { etiket: "✍️ Bir daha yazsın", hedef: "iz_bekle" },
          { etiket: "🥐 Boyozla teselli olsun", hedef: "son_boyoz" },
        ],
      },
      son_boyoz: {
        emoji: "🥐",
        metin: "3 boyoz, 2 kumru, 1 midye tabağı. Midesi isyan etti, İzmir'e küsüp döndü. SON.",
        secenekler: [],
      },
      iz_bekle: {
        emoji: "🪫",
        metin: "Saat 22:00. Kız hâlâ yok. Telefonun şarjı %3.",
        secenekler: [
          { etiket: "🔌 Şarj bulsun", hedef: "iz_sarj" },
          { etiket: "🛏️ Bankta uyusun", hedef: "son_sokak" },
        ],
      },
      son_sokak: {
        emoji: "🤧",
        metin: "İki gün Kordon'da bekledi, bankta yattı, hasta oldu. Kız hâlâ gelmedi. Berkay burnu akarak eve döndü. SON.",
        secenekler: [],
      },
      iz_sarj: {
        emoji: "🔌",
        metin: "Bir kafeye girdi, şarj için son parasıyla bir çay aldı. Telefon açıldı. Kızdan mesaj: \"Sen gerçekten geldin mi 😳\"",
        secenekler: [
          { etiket: "🥺 \"Evet\" desin", hedef: "iz_kiz" },
          { etiket: "😎 \"Tesadüfen buradaydım\" desin", hedef: "son_havali" },
        ],
      },
      son_havali: {
        emoji: "🚫",
        metin: "Kız: \"Kordon'da 5 saattir tesadüfen mi?\" Engellendi. Havalı olmanın bedeli ağır oldu. SON.",
        secenekler: [],
      },
      iz_kiz: {
        emoji: "💬",
        metin: "Kız: \"Tamam yarın öğlen Alsancak'ta buluşalım.\" Berkay mutlu! Ama kalacak yer yok, para da yok.",
        secenekler: [
          { etiket: "📞 Kuzenini arasın", hedef: "iz_kuzen" },
          { etiket: "🪑 Bankta sabahlasın", hedef: "iz_bank" },
        ],
      },
      iz_bank: {
        emoji: "🥶",
        metin: "Bankta sabahladı. Sabah uyandığında burnu akıyor, sesi kısılmış, üstü martı ...lı.",
        secenekler: [
          { etiket: "💪 Yine de buluşmaya gitsin", hedef: "iz_bulusma" },
          { etiket: "🤒 Hasta hasta eve dönsün", hedef: "son_sokak" },
        ],
      },
      iz_kuzen: {
        emoji: "🛏️",
        metin: "Kuzeni Bornova'da kapıyı açtı: \"Yer yatağı var, gel.\" Berkay yattı, alarmı her zamanki gibi 13:00'e kurdu.",
        secenekler: [
          { etiket: "⏰ Alarmı 11:00'e çeksin", hedef: "iz_bulusma" },
          { etiket: "😴 13:00'te kalsın", hedef: "son_uyku_izmir" },
        ],
      },
      son_uyku_izmir: {
        emoji: "⌛",
        metin: "14:30'da uyandı. 12 cevapsız arama. Bu sefer kız gelmiş, Berkay gelmemiş. İzmir'in intikamı. SON.",
        secenekler: [],
      },
      iz_bulusma: {
        emoji: "😍",
        metin: "Alsancak, 12:00. VE KIZ GELDİ! Berkay'ın elleri titriyor, bir şey demesi lazım.",
        secenekler: [
          { etiket: "🍽️ Yemeğe davet etsin", hedef: "iz_yemek" },
          { etiket: "🎢 Lunaparka götürsün", hedef: "son_lunapark" },
        ],
      },
      son_lunapark: {
        emoji: "😭",
        metin: "Çarkıfeleğin en tepesinde korkudan ağlamaya başladı. Kız onu teselli etti, sonra \"sen iyi birisin ama...\" dedi. SON.",
        secenekler: [],
      },
      iz_yemek: {
        emoji: "🧾",
        metin: "Güzel bir restoran, güzel bir sohbet. Sonra hesap geldi: 1.240 TL. Berkay'ın cüzdanında 12 TL var.",
        secenekler: [
          { etiket: "🤝 Hesabı bölüşmeyi teklif etsin", hedef: "son_hesap" },
          { etiket: "🚽 Tuvaletten kaçsın", hedef: "son_kacis" },
        ],
      },
      son_hesap: {
        emoji: "🫂",
        metin: "Kız hesabın tamamını ödedi ve \"Arkadaş kalalım\" dedi. Berkay İzmir'den friendzone ile döndü. Bu hikayedeki en iyi son buydu. SON.",
        secenekler: [],
      },
      son_kacis: {
        emoji: "🚒",
        metin: "Tuvaletin küçük penceresinden kaçmaya çalıştı, belinden sıkıştı. İtfaiye geldi, kız videoya çekti, 2 milyon izlendi. SON.",
        secenekler: [],
      },

      // ================= EV KOLU (en uzun yol 15 adım) =================
      ev1: {
        emoji: "🏠",
        metin: "Berkay evde kaldı. Bilgisayarın karşısına oturdu, derin bir nefes aldı.",
        secenekler: [
          { etiket: "📚 Ders çalışsın", hedef: "ev_ders" },
          { etiket: "🎮 Oyun oynasın", hedef: "ev_oyun" },
        ],
      },
      ev_ders: {
        emoji: "📚",
        metin: "Kitabı açtı. 4. sayfada yoruldu. Kalemi tutarken bileğini burktu.",
        secenekler: [
          { etiket: "🛌 Uyusun", hedef: "son_uyku" },
          { etiket: "🍗 Popeyes söylesin", hedef: "ev_popeyes" },
        ],
      },
      ev_oyun: {
        emoji: "🎮",
        metin: "Oyunu açtı. \"Sadece bir maç\" dedi. Herkes biliyor ki bu bir yalan.",
        secenekler: [
          { etiket: "🏆 Ranked'e girsin", hedef: "ev_ranked" },
          { etiket: "🪂 Airdrop kassın", hedef: "ev_airdrop" },
        ],
      },
      ev_airdrop: {
        emoji: "🪂",
        metin: "Yeni bir airdrop buldu. \"Bu sefer kesin zengin olacağım\" dedi. ZKsync'ten de böyle demişti.",
        secenekler: [
          { etiket: "⛏️ Bir yıl kassın", hedef: "son_airdrop" },
          { etiket: "🎮 Bırakıp oyuna dönsün", hedef: "ev_ranked" },
        ],
      },
      son_airdrop: {
        emoji: "🪙",
        metin: "365 gün kastı. Airdrop günü geldi: 0,00 token. Ekran görüntüsünü alıp ağladı. SON.",
        secenekler: [],
      },
      ev_ranked: {
        emoji: "📉",
        metin: "5 maç üst üste kaybetti. Suç tabii ki takımda, Berkay kusursuz oynadı (değil).",
        secenekler: [
          { etiket: "🎙️ Mikrofonu açıp bağırsın", hedef: "ev_mikrofon" },
          { etiket: "👊 Klavyeyi yumruklasın", hedef: "son_klavye" },
        ],
      },
      son_klavye: {
        emoji: "⌨️",
        metin: "Boks makinesi gibi klavyeyi de beceremedi: klavye sağlam, eli şişti. SON.",
        secenekler: [],
      },
      ev_mikrofon: {
        emoji: "🎙️",
        metin: "Otobüsteki sesiyle bağırdı. Komşu duvara vurdu. Takım arkadaşı sordu: \"Kardeşim sen kaç yaşındasın?\"",
        secenekler: [
          { etiket: "🎮 Oyuna devam etsin", hedef: "ev_gece" },
          { etiket: "🚩 Takım arkadaşını şikayet etsin", hedef: "son_ban" },
        ],
      },
      son_ban: {
        emoji: "⛔",
        metin: "Şikayet etti. Sistem kayıtları inceledi. Ban yiyen kişi: Berkay. 14 gün. SON.",
        secenekler: [],
      },
      ev_gece: {
        emoji: "🌙",
        metin: "Saat 03:00. 14 saattir oynuyor. Klavyenin arasında 3 tane kendi saç telini buldu.",
        secenekler: [
          { etiket: "🔁 Devam etsin", hedef: "ev_aclik" },
          { etiket: "🛌 Uyusun", hedef: "son_uyku" },
        ],
      },
      son_uyku: {
        emoji: "🛌",
        metin: "Yattı, ertesi gün 15:00'te uyandı. Rekor. SON.",
        secenekler: [],
      },
      ev_aclik: {
        emoji: "🍽️",
        metin: "Midesi guruldadı. Dolabı açtı: yarım limon ve bir ketçap.",
        secenekler: [
          { etiket: "🍗 Popeyes söylesin", hedef: "ev_popeyes" },
          { etiket: "🍳 Kendisi yemek yapsın", hedef: "son_yangin" },
        ],
      },
      son_yangin: {
        emoji: "🔥",
        metin: "Su kaynatmaya çalıştı. Nasıl olduysa yangın alarmı çaldı, bütün apartman 03:30'da sokağa indi. SON.",
        secenekler: [],
      },
      ev_popeyes: {
        emoji: "💳",
        metin: "Menüyü sepete ekledi: 410 TL. Kartındaki bakiye: 47 TL.",
        secenekler: [
          { etiket: "🙏 Arkadaşından borç istesin", hedef: "ev_borc" },
          { etiket: "🛵 Kuryeyle pazarlık etsin", hedef: "son_kurye" },
        ],
      },
      son_kurye: {
        emoji: "🛵",
        metin: "\"Abi 47'ye versen?\" Kurye sipariş iptal etti, yolda yemeği kendisi yedi. SON.",
        secenekler: [],
      },
      ev_borc: {
        emoji: "💸",
        metin: "Arkadaşı: \"Önce eski borcunu öde.\" Berkay manifestten zoktay gibi kıvırdı, 20 dakika sonra 400 TL aldı.",
        secenekler: [
          { etiket: "🍗 Hemen yemek söylesin", hedef: "ev_doydu" },
          { etiket: "🎁 Parayla oyunda kasa açsın", hedef: "son_kasa" },
        ],
      },
      son_kasa: {
        emoji: "📦",
        metin: "Kasadan en değersiz skin çıktı. 400 TL gitti, karnı hâlâ aç, bir de arkadaşına borçlu. SON.",
        secenekler: [],
      },
      ev_doydu: {
        emoji: "🍟",
        metin: "Tavuklar, patatesler... Yağlı elleriyle klavyeyi mahvetti. Saat 07:00, güneş doğuyor.",
        secenekler: [
          { etiket: "🌅 Güneşi izleyip hayatı sorgulasın", hedef: "ev_sorgu" },
          { etiket: "🛌 Uyusun", hedef: "son_uyku" },
        ],
      },
      ev_sorgu: {
        emoji: "🤔",
        metin: "Pencereden güneşe baktı ve dedi ki: \"Ben hayatımı değiştirmeliyim.\"",
        secenekler: [
          { etiket: "🏋️ Spor salonuna yazılsın", hedef: "ev_spor" },
          { etiket: "💼 İş başvurusu yapsın", hedef: "son_is" },
        ],
      },
      son_is: {
        emoji: "💼",
        metin: "Başvurdu, mülakata çağrıldı: yarın sabah 09:00. Alarmı 13:00'e kurdu. SON.",
        secenekler: [],
      },
      ev_spor: {
        emoji: "🏋️",
        metin: "Salona gitti, ilk gün! Etrafta kaslı adamlar, Berkay ne yapacağını bilmiyor.",
        secenekler: [
          { etiket: "🥊 Boks torbasına vursun", hedef: "son_boks" },
          { etiket: "🏃 Koşu bandına çıksın", hedef: "ev_kosu" },
        ],
      },
      son_boks: {
        emoji: "🥊",
        metin: "Tarih tekerrürden ibarettir: torbaya vurdu, eli yaralandı, salondan sargıyla çıktı. SON.",
        secenekler: [],
      },
      ev_kosu: {
        emoji: "🏃",
        metin: "Koşu bandının hızını 8'e aldı: \"Kubiii 8'i gördüm!\" Salondaki herkes dönüp baktı.",
        secenekler: [
          { etiket: "🚀 Hızı 85'e çıkarmaya çalışsın", hedef: "son_bant" },
          { etiket: "🐢 Yavaş yavaş devam etsin", hedef: "ev_basari" },
        ],
      },
      son_bant: {
        emoji: "💥",
        metin: "Bant 20'de durdu ama Berkay durmadı. Bandın arkasından uçup su sebiline çarptı. Kasksız 85'in salon versiyonu. SON.",
        secenekler: [],
      },
      ev_basari: {
        emoji: "🏅",
        metin: "20 dakika koştu. Hayatında ilk kez bir şeyi yarım bırakmadan bitirdi! Gururla eve döndü.",
        secenekler: [
          { etiket: "📅 Yarın da gitsin", hedef: "son_motivasyon" },
          { etiket: "📸 Instagram'a paylaşsın", hedef: "son_story" },
        ],
      },
      son_motivasyon: {
        emoji: "🗓️",
        metin: "Ertesi gün 13:00'te uyandı. Salon üyeliği 6 ay boyunca bir daha kullanılmadı. SON.",
        secenekler: [],
      },
      son_story: {
        emoji: "📸",
        metin: "Story attı: \"Yeni ben 💪\". 3 kişi baktı, biri İzmir'deki kız. Görüldü, cevap yok. SON.",
        secenekler: [],
      },
    },
  };

  Object.assign(VARSAYILAN.dugumler, GOLCUK);

  const GOLCUK_SECENEK = { etiket: "🚗 Gölcük'e gitsin", hedef: "gk1" };

  function kopya(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Firestore'dan gelen (ya da editörde düzenlenen) veriyi temizler/doğrular,
  // bozuk bir kayıt yüzünden sayfa asla çökmesin diye.
  function temizle(raw) {
    if (!raw || typeof raw !== "object" || !raw.dugumler || typeof raw.dugumler !== "object") {
      return kopya(VARSAYILAN);
    }
    const out = { baslangic: String(raw.baslangic || ""), dugumler: {} };
    Object.keys(raw.dugumler).forEach((id) => {
      const d = raw.dugumler[id] || {};
      out.dugumler[id] = {
        emoji: typeof d.emoji === "string" ? d.emoji.slice(0, 8) : "",
        metin: typeof d.metin === "string" ? d.metin.slice(0, 600) : "",
        secenekler: Array.isArray(d.secenekler)
          ? d.secenekler
              .filter((s) => s && typeof s === "object")
              .slice(0, 6)
              .map((s) => ({
                etiket: typeof s.etiket === "string" ? s.etiket.slice(0, 60) : "",
                hedef: typeof s.hedef === "string" ? s.hedef : "",
              }))
          : [],
      };
    });
    if (!out.dugumler[out.baslangic]) {
      const ilk = Object.keys(out.dugumler)[0];
      if (!ilk) return kopya(VARSAYILAN);
      out.baslangic = ilk;
    }
    return out;
  }

  function guvenliResim(src) {
    return typeof src === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(src) ? src : null;
  }

  async function yukle() {
    let hikaye = kopya(VARSAYILAN);
    let resim = null;
    let kaynak = "varsayilan";
    if (typeof db !== "undefined" && db) {
      try {
        const [anaSnap, resimSnap] = await Promise.all([
          db.collection("sosyal_hikaye").doc("ana").get(),
          db.collection("sosyal_hikaye").doc("resim").get(),
        ]);
        if (anaSnap.exists) {
          hikaye = temizle(anaSnap.data());
          kaynak = "firestore";
        }
        if (resimSnap.exists) resim = guvenliResim(resimSnap.data().resim);
      } catch (err) {
        console.warn("Sosyal hikaye Firestore'dan okunamadı, varsayılan kullanılıyor:", err.message);
      }
    }
    return { hikaye, resim, kaynak };
  }

  window.SosyalHikaye = {
    varsayilan: () => kopya(VARSAYILAN),
    golcuk: () => ({ dugumler: kopya(GOLCUK), secenek: kopya(GOLCUK_SECENEK) }),
    temizle,
    guvenliResim,
    yukle,
  };
})();
