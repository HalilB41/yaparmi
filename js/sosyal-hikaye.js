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

      // ---------------- İzmir kolu ----------------
      izmir1: {
        emoji: "🚌",
        metin: "Otogara gitti, İzmir otobüsüne bindi. Daha kalkmadan telefonu açıp bütün otobüse duyurarak konuşmaya başladı. Ön koltuktaki teyze dönüp bakıyor.",
        secenekler: [
          { etiket: "🤫 Susup uyusun", hedef: "izmir_uyu" },
          { etiket: "📢 Daha da bağırsın", hedef: "izmir_bagir" },
        ],
      },
      izmir_uyu: {
        emoji: "💤",
        metin: "Uyudu. Hem de nasıl uyudu. Gözünü açtığında otobüs Aydın'daydı, İzmir'i çoktan geçmişti.",
        secenekler: [
          { etiket: "↩️ Geri dönsün", hedef: "izmir2" },
          { etiket: "🌴 Aydın'da takılsın", hedef: "son_aydin" },
        ],
      },
      izmir_bagir: {
        emoji: "📢",
        metin: "Muavin üç kere uyardı. Dördüncüde Berkay'ı Manisa'da, yol kenarında indirdiler.",
        secenekler: [
          { etiket: "👍 Otostop çeksin", hedef: "izmir2" },
          { etiket: "🏠 Eve dönsün", hedef: "ev1" },
        ],
      },
      izmir2: {
        emoji: "🌊",
        metin: "Sonunda İzmir! Kızla Kordon'da buluşacaklardı. Saat geldi, geçti... Kız yok.",
        secenekler: [
          { etiket: "⏳ Beklesin", hedef: "son_sokak" },
          { etiket: "📱 Mesaj atsın", hedef: "izmir_mesaj" },
        ],
      },
      izmir_mesaj: {
        emoji: "📱",
        metin: "\"Geldim ben, neredesin?\" İletildi. Görüldü. Cevap yok. Yazıyor... yazmayı bıraktı.",
        secenekler: [
          { etiket: "✍️ Bir daha yazsın", hedef: "son_sokak" },
          { etiket: "🥐 Boyozla teselli olsun", hedef: "son_boyoz" },
        ],
      },
      son_sokak: {
        emoji: "🤧",
        metin: "İki gün Kordon'da bekledi, bankta yattı, hasta oldu. Kız hâlâ gelmedi. Berkay burnu akarak eve döndü. SON.",
        secenekler: [],
      },
      son_boyoz: {
        emoji: "🥐",
        metin: "3 boyoz, 2 kumru, 1 midye tabağı. Midesi isyan etti, İzmir'e küsüp döndü. SON.",
        secenekler: [],
      },
      son_aydin: {
        emoji: "🌴",
        metin: "\"Burası da İzmir sayılır\" dedi. Sayılmıyor. SON.",
        secenekler: [],
      },

      // ---------------- Ev kolu ----------------
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
          { etiket: "🍗 Popeyes söylesin", hedef: "son_popeyes" },
        ],
      },
      ev_oyun: {
        emoji: "🎮",
        metin: "14 saat aralıksız oynadı. Klavyenin arasında 3 tane kendi saç telini buldu.",
        secenekler: [
          { etiket: "🔁 Devam etsin", hedef: "son_kel" },
          { etiket: "🚪 Dışarı çıksın", hedef: "basla" },
        ],
      },
      son_uyku: {
        emoji: "🛌",
        metin: "Akşam 6'da uyudu, ertesi gün 15:00'te uyandı. Rekor. SON.",
        secenekler: [],
      },
      son_popeyes: {
        emoji: "🍗",
        metin: "Popeyes geldi, ders bitti. Bugünlük bu kadar zeka yeter dedi. SON.",
        secenekler: [],
      },
      son_kel: {
        emoji: "👨‍🦲",
        metin: "Sabaha karşı ekrandaki yansımasına baktı: saç çizgisi bir bölge daha geri çekilmişti. SON.",
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
