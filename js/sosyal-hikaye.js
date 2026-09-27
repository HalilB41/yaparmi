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

  // ================= GÖLCÜK KOLU (v2 — uzun sürüm) =================
  // Karakterler: Kurban (KPSS'ye 4 Ekim'de girecek, en mantıklısı), Alihan (kanzilerin
  // lideri, Enver Paşa/Sarıkamış hassasiyeti), Burger King (burger delisi, Alihan'ın
  // kahve haklarını bitirir), Halil (bedava stajyer, ULTRA MEGA DEPO AMELESİ).
  // "KUBİİİ OTOBÜSTEYİM" sonu dışında hiçbir yol 20 adımdan önce bitmez.
  // Her seçenek kendi sonucunu anlatan ayrı bir adıma gider ("__a"/"__b" adımları).
  const GOLCUK = {
    "gk1": {
      "emoji": "🚏",
      "metin": "Kız arkadaşı Gölcük'te, bugün buluşacaklar! Berkay yarım saat saçını düzeltti (düzelmedi), durağa geldi. Tek bir sorun var: hangi otobüse bineceğini bilmiyor.",
      "secenekler": [
        {
          "etiket": "📞 Kurban'a sorsun",
          "hedef": "gk2"
        },
        {
          "etiket": "🧍 Sokaktan rastgele birine sorsun",
          "hedef": "gk_amca"
        }
      ]
    },
    "gk_amca": {
      "emoji": "👴",
      "metin": "Duraktaki amcaya sordu. Amca \"Gölcük mü? Ben orada askerlik yaptım evladım...\" diye başladı. 45 dakika geçti, hikâye hâlâ 1989'da.",
      "secenekler": [
        {
          "etiket": "👂 Sonuna kadar dinlesin",
          "hedef": "gk_amca2"
        },
        {
          "etiket": "📞 Kaçıp Kurban'ı arasın, Popeyes sözü versin",
          "hedef": "gk3"
        }
      ]
    },
    "gk_amca2": {
      "emoji": "⏰",
      "metin": "Amca hikâyeyi bitirdi: \"Gölcük otobüsü mü? O az önce kalktı evladım.\" Bir sonraki bir saat sonra. Berkay'ın canı sıkıldı, birini arayıp dertleşmesi lazım.",
      "secenekler": [
        {
          "etiket": "🦅 Alihan'ı arasın",
          "hedef": "gk_al1"
        },
        {
          "etiket": "🍔 Burger King'i arasın",
          "hedef": "gk_bk1"
        }
      ]
    },
    "gk_al1": {
      "emoji": "🦅",
      "metin": "Alihan açtı: \"Otobüs mü bekliyorsun? Kardeşim Enver Paşa Sarıkamış'a yürüyerek gitti, sen 1 saat otobüs bekleyemiyor musun?\"",
      "secenekler": [
        {
          "etiket": "🥶 \"Orada donmadılar mı?\" desin",
          "hedef": "gk_al_kriz"
        },
        {
          "etiket": "🫡 Alihan'a hak verip yürüsün",
          "hedef": "gk_al_yuru"
        }
      ]
    },
    "gk_al_kriz": {
      "emoji": "🤬",
      "metin": "Hata. Alihan sanki ailesine sövülmüş gibi 40 dakika bağırdı: \"O facia değil, STRATEJİK SERİNLEME!\" Berkay telefonu kulağından uzak tutarken otobüs geldi; fark etmeden bindi, uyudu, Gölcük'te uyandı. Alihan hâlâ hatta.",
      "secenekler": [
        {
          "etiket": "📴 Kapatıp yürümeye başlasın",
          "hedef": "gk_al_kriz__a"
        },
        {
          "etiket": "🙄 Alihan'ı açık bırakıp yürüsün",
          "hedef": "gk_al_kriz__b"
        }
      ]
    },
    "gk_al_yuru": {
      "emoji": "🚶",
      "metin": "Enver Paşa ruhuyla yürümeye başladı. 2 km sonra bitti. Alihan'dan mesaj: \"Enver Paşa yorulmazdı.\" Tam o sırada yanında bir otobüs durdu: GÖLCÜK. Bindi, uyudu, Gölcük'te indi.",
      "secenekler": [
        {
          "etiket": "🚶 Yürümeye devam etsin",
          "hedef": "gk_al_yuru__a"
        },
        {
          "etiket": "📱 Alihan'a \"Enver otobüse binerdi\" yazsın",
          "hedef": "gk_al_yuru__b"
        }
      ]
    },
    "gk_bk1": {
      "emoji": "🍔",
      "metin": "Burger King kütüphaneden fısıldayarak açtı: \"Kanka Alihan'ın kahve haklarını bitiriyorum, çabuk söyle.\" Berkay durumu anlattı. BK: \"Gölcük'te Burger King var mı?\"",
      "secenekler": [
        {
          "etiket": "✅ \"Var\" desin",
          "hedef": "gk_bk2"
        },
        {
          "etiket": "❌ \"Popeyes var\" desin",
          "hedef": "gk_bk3"
        }
      ]
    },
    "gk_bk2": {
      "emoji": "🚌",
      "metin": "BK kütüphaneden fırladı, elinde Alihan'ın hakkıyla alınmış iki kahve. Birlikte Gölcük otobüsüne bindiler; BK ders çalıştı, Berkay horladı. Gölcük'te inerken basamağı kaçırdı, ayağı yamuldu: \"kıtır.\" BK Burger King'e gitti, Berkay seke seke buluşmaya.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke yola koyulsun",
          "hedef": "gk_bk2__a"
        },
        {
          "etiket": "☕ Kahveyi bitirip seksin",
          "hedef": "gk_bk2__b"
        }
      ]
    },
    "gk_bk3": {
      "emoji": "💔",
      "metin": "BK: \"Popeyes mi? İhanet!\" dedi ve kapattı. 5 dakika sonra geri aradı: \"Tamam kızmadım, 7'yle başlayan kırmızıya bin.\" Bindi, uyudu, Gölcük'te inerken basamağı kaçırdı: \"kıtır.\" Ayak yamuldu.",
      "secenekler": [
        {
          "etiket": "🙏 BK'ya teşekkür edip seksin",
          "hedef": "gk_bk3__a"
        },
        {
          "etiket": "🍗 \"Popeyes daha iyi\" yazıp seksin",
          "hedef": "gk_bk3__b"
        }
      ]
    },
    "gk2": {
      "emoji": "📞",
      "metin": "Kurban 7. çalışta açtı: \"Ne var lan? KPSS'ye bir hafta var, 4 Ekim'e kadar telefon yasak. 1 dakikan var.\" Berkay: \"Gölcük'e hangi otobüs gidiyor kanka?\" Kurban derin bir iç çekti.",
      "secenekler": [
        {
          "etiket": "🙏 Yalvarsın",
          "hedef": "gk_yalvar"
        },
        {
          "etiket": "🍗 \"Popeyes ısmarlarım\" desin",
          "hedef": "gk3"
        }
      ]
    },
    "gk_yalvar": {
      "emoji": "🥺",
      "metin": "Kurban 5 dakika yalvarttı, sonra: \"Ben de bilmiyorum. Halil'e sor, bütün depoların bütün araçları ondan sorulur.\" Ve KPSS paragraf sorularına geri döndü.",
      "secenekler": [
        {
          "etiket": "📦 Halil'i arasın",
          "hedef": "gk_h1"
        },
        {
          "etiket": "🤷 Kendisi bulsun",
          "hedef": "gk_sapanca"
        }
      ]
    },
    "gk_h1": {
      "emoji": "📦",
      "metin": "Halil forklift sesinin arasından açtı: \"Kanka hepsijet deposundayım, 5 ay bedava stajdayım, çok konuşamam. Ekol'ün kamyonu şimdi Gölcük'e çıkıyor, arkaya atla.\"",
      "secenekler": [
        {
          "etiket": "🚛 Kamyona atlasın",
          "hedef": "gk_h2"
        },
        {
          "etiket": "🚌 \"Otobüs olsun\" desin",
          "hedef": "gk_h_otobus"
        }
      ]
    },
    "gk_h_otobus": {
      "emoji": "🚌",
      "metin": "Halil: \"Kırmızı, 7'yle başlıyor. Kanka bir de klima deposuna yevmiye lazım, gelir misin?\" Berkay \"hıı\" deyip kapattı, otobüse bindi, uyudu, Gölcük'te indi.",
      "secenekler": [
        {
          "etiket": "🚶 Yürümeye başlasın",
          "hedef": "gk_h_otobus__a"
        },
        {
          "etiket": "🧾 Yürürken Halil'e yevmiyeyi sorsun",
          "hedef": "gk_h_otobus__b"
        }
      ]
    },
    "gk_h2": {
      "emoji": "🚛",
      "metin": "Kamyonun kasasında klima kutularının arasında yola çıktı. Kamyon her depoda duruyor, şoför Berkay'a bakıp \"hazır buradasın\" diyor.",
      "secenekler": [
        {
          "etiket": "💪 Koli taşısın",
          "hedef": "gk_h3"
        },
        {
          "etiket": "💤 Kolilerin arasında uyusun",
          "hedef": "gk_h3b"
        }
      ]
    },
    "gk_h3": {
      "emoji": "💵",
      "metin": "12 koli taşıdı, şoför 50 TL verdi. Berkay hayatında ilk kez alnının teriyle para kazandı. Gölcük'te kamyondan atlarken ayağı yamuldu: \"kıtır.\" 50 TL'yi Popeyes'a ayırdı.",
      "secenekler": [
        {
          "etiket": "📸 Parayı gruba atsın",
          "hedef": "gk_h3__a"
        },
        {
          "etiket": "🦵 Seke seke yola koyulsun",
          "hedef": "gk_h3__b"
        }
      ]
    },
    "gk_h3b": {
      "emoji": "📦",
      "metin": "Kolilerin arasında uyudu. Gölcük'te boşaltırken işçiler \"bu koli neden horluyor?\" diye açtılar. İçinden Berkay çıktı, kasadan atlarken ayağı yamuldu: \"kıtır.\"",
      "secenekler": [
        {
          "etiket": "🙋 \"Kargo benim\" desin",
          "hedef": "gk_h3b__a"
        },
        {
          "etiket": "🏃 Seke seke kaçsın",
          "hedef": "gk_h3b__b"
        }
      ]
    },
    "gk_sapanca": {
      "emoji": "🏞️",
      "metin": "Yanlış otobüs. 40 dakika sonra tabela: Sapanca. Göl var ama Gölcük değil, salak. Kurban'a konum attı. Kurban: \"KPSS'ye 7 gün var ve ben seninle uğraşıyorum.\"",
      "secenekler": [
        {
          "etiket": "🔁 Geri dönen otobüse binsin",
          "hedef": "gk_sap2"
        },
        {
          "etiket": "🍔 Burger King'i arasın",
          "hedef": "gk_bk1"
        }
      ]
    },
    "gk_sap2": {
      "emoji": "🍀",
      "metin": "Geri dönen otobüste yine uyudu. Ama bu sefer mucize: gözünü açtığında Gölcük'teydi. Şans da bir yetenektir.",
      "secenekler": [
        {
          "etiket": "🙌 Şükretsin",
          "hedef": "gk_sap2__a"
        },
        {
          "etiket": "📱 Kurban'a \"planım buydu\" yazsın",
          "hedef": "gk_sap2__b"
        }
      ]
    },
    "gk3": {
      "emoji": "🚌",
      "metin": "Popeyes lafını duyan Kurban anında uyandı: \"Kırmızı otobüs, 7'yle başlıyor. Sen yaparsın Berkay, sen bu işin hocasısın!\" (Kurban da inanmıyor.) Durağa aynı anda iki kırmızı otobüs yanaştı.",
      "secenekler": [
        {
          "etiket": "🏃 İlk gelene atlasın",
          "hedef": "gk_sapanca"
        },
        {
          "etiket": "🧐 Şoföre sorsun",
          "hedef": "gk4"
        }
      ]
    },
    "gk4": {
      "emoji": "🧑‍✈️",
      "metin": "Şoför \"Gölcük, bin\" dedi. Kart bip etti, Berkay en arkaya oturdu. Yanında örgü ören bir teyze var.",
      "secenekler": [
        {
          "etiket": "🔊 Kurban'ı hoparlörden arasın",
          "hedef": "gk_son_hoparlor"
        },
        {
          "etiket": "🎧 Kulaklık takıp uyusun",
          "hedef": "gk5"
        }
      ]
    },
    "gk_son_hoparlor": {
      "emoji": "📢",
      "metin": "\"KUBİİİ OTOBÜSTEYİM KANKA!\" Şoför otobüsü sağa çekti, Berkay'ı indirdi. Yolcular alkışladı, teyze örgüsüne devam etti. SON.",
      "secenekler": []
    },
    "gk5": {
      "emoji": "💤",
      "metin": "Horladı. Teyze dürttü: \"Oğlum Gölcük'e geldik, horlamandan örgümü üç kere söktüm.\" İndi. Buluşmaya 20 dakika, konuma 1,5 km var.",
      "secenekler": [
        {
          "etiket": "🚶 Yürüsün",
          "hedef": "gk6"
        },
        {
          "etiket": "🛴 Martı kiralasın",
          "hedef": "gk_marti"
        }
      ]
    },
    "gk_marti": {
      "emoji": "🛴",
      "metin": "Martı'ya bindi: \"Kubiii 85'i göreceğim!\" Scooter 25'ten fazla gitmedi. Hırsından gaza asıldı, ön teker çukura girdi, Berkay uçtu. İndiği yer: kendi ayağı. \"Kıtır.\"",
      "secenekler": [
        {
          "etiket": "📞 Martı'yı arayıp şikâyet etsin",
          "hedef": "gk_marti2"
        },
        {
          "etiket": "🦵 Kalkıp seksin",
          "hedef": "gk7"
        }
      ]
    },
    "gk_marti2": {
      "emoji": "☎️",
      "metin": "Müşteri hizmetleri: \"Hız sınırını aşmaya çalışan müşterimiz, 85 için uçağa binmeniz gerekir.\" 20 dakika beklemede kaldı, bu arada ayağı portakal oldu. Seke seke bir apartmanın önüne kadar geldi.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam",
          "hedef": "gk_marti2__a"
        },
        {
          "etiket": "😤 Scooter'ı tekmelesin",
          "hedef": "gk_marti2__b"
        }
      ]
    },
    "gk6": {
      "emoji": "🦶",
      "metin": "Telefona bakarak yürürken çukuru görmedi. Ayağı yamuldu, \"kıtır\" diye bir ses geldi. Bilek bir anda portakal boyutunda.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_amb": {
      "emoji": "🚑",
      "metin": "Ambulans geldi, görevli 3 saniye baktı: \"Burkulma, buz koy.\" Ve gitti. Buz yok. Berkay aklına gelen ilk soğuk şeyi aradı: Burger King.",
      "secenekler": [
        {
          "etiket": "🍔 BK'dan buzlu kola istesin",
          "hedef": "gk_amb2"
        },
        {
          "etiket": "🦅 Alihan'dan tavsiye istesin",
          "hedef": "gk_amb3"
        }
      ]
    },
    "gk_amb2": {
      "emoji": "🥤",
      "metin": "BK tesadüfen Gölcük'teki Burger King'deymiş. Buzlu kolayı getirdi ama yarısını yolda içmiş. Kalan buzları Berkay'ın bileğine döktü: \"Kanka bir burger ye, iyileşirsin.\"",
      "secenekler": [
        {
          "etiket": "🍔 Bir burger yesin",
          "hedef": "gk_amb2__a"
        },
        {
          "etiket": "🙅 \"Popeyes'a yer açıyorum\" desin",
          "hedef": "gk_amb2__b"
        }
      ]
    },
    "gk_amb3": {
      "emoji": "🦅",
      "metin": "Alihan: \"Sarıkamış'ta askerler buzla yaşadı, sen buz mu bulamıyorsun?\" Berkay \"orada donmadılar mı?\" dedi. Alihan 15 dakika bağırdı. Kar yok, buz yok, ama köşede bir çeşme var.",
      "secenekler": [
        {
          "etiket": "🚰 Çeşmede soğutsun",
          "hedef": "gk_amb3__a"
        },
        {
          "etiket": "📴 Alihan'ı kapatsın",
          "hedef": "gk_amb3__b"
        }
      ]
    },
    "gk7": {
      "emoji": "🦩",
      "metin": "Tek ayak üstünde seke seke ilerliyor, flamingo gibi. Mahallenin çocukları arkasından \"flamingo abi!\" diye bağırıp taklidini yapıyor.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_cocuk": {
      "emoji": "⚽",
      "metin": "\"Ne bakıyonuz lan!\" Çocuklar top attı. Berkay topa vurmaya kalktı, sakat ayakla ıskaladı ve yere yapıştı. Çocuklar toplandı: \"Abi kalk, seni götürelim.\"",
      "secenekler": [
        {
          "etiket": "🛒 Bakkalın el arabasına binsin",
          "hedef": "gk_cocuk2"
        },
        {
          "etiket": "😤 Gururuna yediremesin",
          "hedef": "gk_cocuk3"
        }
      ]
    },
    "gk_cocuk2": {
      "emoji": "🛒",
      "metin": "Çocuklar Berkay'ı bakkalın el arabasına koyup \"flamingo abi geliyor!\" diye bağırarak buluşma noktasına kadar götürdü. Bakkal arabasını geri istedi, 20 TL de kira istedi.",
      "secenekler": [
        {
          "etiket": "💸 Parayı versin",
          "hedef": "gk_cocuk2__a"
        },
        {
          "etiket": "🌀 Manifestten zoktay gibi kıvırsın",
          "hedef": "gk_cocuk2__b"
        }
      ]
    },
    "gk_cocuk3": {
      "emoji": "🦩",
      "metin": "Gurur yaptı, kendi başına seke seke devam etti. Çocuklar arkasından ritimli alkışla eşlik etti, Berkay buluşma noktasına düğün alayı gibi vardı.",
      "secenekler": [
        {
          "etiket": "👋 Seyircilere el sallasın",
          "hedef": "gk_cocuk3__a"
        },
        {
          "etiket": "🙈 Başını önüne eğsin",
          "hedef": "gk_cocuk3__b"
        }
      ]
    },
    "gk8": {
      "emoji": "📱",
      "metin": "Bir apartman önünde soluklandı. 800 metre kaldı. Kız arkadaşından mesaj: \"Geliyor musun? 😊\"",
      "secenekler": [
        {
          "etiket": "📸 Şiş ayağının fotoğrafını çeksin",
          "hedef": "gk_foto"
        },
        {
          "etiket": "😎 \"Geliyorum\" yazsın",
          "hedef": "gk9"
        }
      ]
    },
    "gk_foto": {
      "emoji": "🤳",
      "metin": "Fotoğrafı çekti ve yanlışlıkla arkadaş grubuna attı. Grup patladı. Alihan: \"Sarıkamış'ta bile kimsenin ayağı böyle şişmedi.\" BK: \"Burger ye geçer.\" Halil: \"Depoda klima kutusu düşse bu kadar ezilmez.\" Kurban: \"KPSS'ye 7 gün var, rahatsız etmeyin.\"",
      "secenekler": [
        {
          "etiket": "💬 Gruba \"siz de gelin\" yazsın",
          "hedef": "gk_foto2"
        },
        {
          "etiket": "🔕 Grubu sessize alsın",
          "hedef": "gk_foto3"
        }
      ]
    },
    "gk_foto2": {
      "emoji": "💬",
      "metin": "Kurban: \"KPSS.\" Alihan: \"Enver Paşa gelirdi ama ben gelmem.\" BK: \"Burger varsa gelirim.\" Halil: \"Hepsiburada deposundayım, çıkamam.\" Kimse gelmiyor.",
      "secenekler": [
        {
          "etiket": "😔 Gruba küssün",
          "hedef": "gk_foto2__a"
        },
        {
          "etiket": "🦅 Alihan'a \"Enver de gelmezdi\" yazsın",
          "hedef": "gk_foto2__b"
        }
      ]
    },
    "gk_foto3": {
      "emoji": "🔕",
      "metin": "Grubu sessize aldı. Telefon yine de 47 kere titredi: Alihan Enver Paşa'nın yürüyüş rotasını, BK en yakın Burger King'in konumunu, Halil de klima deposu için yevmiye ilanını atmış.",
      "secenekler": [
        {
          "etiket": "📍 BK'nın konumuna baksın",
          "hedef": "gk_foto3__a"
        },
        {
          "etiket": "🙄 Telefonu cebe koysun",
          "hedef": "gk_foto3__b"
        }
      ]
    },
    "gk9": {
      "emoji": "🥵",
      "metin": "\"Geliyorum 😎\" yazdı ama 800 metreyi seke seke 25 dakikada aldı. Buluşma köşesine vardı: ter içinde, tek ayak havada.",
      "secenekler": [
        {
          "etiket": "🧻 Önce terini silsin",
          "hedef": "gk10__ter"
        },
        {
          "etiket": "🏃 Direkt yanına seksin",
          "hedef": "gk_kopek"
        }
      ]
    },
    "gk_kopek": {
      "emoji": "🐕",
      "metin": "Sekerken köşedeki köpeğin kuyruğuna bastı. Köpek kovaladı, Berkay tek ayakla hayatının en hızlı koşusunu yaptı ve bir burgerciye sığındı. İçeride tanıdık bir yüz: Burger King!",
      "secenekler": [
        {
          "etiket": "🍔 BK'nın masasına otursun",
          "hedef": "gk_kopek2"
        },
        {
          "etiket": "🏃 \"Acelem var\" deyip çıksın",
          "hedef": "gk10"
        }
      ]
    },
    "gk_kopek2": {
      "emoji": "🍔",
      "metin": "BK ağzı dolu: \"Kanka Gölcük'ün burgerlerini test ediyorum.\" Berkay'a bir ısırık verdi, sonra geri aldı. Saat geçiyor, Berkay 10 dakika geç kaldı bile.",
      "secenekler": [
        {
          "etiket": "🏃 Buluşmaya yetişsin",
          "hedef": "gk_kopek2__a"
        },
        {
          "etiket": "🍟 BK'nın patatesini kapıp kaçsın",
          "hedef": "gk_kopek2__b"
        }
      ]
    },
    "gk10": {
      "emoji": "💞",
      "metin": "Kız arkadaşı geldi. Ayağını görünce \"Ne oldu sana?\" diye sordu. Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_durust": {
      "emoji": "😇",
      "metin": "Dürüst oldu. Kız arkadaşı \"geçmiş olsun\" deyip koluna girdi: \"Hadi bir şeyler yiyelim, Popeyes?\" Berkay'ın hayatında aldığı ilk doğru karar, ödülü de hemen geldi.",
      "secenekler": [
        {
          "etiket": "🍗 \"EVET!\" desin",
          "hedef": "gk_durust__a"
        },
        {
          "etiket": "🥹 Duygulansın",
          "hedef": "gk_durust__b"
        }
      ]
    },
    "gk11": {
      "emoji": "🤥",
      "metin": "\"Beş kişiydiler.\" Tam o sırada mahallenin çocukları \"flamingo abi!\" diye bağırarak yanlarından geçti. Yalan tam 3 saniye yaşadı.",
      "secenekler": [
        {
          "etiket": "🌀 Yalanı büyütsün",
          "hedef": "gk_yalan"
        },
        {
          "etiket": "😔 İtiraf etsin",
          "hedef": "gk12__itiraf"
        }
      ]
    },
    "gk_yalan": {
      "emoji": "🌀",
      "metin": "\"Beş değil on kişilerdi, hepsi kemer kuşak.\" Manifestten zoktay gibi kıvırdı. Kanıt olarak Alihan'ı aradı: \"Söyle, kavga ettim değil mi?\"",
      "secenekler": [
        {
          "etiket": "📞 Alihan'ı hoparlöre alsın",
          "hedef": "gk_yalan2"
        },
        {
          "etiket": "🍗 Konuyu Popeyes'a getirsin",
          "hedef": "gk13"
        }
      ]
    },
    "gk_yalan2": {
      "emoji": "🦅",
      "metin": "Alihan: \"Berkay mı? Kavga mı? Bu adam depoda koli bile kaldırmadı, ben de kaldırmadım ama o başka. Asıl kahraman Enver Paşa'dır...\" Berkay kapattı. Kız arkadaşı gülmemek için dudağını ısırıp \"hadi yemeğe\" dedi. Popeyes'a girdiler, Berkay 1000 TL'lik 6 kişilik menüyü kartla aldı.",
      "secenekler": [
        {
          "etiket": "🍗 Masaya otursunlar",
          "hedef": "gk_yalan2__a"
        },
        {
          "etiket": "😳 Kızararak otursun",
          "hedef": "gk_yalan2__b"
        }
      ]
    },
    "gk_salata": {
      "emoji": "🥗",
      "metin": "\"Salata\" derken kendi sesine yabancılaştı. Popeyes'ın önünden geçerken gözünden bir damla yaş süzüldü. Kız arkadaşı durumu anladı: \"Hadi Popeyes'a gidelim.\" Berkay kasaya koştu, 1000 TL'lik 6 kişilik menüyü kartla aldı.",
      "secenekler": [
        {
          "etiket": "🥹 Duygulansın",
          "hedef": "gk_salata__a"
        },
        {
          "etiket": "🍗 Tepsiyi kapsın",
          "hedef": "gk_salata__b"
        }
      ]
    },
    "gk13": {
      "emoji": "🧾",
      "metin": "Popeyes. Kasaya abandı: \"En büyük menü hangisi?\" Kasiyer: \"1000 TL'lik aile menüsü var ama 6 kişilik.\" Berkay: \"Yeter.\"",
      "secenekler": [
        {
          "etiket": "💳 Kartla ödesin",
          "hedef": "gk14"
        },
        {
          "etiket": "💵 Nakit versin",
          "hedef": "gk_nakit"
        }
      ]
    },
    "gk_nakit": {
      "emoji": "💵",
      "metin": "Cebinden 3 buruşuk 100'lük, bir otobüs bileti, 2 sakız ve Kurban'ın çakmağı çıktı. 700 TL eksik. Kasiyer bekliyor, kuyruk uzuyor.",
      "secenekler": [
        {
          "etiket": "📦 Halil'den istesin",
          "hedef": "gk_nakit_h"
        },
        {
          "etiket": "📚 Kurban'dan istesin",
          "hedef": "gk_nakit_k"
        }
      ]
    },
    "gk_nakit_h": {
      "emoji": "📦",
      "metin": "Halil: \"Kanka 5 aydır bedava stajdayım, param yok. Ama ekol deposunda 2 saat koli taşırsan...\" Berkay kapattı, kartı bastı: 1000 TL gitti. 6 kişilik tepsi geldi, ilk hedef patates kovası.",
      "secenekler": [
        {
          "etiket": "🍟 Kovaya saldırsın",
          "hedef": "gk_nakit_h__a"
        },
        {
          "etiket": "🙏 Tepsiye dua etsin",
          "hedef": "gk_nakit_h__b"
        }
      ]
    },
    "gk_nakit_k": {
      "emoji": "📚",
      "metin": "Kurban: \"Paramı KPSS kitaplarına verdim. Ama memur olunca sana ilk maaşımdan...\" Berkay kapattı, kartı bastı: 1000 TL gitti. 6 kişilik tepsi geldi, ilk hedef patates kovası.",
      "secenekler": [
        {
          "etiket": "🍟 Kovaya saldırsın",
          "hedef": "gk_nakit_k__a"
        },
        {
          "etiket": "📚 Kurban'a KPSS'de başarı dilesin",
          "hedef": "gk_nakit_k__b"
        }
      ]
    },
    "gk14": {
      "emoji": "🍗",
      "metin": "1000 TL gitti, ayın geri kalanı bismillah. Garson 6 kişilik tepsiyi getirirken iki kere mola verdi.",
      "secenekler": [
        {
          "etiket": "🍗 Tavukla başlasın",
          "hedef": "gk_tavuk"
        },
        {
          "etiket": "🍟 Patatesle başlasın",
          "hedef": "gk15"
        }
      ]
    },
    "gk_tavuk": {
      "emoji": "🥵",
      "metin": "İlk tavuğu ısırdı, dili yandı. Çalışan buzlu su getirdi; Berkay buzları ayak bileğine koydu: iki sorun, tek hamle. Sonra birinci kova patatesi 40 saniyede bitirip ikinciye geçti.",
      "secenekler": [
        {
          "etiket": "🍟 İkinci kovayı gömsün",
          "hedef": "gk_tavuk__a"
        },
        {
          "etiket": "📸 Buz fikrini gruba anlatsın",
          "hedef": "gk_tavuk__b"
        }
      ]
    },
    "gk15": {
      "emoji": "🍟",
      "metin": "Birinci kova patates. Bitti. Kız arkadaşı daha 3 tane yemişti.",
      "secenekler": [
        {
          "etiket": "🛑 Dursun artık",
          "hedef": "gk_dur"
        },
        {
          "etiket": "🍟 İkinci kovaya geçsin",
          "hedef": "gk16"
        }
      ]
    },
    "gk_dur": {
      "emoji": "⚠️",
      "metin": "\"Dur\" kelimesi Berkay'ın sisteminde tanımlı değil. Beyni 30 saniye donup yeniden başladı. İlk sözü: \"Bir kova daha.\" İkinciyi de bitirdi, üçüncüyü istedi. Kasiyer mutfağa \"rekor kırılıyor!\" diye seslendi.",
      "secenekler": [
        {
          "etiket": "🍟 Üçüncüye başlasın",
          "hedef": "gk_dur__a"
        },
        {
          "etiket": "🔄 Bir daha dursun (başaramaz)",
          "hedef": "gk_dur__b"
        }
      ]
    },
    "gk16": {
      "emoji": "🍟",
      "metin": "İkinci kova da bitti. Parmaklar tuzdan kurudu, göz bebekleri büyüdü. Garson uzaktan endişeyle izliyor.",
      "secenekler": [
        {
          "etiket": "🍟 Üçüncü kovayı istesin",
          "hedef": "gk17"
        },
        {
          "etiket": "🥤 Kolayla bastırsın",
          "hedef": "gk_kola"
        }
      ]
    },
    "gk_kola": {
      "emoji": "🥤",
      "metin": "1 litre kolayı tek nefeste içti, öyle bir geğirdi ki yan masadaki bebek ağladı. Müdür geldi: \"Sen şu rekor denemesi yapan mısın?\" Üçüncü kovayı bizzat getirdi, bütün çalışanlar toplandı.",
      "secenekler": [
        {
          "etiket": "💪 Rekor için bitirsin",
          "hedef": "gk_kola__a"
        },
        {
          "etiket": "🙇 Önce bebekten özür dilesin",
          "hedef": "gk_kola__b"
        }
      ]
    },
    "gk17": {
      "emoji": "🏆",
      "metin": "Üçüncü kova masada. Kasiyer mutfağa \"rekor kırılıyor!\" diye seslendi, bütün Popeyes çalışanları masanın başına toplandı.",
      "secenekler": [
        {
          "etiket": "💪 Rekor için bitirsin",
          "hedef": "gk18"
        },
        {
          "etiket": "🤢 Yarısında bıraksın",
          "hedef": "gk_yarim"
        }
      ]
    },
    "gk_yarim": {
      "emoji": "📲",
      "metin": "Yarısında bıraktı. Telefon titredi, BK: \"Burger King'e ihanet ettin, şimdi Popeyes'a da mı? Sen neye sadıksın?\" Berkay kendini toparladı, kalanı bitirdi. Çalışanlar alkışladı, pantolon düğmesi uçup sos standına çarptı.",
      "secenekler": [
        {
          "etiket": "🚶 Kalkmaya çalışsın",
          "hedef": "gk_yarim__a"
        },
        {
          "etiket": "🙏 BK'ya teşekkür etsin",
          "hedef": "gk_yarim__b"
        }
      ]
    },
    "gk18": {
      "emoji": "👏",
      "metin": "Bitirdi! Çalışanlar alkışladı. Karnı körfez gibi şişti, pantolon düğmesi uçup sos standına çarptı.",
      "secenekler": [
        {
          "etiket": "📸 Çalışanlarla fotoğraf çektirsin",
          "hedef": "gk_pano"
        },
        {
          "etiket": "🚶 Kalkıp çıksınlar",
          "hedef": "gk19"
        }
      ]
    },
    "gk_pano": {
      "emoji": "🖼️",
      "metin": "Fotoğraf \"Ayın Müşterisi\" panosuna asıldı. Altına küçük harflerle yazdılar: \"Bu kişiye ikinci kova verilmez.\" Berkay gururla kalktı: \"kıtır.\" Kız arkadaşı koluna girdi, durağa doğru yola çıktılar.",
      "secenekler": [
        {
          "etiket": "📲 Fotoğrafı gruba atsın",
          "hedef": "gk_pano__a"
        },
        {
          "etiket": "🦩 Seke seke yürüsün",
          "hedef": "gk_pano__b"
        }
      ]
    },
    "gk19": {
      "emoji": "🧍",
      "metin": "Kalkmaya çalıştı, kalkamadı. İkinci denemede kalktı ama sakat ayak hatırlattı: \"kıtır.\" Kız arkadaşı koluna girdi.",
      "secenekler": [
        {
          "etiket": "🚕 Taksi çağırsın",
          "hedef": "gk_taksi"
        },
        {
          "etiket": "🚏 Durağa yürüsünler",
          "hedef": "gk20"
        }
      ]
    },
    "gk_taksi": {
      "emoji": "🚕",
      "metin": "Kız arkadaşını evine yolladı, kendisi taksiye bindi. Taksimetre 150'yi geçince kartında 0 lira kaldığını hatırladı. Taksici Değirmendere'de indirdi.",
      "secenekler": [
        {
          "etiket": "📞 Halil'i arasın",
          "hedef": "gk_taksi2"
        },
        {
          "etiket": "🦩 Seke seke yürüsün",
          "hedef": "gk_son_taksi"
        }
      ]
    },
    "gk_taksi2": {
      "emoji": "🚐",
      "metin": "Halil: \"Hepsijet aracı oradan geçiyor, atla.\" Berkay atladı. Araç eve gidene kadar 40 paket dağıttı, Berkay her kapıda seke seke paket taşıdı.",
      "secenekler": [
        {
          "etiket": "📦 Paketleri taşısın",
          "hedef": "gk_taksi2__a"
        },
        {
          "etiket": "💤 Araçta uyusun",
          "hedef": "gk_taksi2__b"
        }
      ]
    },
    "gk_son_taksi": {
      "emoji": "🗺️",
      "metin": "Değirmendere'den seke seke yola çıktı. Hâlâ yolda. Arada bir durup \"kubiii 1 km'yi gördüm\" diye bağırıyor. SON.",
      "secenekler": []
    },
    "gk20": {
      "emoji": "🚶",
      "metin": "Durağa doğru yürüyorlar. Berkay seke seke; her sekişte karnından bir \"hık\" geliyor.",
      "secenekler": [
        {
          "etiket": "👋 Durakta vedalaşsınlar",
          "hedef": "gk21"
        },
        {
          "etiket": "🏃 Otobüs görünce koşsun",
          "hedef": "gk_son_kos"
        }
      ]
    },
    "gk_son_kos": {
      "emoji": "💨",
      "metin": "Otobüsü görünce tek ayakla depar attı. Otobüs gitti, Berkay kaldırıma yapıştı. Hayatındaki en kısa koşu: 2 metre. SON.",
      "secenekler": []
    },
    "gk21": {
      "emoji": "👋",
      "metin": "Vedalaştılar. Kız arkadaşı \"Eve varınca yaz\" dedi ve gitti. Berkay durakta tek başına, otobüse 15 dakika var.",
      "secenekler": [
        {
          "etiket": "🎮 Telefonda oyun oynasın",
          "hedef": "gk_oyun"
        },
        {
          "etiket": "🪑 Banka otursun",
          "hedef": "gk22"
        }
      ]
    },
    "gk_oyun": {
      "emoji": "🎮",
      "metin": "Oyuna daldı, 3 otobüs kaçırdı, şarj %2. Son gücüyle gruba yazdı: \"Beni kurtarın.\"",
      "secenekler": [
        {
          "etiket": "📚 Kurban cevap versin",
          "hedef": "gk_son_oyun_k"
        },
        {
          "etiket": "🦅 Alihan cevap versin",
          "hedef": "gk_son_oyun_a"
        }
      ]
    },
    "gk_son_oyun_k": {
      "emoji": "📚",
      "metin": "Kurban: \"KPSS'ye 7 gün var, ben oyunu bile bıraktım, sen oyun yüzünden mi kaldın?\" Şarj bitti. Berkay sabahı durak lambasının altında geçirdi. SON.",
      "secenekler": []
    },
    "gk_son_oyun_a": {
      "emoji": "🦅",
      "metin": "Alihan: \"Enver Paşa gece yürürdü.\" Şarj bitti. Berkay Enver Paşa gibi yürümeye başladı, 400 metre sonra bir bankta uyudu. SON.",
      "secenekler": []
    },
    "gk22": {
      "emoji": "🤕",
      "metin": "Banka oturmak için elini dayadı. Bank ıslaktı, eli kaydı, bileğinin üstüne düştü: bu sefer de eli yamuldu. Ayak sakat, el sakat, mide 3 kova.",
      "secenekler": [
        {
          "etiket": "📞 Kurban'ı arasın",
          "hedef": "gk23"
        },
        {
          "etiket": "😭 Ağlasın",
          "hedef": "gk_son_aglama"
        }
      ]
    },
    "gk_son_aglama": {
      "emoji": "😭",
      "metin": "Lunaparktaki gibi hüngür hüngür ağladı. Bir teyze mendil verdi, bir amca 20 TL. Berkay bu işin ekonomisini hesaplamaya başladı, yarın yine geliyor. SON.",
      "secenekler": []
    },
    "gk23": {
      "emoji": "☎️",
      "metin": "Kurban açtı: \"Popeyes'ım nerede?\" Berkay: \"Elim yamuldu kanka.\" Kurban: \"Elin yamuldu da benim Popeyes'ımın ne suçu var?\"",
      "secenekler": [
        {
          "etiket": "🤝 \"Yarın iki menü\" desin",
          "hedef": "gk24__menu"
        },
        {
          "etiket": "📴 Yüzüne kapatsın",
          "hedef": "gk_son_kurban"
        }
      ]
    },
    "gk_son_kurban": {
      "emoji": "🚪",
      "metin": "Telefonu Kurban'ın yüzüne kapattı. Kurban onu arkadaş grubundan attı ve grubun adını \"Berkaysız Huzur\" yaptı. Alihan, BK ve Halil beğendi. SON.",
      "secenekler": []
    },
    "gk_son_bozuk": {
      "emoji": "🪙",
      "metin": "Şoföre avuç dolusu bozukluk uzattı. Şoför: \"1998'den mi geldin sen?\" Kapı kapandı, Berkay bozukluklarıyla durakta kaldı. SON.",
      "secenekler": []
    },
    "gk25": {
      "emoji": "💳",
      "metin": "Kartı çıkardı, yamuk eliyle okuyucuya bastırdı. Bip yok. Bir daha bastırdı. Bip yok. Arkadaki kuyruk söylenmeye başladı.",
      "secenekler": [
        {
          "etiket": "💪 Bütün gücüyle bassın",
          "hedef": "gk26"
        },
        {
          "etiket": "🔄 Kartı ters çevirsin",
          "hedef": "gk_son_sadakat"
        }
      ]
    },
    "gk_son_sadakat": {
      "emoji": "🍗",
      "metin": "Ters çevirdi: BİP! Ama o otobüs kartı değil, Popeyes sadakat kartıymış. Okuyucu \"1 bedava patates kazandınız\" yazdı, şoför Berkay'ı indirdi. SON.",
      "secenekler": []
    },
    "gk26": {
      "emoji": "💥",
      "metin": "ÇIT! Kart ikiye bölündü: yarısı elinde, yarısı okuyucunun içinde. Otobüs sustu. Şoför yavaşça başını çevirdi.",
      "secenekler": [
        {
          "etiket": "😇 \"Kart zaten bozuktu abi\" desin",
          "hedef": "gk27"
        },
        {
          "etiket": "🏃 Kaçsın",
          "hedef": "gk_son_kacis"
        }
      ]
    },
    "gk_son_kacis": {
      "emoji": "🐢",
      "metin": "Seke seke kaçmaya çalıştı. Otobüs 2 metre ileride durup bekledi. Kaçış 4 saniye sürdü, şoför ve yolcular hâlâ gülüyor. SON.",
      "secenekler": []
    },
    "gk27": {
      "emoji": "😠",
      "metin": "Şoför: \"Kart bozuktu da okuyucumu kim bozdu?\" Arkadan yolcular: \"Hadi be kardeşim!\"",
      "secenekler": [
        {
          "etiket": "🤑 Şoförle pazarlık etsin",
          "hedef": "gk_son_pazarlik"
        },
        {
          "etiket": "🙋 Birinden kart bastırsın",
          "hedef": "gk28"
        }
      ]
    },
    "gk_son_pazarlik": {
      "emoji": "🚪",
      "metin": "\"Abi 12 liram var, yarısı senin.\" Şoför kapıyı açtı: \"Buyur in.\" Berkay yarım kartıyla durakta baş başa kaldı. SON.",
      "secenekler": []
    },
    "gk28": {
      "emoji": "🙏",
      "metin": "Arkadaki abla acıdı: \"Benden bas.\" Berkay otobüste! Tek ayak, tek el, 6 kişilik menü dolu mide, yarım kart.",
      "secenekler": [
        {
          "etiket": "🪑 Oturacak yer arasın",
          "hedef": "gk29"
        },
        {
          "etiket": "🧍 Ayakta dursun",
          "hedef": "gk_son_fren"
        }
      ]
    },
    "gk_son_fren": {
      "emoji": "🩰",
      "metin": "İlk frende tek ayak üstünde bale yaptı, üç kişinin ayağına bastı, birinin çantasına tutundu. Çantanın sahibi sivil polis çıktı. SON.",
      "secenekler": []
    },
    "gk29": {
      "emoji": "💺",
      "metin": "Tek boş koltuk en arkada. Otobüs hareket etti, oraya bir şekilde varması lazım.",
      "secenekler": [
        {
          "etiket": "🦘 Seksin",
          "hedef": "gk_son_kucak"
        },
        {
          "etiket": "🧎 Emekleyerek gitsin",
          "hedef": "gk30"
        }
      ]
    },
    "gk_son_kucak": {
      "emoji": "😳",
      "metin": "Otobüs virajı aldı, Berkay sekerken bir amcanın kucağına oturdu. Amca \"rahat mısın evlat?\" dedi. Durak boyunca kalkamadı. SON.",
      "secenekler": []
    },
    "gk30": {
      "emoji": "🧎",
      "metin": "Emekleyerek koltuğa ulaştı, yolcular alkışladı. Oturur oturmaz 3 kova patates harekete geçti.",
      "secenekler": [
        {
          "etiket": "🪟 Pencereyi açsın",
          "hedef": "gk_son_pencere"
        },
        {
          "etiket": "😴 Uyusun, geçer",
          "hedef": "gk31"
        }
      ]
    },
    "gk_son_pencere": {
      "emoji": "🌬️",
      "metin": "Pencereyi açtı, rüzgâr suratına vurdu, patatesler \"merhaba\" dedi. Detaylara girmiyoruz. Otobüs direkt yıkamaya gitti. SON.",
      "secenekler": []
    },
    "gk31": {
      "emoji": "😴",
      "metin": "Uyudu. Kendi durağını tabii ki kaçırdı. Son durakta şoför dürttü: \"Kalk, Kandıra'dayız.\"",
      "secenekler": [
        {
          "etiket": "📚 Kurban'ı arasın",
          "hedef": "gk32"
        },
        {
          "etiket": "🦅 Alihan'ı arasın",
          "hedef": "gk_son_alihan"
        }
      ]
    },
    "gk_son_alihan": {
      "emoji": "🦅",
      "metin": "Alihan: \"Kandıra mı? Geliyorum!\" Geldi ama arabayı Berkay'a sürdürdü: \"Depoda da ben çalışmamıştım, alışkanlık.\" Yol boyunca Sarıkamış anlattı. Eve varınca Berkay \"donmadılar mı?\" dedi. Arabadan atıldı. SON.",
      "secenekler": []
    },
    "gk32": {
      "emoji": "🚗",
      "metin": "Kurban: \"KANDIRA MI? KPSS'ye 7 gün var!.. Tamam geliyorum ama bedeli ağır olacak.\" Berkay'ın cebinde 12 TL var.",
      "secenekler": [
        {
          "etiket": "💸 \"Maaş gelince öderim\" desin",
          "hedef": "gk_son_maas"
        },
        {
          "etiket": "🎮 Oyun hesabını teklif etsin",
          "hedef": "gk33"
        }
      ]
    },
    "gk_son_maas": {
      "emoji": "🫖",
      "metin": "Kurban: \"Senin maaşın mı var lan? Memur olacak olan benim.\" Telefon kapandı. Berkay Kandıra'da bir çay ocağında iş buldu, ilk maaşı 3 ay sonra. SON.",
      "secenekler": []
    },
    "gk33": {
      "emoji": "🚗",
      "metin": "Kurban: \"KPSS'ye kadar oyun oynamıyorum ama 5 Ekim'de hesap benim.\" 20 dakikada geldi. Arabada herkes var: Alihan Enver Paşa anlatıyor, BK burger yiyor, Halil depo yeleğiyle uyuyor. Berkay'ı eve bıraktılar.",
      "secenekler": [
        {
          "etiket": "🛌 Direkt yatsın",
          "hedef": "gk_son_final1"
        },
        {
          "etiket": "📝 Günün hesabını yapsın",
          "hedef": "gk_son_final2"
        }
      ]
    },
    "gk_son_final1": {
      "emoji": "🛌",
      "metin": "Yatağa uzandı: ayak şiş, el şiş, kart kırık, 1000 TL gitti, oyun hesabı Kurban'da. Ama kız arkadaşını gördü ve 3 kova patates yedi. Berkay'ın kariyerindeki en başarılı gün. SON.",
      "secenekler": []
    },
    "gk_son_final2": {
      "emoji": "📝",
      "metin": "Deftere yazdı. Kayıplar: 1 ayak, 1 el, 1 kart, 1000 TL, 1 oyun hesabı. Kazançlar: 3 kova patates, 1 güzel gün. Altına \"değdi\" yazıp uyudu. SON.",
      "secenekler": []
    },
    "gk_al_kriz__a": {
      "emoji": "🦶",
      "metin": "Alihan'ı cümlenin ortasında kapattı. 3 saniye sonra 14 mesaj geldi, hepsi Enver Paşa. Mesajları okuyarak yürürken çukuru görmedi: ayağı yamuldu, \"kıtır.\" Bilek bir anda portakal boyutunda.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_al_kriz__b": {
      "emoji": "🦶",
      "metin": "Telefonu açık halde cebine koydu, Alihan cepten bağırmaya devam etti. Yoldan geçen amca \"evladım cebin Sarıkamış anlatıyor\" dedi. Berkay dönüp bakarken çukura bastı: \"kıtır.\" Bilek portakal boyutunda.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_al_yuru__a": {
      "emoji": "🦶",
      "metin": "Enver Paşa ruhu devam ediyor. 300 metre sonra ruh da yoruldu. Gözü telefondaki haritadaydı, çukuru görmedi: \"kıtır.\" Ayağı yamuldu, bilek portakal oldu.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_al_yuru__b": {
      "emoji": "🦶",
      "metin": "Mesajı gönderdi. Alihan'da \"yazıyor...\" 4 dakika gitmedi. Berkay ekrana bakarak yürürken çukuru görmedi: \"kıtır.\" Ayağı yamuldu. Sonunda Alihan'ın cevabı geldi: \"ASLA.\"",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_h_otobus__a": {
      "emoji": "🦶",
      "metin": "Haritayı açıp yürümeye başladı. 200 metre sonra gözü ekranda, ayağı çukurda: \"kıtır.\" Bilek bir anda portakal boyutunda.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_h_otobus__b": {
      "emoji": "🦶",
      "metin": "Halil: \"Günlüğü 800, sabah 7'de başlıyor...\" Berkay \"sabah 7\"yi duyunca şoka girdi ve çukuru görmedi: \"kıtır.\" Ayağı yamuldu. Halil hâlâ anlatıyor: \"...öğle yemeği de var.\"",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_sap2__a": {
      "emoji": "🦶",
      "metin": "Ellerini açıp gözleri kapalı şükretti, gözleri kapalı yürümeye devam etti. Gözleri kapalı olduğu için çukuru görmedi: \"kıtır.\" Ayağı yamuldu. Şükür kısa sürdü.",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_sap2__b": {
      "emoji": "🦶",
      "metin": "Kurban: \"Planın Sapanca'yı görmek miydi?\" Berkay cevap yazarken çukura bastı: \"kıtır.\" Ayağı yamuldu, bilek portakal oldu. Kurban: \"Bu da mı plandı?\"",
      "secenekler": [
        {
          "etiket": "🦵 Seke seke devam etsin",
          "hedef": "gk7"
        },
        {
          "etiket": "🚑 Ambulans çağırsın",
          "hedef": "gk_amb"
        }
      ]
    },
    "gk_bk2__a": {
      "emoji": "🦩",
      "metin": "BK'ya el salladı, seke seke yola koyuldu, flamingo gibi. Mahallenin çocukları arkasından \"flamingo abi!\" diye bağırıp taklidini yapıyor.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_bk2__b": {
      "emoji": "🦩",
      "metin": "Alihan'ın hakkıyla alınmış kahveyi dikti, kafein vurdu, sekme hızı ikiye katlandı. Tek ayakla deli gibi sekerken mahallenin çocukları peşine takıldı: \"flamingo abi!\"",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_bk3__a": {
      "emoji": "🦩",
      "metin": "BK'ya \"sağ ol kanka\" yazdı. BK: \"Bir burger borcun var.\" Berkay seke seke yola koyuldu; mahallenin çocukları arkasından \"flamingo abi!\" diye bağırıp taklidini yapmaya başladı.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_bk3__b": {
      "emoji": "🦩",
      "metin": "\"Popeyes daha iyi\" yazdı. BK engelledi, 1 dakika sonra engeli kaldırıp \"yine de dikkat et\" yazdı. Berkay seke seke yola koyuldu; mahallenin çocukları \"flamingo abi!\" diye peşine düştü.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_h3__a": {
      "emoji": "🦩",
      "metin": "50 TL'nin fotoğrafını gruba attı. Halil: \"Ameleliğe hoş geldin kanka.\" Alihan: \"Ben olsam çalışmadan alırdım.\" Berkay gururla seke seke yola koyuldu; mahallenin çocukları \"flamingo abi!\" diye peşine takıldı.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_h3__b": {
      "emoji": "🦩",
      "metin": "50 TL cebinde, tek ayak havada, seke seke yola koyuldu. Mahallenin çocukları arkasından \"flamingo abi!\" diye bağırıp taklidini yapıyor.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_h3b__a": {
      "emoji": "🦩",
      "metin": "\"Kargo benim\" dedi. İşçiler barkodunu aradı, bulamadı, \"iade\" diye kenara koydular. Berkay fırsatını bulup seke seke kaçtı; mahallenin çocukları \"flamingo abi!\" diye arkasından bağırıyor.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_h3b__b": {
      "emoji": "🦩",
      "metin": "Tek ayakla depodan kaçtı. İşçiler kovalamaya gerek duymadı, zaten yavaştı. Sokağa çıkınca mahallenin çocukları \"flamingo abi!\" diye taklidini yapmaya başladı.",
      "secenekler": [
        {
          "etiket": "😡 Çocuklara bağırsın",
          "hedef": "gk_cocuk"
        },
        {
          "etiket": "🤫 Umursamadan seksin",
          "hedef": "gk8"
        }
      ]
    },
    "gk_marti2__a": {
      "emoji": "📱",
      "metin": "Scooter'ı kaldırımda bırakıp seke seke devam etti. Bir apartman önünde soluklandı. 800 metre kaldı. Kız arkadaşından mesaj: \"Geliyor musun? 😊\"",
      "secenekler": [
        {
          "etiket": "📸 Şiş ayağının fotoğrafını çeksin",
          "hedef": "gk_foto"
        },
        {
          "etiket": "😎 \"Geliyorum\" yazsın",
          "hedef": "gk9"
        }
      ]
    },
    "gk_marti2__b": {
      "emoji": "📱",
      "metin": "Sağlam ayağıyla scooter'ı tekmeledi. Scooter devrilmedi, Berkay devrildi. Kalkıp seke seke bir apartman önüne geldi, soluklandı. 800 metre kaldı. Kız arkadaşından mesaj: \"Geliyor musun? 😊\"",
      "secenekler": [
        {
          "etiket": "📸 Şiş ayağının fotoğrafını çeksin",
          "hedef": "gk_foto"
        },
        {
          "etiket": "😎 \"Geliyorum\" yazsın",
          "hedef": "gk9"
        }
      ]
    },
    "gk_amb2__a": {
      "emoji": "🥵",
      "metin": "Burgeri iki ısırıkta bitirdi, BK gurur duydu. Tam o sırada kız arkadaşından mesaj: \"Geliyor musun? 😊\" \"Geliyorum 😎\" yazdı ama 800 metreyi seke seke, ağzı burgerli 25 dakikada aldı. Buluşma köşesine vardı: ter içinde, tek ayak havada.",
      "secenekler": [
        {
          "etiket": "🧻 Önce terini silsin",
          "hedef": "gk10__ter"
        },
        {
          "etiket": "🏃 Direkt yanına seksin",
          "hedef": "gk_kopek"
        }
      ]
    },
    "gk_amb2__b": {
      "emoji": "🥵",
      "metin": "BK: \"Popeyes'a yer açıyorsun ha? Hain.\" Burgeri kendisi yedi. Kız arkadaşından mesaj geldi: \"Geliyor musun? 😊\" \"Geliyorum 😎\" yazdı, 800 metreyi seke seke 25 dakikada aldı. Buluşma köşesine vardı: ter içinde, tek ayak havada.",
      "secenekler": [
        {
          "etiket": "🧻 Önce terini silsin",
          "hedef": "gk10__ter"
        },
        {
          "etiket": "🏃 Direkt yanına seksin",
          "hedef": "gk_kopek"
        }
      ]
    },
    "gk_amb3__a": {
      "emoji": "🥵",
      "metin": "Ayağını mahalle çeşmesine soktu. Çeşmenin başındaki amca \"abdest mi alıyon evlat?\" dedi. Kız arkadaşından mesaj: \"Geliyor musun? 😊\" \"Geliyorum 😎\" yazdı, ıslak ayakla şapır şapır sekerek 25 dakikada buluşma köşesine vardı: ter içinde, tek ayak havada.",
      "secenekler": [
        {
          "etiket": "🧻 Önce terini silsin",
          "hedef": "gk10__ter"
        },
        {
          "etiket": "🏃 Direkt yanına seksin",
          "hedef": "gk_kopek"
        }
      ]
    },
    "gk_amb3__b": {
      "emoji": "🥵",
      "metin": "Alihan'ı kapattı. Alihan geri aradı, yine kapattı. Üçüncüde uçak moduna aldı. Açınca kız arkadaşından mesaj: \"Geliyor musun? 😊\" \"Geliyorum 😎\" yazdı, 800 metreyi seke seke 25 dakikada aldı. Buluşma köşesine vardı: ter içinde, tek ayak havada.",
      "secenekler": [
        {
          "etiket": "🧻 Önce terini silsin",
          "hedef": "gk10__ter"
        },
        {
          "etiket": "🏃 Direkt yanına seksin",
          "hedef": "gk_kopek"
        }
      ]
    },
    "gk_cocuk2__a": {
      "emoji": "💞",
      "metin": "20 TL'yi verdi, bakkal arabasını alıp gitti. Berkay arabadan iner inmez kız arkadaşı köşeden çıktı. Ayağına baktı: \"Ne oldu sana?\" Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_cocuk2__b": {
      "emoji": "💞",
      "metin": "\"Abi aslında ben size reklam yaptım, bütün mahalle sizi konuşuyor\" dedi. Bakkal ikna oldu, üstüne bir su verdi. Tam o sırada kız arkadaşı geldi, ayağına baktı: \"Ne oldu sana?\" Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_cocuk3__a": {
      "emoji": "💞",
      "metin": "Çocuklara el salladı, çocuklar \"flamingo abi!\" diye tezahürat yaptı. Kız arkadaşı bu tezahüratın ortasında geldi, ayağına baktı: \"Ne oldu sana?\" Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_cocuk3__b": {
      "emoji": "💞",
      "metin": "Başını önüne eğip sekmeye devam etti ve kafasını buluşma noktasındaki direğe çarptı. Kız arkadaşı tam o anda geldi: \"Ne oldu sana? Ayağın da mı?\" Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_foto2__a": {
      "emoji": "💞",
      "metin": "\"Ben de sizi sevmiyom\" yazıp gruptan çıktı. 10 saniye sonra Halil geri ekledi: \"Kanka yevmiye var.\" Bu arada buluşma noktasına varmıştı. Kız arkadaşı geldi, ayağına baktı: \"Ne oldu sana?\" Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_foto2__b": {
      "emoji": "💞",
      "metin": "\"Enver de gelmezdi\" yazdı. Alihan 3 sesli mesaj attı, toplam 11 dakika. Berkay dinlemeden buluşma noktasına sekti. Kız arkadaşı geldi, ayağına baktı: \"Ne oldu sana?\" Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_foto3__a": {
      "emoji": "💞",
      "metin": "BK'nın attığı konuma baktı: en yakın Burger King 300 metrede. İçinden geçti ama direndi. Buluşma noktasına vardı. Kız arkadaşı geldi, ayağına baktı: \"Ne oldu sana?\" Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_foto3__b": {
      "emoji": "💞",
      "metin": "Telefonu cebe koydu. Cep titremeye devam etti, bacağı bedava masaj aldı. Buluşma noktasına vardı, kız arkadaşı ayağına bakıp \"Ne oldu sana?\" dedi. Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk_kopek2__a": {
      "emoji": "🤥",
      "metin": "Seke seke 10 dakika geç vardı. Kız arkadaşı ayağına bakıp \"Ne oldu sana?\" dedi. Berkay düşünmeden: \"Kavga ettim, beş kişiydiler.\" Tam o sırada mahallenin çocukları \"flamingo abi!\" diye bağırarak geçti. Yalan tam 3 saniye yaşadı.",
      "secenekler": [
        {
          "etiket": "🌀 Yalanı büyütsün",
          "hedef": "gk_yalan"
        },
        {
          "etiket": "😔 İtiraf etsin",
          "hedef": "gk12__itiraf"
        }
      ]
    },
    "gk_kopek2__b": {
      "emoji": "🤥",
      "metin": "BK'nın patatesini kapıp kaçtı, BK arkadan \"HAİN!\" diye bağırdı. Buluşmaya ağzı patatesli vardı. \"Ne oldu sana?\" \"Kavga ettim, beş kişiydiler.\" Tam o sırada mahallenin çocukları \"flamingo abi!\" diye geçti. Yalan 3 saniye yaşadı.",
      "secenekler": [
        {
          "etiket": "🌀 Yalanı büyütsün",
          "hedef": "gk_yalan"
        },
        {
          "etiket": "😔 İtiraf etsin",
          "hedef": "gk12__itiraf"
        }
      ]
    },
    "gk_durust__a": {
      "emoji": "🧾",
      "metin": "\"EVET!\" diye öyle bağırdı ki sokaktaki güvercinler havalandı. Popeyes'a girdiler. Kasaya abandı: \"En büyük menü hangisi?\" Kasiyer: \"1000 TL'lik aile menüsü var ama 6 kişilik.\" Berkay: \"Yeter.\"",
      "secenekler": [
        {
          "etiket": "💳 Kartla ödesin",
          "hedef": "gk14"
        },
        {
          "etiket": "💵 Nakit versin",
          "hedef": "gk_nakit"
        }
      ]
    },
    "gk_durust__b": {
      "emoji": "🧾",
      "metin": "Gözleri doldu: \"Beni benden iyi tanıyorsun.\" Popeyes'a girdiler. Kasaya abandı: \"En büyük menü hangisi?\" Kasiyer: \"1000 TL'lik aile menüsü var ama 6 kişilik.\" Berkay: \"Yeter.\"",
      "secenekler": [
        {
          "etiket": "💳 Kartla ödesin",
          "hedef": "gk14"
        },
        {
          "etiket": "💵 Nakit versin",
          "hedef": "gk_nakit"
        }
      ]
    },
    "gk_yalan2__a": {
      "emoji": "🍗",
      "metin": "Masaya oturdular. 1000 TL gitti, ayın geri kalanı bismillah. Garson 6 kişilik tepsiyi getirirken iki kere mola verdi.",
      "secenekler": [
        {
          "etiket": "🍗 Tavukla başlasın",
          "hedef": "gk_tavuk"
        },
        {
          "etiket": "🍟 Patatesle başlasın",
          "hedef": "gk15"
        }
      ]
    },
    "gk_yalan2__b": {
      "emoji": "🍗",
      "metin": "Domates gibi kızarmış halde oturdu. Garson \"iyi misiniz, acılı sos mu döküldü?\" diye sordu, sonra 6 kişilik tepsiyi getirdi; getirirken iki kere mola verdi. 1000 TL gitti.",
      "secenekler": [
        {
          "etiket": "🍗 Tavukla başlasın",
          "hedef": "gk_tavuk"
        },
        {
          "etiket": "🍟 Patatesle başlasın",
          "hedef": "gk15"
        }
      ]
    },
    "gk_salata__a": {
      "emoji": "🍗",
      "metin": "Popeyes'ın kokusunu alınca bir kez daha duygulandı, kasiyer peçete uzattı. 1000 TL gitti. Garson 6 kişilik tepsiyi getirirken iki kere mola verdi.",
      "secenekler": [
        {
          "etiket": "🍗 Tavukla başlasın",
          "hedef": "gk_tavuk"
        },
        {
          "etiket": "🍟 Patatesle başlasın",
          "hedef": "gk15"
        }
      ]
    },
    "gk_salata__b": {
      "emoji": "🍗",
      "metin": "Garson daha tepsiyi masaya koymadan Berkay kaptı, garson boş elle kaldı. 1000 TL'lik 6 kişilik menü artık Berkay'ın kucağında.",
      "secenekler": [
        {
          "etiket": "🍗 Tavukla başlasın",
          "hedef": "gk_tavuk"
        },
        {
          "etiket": "🍟 Patatesle başlasın",
          "hedef": "gk15"
        }
      ]
    },
    "gk_nakit_h__a": {
      "emoji": "🍟",
      "metin": "Kovaya elini daldırdı, çıkardığında kova boştu. Birinci kova patates: bitti. Kız arkadaşı daha 3 tane yemişti.",
      "secenekler": [
        {
          "etiket": "🛑 Dursun artık",
          "hedef": "gk_dur"
        },
        {
          "etiket": "🍟 İkinci kovaya geçsin",
          "hedef": "gk16"
        }
      ]
    },
    "gk_nakit_h__b": {
      "emoji": "🍟",
      "metin": "Tepsiye bakıp \"Bismillah\" dedi, \"Halil'in stajı da hayırlı olsun\" diye ekledi. Dua bitince birinci kova da bitti. Kız arkadaşı daha 3 tane yemişti.",
      "secenekler": [
        {
          "etiket": "🛑 Dursun artık",
          "hedef": "gk_dur"
        },
        {
          "etiket": "🍟 İkinci kovaya geçsin",
          "hedef": "gk16"
        }
      ]
    },
    "gk_nakit_k__a": {
      "emoji": "🍟",
      "metin": "İlk kovaya saldırdı. 40 saniye sonra kova boştu. Kız arkadaşı daha 3 tane yemişti.",
      "secenekler": [
        {
          "etiket": "🛑 Dursun artık",
          "hedef": "gk_dur"
        },
        {
          "etiket": "🍟 İkinci kovaya geçsin",
          "hedef": "gk16"
        }
      ]
    },
    "gk_nakit_k__b": {
      "emoji": "🍟",
      "metin": "\"Kanka KPSS'de başarılar, memur olunca beni de al\" yazdı. Kurban: \"Seni alan kurum kapanır.\" Mesajı yazana kadar birinci kova bitmişti bile. Kız arkadaşı daha 3 tane yemişti.",
      "secenekler": [
        {
          "etiket": "🛑 Dursun artık",
          "hedef": "gk_dur"
        },
        {
          "etiket": "🍟 İkinci kovaya geçsin",
          "hedef": "gk16"
        }
      ]
    },
    "gk_tavuk__a": {
      "emoji": "🍟",
      "metin": "İkinci kovaya kafasını gömdü, çıktığında kova bitmişti. Parmaklar tuzdan kurudu, göz bebekleri büyüdü. Garson uzaktan endişeyle izliyor.",
      "secenekler": [
        {
          "etiket": "🍟 Üçüncü kovayı istesin",
          "hedef": "gk17"
        },
        {
          "etiket": "🥤 Kolayla bastırsın",
          "hedef": "gk_kola"
        }
      ]
    },
    "gk_tavuk__b": {
      "emoji": "🍟",
      "metin": "Gruba yazdı: \"Buzlu suyu hem içtim hem ayağıma koydum.\" Halil: \"Depoda buna verimlilik denir.\" Yazarken ikinci kovayı da bitirmişti. Parmaklar tuzdan kurudu, göz bebekleri büyüdü. Garson endişeyle izliyor.",
      "secenekler": [
        {
          "etiket": "🍟 Üçüncü kovayı istesin",
          "hedef": "gk17"
        },
        {
          "etiket": "🥤 Kolayla bastırsın",
          "hedef": "gk_kola"
        }
      ]
    },
    "gk_dur__a": {
      "emoji": "🏆",
      "metin": "Üçüncü kova masada. Bütün Popeyes çalışanları masanın başına toplandı, biri telefonla video çekiyor.",
      "secenekler": [
        {
          "etiket": "💪 Rekor için bitirsin",
          "hedef": "gk18"
        },
        {
          "etiket": "🤢 Yarısında bıraksın",
          "hedef": "gk_yarim"
        }
      ]
    },
    "gk_dur__b": {
      "emoji": "🏆",
      "metin": "Durmaya çalıştı, eli kendiliğinden kovaya gitti. Bir daha denedi, ağzı kendiliğinden açıldı. Vazgeçti. Üçüncü kova masada, çalışanlar etrafında toplandı.",
      "secenekler": [
        {
          "etiket": "💪 Rekor için bitirsin",
          "hedef": "gk18"
        },
        {
          "etiket": "🤢 Yarısında bıraksın",
          "hedef": "gk_yarim"
        }
      ]
    },
    "gk_kola__a": {
      "emoji": "👏",
      "metin": "Müdürün gözlerinin içine bakarak üçüncü kovayı bitirdi. Çalışanlar alkışladı! Karnı körfez gibi şişti, pantolon düğmesi uçup sos standına çarptı.",
      "secenekler": [
        {
          "etiket": "📸 Çalışanlarla fotoğraf çektirsin",
          "hedef": "gk_pano"
        },
        {
          "etiket": "🚶 Kalkıp çıksınlar",
          "hedef": "gk19"
        }
      ]
    },
    "gk_kola__b": {
      "emoji": "👏",
      "metin": "Yan masaya gidip bebekten özür diledi. Bebek ağlamayı kesti, Berkay'ın yüzüne bakıp bir daha başladı. Annesi \"siz rekorunuza dönün\" dedi. Berkay masaya dönüp üçüncü kovayı bitirdi. Çalışanlar alkışladı, pantolon düğmesi uçup sos standına çarptı.",
      "secenekler": [
        {
          "etiket": "📸 Çalışanlarla fotoğraf çektirsin",
          "hedef": "gk_pano"
        },
        {
          "etiket": "🚶 Kalkıp çıksınlar",
          "hedef": "gk19"
        }
      ]
    },
    "gk_yarim__a": {
      "emoji": "🧍",
      "metin": "Kalkmaya çalıştı, kalkamadı. İkinci denemede kalktı ama sakat ayak hatırlattı: \"kıtır.\" Kız arkadaşı koluna girdi.",
      "secenekler": [
        {
          "etiket": "🚕 Taksi çağırsın",
          "hedef": "gk_taksi"
        },
        {
          "etiket": "🚏 Durağa yürüsünler",
          "hedef": "gk20"
        }
      ]
    },
    "gk_yarim__b": {
      "emoji": "🧍",
      "metin": "BK'ya \"Sayende bitirdim kanka\" yazdı. BK: \"Popeyes'ta bitirdin, sayılmaz.\" Berkay kalkmaya çalıştı, kalkamadı. İkincide kalktı: \"kıtır.\" Kız arkadaşı koluna girdi.",
      "secenekler": [
        {
          "etiket": "🚕 Taksi çağırsın",
          "hedef": "gk_taksi"
        },
        {
          "etiket": "🚏 Durağa yürüsünler",
          "hedef": "gk20"
        }
      ]
    },
    "gk_pano__a": {
      "emoji": "🚶",
      "metin": "Fotoğrafı gruba attı. Kurban: \"KPSS'de bu kadar soru çözsen...\" BK: \"Ben olsam 4 kova.\" Durağa doğru yürüyorlar; Berkay seke seke, her sekişte karnından bir \"hık\" geliyor.",
      "secenekler": [
        {
          "etiket": "👋 Durakta vedalaşsınlar",
          "hedef": "gk21"
        },
        {
          "etiket": "🏃 Otobüs görünce koşsun",
          "hedef": "gk_son_kos"
        }
      ]
    },
    "gk_pano__b": {
      "emoji": "🚶",
      "metin": "Durağa doğru yürüyorlar. Berkay seke seke; her sekişte karnından bir \"hık\" geliyor, kız arkadaşı her \"hık\"ta \"iyi misin?\" diye soruyor.",
      "secenekler": [
        {
          "etiket": "👋 Durakta vedalaşsınlar",
          "hedef": "gk21"
        },
        {
          "etiket": "🏃 Otobüs görünce koşsun",
          "hedef": "gk_son_kos"
        }
      ]
    },
    "gk_taksi2__a": {
      "emoji": "📦",
      "metin": "40 paketin hepsini seke seke taşıdı. Gece 2'de eve vardı. Halil ertesi sabah yazdı: \"Kanka performansın süperdi, yarın klima deposuna yazdırdım seni.\" Berkay telefonu kapattı. SON.",
      "secenekler": []
    },
    "gk_taksi2__b": {
      "emoji": "📦",
      "metin": "Araçta uyudu, şoför her durakta \"kalk koli taşı\" diye dürttü. Gece 2'de eve vardı. Halil sabah yazdı: \"Şoför seni şikâyet etti ama yarın klima deposuna yine de yazdırdım.\" SON.",
      "secenekler": []
    },
    "gk10__ter": {
      "emoji": "💞",
      "metin": "Terini sildi, saçını düzeltti (düzelmedi). Tam o sırada kız arkadaşı geldi. Ayağını görünce \"Ne oldu sana?\" diye sordu. Berkay bir cevap vermeli.",
      "secenekler": [
        {
          "etiket": "🦸 \"Yolda kavga ettim\" desin",
          "hedef": "gk11"
        },
        {
          "etiket": "😅 \"Çukura düştüm\" desin",
          "hedef": "gk_durust"
        }
      ]
    },
    "gk12__itiraf": {
      "emoji": "😋",
      "metin": "\"Tamam... çukura düştüm.\" Kız arkadaşı güldü: \"Biliyordum.\" Neyse ki ikisi de acıkmıştı. \"Nereye gidelim?\" Berkay'ın gözleri parladı.",
      "secenekler": [
        {
          "etiket": "🍗 \"Popeyes!\"",
          "hedef": "gk13"
        },
        {
          "etiket": "🥗 \"Salata yiyelim\" desin",
          "hedef": "gk_salata"
        }
      ]
    },
    "gk24__menu": {
      "emoji": "🚌",
      "metin": "Kurban: \"Anlaştık. KPSS'den sonra, 5 Ekim, iki menü. Yazılı söz istiyorum.\" Berkay yamuk eliyle sözleşmeyi mesaj attı. Tam o sırada otobüs geldi! Kart cüzdanın en dibinde, Popeyes fişlerinin arasında.",
      "secenekler": [
        {
          "etiket": "🪙 Bozuk parayla ödesin",
          "hedef": "gk_son_bozuk"
        },
        {
          "etiket": "💳 Kartı çıkarsın",
          "hedef": "gk25"
        }
      ]
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
