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

  const VARSAYILAN = {
    baslangic: "basla",
    dugumler: {
      basla: {
        emoji: "😴",
        metin: "Cumartesi. Berkay saat 13:00'te uyandı (onun için sabahın köründe). Bugün ne yapsın?",
        secenekler: [
          { etiket: "🚌 İzmir'e gitsin", hedef: "izmir1" },
          { etiket: "🏠 Evde kalsın", hedef: "ev1" },
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
    temizle,
    guvenliResim,
    yukle,
  };
})();
