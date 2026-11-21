// ============================================================
// tahmin.js — sadece tahmin.html: Tahmin Pazarı.
// Admin bir iddia açar (admin → Ekonomi). Herkes bir seçeneğe BERKAY yatırır.
// Sonuç girilince havuz, bilenler arasında yatırdıkları oranda paylaşılır
// (kimse bilemezse herkese iade). Para işlemleri sunucuda: api/borsa.js → tahminBahis.
//   tahmin/{id}        { soru, secenekler:[{ad,toplam,kisi}], havuz, durum, kapanis, kazanan }
//   tahmin_bahis/{id}  { tahminId, uid, ad, secenek, miktar, odenen, sonuc }
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const para = (x, k = 0) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  let profile = null, basladi = false, tahminler = [], bahisler = [], benim = null;

  $("ekGirisBtn").addEventListener("click", (e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); const t = $("authToggle"), p = $("authPanel"); if (t && p && p.hidden) t.click(); });
  if (typeof db === "undefined" || !db) { $("ekKapiYazi").textContent = "Şu an bağlı değil."; return; }
  window.YaparmiAuth.onChange((p) => {
    profile = p;
    if (!p) { $("ekIcerik").hidden = true; $("ekKapi").hidden = false; $("ekKapiYazi").innerHTML = "Tahmin pazarına girmek için <b>kayıt ol</b>. Kayıt olunca 200 BERKAY hediye."; $("ekGirisBtn").hidden = false; return; }
    $("ekKapi").hidden = true; $("ekIcerik").hidden = false;
    if (!basladi) { basladi = true; dinle(); }
  });

  function dinle() {
    db.collection("tahmin").onSnapshot((s) => { tahminler = s.docs.map((d) => Object.assign({ id: d.id }, d.data())); ciz(); },
      (err) => { $("tmAcik").innerHTML = '<p class="muted">Tahminler okunamadı (' + err.message + ').</p>'; });
    db.collection("tahmin_bahis").onSnapshot((s) => { bahisler = s.docs.map((d) => d.data()); ciz(); }, () => {});
    Ekonomi.cuzdanim((c) => { benim = c; $("tmBakiye").textContent = benim ? para(benim.bkc, 2) + " BERKAY" : "0 BERKAY"; ciz(); });
    setInterval(() => { if (!document.hidden) ciz(); }, 30000); // geri sayımlar
  }

  function kalanYaz(t) {
    if (!t) return "Admin kapatana kadar açık";
    const s = Math.round((t - Date.now()) / 1000);
    if (s <= 0) return "Bahisler kapandı, sonuç bekleniyor";
    if (s < 3600) return "⏳ " + Math.ceil(s / 60) + " dk kaldı";
    if (s < 86400) return "⏳ " + Math.floor(s / 3600) + " sa " + Math.round((s % 3600) / 60) + " dk kaldı";
    return "⏳ " + Math.floor(s / 86400) + " gün " + Math.floor((s % 86400) / 3600) + " sa kaldı";
  }

  function ciz() {
    const acik = tahminler.filter((t) => t.durum === "acik" || t.durum === "kapali").sort((a, b) => (b.olusturma || 0) - (a.olusturma || 0));
    const biten = tahminler.filter((t) => t.durum === "sonuclandi" || t.durum === "iptal").sort((a, b) => (b.bitis || 0) - (a.bitis || 0)).slice(0, 20);
    const A = $("tmAcik"); A.textContent = "";
    if (!acik.length) A.append(el("p", "card muted tm-bos", "Şu an açık tahmin yok. Admin yeni bir iddia açınca burada görünür."));
    acik.forEach((t) => A.append(kart(t, false)));
    const B = $("tmBiten"); B.textContent = "";
    if (!biten.length) B.append(el("p", "muted", "Henüz biten tahmin yok."));
    biten.forEach((t) => B.append(kart(t, true)));
  }

  function kart(t, bitti) {
    const k = el("article", "card tm-kart" + (bitti ? " tm-bitti" : ""));
    const ust = el("div", "tm-ust");
    ust.append(el("h3", null, t.soru));
    const etiket = t.durum === "acik" && (!t.kapanis || t.kapanis > Date.now()) ? kalanYaz(t.kapanis) : t.durum === "iptal" ? "↩️ İptal edildi, herkese iade" : t.durum === "sonuclandi" ? (t.iade ? "Kimse bilemedi, iade edildi" : "✅ Sonuçlandı") : "🔒 Bahisler kapandı, sonuç bekleniyor";
    ust.append(el("span", "tm-etiket", etiket));
    k.append(ust);
    k.append(el("p", "muted tm-havuz", "Havuz: " + para(t.havuz || 0) + " BERKAY"));

    const acikMi = t.durum === "acik" && (!t.kapanis || t.kapanis > Date.now());
    const benimBahis = bahisler.filter((b) => b.tahminId === t.id && b.uid === profile.uid);
    const liste = el("div", "tm-secenekler");
    t.secenekler.forEach((s, i) => {
      const oran = t.havuz ? (s.toplam || 0) / t.havuz : 0;
      const satir = el("div", "tm-secenek" + (bitti && t.kazanan === i && !t.iade ? " is-kazanan" : ""));
      const bar = el("i", "tm-bar"); bar.style.width = (oran * 100).toFixed(1) + "%"; satir.append(bar);
      const sol = el("div", "tm-sol");
      sol.append(el("b", null, (bitti && t.kazanan === i && !t.iade ? "🏆 " : "") + s.ad));
      sol.append(el("small", "muted", `${para(s.toplam || 0)} BERKAY · ${s.kisi || 0} kişi · %${(oran * 100).toFixed(0)}`));
      satir.append(sol);
      const kat = s.toplam ? (t.havuz / s.toplam) : 0;
      if (kat) satir.append(el("span", "tm-kat", "×" + kat.toFixed(2)));
      const benimki = benimBahis.filter((b) => b.secenek === i).reduce((x, b) => x + b.miktar, 0);
      if (benimki) satir.append(el("span", "tm-benim", "Sen: " + para(benimki, 0)));
      if (acikMi) {
        const form = el("div", "tm-form");
        const inp = el("input"); inp.type = "number"; inp.min = "1"; inp.step = "1"; inp.placeholder = "BERKAY"; inp.inputMode = "numeric";
        const tahminKazanc = el("small", "muted tm-kazanc");
        inp.addEventListener("input", () => {
          const m = Number(inp.value);
          tahminKazanc.textContent = m > 0 ? "Bilirsen ≈ " + para((m / ((s.toplam || 0) + m)) * ((t.havuz || 0) + m)) + " BERKAY" : "";
        });
        const btn = el("button", "btn se-small", "Yatır");
        btn.type = "button";
        btn.addEventListener("click", async () => {
          const m = Number(inp.value);
          if (!(m >= 1)) { Ekonomi.toast("En az 1 BERKAY yaz."); return; }
          btn.disabled = true;
          try { const r = await Ekonomi.api("tahminBahis", { id: t.id, secenek: i, miktar: m }); Ekonomi.toast("🎲 " + r.mesaj); inp.value = ""; tahminKazanc.textContent = ""; }
          catch (err) { Ekonomi.toast("⚠️ " + err.message); }
          finally { btn.disabled = false; }
        });
        form.append(inp, btn, tahminKazanc);
        satir.append(form);
      }
      liste.append(satir);
    });
    k.append(liste);

    // Kim neye yatırdı
    const yatiranlar = bahisler.filter((b) => b.tahminId === t.id).sort((a, b) => b.miktar - a.miktar);
    if (yatiranlar.length) {
      const d = el("details", "tm-kimler");
      d.append(el("summary", null, `👥 ${new Set(yatiranlar.map((b) => b.uid)).size} kişi yatırdı`));
      yatiranlar.forEach((b) => {
        const r = el("div", "bx-satir");
        r.append(Ekonomi.isim(b.ad, undefined, { unvan: false }), el("span", null, "→ " + (t.secenekler[b.secenek] ? t.secenekler[b.secenek].ad : "?")), el("span", "bx-sag", para(b.miktar) + " BERKAY"));
        if (bitti && b.odenen != null) r.append(el("span", b.sonuc === "kazandi" ? "yukari" : b.sonuc === "kaybetti" ? "asagi" : "muted", b.sonuc === "kazandi" ? "+" + para(b.odenen) : b.sonuc === "kaybetti" ? "−" + para(b.miktar) : "iade"));
        d.append(r);
      });
      k.append(d);
    }
    if (bitti && benimBahis.length) {
      const yat = benimBahis.reduce((x, b) => x + b.miktar, 0), al = benimBahis.reduce((x, b) => x + (b.odenen || 0), 0);
      const net = al - yat;
      k.append(el("p", "tm-sonuc " + (net > 0 ? "yukari" : net < 0 ? "asagi" : "muted"), net > 0 ? `🤑 Bildin! +${para(net)} BERKAY kâr` : net < 0 ? `💸 Bilemedin, ${para(-net)} BERKAY gitti` : "↩️ Paran iade edildi"));
    }
    return k;
  }
})();
