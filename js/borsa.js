// ============================================================
// borsa.js — sadece borsa.html: çok coinli borsa (kullanıcı tarafı).
// Üstte DexScreener gibi coin listesi + arama; seçili coinin grafiği ve işlem paneli altta.
// Her para işlemi /api/borsa üzerinden SUNUCUDA yapılır; burası sadece
// gösterir ve tahmin hesaplar. Veri yapısı için bkz. api/borsa.js başı.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const E = window.BorsaEgri;
  const api = window.BorsaApi;
  const sayi = window.BorsaSayi;
  const BC = window.BorsaCoin;
  const para = (x, k = 2) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  const isaretli = (x, k = 2) => (x >= 0 ? "+" : "") + para(x, k);
  const kacOnce = (t) => {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return s + " sn";
    if (s < 3600) return Math.round(s / 60) + " dk";
    if (s < 86400) return Math.round(s / 3600) + " sa";
    return Math.round(s / 86400) + " gün";
  };
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  let profile = null;
  let d = null; // seçili coinin durum belgesi
  let cuzdan = null;
  let coinler = BC.liste(null); // coin listesi (borsa/coinler + varsayılanlar)
  const durumlar = {}; // sym → durum belgesi
  const dinleyiciler = {}; // sym → unsubscribe
  const mumDepo = {}; // sym → Map(t → mum) eski günler
  const yuklenenGun = {}; // sym → true (eski mumlar çekildi)
  let secili = (decodeURIComponent(location.hash.slice(1)) || "BERKAY").toUpperCase();
  let gecmisMumlar = new Map();
  let grafik = null;
  let mod = "spot", spotYon = "al", kYon = "long";
  let basladi = false;
  let gecmisListe = [];

  // ---------------- Kapı (kayıt zorunlu) ----------------
  $("bxGirisBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = $("authToggle"), p = $("authPanel");
    if (t && p && p.hidden) t.click();
    const k = $("authUser"); if (k) setTimeout(() => k.focus(), 250);
  });
  if (typeof db === "undefined" || !db || typeof auth === "undefined" || !auth) {
    $("bxKapiYazi").textContent = "Borsa şu an bağlı değil (Firebase ayarlanmamış).";
    return;
  }
  window.YaparmiAuth.onChange((p) => {
    profile = p;
    if (!p) {
      $("bxIcerik").hidden = true; $("bxKapi").hidden = false;
      $("bxKapiYazi").innerHTML = "Borsaya girmek için <b>kayıt olman</b> gerekiyor. Kayıt olunca hesabına <b>200 BERKAY</b> hediye ediliyor.";
      $("bxGirisBtn").hidden = false;
      return;
    }
    baslat();
  });

  async function baslat() {
    if (basladi) return;
    basladi = true;
    $("bxKapiYazi").textContent = "Cüzdanın hazırlanıyor…";
    $("bxGirisBtn").hidden = true;
    try {
      const r = await api("baslat");
      if (r.yeni) toast(`🎉 Hoş geldin! Hesabına ${r.bonus} BERKAY yüklendi.`, 6000);
    } catch (err) {
      basladi = false;
      $("bxKapiYazi").textContent = "⚠️ " + err.message;
      return;
    }
    $("bxKapi").hidden = true;
    $("bxIcerik").hidden = false;
    grafik = new window.BorsaGrafik($("bxGrafik"));
    dinle();
    haftaDinle();
    coinSec(secili, false);
    // Firestore kotası için seyrek: açık coin 30 sn'de, liste 5 dk'da bir ilerletilir (sunucu da aynı sınırı uygular)
    // Sunucuya sadece gerçekten bayatlamış coin için gidilir: sonTick dinlenen belgede zaten var.
    // Biri ilerletince herkes yeni sonTick'i görür, başkası aynı işi tekrar yapmaz (Firestore okuma kotası).
    const bayat = (sym, ms) => { const dd = durumlar[sym]; return !dd || Date.now() - (dd.sonTick || 0) >= ms; };
    const listeIlerlet = () => { const l = coinler.map((c) => c.sym).filter((s) => bayat(s, 300000)); if (l.length) api("tickHepsi", { coinler: l }).catch(() => {}); };
    setTimeout(listeIlerlet, 2500); // önce belgeler gelsin, sonra sadece bayatlar istensin
    setInterval(() => { if (document.visibilityState === "visible" && bayat(secili, 30000)) api("tick", { coin: secili }).catch(() => {}); }, 15000);
    setInterval(() => { if (document.visibilityState === "visible") listeIlerlet(); }, 60000);
    setInterval(() => { if (!document.hidden) dexCiz(); }, 5000);
    setInterval(() => { if (d && !document.hidden) { arenaCiz(); akisCiz(); pozlarimCiz(); } }, 15000);
  }

  // ---------------- Firestore dinleyicileri ----------------
  // Her coinin durum belgesini dinle (liste canlı kalsın)
  function coinDinle() {
    const istenen = new Set(coinler.map((c) => c.sym));
    Object.keys(dinleyiciler).forEach((sym) => { if (!istenen.has(sym)) { dinleyiciler[sym](); delete dinleyiciler[sym]; delete durumlar[sym]; } });
    coinler.forEach((c) => {
      if (dinleyiciler[c.sym]) return;
      dinleyiciler[c.sym] = db.collection("borsa").doc(BC.durumId(c.sym)).onSnapshot((s) => {
        if (!s.exists) return;
        const eski = durumlar[c.sym];
        const yeni = s.data();
        yeni.poz = yeni.poz || {}; yeni.akis = yeni.akis || []; yeni.son = yeni.son || []; yeni.saat = yeni.saat || [];
        durumlar[c.sym] = yeni;
        if (eski && yeni.sifirlama && yeni.sifirlama !== eski.sifirlama) {
          if (mumDepo[c.sym]) mumDepo[c.sym].clear();
          if (c.sym === secili) toast(`📉 ${c.sym} grafiği admin tarafından sıfırlandı.`, 5000);
        }
        dexCizGecikmeli();
        pozlarimCiz(); cuzdanCiz();
        if (c.sym === secili) seciliGuncelle();
        else zenginCiz();
      }, (err) => console.warn(c.sym + ":", err.message));
    });
  }
  function seciliGuncelle() {
    d = durumlar[secili] || null;
    if (!d) { $("bxFiyat").textContent = "…"; return; }
    gecmisMumlar = mumDepo[secili] || (mumDepo[secili] = new Map());
    grafikGuncelle();
    seritCiz(); arenaCiz(); akisCiz(); tahminleriCiz(); cuzdanCiz();
    zenginCiz();
    $("bxX").max = String(d.maxKaldirac || 20);
  }
  function dinle() {
    db.collection("borsa").doc("coinler").onSnapshot((s) => {
      coinler = BC.liste(s.exists ? s.data() : null);
      if (!coinler.some((c) => c.sym === secili)) coinSec("BERKAY", false);
      coinDinle(); dexCiz(); seritCiz();
    }, () => { coinDinle(); dexCiz(); });

    db.collection("borsa_cuzdan").doc(profile.uid).onSnapshot((s) => {
      cuzdan = s.exists ? s.data() : null; cuzdanCiz(); tahminleriCiz();
    }, (err) => console.warn("cüzdan:", err.message));

    db.collection("borsa_gecmis").where("uid", "==", profile.uid).onSnapshot((s) => {
      gecmisListe = s.docs.map((x) => x.data()).sort((a, b) => b.kapanis - a.kapanis).slice(0, 40);
      gecmisCiz();
    }, (err) => console.warn("geçmiş:", err.message));

    db.collection("borsa_market").onSnapshot((s) => {
      marketCiz(s.docs.map((x) => Object.assign({ id: x.id }, x.data())).filter((u) => u.aktif !== false).sort((a, b) => (a.sira || 99) - (b.sira || 99)));
    }, (err) => console.warn("market:", err.message));

    db.collection("borsa_siparis").where("uid", "==", profile.uid).onSnapshot((s) => {
      siparisCiz(s.docs.map((x) => x.data()).sort((a, b) => (b.ms || 0) - (a.ms || 0)));
    }, (err) => console.warn("sipariş:", err.message));
  }

  async function eskiMumlar(sym) {
    if (yuklenenGun[sym]) return;
    yuklenenGun[sym] = true;
    const depo = mumDepo[sym] || (mumDepo[sym] = new Map());
    const gunler = [];
    for (let i = 0; i < 4; i++) gunler.push(window.BorsaGun(Date.now() - i * 86400000));
    await Promise.all(gunler.map(async (g) => {
      try {
        const s = await db.collection("borsa_grafik").doc(BC.grafikId(sym, g)).get();
        if (s.exists) (s.data().m || []).forEach((m) => depo.set(m.t, m));
      } catch { /* yok */ }
    }));
    if (sym === secili) grafikGuncelle();
  }

  // ---------------- Coin seçimi ----------------
  function coinBilgi(sym) { return coinler.find((c) => c.sym === sym) || { sym, ad: sym, emoji: sym.slice(0, 1), renk: "#5a3fd4" }; }
  function coinSec(sym, kaydir) {
    sym = String(sym || "BERKAY").toUpperCase();
    if (!coinler.some((c) => c.sym === sym)) sym = "BERKAY";
    const degisti = sym !== secili;
    secili = sym;
    if (location.hash.slice(1) !== sym) history.replaceState(null, "", sym === "BERKAY" ? location.pathname : "#" + sym);
    const c = coinBilgi(sym);
    const logo = BC.logo(c); logo.id = "bxCoinLogo"; $("bxCoinLogo").replaceWith(logo);
    $("bxCoinAd").textContent = c.sym;
    $("bxCoinCift").textContent = `${c.ad} · ${c.sym} / USDT`;
    $("bxBkcEtiket").textContent = c.sym;
    $("bxArenaAlt").textContent = `${c.sym} · herkesin açık pozisyonu, canlı`;
    $("bxAkisAlt").textContent = c.sym;
    spotEtiketleri();
    if (degisti) { $("bxSpotMiktar").value = ""; $("bxTeminat").value = ""; durumYaz(""); }
    eskiMumlar(sym);
    seciliGuncelle();
    if (degisti && basladi && (!durumlar[sym] || Date.now() - (durumlar[sym].sonTick || 0) >= 30000)) api("tick", { coin: sym }).catch(() => {});
    dexCiz();
    if (kaydir) $("bxSerit").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  window.addEventListener("hashchange", () => { const h = decodeURIComponent(location.hash.slice(1)).toUpperCase(); if (h && h !== secili) coinSec(h, true); });

  // ---------------- DexScreener tarzı liste ----------------
  let dexSira = { alan: null, ters: true }, dexZaman = null;
  function dexCizGecikmeli() { if (!dexZaman) dexZaman = setTimeout(() => { dexZaman = null; dexCiz(); }, 300); }
  function degisim(dd, ms) {
    if (!dd) return null;
    const sinir = Date.now() - ms;
    const kaynak = ms > 4 * 3600000 ? dd.saat : dd.son;
    const ilk = (kaynak || []).find((m) => m.t + (ms > 4 * 3600000 ? 3600000 : 60000) > sinir);
    if (!ilk) return null;
    return ((dd.fiyat - ilk.o) / ilk.o) * 100;
  }
  function hacim24(dd) {
    if (!dd) return 0;
    const sinir = Date.now() - 86400000;
    return (dd.saat || []).filter((m) => m.t >= sinir - 3600000).reduce((t, m) => t + (m.v || 0), 0);
  }
  function satirVeri(c) {
    const dd = durumlar[c.sym];
    return {
      c, dd,
      fiyat: dd ? dd.fiyat : null,
      d5: degisim(dd, 5 * 60000), d60: degisim(dd, 3600000), d24: degisim(dd, 86400000),
      hacim: hacim24(dd),
      mcap: dd ? dd.fiyat * (dd.toplamArz - 0) : 0,
      lik: dd ? dd.derinlik : 0,
      poz: dd ? Object.keys(dd.poz).length : 0,
    };
  }
  function yuzdeHucre(v) {
    const td = el("td", "bx-dex-yuzde " + (v == null ? "muted" : v >= 0 ? "yukari" : "asagi"));
    td.textContent = v == null ? "—" : (v >= 0 ? "+" : "") + (Math.abs(v) >= 1000 ? para(v, 0) : v.toFixed(2)) + "%";
    return td;
  }
  const kisa = (x) => (x >= 1e12 ? para(x / 1e12, 2) + " Tn" : x >= 1e9 ? para(x / 1e9, 2) + " Mr" : x >= 1e6 ? para(x / 1e6, 2) + " Mn" : x >= 1e4 ? para(x / 1e3, 1) + " bin" : para(x, 0));
  function spark(dd) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 32"); svg.setAttribute("class", "bx-spark"); svg.setAttribute("preserveAspectRatio", "none");
    const k = (dd && dd.son || []).map((m) => m.c).filter((x) => x > 0);
    if (k.length < 2) return svg;
    const adim = Math.max(1, Math.floor(k.length / 60));
    const n = k.filter((_, i) => i % adim === 0 || i === k.length - 1);
    const lg = n.map((x) => Math.log(x)), mn = Math.min(...lg), mx = Math.max(...lg), ar = mx - mn || 1;
    const yol = n.map((x, i) => `${i ? "L" : "M"}${(i / (n.length - 1) * 120).toFixed(1)},${(30 - ((Math.log(x) - mn) / ar) * 28).toFixed(1)}`).join(" ");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", yol); p.setAttribute("class", n[n.length - 1] >= n[0] ? "yukari" : "asagi");
    svg.append(p);
    return svg;
  }
  function dexCiz() {
    const tb = $("bxCoinler"); if (!tb) return;
    const q = $("bxAra").value;
    let satirlar = coinler.filter((c) => BC.eslesir(c, q)).map(satirVeri);
    if (dexSira.alan) satirlar.sort((a, b) => ((b[dexSira.alan] ?? -Infinity) - (a[dexSira.alan] ?? -Infinity)) * (dexSira.ters ? 1 : -1));
    tb.textContent = "";
    if (!satirlar.length) {
      const tr = el("tr"); const td = el("td", "muted", `"${q}" diye bir coin yok.`); td.colSpan = 11; tr.append(td); tb.append(tr);
    }
    satirlar.forEach((v, i) => {
      const tr = el("tr", v.c.sym === secili ? "secili" : "");
      tr.tabIndex = 0;
      tr.append(el("td", "muted", "#" + (i + 1)));
      const ad = el("td"), kap = el("div", "bx-dex-coin");
      const yazi = el("span"); yazi.append(el("b", null, v.c.sym), el("small", null, v.c.ad));
      kap.append(BC.logo(v.c, 30), yazi);
      if (v.c.sym === "BERKAY") kap.append(el("span", "bx-dex-etiket", "ANA"));
      if (v.dd ? v.dd.gercek : v.c.gercek) kap.append(el("span", "bx-dex-etiket canli", "CANLI"));
      ad.append(kap); tr.append(ad);
      tr.append(el("td", "bx-dex-fiyat", v.fiyat == null ? "…" : sayi(v.fiyat) + " $"));
      tr.append(yuzdeHucre(v.d5), yuzdeHucre(v.d60), yuzdeHucre(v.d24));
      tr.append(el("td", null, kisa(v.hacim) + " $"), el("td", null, kisa(v.mcap) + " $"), el("td", null, v.dd && v.dd.gercek ? "∞" : kisa(v.lik) + " $"), el("td", v.poz ? "" : "muted", v.poz ? `⚡ ${v.poz}` : "—"));
      const sp = el("td", "bx-dex-spark"); sp.append(spark(v.dd)); tr.append(sp);
      tr.addEventListener("click", () => coinSec(v.c.sym, true));
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") coinSec(v.c.sym, true); });
      tb.append(tr);
    });
    const toplamHacim = coinler.reduce((t, c) => t + hacim24(durumlar[c.sym]), 0);
    $("bxDexOzet").textContent = `${coinler.length} coin · 24s hacim ${kisa(toplamHacim)} $`;
    document.querySelectorAll(".bx-dex-tablo th[data-sira]").forEach((th) => th.classList.toggle("on", th.dataset.sira === dexSira.alan));
  }
  $("bxAra").addEventListener("input", dexCiz);
  $("bxAra").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const ilk = coinler.find((c) => BC.eslesir(c, $("bxAra").value)); if (ilk) { coinSec(ilk.sym, true); $("bxAra").blur(); } }
    if (e.key === "Escape") { $("bxAra").value = ""; dexCiz(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); $("bxAra").focus(); }
  });
  document.querySelectorAll(".bx-dex-tablo th[data-sira]").forEach((th) => th.addEventListener("click", () => {
    const alan = th.dataset.sira;
    if (dexSira.alan === alan) { if (dexSira.ters) dexSira.ters = false; else dexSira.alan = null; } else dexSira = { alan, ters: true };
    dexCiz();
  }));

  function tumMumlar() {
    const m = new Map(gecmisMumlar);
    if (d) d.son.forEach((x) => m.set(x.t, x));
    const sinir = d && d.sifirlama ? Math.floor(d.sifirlama / 60000) * 60000 : 0; // admin grafiği sıfırladıysa öncesini gösterme
    return [...m.values()].filter((x) => x.t >= sinir).sort((a, b) => a.t - b.t);
  }

  function grafikGuncelle() {
    if (!grafik || !d) return;
    grafik.canliFiyat = d.fiyat;
    grafik.veri(tumMumlar());
    const cizgiler = [];
    const benimPoz = Object.values(d.poz).filter((p) => p.uid === profile.uid);
    benimPoz.forEach((p) => {
      cizgiler.push({ p: p.giris, renk: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5a3fd4", yazi: `${p.kaldirac}x ${p.yon.toUpperCase()} ort. giriş` });
      cizgiler.push({ p: E.lik(p, d.derinlik), renk: "#e8590c", yazi: "Likidasyon" });
    });
    grafik.cizgiler(cizgiler);
  }

  document.querySelectorAll("#bxPeriyot button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#bxPeriyot button").forEach((x) => x.classList.toggle("on", x === b));
    grafik && grafik.periyot(Number(b.dataset.per));
  }));
  document.querySelectorAll("#bxOlcek button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#bxOlcek button").forEach((x) => x.classList.toggle("on", x === b));
    grafik && grafik.logOlcek(b.dataset.olcek);
  }));
  document.querySelectorAll("#bxTip button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#bxTip button").forEach((x) => x.classList.toggle("on", x === b));
    grafik && grafik.tip(b.dataset.tip);
  }));

  // ---------------- Şerit ----------------
  function seritCiz() {
    if (!d) return;
    const mumlar = tumMumlar();
    const sinir = Date.now() - 86400000;
    const gun = mumlar.filter((m) => m.t >= sinir);
    const acilis = gun.length ? gun[0].o : d.fiyat;
    const deg = ((d.fiyat - acilis) / acilis) * 100;
    $("bxFiyat").textContent = sayi(d.fiyat);
    const dg = $("bxDegisim");
    dg.textContent = (deg >= 0 ? "▲ +" : "▼ ") + deg.toFixed(2) + "%";
    dg.className = deg >= 0 ? "yukari" : "asagi";
    $("bxFiyat").className = deg >= 0 ? "yukari" : "asagi";
    $("bxYuksek").textContent = sayi(Math.max(d.fiyat, ...gun.map((m) => m.h)));
    $("bxDusuk").textContent = sayi(Math.min(d.fiyat, ...gun.map((m) => m.l)));
    $("bxHacim").textContent = para(gun.reduce((t, m) => t + (m.v || 0), 0), 0) + " USDT";
    if (d.gercek) {
      $("bxDolasimEtiket").textContent = "Fiyat kaynağı";
      const yas = d.disZaman ? Math.round((Date.now() - d.disZaman) / 1000) : null;
      $("bxDolasim").innerHTML = `<span class="bx-nokta ok"></span>Canlı · Binance${yas != null && yas > 60 ? ` (${yas} sn önce)` : ""}`;
    } else {
      $("bxDolasimEtiket").textContent = "Dolaşımdaki arz";
      $("bxDolasim").textContent = para(d.toplamArz - d.kasaBKC, 0) + " / " + para(d.toplamArz, 0);
    }
    $("bxGercekNot").hidden = !d.gercek; $("bxEgriNot").hidden = !!d.gercek;
    $("bxPiyasa").innerHTML = d.acik ? '<span class="bx-nokta ok"></span>Açık' : '<span class="bx-nokta"></span>Kapalı';
    document.title = `${sayi(d.fiyat)} ${secili} · Berkay Borsası`;
  }

  // ---------------- Cüzdan ----------------
  function cuzdanCiz() {
    if (!cuzdan) return;
    if (sonUrunler) marketCiz(sonUrunler);
    $("bxBkc").textContent = para(BC.bakiye(cuzdan, secili), 4);
    $("bxBtl").textContent = para(cuzdan.btl, 2);
    $("bxToplam").textContent = para(degerHesap(cuzdan), 2) + " USDT";
    // Elindeki bütün coinler
    const v = $("bxVarliklar"); v.textContent = "";
    coinler.forEach((c) => {
      const m = BC.bakiye(cuzdan, c.sym);
      if (m <= 1e-9) return;
      const dd = durumlar[c.sym];
      const b = el("button", "bx-varlik" + (c.sym === secili ? " on" : "")); b.type = "button";
      const y = el("span"); y.append(el("b", null, `${para(m, m < 10 ? 4 : 2)} ${c.sym}`), el("small", "muted", dd ? "≈ " + para(m * dd.fiyat, 2) + " USDT" : "…"));
      b.append(BC.logo(c, 22), y);
      b.addEventListener("click", () => coinSec(c.sym, true));
      v.append(b);
    });
    const g = $("bxGercek");
    g.textContent = isaretli(cuzdan.gerceklesen || 0) + " USDT";
    g.className = (cuzdan.gerceklesen || 0) >= 0 ? "yukari" : "asagi";
  }

  // ---------------- İşlem paneli ----------------
  document.querySelectorAll(".bx-sekme button").forEach((b) => b.addEventListener("click", () => {
    mod = b.dataset.mod;
    document.querySelectorAll(".bx-sekme button").forEach((x) => x.classList.toggle("on", x === b));
    $("bxSpot").hidden = mod !== "spot"; $("bxKaldirac").hidden = mod !== "kaldirac";
    tahminleriCiz();
  }));
  $("bxSpot").querySelectorAll(".bx-yon button").forEach((b) => b.addEventListener("click", () => {
    spotYon = b.dataset.yon;
    $("bxSpot").querySelectorAll(".bx-yon button").forEach((x) => x.classList.toggle("on", x === b));
    spotEtiketleri();
    $("bxSpotMiktar").value = "";
    tahminleriCiz();
  }));
  function spotEtiketleri() {
    $("bxSpotEtiket").textContent = spotYon === "al" ? "Harcanacak USDT" : `Satılacak ${secili}`;
    $("bxSpotBirim").textContent = spotYon === "al" ? "USDT" : secili;
    $("bxSpotBtn").textContent = spotYon === "al" ? `${secili} al` : `${secili} sat`;
    $("bxSpotBtn").className = "bx-gonder " + (spotYon === "al" ? "al" : "sat");
  }
  $("bxKaldirac").querySelectorAll(".bx-yon button").forEach((b) => b.addEventListener("click", () => {
    kYon = b.dataset.yon;
    $("bxKaldirac").querySelectorAll(".bx-yon button").forEach((x) => x.classList.toggle("on", x === b));
    $("bxKBtn").textContent = kYon === "long" ? "Long aç" : "Short aç";
    $("bxKBtn").className = "bx-gonder " + (kYon === "long" ? "al" : "sat");
    tahminleriCiz();
  }));
  document.querySelectorAll(".bx-yuzde").forEach((grup) => grup.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    if (!cuzdan) return;
    const y = Number(b.dataset.y) / 100;
    if (grup.dataset.hedef === "spot") {
      const max = spotYon === "al" ? cuzdan.btl : BC.bakiye(cuzdan, secili);
      $("bxSpotMiktar").value = String(Math.floor(max * y * 10000) / 10000);
    } else {
      $("bxTeminat").value = String(Math.floor(cuzdan.btl * y * 100) / 100);
    }
    tahminleriCiz();
  })));
  ["bxSpotMiktar", "bxTeminat"].forEach((id) => $(id).addEventListener("input", tahminleriCiz));
  $("bxX").addEventListener("input", () => { $("bxXYazi").textContent = $("bxX").value + "x"; tahminleriCiz(); });

  function satir(dl, ad, deger, cls) {
    const div = el("div"); div.append(el("dt", null, ad)); const dd = el("dd", cls, deger); div.append(dd); dl.append(div);
  }
  function tahminleriCiz() {
    if (!d) return;
    const D = d.derinlik, p = d.fiyat;
    // Gerçek coinde fiyat etkisi yok: düz hesap
    const Eg = d.gercek ? {
      al: (pp, N) => ({ q: N / pp, p1: pp }), sat: (pp, q) => ({ N: q * pp, p1: pp }), shortAc: (pp, N) => ({ q: N / pp, p1: pp }),
    } : E;
    const st = $("bxSpotTahmin"); st.textContent = "";
    const m = Number($("bxSpotMiktar").value);
    if (spotYon === "al") {
      satir(st, "Kullanılabilir", para(cuzdan ? cuzdan.btl : 0) + " USDT");
      if (m > 0) {
        const r = Eg.al(p, m, D);
        satir(st, "Alacağın", "≈ " + para(r.q, 4) + " " + secili);
        satir(st, "Ortalama fiyat", sayi(m / r.q));
        if (!d.gercek) satir(st, "Fiyat etkisi", "+" + ((r.p1 / p - 1) * 100).toFixed(2) + "%", "yukari");
      }
    } else {
      satir(st, "Kullanılabilir", para(BC.bakiye(cuzdan, secili), 4) + " " + secili);
      if (m > 0) {
        const r = Eg.sat(p, m, D);
        satir(st, "Alacağın", "≈ " + para(r.N) + " USDT");
        satir(st, "Ortalama fiyat", sayi(r.N / m));
        if (!d.gercek) satir(st, "Fiyat etkisi", ((r.p1 / p - 1) * 100).toFixed(2) + "%", "asagi");
      }
    }
    const kt = $("bxKTahmin"); kt.textContent = "";
    const M = Number($("bxTeminat").value), x = Number($("bxX").value);
    satir(kt, "Kullanılabilir", para(cuzdan ? cuzdan.btl : 0) + " USDT");
    if (M > 0) {
      const N = M * x;
      const r = kYon === "long" ? Eg.al(p, N, D) : Eg.shortAc(p, N, D);
      const poz = { yon: kYon, teminat: M, notional: N, boyut: r.q, giris: N / r.q, v: d.gercek ? 2 : undefined };
      const etki = (r.p1 / p - 1) * 100;
      if (N > D * 0.5) satir(kt, "⚠️ En fazla büyüklük", para(D * 0.5, 0) + " USDT", "asagi");
      satir(kt, "Pozisyon büyüklüğü", para(N) + " USDT");
      satir(kt, "Ortalama giriş", sayi(N / r.q));
      if (!d.gercek) satir(kt, "Fiyatı iter", (etki >= 0 ? "+" : "") + etki.toFixed(2) + "% → " + sayi(r.p1), etki >= 0 ? "yukari" : "asagi");
      satir(kt, "Likidasyon fiyatı", sayi(E.lik(poz, D)), "asagi");
    }
  }

  function durumYaz(msg, hata) { const e = $("bxDurum"); e.textContent = msg; e.className = "bx-durum" + (hata ? " hata" : ""); }
  async function calistir(btn, fn) {
    if (btn.disabled) return;
    btn.disabled = true; durumYaz("İşleniyor…");
    try { const r = await fn(); durumYaz("✅ " + (r.mesaj || "Tamam")); return r; }
    catch (err) { durumYaz("⚠️ " + err.message, true); }
    finally { btn.disabled = false; }
  }
  $("bxSpotBtn").addEventListener("click", () => {
    const m = Number($("bxSpotMiktar").value);
    if (!(m > 0)) { durumYaz("Miktar yaz.", true); return; }
    calistir($("bxSpotBtn"), () => api(spotYon === "al" ? "spotAl" : "spotSat", spotYon === "al" ? { coin: secili, btl: m } : { coin: secili, miktar: m })).then((r) => { if (r) $("bxSpotMiktar").value = ""; });
  });
  $("bxKBtn").addEventListener("click", () => {
    const M = Number($("bxTeminat").value), x = Number($("bxX").value);
    if (!(M >= 1)) { durumYaz("Teminat en az 1 USDT.", true); return; }
    if (x >= 15 && !confirm(`${secili} ${x}x kaldıraç çok riskli: fiyat yaklaşık %${(90 / x).toFixed(1)} ters giderse teminatın gider. Devam?`)) return;
    calistir($("bxKBtn"), () => api("pozAc", { coin: secili, yon: kYon, kaldirac: x, teminat: M })).then((r) => { if (r) $("bxTeminat").value = ""; });
  });

  // ---------------- Pozisyonlar ----------------
  // Bütün coinlerdeki açık pozisyonlarım: [{ p, dd, sym }]
  function benimPozlar(uid) {
    const l = [];
    Object.entries(durumlar).forEach(([sym, dd]) => Object.values(dd.poz).forEach((p) => { if (p.uid === uid) l.push({ p, dd, sym }); }));
    return l;
  }
  function pozlarimCiz() {
    const tb = $("bxPozlarim");
    if (!profile) return;
    const benim = benimPozlar(profile.uid).sort((a, b) => b.p.acilis - a.p.acilis);
    tb.textContent = "";
    if (!benim.length) { const tr = el("tr"); const td = el("td", "muted", "Açık pozisyonun yok."); td.colSpan = 9; tr.append(td); tb.append(tr); return; }
    benim.forEach(({ p, dd: d, sym }) => {
      const pnl = E.pnl(p, d.fiyat, d.derinlik), yuzde = (pnl / p.teminat) * 100;
      const tr = el("tr");
      const ct = el("td"), ck = el("div", "bx-dex-coin"); const cb = el("button", "link-btn", sym); cb.type = "button"; cb.addEventListener("click", () => coinSec(sym, true));
      ck.append(BC.logo(coinBilgi(sym), 22), cb); ct.append(ck); tr.append(ct);
      const yon = el("td"); yon.append(el("span", "bx-rozet " + (p.yon === "long" ? "al" : "sat"), `${p.kaldirac}x ${p.yon === "long" ? "LONG" : "SHORT"}`));
      tr.append(yon, el("td", null, para(p.teminat) + " USDT"), el("td", null, para(p.notional) + " USDT"), el("td", null, sayi(p.giris)), el("td", null, sayi(d.fiyat)), el("td", "asagi", sayi(E.lik(p, d.derinlik))));
      const kz = el("td", pnl >= 0 ? "yukari" : "asagi"); kz.innerHTML = `<b>${isaretli(pnl)} USDT</b><br><small>${isaretli(yuzde)}%</small>`; tr.append(kz);
      const td = el("td", "bx-butonlar");
      const kapat = el("button", "admin-btn reject", "Kapat");
      kapat.type = "button";
      kapat.addEventListener("click", () => calistir(kapat, () => api("pozKapat", { coin: sym, id: p.id })).then((r) => {
        if (r && r.sonuc) { toast(`${r.sonuc.pnl >= 0 ? "🤑" : "😬"} ${isaretli(r.sonuc.pnl)} USDT (${isaretli(r.sonuc.yuzde)}%)`, 4000); if (r.sonuc.pnl > 0) paylasAc(r.sonuc, false); }
      }));
      const pay = el("button", "admin-btn", "📤");
      pay.type = "button"; pay.title = "Paylaş";
      pay.addEventListener("click", () => paylasAc(Object.assign({}, p, { coin: sym, pnl, yuzde, cikis: d.fiyat }), true));
      td.append(kapat, pay); tr.append(td);
      tb.append(tr);
    });
  }

  function arenaCiz() {
    if (!d) return;
    const a = $("bxArena"); a.textContent = "";
    const hepsi = Object.values(d.poz).map((p) => Object.assign({}, p, { pnl: E.pnl(p, d.fiyat, d.derinlik) })).sort((x, y) => y.pnl / y.teminat - x.pnl / x.teminat);
    if (!hepsi.length) { a.append(el("p", "muted", `${secili}'da kimse kaldıraçta değil. İlk sen ol.`)); return; }
    hepsi.forEach((p) => {
      const yuzde = (p.pnl / p.teminat) * 100;
      const row = el("div", "bx-satir");
      row.append(Ekonomi.isim(p.ad, undefined, { unvan: false }), el("span", "bx-rozet " + (p.yon === "long" ? "al" : "sat"), `${p.kaldirac}x ${p.yon === "long" ? "LONG" : "SHORT"}`), el("span", "muted", para(p.notional, 0) + " USDT"));
      const kz = el("span", "bx-sag " + (yuzde >= 0 ? "yukari" : "asagi"), isaretli(yuzde) + "%");
      row.append(kz);
      a.append(row);
    });
  }

  const AKIS = { al: "🟢 aldı", sat: "🔴 sattı", long: "📈 LONG açtı", short: "📉 SHORT açtı", kapat: "✅ pozisyon kapattı", lik: "💀 LİKİDE OLDU" };
  function akisCiz() {
    if (!d) return;
    const a = $("bxAkis"); a.textContent = "";
    if (!d.akis.length) { a.append(el("p", "muted", "Henüz işlem yok.")); return; }
    d.akis.slice(0, 15).forEach((k) => {
      if (k.tur === "olay") {
        const row = el("div", "bx-satir bx-olay-satir");
        row.append(el("b", null, "📰 SON DAKİKA"), el("span", null, k.baslik), el("span", k.etki > 0 ? "yukari" : "asagi", (k.etki > 0 ? "+" : "") + k.etki + "%"), el("span", "bx-sag muted", kacOnce(k.t)));
        a.append(row); return;
      }
      const row = el("div", "bx-satir" + (k.tur === "lik" ? " bx-lik" : ""));
      let ne = AKIS[k.tur] || k.tur;
      if (k.x && (k.tur === "long" || k.tur === "short" || k.tur === "kapat" || k.tur === "lik")) ne = `${k.x}x ` + ne;
      row.append(Ekonomi.isim(k.ad, undefined, { unvan: false }), el("span", null, ne), el("span", "muted", para(k.m, 0) + " USDT"), el("span", "bx-sag muted", kacOnce(k.t)));
      a.append(row);
    });
  }

  function gecmisCiz() {
    const tb = $("bxGecmis"); tb.textContent = "";
    if (!gecmisListe.length) { const tr = el("tr"); const td = el("td", "muted", "Henüz kapanmış pozisyon yok."); td.colSpan = 8; tr.append(td); tb.append(tr); return; }
    gecmisListe.forEach((g) => {
      const tr = el("tr");
      const yon = el("td"); yon.append(el("span", "bx-rozet " + (g.yon === "long" ? "al" : "sat"), `${g.kaldirac}x ${g.yon === "long" ? "LONG" : "SHORT"}`));
      tr.append(el("td", null, new Date(g.kapanis).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })), el("td", null, g.coin || "BERKAY"), yon, el("td", null, para(g.teminat) + " USDT"), el("td", null, sayi(g.giris) + " → " + sayi(g.cikis)));
      const kz = el("td", g.pnl >= 0 ? "yukari" : "asagi"); kz.innerHTML = `<b>${isaretli(g.pnl)} USDT</b><br><small>${isaretli(g.yuzde)}%</small>`; tr.append(kz);
      tr.append(el("td", null, g.sebep === "likide" ? "💀 Likide" : g.sebep === "yenileme" ? "🔄 Sistem güncellemesi (iade)" : "✅ Kapandı"));
      const td = el("td"); const b = el("button", "admin-btn", "📤 Paylaş"); b.type = "button";
      b.addEventListener("click", () => paylasAc(g, false)); td.append(b); tr.append(td);
      tb.append(tr);
    });
  }

  // ---------------- Market ----------------
  let sonUrunler = null;
  function marketCiz(urunler) {
    sonUrunler = urunler;
    const m = $("bxMarket"); m.textContent = "";
    if (!urunler.length) { m.append(el("p", "muted", "Market şu an boş.")); return; }
    urunler.forEach((u) => {
      const k = el("div", "bx-urun");
      k.append(el("div", "bx-urun-emoji", u.emoji || "🎁"));
      const b = el("div", "bx-urun-bilgi");
      b.append(el("b", null, u.ad));
      if (u.aciklama) b.append(el("p", "muted", u.aciklama));
      const alt = el("div", "bx-urun-alt");
      alt.append(el("span", "bx-urun-fiyat", para(u.fiyat, 0) + " BERKAY"));
      if (typeof u.stok === "number" && u.stok >= 0) alt.append(el("small", "muted", u.stok ? `Stok: ${u.stok}` : "Tükendi"));
      if (["renk", "rozet", "unvan"].includes(u.tur)) alt.append(el("small", "bx-dijital", u.tur === "renk" ? "🎨 isim rengi" : u.tur === "rozet" ? "🏅 rozet" : `🏷️ unvan${u.sureGun ? " · " + u.sureGun + " gün" : ""}`));
      b.append(alt);
      const btn = el("button", "btn", "Satın al");
      btn.type = "button";
      btn.disabled = u.stok === 0;
      const ilerleme = el("div", "bx-ilerleme");
      const oran = cuzdan ? Math.min(1, cuzdan.bkc / u.fiyat) : 0;
      const bar = el("i"); bar.style.width = (oran * 100).toFixed(1) + "%"; ilerleme.append(bar);
      ilerleme.title = oran >= 1 ? "Alabilirsin!" : `%${(oran * 100).toFixed(0)} biriktirdin`;
      btn.addEventListener("click", () => {
        let unvan;
        if (u.tur === "unvan" && !u.deger) {
          unvan = prompt("Unvanın ne olsun? (2–24 harf, ör. Berkay'ın Patronu)", "");
          if (unvan == null) return;
          unvan = unvan.trim();
          if (unvan.length < 2) { toast("Unvan en az 2 harf olmalı."); return; }
        }
        if (!confirm(`${u.emoji || "🎁"} ${u.ad}${unvan ? ` ("${unvan}")` : ""} için ${u.fiyat} BERKAY harcanacak. Emin misin?`)) return;
        calistir(btn, () => api("marketAl", { urunId: u.id, unvan })).then((r) => { if (r) toast(r.mesaj, 5000); });
      });
      b.append(ilerleme);
      k.append(b, btn);
      m.append(k);
    });
  }
  const SIP = { bekliyor: "⏳ Bekliyor", teslim: "✅ Teslim edildi", iptal: "↩️ İptal (iade edildi)" };
  function siparisCiz(liste) {
    const s = $("bxSiparisler"); s.textContent = "";
    if (!liste.length) { s.append(el("p", "muted", "Henüz sipariş yok.")); return; }
    liste.forEach((x) => {
      const row = el("div", "bx-satir");
      row.append(el("b", null, (x.emoji || "🎁") + " " + x.urunAd), el("span", "muted", para(x.fiyat, 0) + " BERKAY"), el("span", "bx-sag", SIP[x.durum] || x.durum));
      s.append(row);
    });
  }

  // ---------------- Kâr kartı + paylaş ----------------
  let paylasVeri = null, paylasBlob = null;
  async function kartYap(g, acik) {
    const W = 1080, H = 1350;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    try { await Promise.all([document.fonts.load("800 60px 'Bricolage Grotesque'"), document.fonts.load("700 30px Manrope")]); } catch { /* sistem yazısı */ }
    const DISP = '"Bricolage Grotesque", "Manrope", sans-serif', BODY = '"Manrope", sans-serif';
    const kar = g.pnl >= 0;
    const ana = kar ? "#22c55e" : "#ef4444";
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b0e1f"); bg.addColorStop(1, "#1a1240");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const parlak = ctx.createRadialGradient(W * 0.85, H * 0.15, 10, W * 0.85, H * 0.15, 700);
    parlak.addColorStop(0, kar ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)"); parlak.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = parlak; ctx.fillRect(0, 0, W, H);
    // yükselen/düşen grafik süsü
    ctx.strokeStyle = ana; ctx.lineWidth = 8; ctx.globalAlpha = 0.25; ctx.beginPath();
    let y = kar ? H * 0.9 : H * 0.55;
    for (let x = 0; x <= W; x += 40) { y += (kar ? -1 : 1) * (8 + Math.random() * 14) * (Math.random() < 0.3 ? -1.4 : 1); if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke(); ctx.globalAlpha = 1;
    // logo
    const kc = coinBilgi(g.coin || "BERKAY");
    ctx.fillStyle = kc.sym === "BERKAY" ? "#f5b82e" : kc.renk || "#5a3fd4"; ctx.beginPath(); ctx.arc(130, 140, 54, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = kc.sym === "BERKAY" ? "#3a2800" : "#fff"; ctx.font = `800 64px ${DISP}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(kc.emoji || kc.sym[0], 130, 144);
    ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = `800 52px ${DISP}`; ctx.fillText(kc.sym, 210, 124);
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = `700 30px ${BODY}`; ctx.fillText("Berkay Borsası · yaparmi.com", 212, 172);
    // yön rozeti
    const rozet = `${g.kaldirac}x ${g.yon === "long" ? "LONG" : "SHORT"}`;
    ctx.font = `800 44px ${DISP}`;
    const rw = ctx.measureText(rozet).width + 60;
    ctx.fillStyle = g.yon === "long" ? "#22c55e" : "#ef4444";
    ctx.beginPath(); ctx.roundRect(80, 300, rw, 84, 42); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(rozet, 110, 344);
    if (acik) { ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = `700 32px ${BODY}`; ctx.fillText("● Açık pozisyon", 80 + rw + 30, 344); }
    // dev ROI
    ctx.fillStyle = ana; ctx.font = `800 200px ${DISP}`; ctx.textBaseline = "alphabetic";
    const roi = (g.yuzde >= 0 ? "+" : "") + g.yuzde.toFixed(2) + "%";
    let boy = 200; while (ctx.measureText(roi).width > W - 160 && boy > 80) { boy -= 10; ctx.font = `800 ${boy}px ${DISP}`; }
    ctx.fillText(roi, 76, 640);
    ctx.fillStyle = "#fff"; ctx.font = `800 64px ${DISP}`;
    ctx.fillText((g.pnl >= 0 ? "+" : "") + para(g.pnl) + " USDT", 80, 740);
    // detaylar
    const satirlar = [["Giriş fiyatı", sayi(g.giris)], [acik ? "Anlık fiyat" : "Çıkış fiyatı", sayi(g.cikis)], ["Teminat", para(g.teminat) + " USDT"]];
    satirlar.forEach(([a, b], i) => {
      const yy = 880 + i * 92;
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = `700 34px ${BODY}`; ctx.fillText(a, 80, yy);
      ctx.fillStyle = "#fff"; ctx.font = `800 40px ${BODY}`; ctx.textAlign = "right"; ctx.fillText(b, W - 80, yy); ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(80, yy + 30, W - 160, 2);
    });
    // alt
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, H - 170, W, 170);
    ctx.fillStyle = "#fff"; ctx.font = `800 46px ${DISP}`; ctx.fillText("@" + (g.ad || (profile && profile.kullaniciAdi) || "berkay"), 80, H - 92);
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = `700 30px ${BODY}`;
    ctx.fillText(new Date(g.kapanis || Date.now()).toLocaleString("tr-TR"), 80, H - 46);
    ctx.textAlign = "right"; ctx.fillStyle = "#f5b82e"; ctx.font = `800 36px ${DISP}`; ctx.fillText(kar ? "Berkay'a ders verdim 😎" : "Berkay bile yapmazdı 💀", W - 80, H - 70);
    return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  }
  function paylasMetni(g, acik) {
    const kar = g.pnl >= 0;
    return `${kar ? "🤑" : "💀"} ${g.coin || "BERKAY"} ${g.kaldirac}x ${g.yon === "long" ? "LONG" : "SHORT"} ${acik ? "(açık)" : ""}\n` +
      `${(g.yuzde >= 0 ? "+" : "") + g.yuzde.toFixed(2)}%  ·  ${(g.pnl >= 0 ? "+" : "") + para(g.pnl)} USDT\n` +
      `Giriş ${sayi(g.giris)} → ${acik ? "şimdi" : "çıkış"} ${sayi(g.cikis)}\n` +
      `Sen de dene: ${location.origin}/borsa${g.coin && g.coin !== "BERKAY" ? "#" + g.coin : ""}`;
  }
  async function paylasAc(g, acik) {
    paylasVeri = { g, acik };
    $("bxPaylasModal").hidden = false;
    $("bxPaylasResim").removeAttribute("src");
    paylasBlob = await kartYap(g, acik);
    if (paylasBlob) $("bxPaylasResim").src = URL.createObjectURL(paylasBlob);
  }
  $("bxPaylasKapat").addEventListener("click", () => { $("bxPaylasModal").hidden = true; });
  $("bxPaylasModal").addEventListener("click", (e) => { if (e.target === $("bxPaylasModal")) $("bxPaylasModal").hidden = true; });
  $("bxPaylasWp").addEventListener("click", async () => {
    if (!paylasVeri) return;
    const metin = paylasMetni(paylasVeri.g, paylasVeri.acik);
    // Telefonda: resim + yazı birlikte paylaşım menüsünden (WhatsApp seçilir)
    if (paylasBlob && navigator.canShare) {
      const dosya = new File([paylasBlob], "berkaycoin-kar.png", { type: "image/png" });
      if (navigator.canShare({ files: [dosya] })) {
        try { await navigator.share({ files: [dosya], text: metin }); return; } catch (err) { if (err && err.name === "AbortError") return; }
      }
    }
    // Bilgisayarda: WhatsApp'a yazı gider, resmi ayrıca indirip ekleyebilir
    window.open("https://wa.me/?text=" + encodeURIComponent(metin), "_blank", "noopener");
  });
  $("bxPaylasIndir").addEventListener("click", () => {
    if (!paylasBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(paylasBlob); a.download = "berkaycoin-kar.png"; a.click();
  });

  // ---------------- Zenginler + bu hafta ----------------
  function degerHesap(c) {
    let t = c.btl || 0;
    coinler.forEach((k) => { const dd = durumlar[k.sym]; const m = BC.bakiye(c, k.sym); if (m) t += m * (dd ? dd.fiyat : k.sym === "BERKAY" ? 1 : 0); });
    benimPozlar(c.uid).forEach(({ p, dd }) => { t += Math.max(0, p.teminat + E.pnl(p, dd.fiyat, dd.derinlik)); });
    return t;
  }
  // Zenginler: sunucunun 10 dk'da bir hazırladığı özetten (herkesin cüzdanını okumamak için)
  let ozetVeri = null;
  function zenginCiz() {
    const z = $("bxZengin"); z.textContent = "";
    const l = ((ozetVeri && ozetVeri.zengin) || []).slice(0, 10);
    if (!l.length) { z.append(el("p", "muted", ozetVeri ? "Henüz kimse yok." : "Yükleniyor…")); return; }
    l.forEach((c, i) => {
      const benim = profile && c.uid === profile.uid;
      const r = el("div", "bx-satir" + (benim ? " pf-vurgu" : ""));
      r.append(el("span", "rk-sira", ["🥇", "🥈", "🥉"][i] || String(i + 1)), Ekonomi.isim(c.ad, c.kozmetik || null), el("span", "bx-sag", para(benim && cuzdan ? degerHesap(cuzdan) : c.deger, 0) + " USDT"));
      z.append(r);
    });
    const ben = profile && ozetVeri && ozetVeri.kisi && ozetVeri.kisi[profile.uid];
    if (ben && ben.sira > 10) { const r = el("div", "bx-satir pf-vurgu"); r.append(el("span", "rk-sira", String(ben.sira)), Ekonomi.isim(ben.ad), el("span", "bx-sag", para(cuzdan ? degerHesap(cuzdan) : ben.deger, 0) + " USDT")); z.append(r); }
    if (ozetVeri && ozetVeri.t) z.append(el("p", "muted bx-ozet-not", `${kacOnce(ozetVeri.t)} önce güncellendi · 10 dakikada bir yenilenir`));
  }
  function haftaCiz() {
    const h = $("bxHafta"); h.textContent = "";
    const liste = ((ozetVeri && ozetVeri.hafta) || []).map((g) => ({ ...g, kaldirac: g.x })).filter((g) => g.sebep !== "yenileme");
    const lik = liste.filter((g) => g.sebep === "likide").sort((a, b) => b.teminat - a.teminat)[0];
    const kar = liste.filter((g) => g.pnl > 0).sort((a, b) => b.pnl - a.pnl)[0];
    const yuzde = liste.filter((g) => g.pnl > 0).sort((a, b) => b.yuzde - a.yuzde)[0];
    const satirlar = [];
    const yap = (ikon, baslik, g, deger, cls) => {
      const r = el("div", "bx-satir");
      r.append(el("span", null, ikon + " " + baslik), Ekonomi.isim(g.ad, undefined, { unvan: false }), el("span", "muted", `${g.coin || "BERKAY"} ${g.kaldirac}x ${g.yon.toUpperCase()}`), el("span", "bx-sag " + cls, deger));
      satirlar.push(r);
    };
    if (kar) yap("🤑", "En kârlı işlem", kar, "+" + para(kar.pnl, 0) + " USDT", "yukari");
    if (yuzde && yuzde !== kar) yap("🚀", "En yüksek getiri", yuzde, "+" + para(yuzde.yuzde, 0) + "%", "yukari");
    if (lik) yap("💀", "Haftanın likide olanı", lik, "−" + para(lik.teminat, 0) + " USDT", "asagi");
    const likSay = liste.filter((g) => g.sebep === "likide").length;
    const r = el("div", "bx-satir"); r.append(el("span", null, `📊 ${liste.length} pozisyon kapandı · ${likSay} likidasyon`)); satirlar.push(r);
    satirlar.forEach((x) => h.append(x));
  }
  function haftaDinle() {
    Ekonomi.ozet((o) => { ozetVeri = o; zenginCiz(); haftaCiz(); if (d) { arenaCiz(); akisCiz(); } });
  }

  // ---------------- Bildirim ----------------
  let toastZaman = null;
  function toast(msg, sure) {
    const t = $("bxToast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastZaman); toastZaman = setTimeout(() => { t.hidden = true; }, sure || 3000);
  }

  // Likide olunca kullanıcıya haber ver
  let oncekiPozIdleri = null;
  setInterval(() => {
    if (!profile || !Object.keys(durumlar).length) return;
    const simdi = new Set(benimPozlar(profile.uid).map((x) => x.p.id));
    if (oncekiPozIdleri) oncekiPozIdleri.forEach((id) => {
      if (!simdi.has(id)) { const g = gecmisListe.find((x) => x.id === id); if (g && g.sebep === "likide") toast(`💀 ${g.coin || "BERKAY"} ${g.kaldirac}x ${g.yon.toUpperCase()} pozisyonun likide oldu (−${para(g.teminat)} USDT)`, 7000); }
    });
    oncekiPozIdleri = simdi;
  }, 2000);
})();
