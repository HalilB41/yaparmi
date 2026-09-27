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

  // ================= GÖLCÜK KOLU (en uzun yol ~34 seçim) =================
  // En uzun yol hep 1. ya da hep 2. seçenekle gitmiyor: 1-2-2-2-1-1-2-2-1-1-2-...
  const GOLCUK = {
    gk1: {
      emoji: "🚏",
      metin: "Kız arkadaşı Gölcük'te, bugün buluşacaklar! Berkay yarım saat saçını düzeltti (düzelmedi), durağa geldi. Tek bir sorun var: hangi otobüse bineceğini bilmiyor.",
      secenekler: [
        { etiket: "📞 Kurban'a sorsun", hedef: "gk2" },
        { etiket: "🧍 Sokaktan rastgele birine sorsun", hedef: "gk_amca" },
      ],
    },
    gk_amca: {
      emoji: "👴",
      metin: "Duraktaki amcaya sordu. Amca \"Gölcük mü? Ben orada askerlik yaptım evladım...\" diye başladı. 45 dakika geçti, hikâye hâlâ 1989'da.",
      secenekler: [
        { etiket: "👂 Sonuna kadar dinlesin", hedef: "gk_son_amca" },
        { etiket: "📞 Kaçıp Kurban'ı arasın", hedef: "gk2" },
      ],
    },
    gk_son_amca: {
      emoji: "🌙",
      metin: "Amca hikâyeyi bitirdiğinde hava kararmıştı. Otobüsü soramadı bile ama amcanın numarasını aldı, bayramda arayacak. SON.",
      secenekler: [],
    },
    gk2: {
      emoji: "📞",
      metin: "Kurban telefonu 7. çalışta açtı: \"Ne var lan sabah sabah?\" Saat 14:30. Berkay: \"Gölcük'e hangi otobüs gidiyor kanka?\" Kurban derin bir iç çekti.",
      secenekler: [
        { etiket: "🙏 Yalvarsın", hedef: "gk_son_yalvar" },
        { etiket: "🍗 \"Popeyes ısmarlarım\" desin", hedef: "gk3" },
      ],
    },
    gk_son_yalvar: {
      emoji: "📵",
      metin: "Kurban \"biraz daha yalvar\" dedi, 10 dakika yalvarttı, sonra \"ben de bilmiyorum\" deyip kapattı. Berkay durakta üç saat bekledi. SON.",
      secenekler: [],
    },
    gk3: {
      emoji: "🚌",
      metin: "Popeyes lafını duyan Kurban anında uyandı: \"Kırmızı otobüs, numarası 7'yle başlıyor, gerisini şoföre sor.\" Durağa aynı anda iki kırmızı otobüs yanaştı.",
      secenekler: [
        { etiket: "🏃 İlk gelene atlasın", hedef: "gk_son_sapanca" },
        { etiket: "🧐 Şoföre sorsun", hedef: "gk4" },
      ],
    },
    gk_son_sapanca: {
      emoji: "🏞️",
      metin: "İlk gelene atladı. 40 dakika sonra tabelayı okudu: Sapanca. Göl var ama Gölcük değil, salak. SON.",
      secenekler: [],
    },
    gk4: {
      emoji: "🧑‍✈️",
      metin: "Şoför \"Gölcük, bin\" dedi. Kart bip etti, Berkay en arkaya oturdu. Yanında örgü ören bir teyze var.",
      secenekler: [
        { etiket: "🔊 Kurban'ı hoparlörden arasın", hedef: "gk_son_hoparlor" },
        { etiket: "🎧 Kulaklık takıp uyusun", hedef: "gk5" },
      ],
    },
    gk_son_hoparlor: {
      emoji: "📢",
      metin: "\"KUBİİİ OTOBÜSTEYİM KANKA!\" Şoför otobüsü sağa çekti, Berkay'ı indirdi. Yolcular alkışladı, teyze örgüsüne devam etti. SON.",
      secenekler: [],
    },
    gk5: {
      emoji: "💤",
      metin: "Uyudu, horladı. Teyze dürttü: \"Oğlum Gölcük'e geldik, horlamandan örgümü üç kere söktüm.\" İndi. Buluşmaya 20 dakika, konuma 1,5 km var.",
      secenekler: [
        { etiket: "🚶 Yürüsün", hedef: "gk6" },
        { etiket: "🛴 Martı kiralasın", hedef: "gk_son_marti" },
      ],
    },
    gk_son_marti: {
      emoji: "🛴",
      metin: "Martı'ya bindi: \"Kubiii 85'i göreceğim!\" Scooter 25'ten fazla gitmedi. Hırsından kaldırıma girdi, kaldırım kazandı. SON.",
      secenekler: [],
    },
    gk6: {
      emoji: "🦶",
      metin: "Telefona bakarak yürürken çukuru görmedi. Ayağı yamuldu, \"kıtır\" diye bir ses geldi. Bilek bir anda portakal boyutunda.",
      secenekler: [
        { etiket: "🦵 Seke seke devam etsin", hedef: "gk7" },
        { etiket: "🚑 Ambulans çağırsın", hedef: "gk_son_ambulans" },
      ],
    },
    gk_son_ambulans: {
      emoji: "🚑",
      metin: "Ambulans geldi, görevli baktı: \"Burkulma bu, buz koy.\" Acilde 3 saat buz tuttu, buluşma kaçtı. Ambulans masrafı Kurban'ın Popeyes'ından çıktı. SON.",
      secenekler: [],
    },
    gk7: {
      emoji: "🦩",
      metin: "Tek ayak üstünde seke seke ilerliyor, flamingo gibi. Mahallenin çocukları arkasından \"flamingo abi!\" diye bağırıp taklidini yapıyor.",
      secenekler: [
        { etiket: "😡 Çocuklara bağırsın", hedef: "gk_son_cocuk" },
        { etiket: "🤫 Umursamadan seksin", hedef: "gk8" },
      ],
    },
    gk_son_cocuk: {
      emoji: "⚽",
      metin: "\"Ne bakıyonuz lan!\" Çocuklar top attı, Berkay kaçarken diğer ayağı da burkuldu. İki ayak yamuk, mahalle balkondan izliyor. SON.",
      secenekler: [],
    },
    gk8: {
      emoji: "📱",
      metin: "Bir apartman önünde soluklandı. 800 metre kaldı. Kız arkadaşından mesaj: \"Geliyor musun? 😊\"",
      secenekler: [
        { etiket: "📸 Şiş ayağının fotoğrafını atsın", hedef: "gk_son_foto" },
        { etiket: "😎 \"Geliyorum\" yazsın", hedef: "gk9" },
      ],
    },
    gk_son_foto: {
      emoji: "🤳",
      metin: "Şiş bileğin fotoğrafını çekti ve yanlışlıkla aile grubuna attı. Grupta 4 dakikalık sesli mesajlar başladı, Berkay utançtan telefonu kapatıp geri döndü. SON.",
      secenekler: [],
    },
    gk9: {
      emoji: "🥵",
      metin: "\"Geliyorum 😎\" yazdı ama 800 metreyi seke seke 25 dakikada aldı. Buluşma köşesine vardı: ter içinde, tek ayak havada.",
      secenekler: [
        { etiket: "🧻 Önce terini silsin", hedef: "gk10" },
        { etiket: "🏃 Direkt yanına seksin", hedef: "gk_son_kopek" },
      ],
    },
    gk_son_kopek: {
      emoji: "🐕",
      metin: "Sekerken köşedeki köpeğin kuyruğuna bastı. Köpek kovaladı, Berkay tek ayakla hayatının en hızlı koşusunu yaptı ve yanlış mahallede kayboldu. SON.",
      secenekler: [],
    },
    gk10: {
      emoji: "💞",
      metin: "Terini sildi, kız arkadaşı geldi. Ayağını görünce \"Ne oldu sana?\" diye sordu. Berkay bir cevap vermeli.",
      secenekler: [
        { etiket: "🦸 \"Yolda kavga ettim\" desin", hedef: "gk11" },
        { etiket: "😅 \"Çukura düştüm\" desin", hedef: "gk_durust" },
      ],
    },
    gk_durust: {
      emoji: "😇",
      metin: "Dürüst oldu. Kız arkadaşı \"geçmiş olsun\" deyip koluna girdi. Berkay'ın hayatında aldığı ilk doğru karar, muhtemelen sonuncusu.",
      secenekler: [{ etiket: "🍽️ Yemeğe gitsinler", hedef: "gk12" }],
    },
    gk11: {
      emoji: "🤥",
      metin: "\"Beş kişiydiler.\" Tam o sırada mahallenin çocukları \"flamingo abi!\" diye bağırarak yanlarından geçti. Yalan tam 3 saniye yaşadı.",
      secenekler: [
        { etiket: "🌀 Yalanı büyütsün", hedef: "gk_son_yalan" },
        { etiket: "😔 İtiraf etsin", hedef: "gk12" },
      ],
    },
    gk_son_yalan: {
      emoji: "🌀",
      metin: "\"Beş değil on kişilerdi, hepsi kemer kuşak.\" Manifestten zoktay gibi kıvırdı, kıvırdı, sonunda kendisi de inandı ve rövanş için mahalleye geri sekti. SON.",
      secenekler: [],
    },
    gk12: {
      emoji: "😋",
      metin: "Neyse ki ikisi de acıkmıştı. \"Nereye gidelim?\" Berkay'ın gözleri parladı.",
      secenekler: [
        { etiket: "🍗 \"Popeyes!\"", hedef: "gk13" },
        { etiket: "🥗 \"Salata yiyelim\" desin", hedef: "gk_son_salata" },
      ],
    },
    gk_son_salata: {
      emoji: "🥗",
      metin: "\"Salata\" derken kendi sesine yabancılaştı. Popeyes'ın önünden geçerken gözünden bir damla yaş süzüldü, salata boğazında kaldı. SON.",
      secenekler: [],
    },
    gk13: {
      emoji: "🧾",
      metin: "Popeyes. Kasaya abandı: \"En büyük menü hangisi?\" Kasiyer: \"1000 TL'lik aile menüsü var ama 6 kişilik.\" Berkay: \"Yeter.\"",
      secenekler: [
        { etiket: "💳 Kartla ödesin", hedef: "gk14" },
        { etiket: "💵 Nakit versin", hedef: "gk_son_nakit" },
      ],
    },
    gk_son_nakit: {
      emoji: "🧸",
      metin: "Cebinden 3 buruşuk 100'lük, bir otobüs bileti, 2 sakız ve Kurban'a ait bir çakmak çıktı. 700 TL eksik. Kasiyer \"O zaman çocuk menüsü\" dedi. Berkay menüden çıkan oyuncakla oynayarak Gölcük sahilinde oturdu. SON.",
      secenekler: [],
    },
    gk14: {
      emoji: "🍗",
      metin: "1000 TL gitti, ayın geri kalanı bismillah. Garson 6 kişilik tepsiyi getirirken iki kere mola verdi.",
      secenekler: [
        { etiket: "🍗 Tavukla başlasın", hedef: "gk_son_tavuk" },
        { etiket: "🍟 Patatesle başlasın", hedef: "gk15" },
      ],
    },
    gk_son_tavuk: {
      emoji: "🥵",
      metin: "İlk tavuğu ısırdı, dili yandı, \"aaaa\" diye zıplayınca sakat ayağının üstüne bastı, tepsi devrildi. 1000 TL'lik menü yerde. SON.",
      secenekler: [],
    },
    gk15: {
      emoji: "🍟",
      metin: "Birinci kova patates. Bitti. Kız arkadaşı daha 3 tane yemişti.",
      secenekler: [
        { etiket: "🛑 Dursun artık", hedef: "gk_son_dur" },
        { etiket: "🍟 İkinci kovaya geçsin", hedef: "gk16" },
      ],
    },
    gk_son_dur: {
      emoji: "⚠️",
      metin: "\"Dur\" kelimesi Berkay'ın sisteminde tanımlı değil. Beyni hata verip yeniden başladı, uyandığında restoran kapanıyordu. SON.",
      secenekler: [],
    },
    gk16: {
      emoji: "🍟",
      metin: "İkinci kova da bitti. Parmaklar tuzdan kurudu, göz bebekleri büyüdü. Garson uzaktan endişeyle izliyor.",
      secenekler: [
        { etiket: "🍟 Üçüncü kovayı istesin", hedef: "gk17" },
        { etiket: "🥤 Kolayla bastırsın", hedef: "gk_son_kola" },
      ],
    },
    gk_son_kola: {
      emoji: "🥤",
      metin: "1 litre kolayı tek nefeste içti ve öyle bir geğirdi ki yan masadaki bebek ağlamaya başladı. Müdür nazikçe kapıyı gösterdi. SON.",
      secenekler: [],
    },
    gk17: {
      emoji: "🏆",
      metin: "Üçüncü kova masada. Kasiyer mutfağa \"rekor kırılıyor!\" diye seslendi, bütün Popeyes çalışanları masanın başına toplandı.",
      secenekler: [
        { etiket: "💪 Rekor için bitirsin", hedef: "gk18" },
        { etiket: "🤢 Yarısında bıraksın", hedef: "gk_son_yarim" },
      ],
    },
    gk_son_yarim: {
      emoji: "😞",
      metin: "Yarısında bıraktı. Çalışanlar hayal kırıklığıyla dağıldı. Berkay ömür boyu o yarım kovayı düşünecek. SON.",
      secenekler: [],
    },
    gk18: {
      emoji: "👏",
      metin: "Bitirdi! Çalışanlar alkışladı. Karnı körfez gibi şişti, pantolon düğmesi uçup sos standına çarptı.",
      secenekler: [
        { etiket: "📸 Çalışanlarla fotoğraf çektirsin", hedef: "gk_son_pano" },
        { etiket: "🚶 Kalkıp çıksınlar", hedef: "gk19" },
      ],
    },
    gk_son_pano: {
      emoji: "🖼️",
      metin: "Fotoğraf \"Ayın Müşterisi\" panosuna asıldı. Altına küçük harflerle yazdılar: \"Bu kişiye ikinci kova verilmez.\" SON.",
      secenekler: [],
    },
    gk19: {
      emoji: "🧍",
      metin: "Kalkmaya çalıştı, kalkamadı. İkinci denemede kalktı ama sakat ayak hatırlattı: \"kıtır.\" Kız arkadaşı koluna girdi.",
      secenekler: [
        { etiket: "🚕 Taksi çağırsın", hedef: "gk_son_taksi" },
        { etiket: "🚏 Durağa yürüsünler", hedef: "gk20" },
      ],
    },
    gk_son_taksi: {
      emoji: "🚕",
      metin: "Taksi geldi, Berkay bindi. Taksimetre 150 TL'yi geçince kartında 0 lira kaldığını hatırladı. Değirmendere'de indirildi, hâlâ oradan sekiyor. SON.",
      secenekler: [],
    },
    gk20: {
      emoji: "🚶",
      metin: "Durağa doğru yürüyorlar. Berkay seke seke; her sekişte karnından bir \"hık\" geliyor.",
      secenekler: [
        { etiket: "👋 Durakta vedalaşsınlar", hedef: "gk21" },
        { etiket: "🏃 Otobüs görünce koşsun", hedef: "gk_son_kos" },
      ],
    },
    gk_son_kos: {
      emoji: "💨",
      metin: "Otobüsü görünce tek ayakla depar attı. Otobüs gitti, Berkay kaldırıma yapıştı. Hayatındaki en kısa koşu: 2 metre. SON.",
      secenekler: [],
    },
    gk21: {
      emoji: "👋",
      metin: "Vedalaştılar. Kız arkadaşı \"Eve varınca yaz\" dedi ve gitti. Berkay durakta tek başına, otobüse 15 dakika var.",
      secenekler: [
        { etiket: "🎮 Telefonda oyun oynasın", hedef: "gk_son_oyun" },
        { etiket: "🪑 Banka otursun", hedef: "gk22" },
      ],
    },
    gk_son_oyun: {
      emoji: "🔋",
      metin: "Oyuna daldı, 3 otobüs kaçırdı, şarj %0. Sabahı durak lambasının altında, tek ayak havada geçirdi. SON.",
      secenekler: [],
    },
    gk22: {
      emoji: "🤕",
      metin: "Banka oturmak için elini dayadı. Bank ıslaktı, eli kaydı, bileğinin üstüne düştü: bu sefer de eli yamuldu. Ayak sakat, el sakat, mide 3 kova.",
      secenekler: [
        { etiket: "📞 Kurban'ı arasın", hedef: "gk23" },
        { etiket: "😭 Ağlasın", hedef: "gk_son_aglama" },
      ],
    },
    gk_son_aglama: {
      emoji: "😭",
      metin: "Lunaparktaki gibi hüngür hüngür ağladı. Bir teyze mendil verdi, bir amca 20 TL. Berkay bu işin ekonomisini hesaplamaya başladı, yarın yine geliyor. SON.",
      secenekler: [],
    },
    gk23: {
      emoji: "☎️",
      metin: "Kurban açtı: \"Popeyes'ım nerede?\" Berkay: \"Elim yamuldu kanka.\" Kurban: \"Elin yamuldu da benim Popeyes'ımın ne suçu var?\"",
      secenekler: [
        { etiket: "🤝 \"Yarın iki menü\" desin", hedef: "gk24" },
        { etiket: "📴 Yüzüne kapatsın", hedef: "gk_son_kurban" },
      ],
    },
    gk_son_kurban: {
      emoji: "🚪",
      metin: "Telefonu Kurban'ın yüzüne kapattı. Kurban onu arkadaş grubundan attı ve grubun adını \"Berkaysız Huzur\" yaptı. SON.",
      secenekler: [],
    },
    gk24: {
      emoji: "🚌",
      metin: "Otobüs geldi! Berkay yamuk eliyle kartı aradı. Kart cüzdanın en dibinde, Popeyes fişlerinin arasında.",
      secenekler: [
        { etiket: "🪙 Bozuk parayla ödesin", hedef: "gk_son_bozuk" },
        { etiket: "💳 Kartı çıkarsın", hedef: "gk25" },
      ],
    },
    gk_son_bozuk: {
      emoji: "🪙",
      metin: "Şoföre avuç dolusu bozukluk uzattı. Şoför: \"1998'den mi geldin sen?\" Kapı kapandı, Berkay bozukluklarıyla durakta kaldı. SON.",
      secenekler: [],
    },
    gk25: {
      emoji: "💳",
      metin: "Kartı çıkardı, yamuk eliyle okuyucuya bastırdı. Bip yok. Bir daha bastırdı. Bip yok. Arkadaki kuyruk söylenmeye başladı.",
      secenekler: [
        { etiket: "💪 Bütün gücüyle bassın", hedef: "gk26" },
        { etiket: "🔄 Kartı ters çevirsin", hedef: "gk_son_sadakat" },
      ],
    },
    gk_son_sadakat: {
      emoji: "🍗",
      metin: "Ters çevirdi: BİP! Ama o otobüs kartı değil, Popeyes sadakat kartıymış. Okuyucu \"1 bedava patates kazandınız\" yazdı, şoför Berkay'ı indirdi. SON.",
      secenekler: [],
    },
    gk26: {
      emoji: "💥",
      metin: "ÇIT! Kart ikiye bölündü: yarısı elinde, yarısı okuyucunun içinde. Otobüs sustu. Şoför yavaşça başını çevirdi.",
      secenekler: [
        { etiket: "😇 \"Kart zaten bozuktu abi\" desin", hedef: "gk27" },
        { etiket: "🏃 Kaçsın", hedef: "gk_son_kacis" },
      ],
    },
    gk_son_kacis: {
      emoji: "🐢",
      metin: "Seke seke kaçmaya çalıştı. Otobüs 2 metre ileride durup bekledi. Kaçış 4 saniye sürdü, şoför ve yolcular hâlâ gülüyor. SON.",
      secenekler: [],
    },
    gk27: {
      emoji: "😠",
      metin: "Şoför: \"Kart bozuktu da okuyucumu kim bozdu?\" Arkadan yolcular: \"Hadi be kardeşim!\"",
      secenekler: [
        { etiket: "🤑 Şoförle pazarlık etsin", hedef: "gk_son_pazarlik" },
        { etiket: "🙋 Birinden kart bastırsın", hedef: "gk28" },
      ],
    },
    gk_son_pazarlik: {
      emoji: "🚪",
      metin: "\"Abi 12 liram var, yarısı senin.\" Şoför kapıyı açtı: \"Buyur in.\" Berkay yarım kartıyla durakta baş başa kaldı. SON.",
      secenekler: [],
    },
    gk28: {
      emoji: "🙏",
      metin: "Arkadaki abla acıdı: \"Benden bas.\" Berkay otobüste! Tek ayak, tek el, 6 kişilik menü dolu mide, yarım kart.",
      secenekler: [
        { etiket: "🪑 Oturacak yer arasın", hedef: "gk29" },
        { etiket: "🧍 Ayakta dursun", hedef: "gk_son_fren" },
      ],
    },
    gk_son_fren: {
      emoji: "🩰",
      metin: "İlk frende tek ayak üstünde bale yaptı, üç kişinin ayağına bastı, birinin çantasına tutundu. Çantanın sahibi sivil polis çıktı. SON.",
      secenekler: [],
    },
    gk29: {
      emoji: "💺",
      metin: "Tek boş koltuk en arkada. Otobüs hareket etti, oraya bir şekilde varması lazım.",
      secenekler: [
        { etiket: "🦘 Seksin", hedef: "gk_son_kucak" },
        { etiket: "🧎 Emekleyerek gitsin", hedef: "gk30" },
      ],
    },
    gk_son_kucak: {
      emoji: "😳",
      metin: "Otobüs virajı aldı, Berkay sekerken bir amcanın kucağına oturdu. Amca \"rahat mısın evlat?\" dedi. Durak boyunca kalkamadı. SON.",
      secenekler: [],
    },
    gk30: {
      emoji: "🧎",
      metin: "Emekleyerek koltuğa ulaştı, yolcular alkışladı. Oturur oturmaz 3 kova patates harekete geçti.",
      secenekler: [
        { etiket: "🪟 Pencereyi açsın", hedef: "gk_son_pencere" },
        { etiket: "😴 Uyusun, geçer", hedef: "gk31" },
      ],
    },
    gk_son_pencere: {
      emoji: "🌬️",
      metin: "Pencereyi açtı, rüzgâr suratına vurdu, patatesler \"merhaba\" dedi. Detaylara girmiyoruz. Otobüs direkt yıkamaya gitti. SON.",
      secenekler: [],
    },
    gk31: {
      emoji: "😴",
      metin: "Uyudu. Kendi durağını tabii ki kaçırdı. Son durakta şoför dürttü: \"Kalk, Kandıra'dayız.\"",
      secenekler: [
        { etiket: "📞 Kurban'ı arasın", hedef: "gk32" },
        { etiket: "🚶 Yürüyerek dönsün", hedef: "gk_son_yuru" },
      ],
    },
    gk_son_yuru: {
      emoji: "🗺️",
      metin: "Tek ayak, tek el, 40 km. Berkay hâlâ yolda. Arada bir durup \"kubiii 1 km'yi gördüm\" diye bağırıyor. SON.",
      secenekler: [],
    },
    gk32: {
      emoji: "🚗",
      metin: "Kurban: \"KANDIRA MI? ... Tamam geliyorum ama bedeli ağır olacak.\" Berkay'ın cebinde 12 TL var.",
      secenekler: [
        { etiket: "💸 \"Maaş gelince öderim\" desin", hedef: "gk_son_maas" },
        { etiket: "🎮 Oyun hesabını teklif etsin", hedef: "gk33" },
      ],
    },
    gk_son_maas: {
      emoji: "🫖",
      metin: "Kurban: \"Senin maaşın mı var lan?\" Telefon kapandı. Berkay Kandıra'da bir çay ocağında iş buldu, ilk maaşı 3 ay sonra. SON.",
      secenekler: [],
    },
    gk33: {
      emoji: "🏠",
      metin: "Hesap şifresini alan Kurban 20 dakikada geldi, Berkay'ı eve bıraktı. Kapıda kız arkadaşına \"Vardım ❤️\" yazdı. Günün sonu geldi.",
      secenekler: [
        { etiket: "🛌 Direkt yatsın", hedef: "gk_son_final1" },
        { etiket: "📝 Günün hesabını yapsın", hedef: "gk_son_final2" },
      ],
    },
    gk_son_final1: {
      emoji: "🛌",
      metin: "Yatağa uzandı: ayak şiş, el şiş, kart kırık, 1000 TL gitti, oyun hesabı Kurban'da. Ama kız arkadaşını gördü ve 3 kova patates yedi. Berkay'ın kariyerindeki en başarılı gün. SON.",
      secenekler: [],
    },
    gk_son_final2: {
      emoji: "📝",
      metin: "Deftere yazdı. Kayıplar: 1 ayak, 1 el, 1 kart, 1000 TL, 1 oyun hesabı. Kazançlar: 3 kova patates, 1 güzel gün. Altına \"değdi\" yazıp uyudu. SON.",
      secenekler: [],
    },
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
