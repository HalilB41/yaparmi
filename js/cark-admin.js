// ============================================================
// cark-admin.js — admin.html'deki "🎡 Çark" sekmesi:
//   - Çarkları aç / kapat (her açılış yeni tur = herkesin hakkı yenilenir)
//   - Sınırsız Çark ve Sınırsız Maximus Çarkı dilimlerini düzenle
//   - Kime ne çıktı (ödülü istesin istemesin) listesi, "Verildi" işareti
// Veri yapısı için bkz. js/cark.js başındaki açıklama.
// ============================================================
(function () {
  "use strict";

  const kutu = document.getElementById("carkAdmin");
  if (!kutu) return;

  const $ = (id) => document.getElementById(id);
  const durumYazi = $("carkAdminDurum");
  const acBtn = $("carkAcBtn");
  const kapatBtn = $("carkKapatBtn");
  const hakInput = $("carkHak");
  const sinirsizKutu = $("carkSinirsizDilimler");
  const maximusKutu = $("carkMaximusDilimler");
  const kaydetBtn = $("carkKaydet");
  const kaydetDurum = $("carkKaydetDurum");
  const tablo = $("carkSonucTablo");
  const sekmeSay = $("admCarkSay");

  let ayarlar = { acik: false, tur: 0, hak: 1 };
  let sinirsiz = [];
  let maximus = [];
  let basladi = false;
  const belge = () => db.collection("cark").doc("ayarlar");

  function tarihYaz(ts) {
    try { return ts && ts.toDate ? ts.toDate().toLocaleString("tr-TR") : "-"; } catch { return "-"; }
  }

  function temiz(l, maximusOlabilir) {
    return (Array.isArray(l) ? l : [])
      .filter((d) => d && typeof d.ad === "string")
      .map((d) => ({
        ad: String(d.ad).slice(0, 80),
        agirlik: Math.max(0, Math.min(1000, Math.round(Number(d.agirlik) || 0))),
        maximus: !!(maximusOlabilir && d.maximus),
      }));
  }

  // ---------------- Aç / kapat ----------------
  function durumCiz() {
    durumYazi.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = ayarlar.acik ? "🟢 Çarklar AÇIK" : "🔴 Çarklar KAPALI";
    durumYazi.appendChild(b);
    durumYazi.appendChild(document.createTextNode(" · Tur: " + (ayarlar.tur || 0)));
    acBtn.hidden = !!ayarlar.acik;
    kapatBtn.hidden = !ayarlar.acik;
  }

  function hakDegeri() {
    const n = Math.round(Number(hakInput.value));
    return Number.isFinite(n) && n >= 1 && n <= 50 ? n : 1;
  }

  acBtn.addEventListener("click", async () => {
    acBtn.disabled = true;
    try {
      await belge().set({ acik: true, tur: firebase.firestore.FieldValue.increment(1), hak: hakDegeri() }, { merge: true });
      kaydetDurum.textContent = "✅ Çarklar açıldı, yeni tur başladı. Herkesin hakkı yenilendi.";
    } catch (err) {
      kaydetDurum.textContent = "⚠️ Açılamadı: " + err.message + " (Firestore kurallarına cark eklendi mi?)";
    }
    acBtn.disabled = false;
  });

  kapatBtn.addEventListener("click", async () => {
    kapatBtn.disabled = true;
    try {
      await belge().set({ acik: false }, { merge: true });
      kaydetDurum.textContent = "Çarklar kapatıldı.";
    } catch (err) {
      kaydetDurum.textContent = "⚠️ Kapatılamadı: " + err.message;
    }
    kapatBtn.disabled = false;
  });

  // ---------------- Dilim düzenleyici ----------------
  function dilimleriCiz(kap, liste, maximusOlabilir) {
    kap.innerHTML = "";
    if (!liste.length) {
      kap.innerHTML = '<p class="muted" style="margin:0 0 8px">Henüz dilim yok.</p>';
    }
    const toplam = liste.reduce((t, d) => t + (d.ad.trim() ? d.agirlik : 0), 0);
    liste.forEach((d, i) => {
      const r = document.createElement("div");
      r.className = "cark-dilim-satir" + (d.maximus ? " is-maximus" : "");
      r.innerHTML =
        '<input class="cd-ad" maxlength="80" placeholder="Ödül adı" aria-label="Ödül adı" />' +
        '<label class="cd-agirlik" title="Çıkma ağırlığı: büyük sayı = daha sık çıkar"><span>Ağırlık</span><input type="number" min="0" max="1000" step="1" aria-label="Ağırlık" /></label>' +
        '<span class="cd-yuzde"></span>' +
        (maximusOlabilir ? '<label class="cd-mx" title="Bu dilim çıkarsa Sınırsız Maximus Çarkı bileti kazanılır"><input type="checkbox" /> 🌟 Maximus</label>' : "") +
        '<button type="button" class="admin-btn reject se-small">Sil</button>';
      const ad = r.querySelector(".cd-ad");
      const ag = r.querySelector(".cd-agirlik input");
      const yuzde = r.querySelector(".cd-yuzde");
      ad.value = d.ad;
      ag.value = d.agirlik;
      yuzde.textContent = toplam && d.ad.trim() ? "%" + ((d.agirlik / toplam) * 100).toFixed(1).replace(".0", "") : "";
      ad.oninput = () => (d.ad = ad.value);
      ad.onchange = () => dilimleriCiz(kap, liste, maximusOlabilir);
      ag.onchange = () => { d.agirlik = Math.max(0, Math.min(1000, Math.round(Number(ag.value) || 0))); dilimleriCiz(kap, liste, maximusOlabilir); };
      const mx = r.querySelector(".cd-mx input");
      if (mx) {
        mx.checked = d.maximus;
        mx.onchange = () => { d.maximus = mx.checked; if (d.maximus && !d.ad.trim()) d.ad = "Sınırsız Maximus Çarkı"; dilimleriCiz(kap, liste, maximusOlabilir); };
      }
      r.querySelector("button").onclick = () => { liste.splice(i, 1); dilimleriCiz(kap, liste, maximusOlabilir); };
      kap.appendChild(r);
    });
  }
  function hepsiniCiz() {
    dilimleriCiz(sinirsizKutu, sinirsiz, true);
    dilimleriCiz(maximusKutu, maximus, false);
  }

  function ekle(liste, kap, maximusOlabilir, d) {
    liste.push(d);
    dilimleriCiz(kap, liste, maximusOlabilir);
    const son = kap.querySelector(".cark-dilim-satir:last-child .cd-ad");
    if (son) son.focus();
  }
  $("carkSinirsizEkle").addEventListener("click", () => ekle(sinirsiz, sinirsizKutu, true, { ad: "", agirlik: 10, maximus: false }));
  $("carkSinirsizMxEkle").addEventListener("click", () => ekle(sinirsiz, sinirsizKutu, true, { ad: "Sınırsız Maximus Çarkı", agirlik: 3, maximus: true }));
  $("carkMaximusEkle").addEventListener("click", () => ekle(maximus, maximusKutu, false, { ad: "", agirlik: 10, maximus: false }));

  kaydetBtn.addEventListener("click", async () => {
    const s = temiz(sinirsiz, true).filter((d) => d.ad.trim()).map((d) => ({ ad: d.ad.trim(), agirlik: d.agirlik, maximus: d.maximus }));
    const m = temiz(maximus, false).filter((d) => d.ad.trim()).map((d) => ({ ad: d.ad.trim(), agirlik: d.agirlik }));
    if (s.length > 24 || m.length > 24) { kaydetDurum.textContent = "⚠️ Bir çarkta en fazla 24 dilim olabilir."; return; }
    kaydetBtn.disabled = true;
    kaydetDurum.textContent = "Kaydediliyor…";
    try {
      await belge().set({ sinirsiz: s, maximus: m, hak: hakDegeri() }, { merge: true });
      sinirsiz = s.map((d) => Object.assign({}, d));
      maximus = m.map((d) => Object.assign({}, d, { maximus: false }));
      hepsiniCiz();
      kaydetDurum.textContent = "✅ Kaydedildi, çark sayfasında anında görünüyor.";
    } catch (err) {
      kaydetDurum.textContent = "⚠️ Kaydedilemedi: " + err.message + " (Firestore kurallarına cark eklendi mi?)";
    }
    kaydetBtn.disabled = false;
  });

  // ---------------- Kim ne kazandı ----------------
  function sonuclariDinle() {
    db.collection("cark_sonuclari")
      .orderBy("tarih", "desc")
      .limit(300)
      .onSnapshot(
        (snap) => {
          tablo.innerHTML = "";
          let bekleyen = 0;
          if (snap.empty) {
            tablo.innerHTML = '<tr><td colspan="6" class="muted">Henüz kimse çevirmedi.</td></tr>';
          }
          snap.forEach((doc) => {
            const v = doc.data();
            const tr = document.createElement("tr");
            if (v.istendi && !v.verildi) { tr.className = "is-istendi"; bekleyen++; }
            const hucre = (metin, sinif) => {
              const td = document.createElement("td");
              td.textContent = metin;
              if (sinif) td.className = sinif;
              tr.appendChild(td);
              return td;
            };
            hucre(tarihYaz(v.tarih));
            hucre(v.kullaniciAdi || "?");
            hucre(v.cark === "maximus" ? "🌟 Maximus" : "🎡 Sınırsız" + (v.tur ? " · tur " + v.tur : ""));
            hucre(v.maximusBileti ? "🎟️ Maximus bileti (" + v.odul + ")" : v.odul || "");
            hucre(v.maximusBileti ? "—" : v.verildi ? "✅ Verildi" : v.istendi ? "🙋 İstedi (" + tarihYaz(v.istenmeTarihi) + ")" : "İstemedi");
            const islem = hucre("");
            if (!v.maximusBileti) {
              const vb = document.createElement("button");
              vb.type = "button";
              vb.className = "admin-btn se-small " + (v.verildi ? "reject" : "publish");
              vb.textContent = v.verildi ? "Geri al" : "Verildi";
              vb.onclick = () => db.collection("cark_sonuclari").doc(doc.id).update({ verildi: !v.verildi }).catch((e) => alert("Olmadı: " + e.message));
              islem.appendChild(vb);
            }
            const sb = document.createElement("button");
            sb.type = "button";
            sb.className = "admin-btn reject se-small";
            sb.textContent = "Sil";
            sb.title = "Kaydı sil (o tur için kişinin hakkı geri gelir)";
            sb.onclick = () => {
              if (!confirm((v.kullaniciAdi || "?") + " → " + (v.odul || "") + " kaydı silinsin mi?")) return;
              db.collection("cark_sonuclari").doc(doc.id).delete().catch((e) => alert("Silinemedi: " + e.message));
            };
            islem.appendChild(sb);
            tablo.appendChild(tr);
          });
          if (sekmeSay) { sekmeSay.hidden = bekleyen === 0; sekmeSay.textContent = String(bekleyen); }
        },
        (err) => {
          console.error("Çark sonuçları okunamadı:", err.message);
          tablo.innerHTML = '<tr><td colspan="6" class="muted">Okunamadı (Firestore kurallarına cark_sonuclari eklendi mi?).</td></tr>';
        }
      );
  }

  function basla() {
    if (basladi || typeof db === "undefined" || !db) return;
    basladi = true;
    let ilk = true;
    belge().onSnapshot(
      (snap) => {
        const v = snap.exists ? snap.data() : {};
        ayarlar = { acik: !!v.acik, tur: v.tur || 0, hak: v.hak || 1 };
        durumCiz();
        if (ilk) {
          // Dilimleri sadece ilk açılışta yükle; düzenlerken başka güncelleme üstüne yazmasın.
          ilk = false;
          hakInput.value = ayarlar.hak;
          sinirsiz = temiz(v.sinirsiz, true);
          maximus = temiz(v.maximus, false);
          hepsiniCiz();
        }
      },
      (err) => { durumYazi.textContent = "⚠️ Ayarlar okunamadı: " + err.message; }
    );
    sonuclariDinle();
  }

  if (window.YaparmiAuth) {
    window.YaparmiAuth.onChange((p) => { if (p && p.rol === "admin") basla(); });
  }
})();
