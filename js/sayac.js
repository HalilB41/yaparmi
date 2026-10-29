// ============================================================
// sayac.js — Sayaçlar ("Berkay ehliyet alalı 12 gün 4 saat" gibi).
// Liste admin panelinden düzenlenir, Firestore: sayaclar/liste { liste: [...] }
// Her sayaç: { emoji, baslik, tarih (ms), tur: "gecen" | "kalan" }
//   gecen → o tarihten bu yana geçen süre ("... alalı")
//   kalan → o tarihe kalan süre ("... düğününe kalan")
// Ana sayfada #sayacListe varsa gösterilir, admin panelinde #sayacAdmin varsa düzenleyici açılır.
// ============================================================
(function () {
  "use strict";

  const hazir = () => typeof db !== "undefined" && db;
  const belge = () => db.collection("sayaclar").doc("liste");

  function temizListe(l) {
    return (Array.isArray(l) ? l : [])
      .filter((s) => s && typeof s.baslik === "string" && Number.isFinite(s.tarih))
      .map((s) => ({ emoji: String(s.emoji || "⏱️").slice(0, 8), baslik: s.baslik.slice(0, 80), tarih: s.tarih, tur: s.tur === "kalan" ? "kalan" : "gecen" }))
      .slice(0, 12);
  }

  function parcala(ms) {
    ms = Math.max(0, ms);
    const gun = Math.floor(ms / 864e5);
    const saat = Math.floor((ms % 864e5) / 36e5);
    const dk = Math.floor((ms % 36e5) / 6e4);
    const sn = Math.floor((ms % 6e4) / 1e3);
    return { gun, saat, dk, sn };
  }
  const iki = (n) => String(n).padStart(2, "0");

  // ---------------- Ana sayfa ----------------
  const liste = document.getElementById("sayacListe");
  const bolum = document.getElementById("sayacBolum");
  if (liste && hazir()) {
    let kartlar = [];
    belge().onSnapshot(
      (snap) => {
        const l = temizListe(snap.exists ? snap.data().liste : []);
        if (bolum) bolum.hidden = l.length === 0;
        liste.innerHTML = "";
        kartlar = l.map((s) => {
          const k = document.createElement("div");
          k.className = "sayac-kart" + (s.tur === "kalan" ? " is-kalan" : "");
          k.innerHTML =
            '<div class="sayac-ust"><span class="sayac-emoji"></span><span class="sayac-tur"></span></div>' +
            '<div class="sayac-gun"><b></b><span>gün</span></div>' +
            '<div class="sayac-saat"></div><div class="sayac-baslik"></div>';
          k.querySelector(".sayac-emoji").textContent = s.emoji;
          k.querySelector(".sayac-tur").textContent = s.tur === "kalan" ? "kalan süre" : "geçen süre";
          k.querySelector(".sayac-baslik").textContent = s.baslik;
          liste.appendChild(k);
          return { s, gun: k.querySelector(".sayac-gun b"), saat: k.querySelector(".sayac-saat"), kart: k };
        });
        tik();
      },
      () => { if (bolum) bolum.hidden = true; }
    );
    function tik() {
      const now = Date.now();
      kartlar.forEach(({ s, gun, saat, kart }) => {
        const fark = s.tur === "kalan" ? s.tarih - now : now - s.tarih;
        const p = parcala(fark);
        gun.textContent = p.gun.toLocaleString("tr-TR");
        saat.textContent = fark <= 0 && s.tur === "kalan" ? "Süre doldu!" : iki(p.saat) + " sa " + iki(p.dk) + " dk " + iki(p.sn) + " sn";
        kart.classList.toggle("is-bitti", fark <= 0 && s.tur === "kalan");
      });
    }
    setInterval(tik, 1000);
  }

  // ---------------- Admin düzenleyici ----------------
  const admin = document.getElementById("sayacAdmin");
  if (!admin) return;
  const durum = document.getElementById("sayacDurum");
  const ekleBtn = document.getElementById("sayacEkle");
  const kaydetBtn = document.getElementById("sayacKaydet");
  let satirlar = [];

  function yerelTarih(ms) {
    const d = new Date(ms);
    return d.getFullYear() + "-" + iki(d.getMonth() + 1) + "-" + iki(d.getDate()) + "T" + iki(d.getHours()) + ":" + iki(d.getMinutes());
  }

  function ciz() {
    admin.innerHTML = "";
    if (!satirlar.length) {
      admin.innerHTML = '<p class="muted" style="margin:0">Henüz sayaç yok. "Sayaç ekle" ile başla; ana sayfada sayaç varsa bölüm görünür.</p>';
      return;
    }
    satirlar.forEach((s, i) => {
      const r = document.createElement("div");
      r.className = "sayac-satir";
      r.innerHTML =
        '<input class="sayac-in-emoji" maxlength="8" aria-label="Emoji" />' +
        '<input class="sayac-in-baslik" maxlength="80" placeholder="Berkay ehliyet alalı" aria-label="Başlık" />' +
        '<input class="sayac-in-tarih" type="datetime-local" aria-label="Tarih" />' +
        '<select class="sayac-in-tur" aria-label="Tür"><option value="gecen">Geçen süre</option><option value="kalan">Kalan süre</option></select>' +
        '<button type="button" class="admin-btn reject se-small" aria-label="Sil">Sil</button>';
      const [em, ba, ta, tu] = r.querySelectorAll("input, select");
      em.value = s.emoji;
      ba.value = s.baslik;
      ta.value = yerelTarih(s.tarih);
      tu.value = s.tur;
      em.oninput = () => (s.emoji = em.value);
      ba.oninput = () => (s.baslik = ba.value);
      ta.onchange = () => { const t = new Date(ta.value).getTime(); if (Number.isFinite(t)) s.tarih = t; };
      tu.onchange = () => (s.tur = tu.value);
      r.querySelector("button").onclick = () => { satirlar.splice(i, 1); ciz(); };
      admin.appendChild(r);
    });
  }

  ekleBtn.addEventListener("click", () => {
    satirlar.push({ emoji: "⏱️", baslik: "", tarih: Date.now(), tur: "gecen" });
    ciz();
    const son = admin.querySelector(".sayac-satir:last-child .sayac-in-baslik");
    if (son) son.focus();
  });

  kaydetBtn.addEventListener("click", async () => {
    if (!hazir()) { durum.textContent = "Bağlı değil."; return; }
    const temiz = temizListe(satirlar.filter((s) => s.baslik.trim()));
    durum.textContent = "Kaydediliyor…";
    try {
      await belge().set({ liste: temiz });
      satirlar = temiz.map((s) => Object.assign({}, s));
      ciz();
      durum.textContent = "✅ Kaydedildi, ana sayfada görünüyor.";
    } catch (err) {
      durum.textContent = "⚠️ Kaydedilemedi: " + err.message + " (Firestore kurallarına sayaclar eklendi mi?)";
    }
  });

  if (hazir()) {
    belge().get().then((snap) => {
      satirlar = temizListe(snap.exists ? snap.data().liste : []);
      ciz();
    }).catch(() => { durum.textContent = "Sayaçlar okunamadı (Firestore kurallarına sayaclar eklendi mi?)."; ciz(); });
  } else {
    ciz();
  }
})();
