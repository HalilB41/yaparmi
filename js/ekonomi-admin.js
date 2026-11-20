// ============================================================
// ekonomi-admin.js — admin.html "💰 Ekonomi" sekmesi.
//   Ödüller (günlük giriş, seri bonusu, oyun rekoru, günlük sınır)
//   BERKAY çarkı (bedava hak, ücret, dilimler)
//   Tahmin pazarı (aç, bahisleri kapat, sonuç gir, iptal, sil)
//   Berkay Bingo (yeni tur, olayları işaretle, turu bitir)
// Her değişiklik /api/borsa üzerinden (sunucuda) yapılır.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("ekaGunluk")) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const para = (x, k = 0) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  const tarih = (ms) => (ms ? new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
  const VARSAYILAN = { acik: true, gunlukMiktar: 10, seriGun: 7, seriBonus: 50, rekorOdul: 15, oyunGunlukLimit: 30, carkUcret: 10, carkGunlukBedava: 1, carkDilimler: [
    { ad: "+5", miktar: 5, agirlik: 30 }, { ad: "+20", miktar: 20, agirlik: 20 }, { ad: "−10", miktar: -10, agirlik: 18 },
    { ad: "+50", miktar: 50, agirlik: 8 }, { ad: "Boş", miktar: 0, agirlik: 15 }, { ad: "−25", miktar: -25, agirlik: 5 }, { ad: "+200 💎", miktar: 200, agirlik: 1 }] };
  const BINGO_ORNEK = [
    "Berkay geç kaldı", "\"Yoldayım\" dedi ama evdeydi", "Bahane uydurdu", "Kubiii dedi", "Spora gideceğim dedi", "Spora gitmedi",
    "Ehliyet konusu açıldı", "Yemek söyledi", "Telefonu şarjsız kaldı", "Mesajı görüp cevap vermedi", "Birine borç para sordu",
    "\"Yarın başlıyorum\" dedi", "Bir şeyi kırdı/döktü", "Uyuyakaldı", "Planı son dakika iptal etti", "Hesabı başkası ödedi",
    "Kendini övdü", "Boks makinesine vurdu", "Story attı", "Sesli mesaj attı (1 dakikadan uzun)", "Oyunda kaybetti, hile dedi",
    "Diyete başladığını söyledi", "Gece 3'te yazdı", "Bir kız hakkında konuştu", "Saçını/sakalını değiştirdi", "Yeni bir iş fikri attı",
    "Maç kuponu yaptı", "Kuponu yattı", "\"Abi ben ne yaptım\" dedi", "Fotoğrafta gözleri kapalı çıktı",
  ];

  let basladi = false, e = VARSAYILAN, ekoDolu = false, dilimler = [], bg = null, metinDolu = false;

  window.YaparmiAuth.onChange((p) => { if (p && p.rol === "admin" && !basladi) { basladi = true; baslat(); } });

  async function islem(btn, durumEl, ad, veri) {
    if (btn) btn.disabled = true;
    durumEl.textContent = "İşleniyor…";
    try { const r = await Ekonomi.api(ad, veri); durumEl.textContent = "✅ " + (r.mesaj || "Tamam"); return r; }
    catch (err) { durumEl.textContent = "⚠️ " + err.message; return null; }
    finally { if (btn) btn.disabled = false; }
  }

  function baslat() {
    db.collection("borsa").doc("ekonomi").onSnapshot((s) => {
      e = Object.assign({}, VARSAYILAN, s.exists ? s.data() : {});
      if (!ekoDolu) { ekoDolu = true; formDoldur(); }
    }, () => { if (!ekoDolu) { ekoDolu = true; formDoldur(); } });
    db.collection("tahmin").onSnapshot((s) => tahminCiz(s.docs.map((d) => Object.assign({ id: d.id }, d.data()))), (err) => { $("ekaTahminler").innerHTML = '<p class="muted">⚠️ ' + err.message + "</p>"; });
    db.collection("bingo").doc("aktif").onSnapshot((s) => { bg = s.exists ? s.data() : null; bingoCiz(); }, (err) => { $("ekaBingoOzet").textContent = "⚠️ " + err.message; });
  }

  // ---------------- Ödüller ----------------
  function formDoldur() {
    $("ekaAcik").checked = e.acik !== false;
    $("ekaGunluk").value = e.gunlukMiktar; $("ekaSeriGun").value = e.seriGun; $("ekaSeriBonus").value = e.seriBonus;
    $("ekaRekor").value = e.rekorOdul; $("ekaOyunLimit").value = e.oyunGunlukLimit;
    $("ekaCarkBedava").value = e.carkGunlukBedava; $("ekaCarkUcret").value = e.carkUcret;
    dilimler = (e.carkDilimler || []).map((x) => Object.assign({}, x));
    dilimCiz();
  }
  $("ekaOdulKaydet").addEventListener("click", () => islem($("ekaOdulKaydet"), $("ekaOdulDurum"), "adminEkonomi", {
    acik: $("ekaAcik").checked, gunlukMiktar: Number($("ekaGunluk").value), seriGun: Number($("ekaSeriGun").value), seriBonus: Number($("ekaSeriBonus").value),
    rekorOdul: Number($("ekaRekor").value), oyunGunlukLimit: Number($("ekaOyunLimit").value),
  }));

  // ---------------- BERKAY çarkı ----------------
  function beklenen() {
    const t = dilimler.reduce((a, x) => a + (Number(x.agirlik) || 0), 0);
    if (!t) { $("ekaCarkBeklenen").textContent = ""; return; }
    const ort = dilimler.reduce((a, x) => a + (Number(x.miktar) || 0) * (Number(x.agirlik) || 0), 0) / t;
    const ucret = Number($("ekaCarkUcret").value) || 0;
    $("ekaCarkBeklenen").innerHTML = `Bir çevirmenin ortalama getirisi: <b>${ort.toFixed(1)} BERKAY</b>` +
      (ucret ? (ort >= ucret ? ` · ⚠️ ücretten (${ucret}) büyük: insanlar durmadan çevirip kasayı boşaltabilir.` : ` · ücret ${ucret}: ücretli çevirmede kasa kazanır ✅`) : "");
  }
  function dilimCiz() {
    const k = $("ekaDilimler"); k.textContent = "";
    dilimler.forEach((x, i) => {
      const r = el("div", "eka-dilim");
      const ad = el("input"); ad.value = x.ad; ad.maxLength = 20; ad.placeholder = "Yazı";
      const m = el("input"); m.type = "number"; m.value = x.miktar; m.step = "1"; m.title = "BERKAY (eksi = kaybettirir)";
      const a = el("input"); a.type = "number"; a.value = x.agirlik; a.min = "0"; a.step = "1"; a.title = "Ağırlık";
      ad.addEventListener("input", () => { x.ad = ad.value; });
      m.addEventListener("input", () => { x.miktar = Number(m.value); beklenen(); });
      a.addEventListener("input", () => { x.agirlik = Number(a.value); beklenen(); });
      const sil = el("button", "admin-btn reject se-small", "✖"); sil.type = "button";
      sil.addEventListener("click", () => { dilimler.splice(i, 1); dilimCiz(); });
      r.append(ad, m, a, sil);
      k.append(r);
    });
    beklenen();
  }
  $("ekaCarkUcret").addEventListener("input", beklenen);
  $("ekaDilimEkle").addEventListener("click", () => { dilimler.push({ ad: "+10", miktar: 10, agirlik: 10 }); dilimCiz(); });
  $("ekaCarkKaydet").addEventListener("click", () => islem($("ekaCarkKaydet"), $("ekaCarkDurum"), "adminEkonomi", {
    carkGunlukBedava: Number($("ekaCarkBedava").value), carkUcret: Number($("ekaCarkUcret").value), carkDilimler: dilimler,
  }));

  // ---------------- Tahmin ----------------
  $("ekaTahminAc").addEventListener("click", async () => {
    const kap = $("ekaTahminKapanis").value;
    const r = await islem($("ekaTahminAc"), $("ekaTahminDurum"), "adminTahmin", {
      alt: "olustur", soru: $("ekaTahminSoru").value, secenekler: $("ekaTahminSecenek").value.split(","), kapanis: kap ? new Date(kap).getTime() : 0,
    });
    if (r) { $("ekaTahminSoru").value = ""; $("ekaTahminKapanis").value = ""; }
  });
  const DURUM = { acik: "🟢 Açık", kapali: "🔒 Bahis kapalı", sonuclandi: "✅ Sonuçlandı", iptal: "↩️ İptal" };
  function tahminCiz(liste) {
    const k = $("ekaTahminler"); k.textContent = "";
    liste.sort((a, b) => (b.olusturma || 0) - (a.olusturma || 0));
    if (!liste.length) { k.append(el("p", "muted", "Henüz tahmin yok.")); return; }
    liste.forEach((t) => {
      const kart = el("div", "eka-tahmin");
      const ust = el("div", "eka-tahmin-ust");
      ust.append(el("b", null, t.soru), el("span", "muted", `${DURUM[t.durum] || t.durum} · havuz ${para(t.havuz || 0)} BERKAY · kapanış ${t.kapanis ? tarih(t.kapanis) : "elle"}`));
      kart.append(ust);
      const sec = el("div", "eka-tahmin-secenek");
      t.secenekler.forEach((s, i) => {
        const r = el("div", "bx-satir");
        r.append(el("span", null, (t.kazanan === i && t.durum === "sonuclandi" ? "🏆 " : "") + s.ad), el("span", "muted", `${s.kisi || 0} kişi`), el("span", "bx-sag", para(s.toplam || 0) + " BERKAY"));
        if (t.durum === "acik" || t.durum === "kapali") {
          const b = el("button", "admin-btn publish se-small", "🏆 Kazanan bu"); b.type = "button";
          b.addEventListener("click", () => { if (confirm(`"${t.soru}" sonucu: ${s.ad}\nHavuz (${para(t.havuz || 0)} BERKAY) bunu bilenlere dağıtılacak. Geri alınamaz.`)) islem(b, $("ekaTahminDurum"), "adminTahmin", { alt: "sonuc", id: t.id, kazanan: i }); });
          r.append(b);
        }
        sec.append(r);
      });
      kart.append(sec);
      const btn = el("div", "sayac-butonlar");
      if (t.durum === "acik") { const b = el("button", "admin-btn se-small", "🔒 Bahisleri kapat"); b.type = "button"; b.addEventListener("click", () => islem(b, $("ekaTahminDurum"), "adminTahmin", { alt: "kapat", id: t.id })); btn.append(b); }
      if (t.durum === "acik" || t.durum === "kapali") { const b = el("button", "admin-btn reject se-small", "↩️ İptal + iade"); b.type = "button"; b.addEventListener("click", () => { if (confirm("İptal edilsin, herkese parası iade edilsin mi?")) islem(b, $("ekaTahminDurum"), "adminTahmin", { alt: "iptal", id: t.id }); }); btn.append(b); }
      if (t.durum === "sonuclandi" || t.durum === "iptal") { const b = el("button", "admin-btn reject se-small", "🗑️ Listeden sil"); b.type = "button"; b.addEventListener("click", () => { if (confirm("Bu biten tahmin listeden silinsin mi?")) islem(b, $("ekaTahminDurum"), "adminTahmin", { alt: "sil", id: t.id }); }); btn.append(b); }
      kart.append(btn);
      k.append(kart);
    });
  }

  // ---------------- Bingo ----------------
  function bingoSay() { const n = [...new Set($("ekaBingoMetin").value.split("\n").map((x) => x.trim()).filter(Boolean))].length; $("ekaBingoSay").textContent = `${n} farklı olay ${n < 24 ? "(en az 24 lazım)" : "✅"}`; }
  $("ekaBingoMetin").addEventListener("input", bingoSay);
  function bingoCiz() {
    if (!metinDolu) {
      metinDolu = true;
      $("ekaBingoMetin").value = (bg && bg.olaylar && bg.olaylar.length ? bg.olaylar.map((o) => o.ad) : BINGO_ORNEK).join("\n");
      if (bg && bg.odul != null) $("ekaBingoOdul").value = bg.odul;
      bingoSay();
    }
    const oz = $("ekaBingoOzet");
    const k = $("ekaBingoOlaylar"); k.textContent = "";
    if (!bg || !bg.olaylar) { oz.textContent = "Henüz hiç tur başlatılmadı. Sağdaki listeyi düzenleyip yeni turu başlat."; k.append(el("p", "muted", "Aktif tur yok.")); return; }
    const isaret = new Set(bg.isaretli || []);
    oz.innerHTML = "";
    oz.append(el("b", null, `🎱 ${bg.tur}. tur · ${bg.durum === "acik" ? "🟢 açık" : "⏹️ bitti"} · ödül ${bg.odul} BERKAY · ${isaret.size}/${bg.olaylar.length} olay oldu`));
    if (bg.kazanan) oz.append(el("span", null, ` · 🎉 Kazanan: ${bg.kazanan.ad} (+${bg.kazanan.odul})`));
    bg.olaylar.forEach((o) => {
      const l = el("label", "eka-bingo-olay" + (isaret.has(o.id) ? " is-oldu" : ""));
      const c = el("input"); c.type = "checkbox"; c.checked = isaret.has(o.id); c.disabled = bg.durum !== "acik";
      c.addEventListener("change", () => islem(null, $("ekaBingoDurum"), "adminBingo", { alt: "isaretle", id: o.id, deger: c.checked }));
      l.append(c, document.createTextNode(" " + o.ad));
      k.append(l);
    });
    $("ekaBingoBitir").disabled = bg.durum !== "acik";
  }
  $("ekaBingoBaslat").addEventListener("click", () => {
    const olaylar = $("ekaBingoMetin").value.split("\n").map((x) => x.trim()).filter(Boolean);
    if (bg && bg.durum === "acik" && !confirm("Açık tur var. Yeni tur başlarsa eski kartlar geçersiz olur. Devam?")) return;
    islem($("ekaBingoBaslat"), $("ekaBingoDurum"), "adminBingo", { alt: "baslat", olaylar, odul: Number($("ekaBingoOdul").value) || 0 });
  });
  $("ekaBingoBitir").addEventListener("click", () => { if (confirm("Tur kazanansız bitirilsin mi?")) islem($("ekaBingoBitir"), $("ekaBingoDurum"), "adminBingo", { alt: "bitir" }); });
})();
