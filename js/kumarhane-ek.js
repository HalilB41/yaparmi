// ============================================================
// kumarhane-ek.js — kumarhane.html: Canlı Rulet, Berkay Slotu, Haftalık Turnuva.
// Sonuçlar sunucuda (api/borsa.js); rulet sonucu turun numarasından gizli anahtarla çıkar,
// bahisler kapanmadan kimse (sunucu cevabı dahil) bilemez.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const para = (x, k = 2) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  const tam = (x) => para(x, 0);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const yavas = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof db === "undefined" || !db) return;
  function durumYaz(id, msg, hata) { const e = $(id); e.textContent = msg || ""; e.className = "bx-durum" + (hata ? " hata" : ""); }

  let profile = null, cuzdan = null, basladi = false;
  const acik = (ad) => { const b = $(ad); return b && !b.hidden; };
  window.YaparmiAuth.onChange((p) => {
    profile = p;
    if (p && !basladi) {
      basladi = true;
      Ekonomi.cuzdanim((c) => { cuzdan = c; ruletCuzdandan(c); });
      Ekonomi.ozet((o) => { if (o && o.jackpot && !slotJp) jackpotYaz(o.jackpot, o.sonJackpot); });
    }
    if (acik("turnuva")) turnuvaYukle();
  });
  window.addEventListener("km-sekme", (e) => {
    if (e.detail === "rulet") ruletBasla();
    if (e.detail === "turnuva") turnuvaYukle();
    if (e.detail === "slot") slotTabloCiz();
  });

  // =====================================================================
  // RULET
  // =====================================================================
  const CARK = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const KIRMIZI = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const renk = (n) => (n === 0 ? "yesil" : KIRMIZI.has(n) ? "kirmizi" : "siyah");
  let AYAR = { TUR_MS: 30000, BAHIS_MS: 20000, DONUS_MS: 6000, MAX: 500 };
  let fark = 0, ruAktif = false, sonFaz = null, sonTur = null, turSonuc = null, gecmis = [];
  let fis = 10;
  let bekleyen = {}; // gönderilmemiş fişler: "tip:deger" → miktar
  let gonderilen = {}; // bu turda sunucuya giden
  let sonBahis = null; // "tekrarla" için
  let gonderZaman = null, gonderiyor = false;
  const simdi = () => Date.now() + fark;
  function an() {
    const t = simdi(), tur = Math.floor(t / AYAR.TUR_MS), gecen = t - tur * AYAR.TUR_MS;
    return { tur, gecen, faz: gecen < AYAR.BAHIS_MS ? "bahis" : gecen < AYAR.BAHIS_MS + AYAR.DONUS_MS ? "donus" : "sonuc" };
  }

  // --- Masa ---
  const hucre = {};
  function masaKur() {
    const m = $("ruMasa"); m.textContent = "";
    const sayilar = el("div", "km-ru-sayilar");
    const sifir = el("button", "km-ru-h yesil sifir", "0"); sifir.type = "button"; sifir.title = "Berkay sıfırı 🐴 (36x)";
    sifir.dataset.k = "sayi:0"; sayilar.append(sifir); hucre["sayi:0"] = sifir;
    for (let n = 1; n <= 36; n++) {
      const b = el("button", "km-ru-h " + renk(n), String(n)); b.type = "button"; b.dataset.k = "sayi:" + n; b.title = `${n} (36x)`;
      sayilar.append(b); hucre["sayi:" + n] = b;
    }
    const dis = el("div", "km-ru-dis");
    [["duzine:1", "1. 12"], ["duzine:2", "2. 12"], ["duzine:3", "3. 12"], ["yarim:1", "1–18"], ["tekcift:cift", "Çift"], ["renk:kirmizi", "🔴"], ["renk:siyah", "⚫"], ["tekcift:tek", "Tek"], ["yarim:2", "19–36"]]
      .forEach(([k, y]) => { const b = el("button", "km-ru-h dis " + k.replace(":", "-"), y); b.type = "button"; b.dataset.k = k; b.title = k.startsWith("duzine") ? "3x" : "2x"; dis.append(b); hucre[k] = b; });
    m.append(sayilar, dis);
    m.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) fisKoy(b.dataset.k); });
    m.addEventListener("contextmenu", (e) => { const b = e.target.closest("[data-k]"); if (b && bekleyen[b.dataset.k]) { e.preventDefault(); delete bekleyen[b.dataset.k]; masaCiz(); } });
    const f = $("ruFisler"); f.textContent = "";
    [1, 5, 10, 25, 50, 100, 500, 1000, 5000].forEach((v) => {
      const b = el("button", "km-fis f" + v + (v === fis ? " on" : ""), String(v)); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(v === fis));
      b.addEventListener("click", () => { fis = v; [...f.children].forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); }); });
      f.append(b);
    });
  }
  const toplamOf = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  function fisKoy(k) {
    if (!profile) { durumYaz("ruDurum", "Oynamak için giriş yap.", true); return; }
    if (an().faz !== "bahis") { durumYaz("ruDurum", "Bahisler kapandı, sonraki turu bekle.", true); return; }
    
    if (cuzdan && toplamOf(bekleyen) + fis > (cuzdan.bkc || 0) + 1e-9) { durumYaz("ruDurum", "Yeterli BERKAY'ın yok.", true); return; }
    bekleyen[k] = (bekleyen[k] || 0) + fis;
    masaCiz();
    durumYaz("ruDurum", "");
    clearTimeout(gonderZaman); gonderZaman = setTimeout(gonder, 700);
  }
  async function gonder() {
    if (gonderiyor || !Object.keys(bekleyen).length) return;
    if (an().faz !== "bahis") { bekleyen = {}; masaCiz(); durumYaz("ruDurum", "Bahisler kapandı, fişler gönderilemedi.", true); return; }
    const giden = bekleyen; bekleyen = {};
    const bahisler = Object.entries(giden).map(([k, miktar]) => { const [tip, deger] = k.split(":"); return { tip, deger, miktar }; });
    gonderiyor = true; masaCiz();
    try {
      const r = await Ekonomi.api("ruletBahis", { bahisler });
      if (r.kapanan) kapananGoster(r.kapanan);
      gonderilen = {};
      (r.rulet && r.rulet.bahisler || []).forEach((b) => { gonderilen[b.tip + ":" + b.deger] = b.miktar; });
      sonBahis = { ...gonderilen };
      durumYaz("ruDurum", `✅ Bahis alındı · masada ${tam(toplamOf(gonderilen))} BERKAY`);
    } catch (err) {
      for (const [k, v] of Object.entries(giden)) bekleyen[k] = (bekleyen[k] || 0) + v; // geri koy
      if (an().faz !== "bahis") bekleyen = {};
      durumYaz("ruDurum", "⚠️ " + err.message, true);
    } finally { gonderiyor = false; masaCiz(); if (Object.keys(bekleyen).length && an().faz === "bahis") { clearTimeout(gonderZaman); gonderZaman = setTimeout(gonder, 300); } }
  }
  function masaCiz() {
    for (const [k, b] of Object.entries(hucre)) {
      const g = gonderilen[k] || 0, bk = bekleyen[k] || 0;
      let f = b.querySelector(".km-ru-fis");
      if (g + bk) {
        if (!f) { f = el("span", "km-ru-fis"); b.append(f); }
        f.textContent = tam(g + bk); f.classList.toggle("bekliyor", !!bk);
      } else if (f) f.remove();
    }
    $("ruToplam").textContent = tam(toplamOf(gonderilen) + toplamOf(bekleyen)) + (Object.keys(bekleyen).length ? (gonderiyor ? " (gönderiliyor…)" : " (gönderilecek)") : "");
    const bahisFaz = an().faz === "bahis";
    $("ruMasa").classList.toggle("kapali", !bahisFaz);
    $("ruTekrar").disabled = !bahisFaz || !sonBahis || toplamOf(gonderilen) > 0;
    $("ruTemizle").disabled = !Object.keys(bekleyen).length;
  }
  $("ruTemizle").addEventListener("click", () => { bekleyen = {}; clearTimeout(gonderZaman); masaCiz(); });
  $("ruTekrar").addEventListener("click", () => {
    if (!sonBahis) return;
    for (const [k, v] of Object.entries(sonBahis)) bekleyen[k] = (bekleyen[k] || 0) + v;
    masaCiz(); clearTimeout(gonderZaman); gonderZaman = setTimeout(gonder, 200);
  });

  // --- Çark ---
  const cv = $("ruTuval"), ctx = cv.getContext("2d");
  let aci = 0, hedefAci = null, donusBas = 0, donusBasAci = 0;
  function tuvalBoyut() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width) return;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * dpr);
    carkCiz();
  }
  window.addEventListener("resize", () => { if (acik("rulet")) tuvalBoyut(); });
  function carkCiz() {
    const W = cv.width, R = W / 2;
    if (!W) return;
    ctx.clearRect(0, 0, W, W);
    ctx.save(); ctx.translate(R, R); ctx.rotate(aci);
    const dil = (Math.PI * 2) / CARK.length;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.99, 0, Math.PI * 2); ctx.fillStyle = "#5c3a1e"; ctx.fill();
    CARK.forEach((n, i) => {
      const a0 = -Math.PI / 2 + i * dil - dil / 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.92, a0, a0 + dil); ctx.closePath();
      ctx.fillStyle = n === 0 ? "#15803d" : KIRMIZI.has(n) ? "#c62828" : "#16161d"; ctx.fill();
      ctx.strokeStyle = "rgba(255,215,140,.45)"; ctx.lineWidth = Math.max(1, W / 400); ctx.stroke();
      ctx.save(); ctx.rotate(a0 + dil / 2 + Math.PI / 2);
      ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(R * 0.085)}px "JetBrains Mono", monospace`; ctx.textAlign = "center";
      ctx.fillText(n === 0 ? "B" : String(n), 0, -R * 0.78);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.fillStyle = "#3d2614"; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.56, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 0.56); g.addColorStop(0, "#d4a24c"); g.addColorStop(1, "#7a4f1d");
    ctx.fillStyle = g; ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = "#e8c77a"; ctx.fillRect(-R * 0.02, -R * 0.5, R * 0.04, R * 0.32); }
    ctx.restore();
    topCiz(R);
  }

  // --- Top ---
  // Beklerken son çıkan sayının cebinde çarkla birlikte döner; çark dönünce ters yöne fırlar,
  // yavaşlar, iç kenara sekip kazanan cebe düşer (o cep o an tam okun altındadır).
  const DIL = (Math.PI * 2) / CARK.length;
  const PIST = 0.955, CEP = 0.865;
  let topSayi = null, topDonus = null;
  const cepAcisi = (n) => aci - Math.PI / 2 + CARK.indexOf(n) * DIL; // cebin ekrandaki açısı
  function topKonum() {
    if (topDonus) {
      const p = Math.min(1, (performance.now() - donusBas) / (AYAR.DONUS_MS - 600));
      const e = 1 - Math.pow(1 - p, 2.4);
      let a = topDonus.bas + (topDonus.son - topDonus.bas) * e;
      // yarıçap: pistte döner → iç kenara sekerek iner → cepte durur
      let r = PIST;
      if (p > 0.6) {
        const q = Math.min(1, (p - 0.6) / 0.3);
        r = PIST - (PIST - CEP) * q + Math.abs(Math.sin(q * Math.PI * 3)) * (1 - q) * 0.05;
      }
      if (p > 0.78) { // son kısımda cebin içine otur
        let cep = cepAcisi(turSonuc);
        cep += 2 * Math.PI * Math.round((a - cep) / (2 * Math.PI));
        const t = Math.min(1, (p - 0.78) / 0.22), y = t * t * (3 - 2 * t);
        a += (cep - a) * y;
      }
      return { a, r };
    }
    if (topSayi == null) return null;
    return { a: cepAcisi(topSayi), r: CEP };
  }
  function topCiz(R) {
    const k = topKonum();
    if (!k) return;
    const x = R + Math.cos(k.a) * k.r * R, y = R + Math.sin(k.a) * k.r * R, rr = R * 0.042;
    ctx.save();
    ctx.beginPath(); ctx.arc(x + rr * 0.25, y + rr * 0.35, rr, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
    const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.35, rr * 0.1, x, y, rr);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.6, "#e9e9ef"); g.addColorStop(1, "#9a9aa6");
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }
  // sayı n'nin cebi üstteki oka gelecek açı
  const sayiAcisi = (n) => -CARK.indexOf(n) * ((Math.PI * 2) / CARK.length);
  function donusBaslat(n) {
    turSonuc = n;
    const hedef = sayiAcisi(n);
    let h = hedef - 2 * Math.PI * 6; // en az 6 tur (saat yönünün tersine)
    while (h > aci - 2 * Math.PI * 5) h -= 2 * Math.PI;
    hedefAci = h; donusBas = performance.now(); donusBasAci = aci;
    // top: şu anki yerinden saat yönünde ~7 tur atıp okun altına (−90°) gelir
    const simdiki = topSayi != null ? cepAcisi(topSayi) : -Math.PI / 2;
    const son = -Math.PI / 2 + 2 * Math.PI * Math.ceil((simdiki + 2 * Math.PI * 7 + Math.PI / 2) / (2 * Math.PI));
    topDonus = { bas: simdiki, son };
  }

  // --- Döngü ---
  let ruIstek = 0;
  async function durumCek() {
    try {
      const t0 = Date.now();
      const r = await fetch("/api/borsa?islem=ruletDurum", { cache: "no-store" }).then((x) => x.json());
      if (!r.ok) return null;
      const rtt = Date.now() - t0;
      fark = r.sunucu + rtt / 2 - Date.now();
      AYAR = Object.assign(AYAR, r.ayar || {});
      gecmis = r.gecmis || [];
      if (topSayi == null && gecmis[0]) topSayi = gecmis[0].sonuc; // top son çıkan sayının cebinde başlar
      gecmisCiz();
      return r;
    } catch { return null; }
  }
  function gecmisCiz() {
    const g = $("ruGecmis"); g.textContent = "";
    gecmis.slice(0, 12).forEach((x) => g.append(el("span", "km-ru-top " + renk(x.sonuc), x.sonuc === 0 ? "B" : String(x.sonuc))));
  }
  async function ruletBasla() {
    tuvalBoyut();
    if (ruAktif) return;
    ruAktif = true;
    if (!Object.keys(hucre).length) masaKur();
    await durumCek();
    masaCiz();
    requestAnimationFrame(dongu);
  }
  function dongu(ts) {
    if (!acik("rulet")) { ruAktif = false; return; }
    requestAnimationFrame(dongu);
    const a = an();
    // faz değişimleri
    if (a.tur !== sonTur) {
      sonTur = a.tur; turSonuc = null; hedefAci = null;
      if (Object.keys(gonderilen).length) { gonderilen = {}; }
      masaCiz(); $("ruSonuc").textContent = "?"; $("ruSonuc").className = "km-rulet-merkez";
      Object.values(hucre).forEach((b) => b.classList.remove("kazanan"));
    }
    if (a.faz !== sonFaz) {
      const once = sonFaz; sonFaz = a.faz;
      masaCiz();
      if (a.faz === "donus" || (a.faz === "sonuc" && turSonuc == null)) {
        if (Object.keys(bekleyen).length) { bekleyen = {}; masaCiz(); durumYaz("ruDurum", "Bahisler kapandı, son fişlerin gönderilemedi.", true); }
        const istek = ++ruIstek;
        setTimeout(async () => {
          const r = await durumCek();
          if (istek !== ruIstek || !r || r.sonuc == null) return;
          if (a.faz === "donus" && !yavas) donusBaslat(r.sonuc); else { turSonuc = r.sonuc; topSayi = r.sonuc; aci = sayiAcisi(r.sonuc); sonucGoster(); }
        }, 350);
      }
      if (a.faz === "sonuc" && once === "donus" && turSonuc != null) sonucGoster();
    }
    // çark açısı
    if (hedefAci != null) {
      const p = Math.min(1, (performance.now() - donusBas) / (AYAR.DONUS_MS - 600));
      const e = 1 - Math.pow(1 - p, 4);
      aci = donusBasAci + (hedefAci - donusBasAci) * e;
      if (p >= 1) { hedefAci = null; topDonus = null; topSayi = turSonuc; aci = sayiAcisi(turSonuc); if (an().faz !== "bahis") sonucGoster(); }
    } else if (a.faz === "bahis" && !yavas) aci -= 0.0025;
    carkCiz();
    // sayaç
    const fazBas = a.faz === "bahis" ? 0 : a.faz === "donus" ? AYAR.BAHIS_MS : AYAR.BAHIS_MS + AYAR.DONUS_MS;
    const fazSure = a.faz === "bahis" ? AYAR.BAHIS_MS : a.faz === "donus" ? AYAR.DONUS_MS : AYAR.TUR_MS - AYAR.BAHIS_MS - AYAR.DONUS_MS;
    const kalan = Math.max(0, (fazBas + fazSure - a.gecen) / 1000);
    $("ruBar").style.width = (100 * (1 - (a.gecen - fazBas) / fazSure)).toFixed(1) + "%";
    const faz = $("ruFaz");
    const yazi = a.faz === "bahis" ? `🟢 Bahisler açık · ${Math.ceil(kalan)} sn` : a.faz === "donus" ? "🌀 Çark dönüyor…" : `Sonraki tur ${Math.ceil(kalan)} sn`;
    if (faz.textContent !== yazi) { faz.textContent = yazi; faz.dataset.faz = a.faz; }
  }
  let gosterilenTur = null;
  async function sonucGoster() {
    if (turSonuc == null || gosterilenTur === sonTur) return;
    gosterilenTur = sonTur;
    const n = turSonuc, m = $("ruSonuc");
    m.textContent = n === 0 ? "B" : String(n); m.className = "km-rulet-merkez " + renk(n);
    const kazananlar = [ "sayi:" + n ];
    if (n) kazananlar.push("renk:" + (KIRMIZI.has(n) ? "kirmizi" : "siyah"), "tekcift:" + (n % 2 ? "tek" : "cift"), "yarim:" + (n <= 18 ? "1" : "2"), "duzine:" + Math.ceil(n / 12));
    kazananlar.forEach((k) => hucre[k] && hucre[k].classList.add("kazanan"));
    if (Object.keys(gonderilen).length) {
      try {
        const r = await Ekonomi.api("ruletTopla");
        if (r.kapanan) kapananGoster(r.kapanan);
      } catch (err) { durumYaz("ruDurum", "⚠️ " + err.message, true); }
    } else durumYaz("ruDurum", n === 0 ? "🐴 Berkay sıfırı! Kasa güldü." : `Çıkan: ${n} ${KIRMIZI.has(n) ? "🔴" : "⚫"}`);
  }
  function kapananGoster(k) {
    const kar = k.odeme - k.bahis;
    durumYaz("ruDurum", `${k.sonuc === 0 ? "🐴 Berkay sıfırı" : "Çıkan " + k.sonuc} · ${k.bahis} yatırdın, ${k.odeme > 0 ? "+" + para(k.odeme) + " geldi" : "kaybettin"}${kar > 0 ? " 🤑" : ""}`);
    if (k.odeme > 0) Ekonomi.toast(`🎡 Rulet · +${para(k.odeme)} BERKAY`, 3500);
  }
  function ruletCuzdandan(c) {
    // Sayfa yenilenince bu turdaki bahsi masada göster; eski açık bahis kaldıysa topla
    const r = c && c.rulet;
    if (!r || r.durum !== "acik") return;
    const a = an();
    if (r.tur === a.tur && a.faz === "bahis") {
      gonderilen = {}; r.bahisler.forEach((b) => { gonderilen[b.tip + ":" + b.deger] = b.miktar; });
      if (Object.keys(hucre).length) masaCiz();
    } else if (r.tur < a.tur && !ruletCuzdandan.topluyor) {
      ruletCuzdandan.topluyor = true;
      Ekonomi.api("ruletTopla").then((x) => { if (x.kapanan) { kapananGoster(x.kapanan); } }).catch(() => {}).finally(() => { ruletCuzdandan.topluyor = false; });
    }
  }

  // =====================================================================
  // SLOT
  // =====================================================================
  const SEMBOL = { kiraz: "🍒", limon: "🍋", burger: "🍔", at: "🐴", para: "💰", yedi: "7️⃣", berkay: "B" };
  const SIRA = Object.keys(SEMBOL);
  const SOZ = {
    kayip: ["Berkay: “Kasa her zaman kazanır. Kasa benim.”", "Berkay: “Bir daha çevir, bu sefer kesin.”", "Berkay: “Paran için teşekkürler 🙏”", "Berkay: “Makinede hile yok… galiba.”", "Berkay: “Az kaldı, hissediyorum.”", "Berkay: “Bu parayla burger alırdın.”"],
    az: ["Berkay: “Paranın bir kısmı döndü, sevin.”", "Berkay: “Bu kazanç sayılmaz ama tamam.”"],
    kazanc: ["Berkay: “Şans bugün senden yana, yarın benden.”", "Berkay: “Hile mi yaptın sen?”", "Berkay kıskançlıktan çatladı."],
    buyuk: ["Berkay: “Bu nasıl olur?! Kasayı kapatın!”", "Berkay: “Ben de oynayabilir miyim?”"],
    jackpot: ["Berkay: “JACKPOT?! Hayır hayır hayır…”"],
  };
  const sec = (l) => l[Math.floor(Math.random() * l.length)];
  function sembolEl(s) {
    const e = el("div", "km-sembol" + (s === "berkay" ? " berkay" : ""));
    if (s === "berkay") e.append(el("b", null, "B"), el("small", null, "BERKAY")); else e.textContent = SEMBOL[s];
    return e;
  }
  const seritler = [$("slM0"), $("slM1"), $("slM2")];
  seritler.forEach((s, i) => { s.append(sembolEl(SIRA[(i * 2) % 7])); });
  let slotJp = null, slotMesgul = false;
  function jackpotYaz(jp, son) {
    slotJp = jp;
    $("slJackpot").textContent = para(jp);
    if (son && son.ad) $("slSonJp").textContent = `Son jackpot: ${son.ad} · ${tam(son.miktar)} BERKAY`;
  }
  let tabloCizildi = false;
  function slotTabloCiz() {
    if (tabloCizildi) return; tabloCizildi = true;
    const t = $("slTablo");
    const satir = (semboller, yazi) => { const r = el("div", "km-slot-satir"); const s = el("span", "km-slot-ufak"); semboller.forEach((x) => s.append(sembolEl(x))); r.append(s, el("b", null, yazi)); t.append(r); };
    satir(["berkay", "berkay", "berkay"], "JACKPOT");
    [["yedi", 250], ["para", 80], ["at", 30], ["burger", 18], ["limon", 10], ["kiraz", 6]].forEach(([x, k]) => satir([x, x, x], k + "x"));
    satir(["berkay", "berkay"], "15x (herhangi ikisi)");
    satir(["kiraz", "kiraz"], "1.8x (herhangi ikisi)");
    satir(["berkay"], "0.5x (tek Berkay)");
    t.append(el("p", "muted km-not", "Her çevirmenin %2'si jackpota eklenir. Ortalama geri ödeme ≈ %96 (jackpot dahil)."));
  }
  async function cevir() {
    if (slotMesgul) return;
    if (!profile) { durumYaz("slDurum", "Oynamak için giriş yap.", true); return; }
    const m = Math.round(Number($("slMiktar").value || 5));
    if (!(m >= 1)) { durumYaz("slDurum", "Bahis en az 1 BERKAY.", true); return; }
    slotMesgul = true; $("slBtn").disabled = true; durumYaz("slDurum", "");
    // sonucu beklerken makaralar dönmeye başlasın
    seritler.forEach((s) => { s.parentElement.classList.add("donuyor"); });
    let r;
    try { r = await Ekonomi.api("slot", { miktar: m }); }
    catch (err) {
      seritler.forEach((s) => s.parentElement.classList.remove("donuyor"));
      durumYaz("slDurum", "⚠️ " + err.message, true); slotMesgul = false; $("slBtn").disabled = false; return;
    }
    await Promise.all(r.semboller.map((s, i) => makaraDurdur(seritler[i], s, yavas ? 0 : 500 + i * 450)));
    jackpotYaz(r.jackpot, r.jackpotKazandi ? { ad: profile.kullaniciAdi, miktar: r.jackpotKazandi } : null);
    const makine = document.querySelector(".km-slot-makine");
    makine.classList.remove("kazandi", "jackpot"); void makine.offsetWidth;
    if (r.jackpotKazandi) {
      makine.classList.add("jackpot");
      $("slSoz").textContent = sec(SOZ.jackpot);
      durumYaz("slDurum", `💰💰💰 JACKPOT! +${para(r.jackpotKazandi)} BERKAY`);
      Ekonomi.toast(`🎰 JACKPOT! +${para(r.jackpotKazandi)} BERKAY`, 8000);
    } else if (r.odeme > 0) {
      if (r.carpan >= 1) makine.classList.add("kazandi");
      $("slSoz").textContent = sec(r.carpan >= 15 ? SOZ.buyuk : r.carpan >= 1.5 ? SOZ.kazanc : SOZ.az);
      durumYaz("slDurum", `${r.ad} · ${r.carpan}x · +${para(r.odeme)} BERKAY`);
    } else {
      $("slSoz").textContent = sec(SOZ.kayip);
      durumYaz("slDurum", `Olmadı · −${m} BERKAY`);
    }
    slotMesgul = false; $("slBtn").disabled = false;
  }
  function makaraDurdur(serit, sonuc, bekle) {
    return new Promise((coz) => {
      setTimeout(() => {
        const mak = serit.parentElement;
        mak.classList.remove("donuyor");
        if (yavas) { serit.textContent = ""; serit.append(sembolEl(sonuc)); serit.style.transform = ""; return coz(); }
        // sonuç en altta olacak şekilde 14 sembollük şerit, yukarıdan aşağı kayar
        serit.style.transition = "none"; serit.textContent = "";
        serit.append(sembolEl(sonuc));
        for (let i = 0; i < 13; i++) serit.append(sembolEl(SIRA[Math.floor(Math.random() * 7)]));
        const h = mak.clientHeight;
        serit.style.transform = `translateY(${-13 * h}px)`;
        void serit.offsetWidth;
        serit.style.transition = "transform .7s cubic-bezier(.2,.9,.25,1.12)";
        serit.style.transform = "translateY(0)";
        setTimeout(() => { serit.style.transition = "none"; while (serit.children.length > 1) serit.lastChild.remove(); coz(); }, 720);
      }, bekle);
    });
  }
  $("slBtn").addEventListener("click", cevir);
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || !acik("slot") || /INPUT|TEXTAREA|BUTTON/.test(document.activeElement && document.activeElement.tagName)) return;
    e.preventDefault(); cevir();
  });

  // =====================================================================
  // TURNUVA
  // =====================================================================
  const OYUN_AD = { boks: "🥊 Boks makinesi", penalti: "⚽ Penaltı", motor: "🏍️ Kasksız 85" };
  const OYUN_LINK = { boks: "/spor#boks", penalti: "/spor#penalti", motor: "/spor#motor" };
  let tu = null, tuYukleniyor = false, tuZaman = null;
  async function turnuvaYukle() {
    if (!profile) { $("tuUst").innerHTML = '<p class="muted">Turnuvayı görmek için giriş yap.</p>'; return; }
    if (tuYukleniyor) return;
    tuYukleniyor = true;
    try { tu = await Ekonomi.api("turnuvaDurum"); turnuvaCiz(); }
    catch (err) { durumYaz("tuDurum", "⚠️ " + err.message, true); }
    finally { tuYukleniyor = false; }
    clearTimeout(tuZaman);
    tuZaman = setTimeout(() => { if (acik("turnuva")) turnuvaYukle(); }, 60_000);
  }
  function kalanYazi(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), g = Math.floor(s / 86400), sa = Math.floor((s % 86400) / 3600), dk = Math.floor((s % 3600) / 60);
    return g ? `${g} gün ${sa} saat` : sa ? `${sa} saat ${dk} dk` : `${dk} dk`;
  }
  function turnuvaCiz() {
    if (!tu) return;
    try { if (tu.ben) localStorage.setItem("yaparmi_turnuva", tu.k + "|" + tu.oyun); } catch { /* yok */ }
    const ust = $("tuUst"); ust.textContent = "";
    const kutu = el("div", "km-tu-ust");
    const sol = el("div", "km-tu-oyun");
    sol.append(el("small", null, "BU HAFTANIN OYUNU"), el("b", null, OYUN_AD[tu.oyun] || tu.oyun), el("small", "muted", "Bitişe " + kalanYazi(tu.bitis - Date.now())));
    const sag = el("div", "km-tu-havuz");
    const bonus = tu.kisi >= 3 ? tu.bonus : 0;
    sag.append(el("small", null, "ÖDÜL HAVUZU"), el("b", null, tam(tu.havuz + bonus)), el("small", "muted", `${tu.kisi} kişi${tu.kisi >= 3 ? ` · +${tu.bonus} kasa bonusu dahil` : ` · 3 kişi olunca +${tu.bonus} bonus`}`));
    kutu.append(sol, sag);
    ust.append(kutu);
    if (tu.ben) {
      const b = el("div", "km-tu-ben");
      b.append(el("span", null, "Sen:"), el("b", null, `${tu.ben.sira}. sıra`), el("span", "muted", `en iyi skor ${tam(tu.ben.skor)}`));
      const pay = tu.ben.sira <= 3 && tu.ben.skor > 0 ? Math.floor((tu.havuz + bonus) * tu.pay[tu.ben.sira - 1]) : 0;
      if (pay) b.append(el("span", "km-tu-pay", `şu an ≈ +${tam(pay)} BERKAY`));
      ust.append(b);
    }
    $("tuKatil").hidden = !!tu.ben; $("tuKatil").textContent = `🎟️ Katıl · ${tu.giris} BERKAY`;
    $("tuOyna").hidden = !tu.ben; $("tuOyna").href = OYUN_LINK[tu.oyun] || "/spor"; $("tuOyna").textContent = `🎮 ${OYUN_AD[tu.oyun] || ""} · oyna →`;
    // liste
    const l = $("tuListe"); l.textContent = "";
    if (!tu.liste.length) l.append(el("p", "muted", "Henüz kimse katılmadı. İlk sen ol!"));
    else {
      const ol = el("ol", "km-tu-liste");
      tu.liste.forEach((x, i) => {
        const li = el("li", i < 3 ? "ilk" + (i + 1) : null);
        li.append(el("span", "km-tu-sira", ["🥇", "🥈", "🥉"][i] || String(i + 1)), Ekonomi.isim(x.ad), el("b", null, x.skor ? tam(x.skor) : "—"));
        if (profile && x.ad === profile.kullaniciAdi) li.classList.add("ben");
        ol.append(li);
      });
      l.append(ol);
    }
    const g = $("tuGecen"); g.textContent = "";
    if (tu.gecen && tu.gecen.kazananlar && tu.gecen.kazananlar.length) {
      g.append(el("h3", null, `Geçen hafta (${OYUN_AD[tu.gecen.oyun] || tu.gecen.oyun})${tu.gecen.odendi ? "" : " · ödül dağıtılıyor…"}`));
      const ul = el("div", "km-tu-gecen");
      tu.gecen.kazananlar.forEach((x, i) => { const r = el("div"); r.append(el("span", null, ["🥇", "🥈", "🥉"][i]), Ekonomi.isim(x.ad), el("small", "muted", `${tam(x.skor)} · +${tam(x.odul)}`)); ul.append(r); });
      g.append(ul);
    }
  }
  $("tuKatil").addEventListener("click", async () => {
    if (!tu) return;
    if (!confirm(`${OYUN_AD[tu.oyun]} turnuvasına ${tu.giris} BERKAY'a katılıyorsun. Hafta sonuna kadar en iyi skorun sayılır. Tamam mı?`)) return;
    $("tuKatil").disabled = true;
    try {
      await Ekonomi.api("turnuvaKatil");
      try { localStorage.setItem("yaparmi_turnuva", tu.k + "|" + tu.oyun); } catch { /* yok */ }
      durumYaz("tuDurum", `✅ Katıldın! Şimdi ${OYUN_AD[tu.oyun]} oyna, en iyi skorun otomatik kaydedilir.`);
      Ekonomi.toast("🏆 Turnuvaya katıldın!", 3500);
      await turnuvaYukle();
    } catch (err) { durumYaz("tuDurum", "⚠️ " + err.message, true); }
    finally { $("tuKatil").disabled = false; }
  });

  // Sayfa açılışında sekme zaten açıksa
  if (acik("rulet")) ruletBasla();
  if (acik("slot")) slotTabloCiz();
})();
