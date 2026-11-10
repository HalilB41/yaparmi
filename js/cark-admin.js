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
  const sifirlaBtn = $("carkSifirlaBtn");
  const hakInput = $("carkHak");
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
    if (ayarlar.sifirTur === ayarlar.tur) {
      durumYazi.appendChild(document.createTextNode(" · 🧹 Bu turun hakları sıfırlandı"));
    }
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

  // Herkesin hakkını sıfırla: bu turda kalan Sınırsız Çark hakları + şu ana kadar
  // kazanılıp kullanılmamış Maximus biletleri geçersiz olur. Kayıtlar silinmez.
  // Çark bir sonraki açılışta (yeni tur) herkes için yine normal hakla başlar.
  sifirlaBtn.addEventListener("click", async () => {
    if (!confirm("Herkesin bu turda kalan çark hakkı ve kullanılmamış Maximus biletleri sıfırlansın mı?\n\nBir sonraki açılışta herkes yine normal hakkıyla başlar.")) return;
    sifirlaBtn.disabled = true;
    try {
      await belge().set({
        sifirTur: ayarlar.tur || 0,
        sifirZaman: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      kaydetDurum.textContent = "✅ Herkesin hakkı sıfırlandı.";
    } catch (err) {
      kaydetDurum.textContent = "⚠️ Sıfırlanamadı: " + err.message;
    }
    sifirlaBtn.disabled = false;
  });

  // ---------------- Çark üzerinde düzenleyici ----------------
  // Çarka tıkla → o dilim seçilir, yandaki kutudan adı / şansı / Maximus'u değişir.
  function editorKur(kap, maximusOlabilir, renkler) {
    const ed = { liste: [], secili: null };
    kap.className = "cark-editor";
    kap.innerHTML =
      '<div class="ce-sol"><div class="cark-sahne"><div class="cark-ok" aria-hidden="true"></div>' +
      '<canvas class="cark-tuval ce-tuval" width="560" height="560"></canvas></div>' +
      '<p class="muted ce-ipucu">👆 Düzenlemek için dilime tıkla</p></div>' +
      '<div class="ce-sag">' +
      '<div class="ce-ekle"><button type="button" class="admin-btn reject ce-yeni">➕ Ödül ekle</button>' +
      (maximusOlabilir ? '<button type="button" class="admin-btn reject ce-yeni-mx">🌟 Maximus dilimi ekle</button>' : "") + "</div>" +
      '<div class="ce-form" hidden>' +
      '<label class="ce-etiket">Ödül adı<input class="ce-ad" maxlength="80" placeholder="Örn. 1 Burger" /></label>' +
      '<label class="ce-etiket">Çıkma şansı <span class="ce-yuzde"></span>' +
      '<input class="ce-sans" type="range" min="1" max="100" step="1" /></label>' +
      '<p class="ce-aciklama muted"></p>' +
      (maximusOlabilir ? '<label class="ce-mx"><input type="checkbox" /> 🌟 Bu dilim Maximus bileti versin</label>' : "") +
      '<div class="ce-arac">' +
      '<span>Araya ekle:</span>' +
      '<button type="button" class="admin-btn reject se-small ce-once">⬅️ Öncesine</button>' +
      '<button type="button" class="admin-btn reject se-small ce-sonra">Sonrasına ➡️</button>' +
      "</div>" +
      '<div class="ce-arac">' +
      '<span>Yerini değiştir:</span>' +
      '<button type="button" class="admin-btn reject se-small ce-geri">◀ Geri</button>' +
      '<button type="button" class="admin-btn reject se-small ce-ileri">İleri ▶</button>' +
      "</div>" +
      '<button type="button" class="admin-btn reject se-small ce-sil">🗑️ Bu dilimi sil</button>' +
      "</div>" +
      '<p class="ce-bos muted">Bir dilime tıkla ya da yeni ödül ekle.</p>' +
      '<div class="ce-liste"></div>' +
      "</div>";
    const q = (c) => kap.querySelector(c);
    const tuval = q(".ce-tuval");
    const form = q(".ce-form");
    const adIn = q(".ce-ad");
    const sansIn = q(".ce-sans");
    const yuzde = q(".ce-yuzde");
    const aciklama = q(".ce-aciklama");
    const mxIn = q(".ce-mx input");
    const listeEl = q(".ce-liste");

    function yuzdeHesap(i) {
      const t = CarkCiz.toplamSans(ed.liste);
      return t ? (ed.liste[i].agirlik / t) * 100 : 0;
    }
    function cizCark() {
      CarkCiz.ciz(tuval, ed.liste, renkler, { secili: ed.secili, bosYazi: "➕ Ödül ekle" });
    }
    function formDoldur() {
      const d = ed.liste[ed.secili];
      form.hidden = !d;
      q(".ce-bos").hidden = !!d;
      if (!d) return;
      if (document.activeElement !== adIn) adIn.value = d.ad;
      sansIn.value = Math.min(100, Math.max(1, d.agirlik));
      const y = yuzdeHesap(ed.secili);
      yuzde.textContent = "%" + (Math.round(y * 10) / 10).toLocaleString("tr-TR");
      const kac = y > 0 ? Math.max(1, Math.round(100 / y)) : 0;
      aciklama.textContent = kac ? "Ortalama her " + kac + " çevirişte bir çıkar." : "";
      if (mxIn) mxIn.checked = !!d.maximus;
    }
    function listeCiz() {
      listeEl.innerHTML = "";
      ed.liste.forEach((d, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ce-chip" + (i === ed.secili ? " on" : "") + (d.maximus ? " mx" : "");
        b.textContent = (d.maximus ? "🌟 " : "") + (d.ad || "(isimsiz)") + " · %" + Math.round(yuzdeHesap(i));
        b.onclick = () => sec(i);
        listeEl.appendChild(b);
      });
    }
    function yenile() { cizCark(); formDoldur(); listeCiz(); }
    function sec(i) { ed.secili = i; yenile(); if (i != null) adIn.focus(); }

    tuval.addEventListener("click", (e) => {
      if (!ed.liste.length) { ekle({ ad: "", agirlik: 10, maximus: false }); return; }
      const rect = tuval.getBoundingClientRect();
      const dx = e.clientX - rect.left - rect.width / 2;
      const dy = e.clientY - rect.top - rect.height / 2;
      if (Math.hypot(dx, dy) > rect.width / 2) return;
      const derece = (Math.atan2(dx, -dy) * 180) / Math.PI;
      sec(CarkCiz.dilimBul(ed.liste, derece));
    });
    adIn.addEventListener("input", () => { if (ed.liste[ed.secili]) { ed.liste[ed.secili].ad = adIn.value; cizCark(); listeCiz(); } });
    sansIn.addEventListener("input", () => { if (ed.liste[ed.secili]) { ed.liste[ed.secili].agirlik = Number(sansIn.value); yenile(); } });
    if (mxIn) mxIn.addEventListener("change", () => {
      const d = ed.liste[ed.secili]; if (!d) return;
      d.maximus = mxIn.checked;
      if (d.maximus && !d.ad.trim()) d.ad = "Sınırsız Maximus Çarkı";
      yenile();
    });
    q(".ce-sil").addEventListener("click", () => {
      if (ed.secili == null) return;
      ed.liste.splice(ed.secili, 1);
      ed.secili = ed.liste.length ? Math.min(ed.secili, ed.liste.length - 1) : null;
      yenile();
    });
    function ekle(d) { ed.liste.push(d); sec(ed.liste.length - 1); }
    // Seçili dilimin hemen öncesine / sonrasına yeni dilim (saat yönünde: sonrası = sağı)
    function arayaEkle(sonrasina) {
      if (ed.secili == null) return;
      const yer = ed.secili + (sonrasina ? 1 : 0);
      ed.liste.splice(yer, 0, { ad: "", agirlik: 10, maximus: false });
      sec(yer);
    }
    function tasi(yon) {
      const i = ed.secili;
      const j = i + yon;
      if (i == null || j < 0 || j >= ed.liste.length) return;
      [ed.liste[i], ed.liste[j]] = [ed.liste[j], ed.liste[i]];
      ed.secili = j;
      yenile();
    }
    q(".ce-once").addEventListener("click", () => arayaEkle(false));
    q(".ce-sonra").addEventListener("click", () => arayaEkle(true));
    q(".ce-geri").addEventListener("click", () => tasi(-1));
    q(".ce-ileri").addEventListener("click", () => tasi(1));
    q(".ce-yeni").addEventListener("click", () => ekle({ ad: "", agirlik: 10, maximus: false }));
    const mxBtn = q(".ce-yeni-mx");
    if (mxBtn) mxBtn.addEventListener("click", () => ekle({ ad: "Sınırsız Maximus Çarkı", agirlik: 5, maximus: true }));

    ed.yukle = (l) => { ed.liste = l; ed.secili = null; yenile(); };
    yenile();
    return ed;
  }

  const sinirsizEd = editorKur($("carkSinirsizEditor"), true, CarkCiz.RENKLER);
  const maximusEd = editorKur($("carkMaximusEditor"), false, CarkCiz.MAXIMUS_RENKLER);
  function hepsiniCiz() {
    sinirsizEd.yukle(sinirsiz);
    maximusEd.yukle(maximus);
  }

  kaydetBtn.addEventListener("click", async () => {
    sinirsiz = sinirsizEd.liste;
    maximus = maximusEd.liste;
    const s = temiz(sinirsiz, true).filter((d) => d.ad.trim()).map((d) => ({ ad: d.ad.trim(), agirlik: d.agirlik, maximus: d.maximus }));
    const m = temiz(maximus, false).filter((d) => d.ad.trim()).map((d) => ({ ad: d.ad.trim(), agirlik: d.agirlik }));
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
        ayarlar = { acik: !!v.acik, tur: v.tur || 0, hak: v.hak || 1, sifirTur: Number.isInteger(v.sifirTur) ? v.sifirTur : -1 };
        durumCiz();
        if (ilk) {
          // Dilimleri sadece ilk açılışta yükle; düzenlerken başka güncelleme üstüne yazmasın.
          ilk = false;
          hakInput.value = ayarlar.hak;
          sinirsiz = temiz(v.sinirsiz, true).map((d) => Object.assign(d, { agirlik: Math.max(1, d.agirlik) }));
          maximus = temiz(v.maximus, false).map((d) => Object.assign(d, { agirlik: Math.max(1, d.agirlik) }));
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
