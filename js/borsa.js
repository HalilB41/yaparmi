// ============================================================
// borsa.js — sadece borsa.html: BERKAY borsası (kullanıcı tarafı).
// Her para işlemi /api/borsa üzerinden SUNUCUDA yapılır; burası sadece
// gösterir ve tahmin hesaplar. Veri yapısı için bkz. api/borsa.js başı.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const E = window.BorsaEgri;
  const api = window.BorsaApi;
  const sayi = window.BorsaSayi;
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
  let d = null; // borsa/durum
  let cuzdan = null;
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
    eskiMumlar();
    setInterval(() => { if (document.visibilityState === "visible") api("tick").catch(() => {}); }, 10000);
    setInterval(() => { if (d) { arenaCiz(); akisCiz(); } }, 15000);
  }

  // ---------------- Firestore dinleyicileri ----------------
  function dinle() {
    db.collection("borsa").doc("durum").onSnapshot((s) => {
      if (!s.exists) return;
      d = s.data();
      d.poz = d.poz || {}; d.akis = d.akis || []; d.son = d.son || [];
      grafikGuncelle();
      seritCiz(); pozlarimCiz(); arenaCiz(); akisCiz(); tahminleriCiz(); cuzdanCiz();
      $("bxX").max = String(d.maxKaldirac || 20);
    }, (err) => console.warn("durum:", err.message));

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

  async function eskiMumlar() {
    const gunler = [];
    for (let i = 0; i < 4; i++) gunler.push(window.BorsaGun(Date.now() - i * 86400000));
    await Promise.all(gunler.map(async (g) => {
      try {
        const s = await db.collection("borsa_grafik").doc(g).get();
        if (s.exists) (s.data().m || []).forEach((m) => gecmisMumlar.set(m.t, m));
      } catch { /* yok */ }
    }));
    grafikGuncelle();
  }

  function tumMumlar() {
    const m = new Map(gecmisMumlar);
    if (d) d.son.forEach((x) => m.set(x.t, x));
    return [...m.values()].sort((a, b) => a.t - b.t);
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
    $("bxHacim").textContent = para(gun.reduce((t, m) => t + (m.v || 0), 0), 0) + " TL";
    $("bxDolasim").textContent = para(d.toplamArz - d.kasaBKC, 0) + " / " + para(d.toplamArz, 0);
    $("bxPiyasa").innerHTML = d.acik ? '<span class="bx-nokta ok"></span>Açık' : '<span class="bx-nokta"></span>Kapalı';
    document.title = `${sayi(d.fiyat)} BERKAY · Berkay Borsası`;
  }

  // ---------------- Cüzdan ----------------
  function cuzdanCiz() {
    if (!cuzdan) return;
    if (sonUrunler) marketCiz(sonUrunler);
    $("bxBkc").textContent = para(cuzdan.bkc, 4);
    $("bxBtl").textContent = para(cuzdan.btl, 2);
    if (d) {
      const acikDeger = Object.values(d.poz).filter((p) => p.uid === profile.uid).reduce((t, p) => t + Math.max(0, p.teminat + E.pnl(p, d.fiyat, d.derinlik)), 0);
      $("bxToplam").textContent = para(cuzdan.bkc * d.fiyat + cuzdan.btl + acikDeger, 2) + " TL";
    }
    const g = $("bxGercek");
    g.textContent = isaretli(cuzdan.gerceklesen || 0) + " TL";
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
    $("bxSpotEtiket").textContent = spotYon === "al" ? "Harcanacak TL" : "Satılacak BERKAY";
    $("bxSpotBirim").textContent = spotYon === "al" ? "TL" : "BERKAY";
    $("bxSpotBtn").textContent = spotYon === "al" ? "BERKAY al" : "BERKAY sat";
    $("bxSpotBtn").className = "bx-gonder " + (spotYon === "al" ? "al" : "sat");
    $("bxSpotMiktar").value = "";
    tahminleriCiz();
  }));
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
      const max = spotYon === "al" ? cuzdan.btl : cuzdan.bkc;
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
    const st = $("bxSpotTahmin"); st.textContent = "";
    const m = Number($("bxSpotMiktar").value);
    if (spotYon === "al") {
      satir(st, "Kullanılabilir", para(cuzdan ? cuzdan.btl : 0) + " TL");
      if (m > 0) {
        const r = E.al(p, m, D);
        satir(st, "Alacağın", "≈ " + para(r.q, 4) + " BERKAY");
        satir(st, "Ortalama fiyat", sayi(m / r.q));
        satir(st, "Fiyat etkisi", "+" + ((r.p1 / p - 1) * 100).toFixed(2) + "%", "yukari");
      }
    } else {
      satir(st, "Kullanılabilir", para(cuzdan ? cuzdan.bkc : 0, 4) + " BERKAY");
      if (m > 0) {
        const r = E.sat(p, m, D);
        satir(st, "Alacağın", "≈ " + para(r.N) + " TL");
        satir(st, "Ortalama fiyat", sayi(r.N / m));
        satir(st, "Fiyat etkisi", ((r.p1 / p - 1) * 100).toFixed(2) + "%", "asagi");
      }
    }
    const kt = $("bxKTahmin"); kt.textContent = "";
    const M = Number($("bxTeminat").value), x = Number($("bxX").value);
    satir(kt, "Kullanılabilir", para(cuzdan ? cuzdan.btl : 0) + " TL");
    if (M > 0) {
      const N = M * x;
      const r = kYon === "long" ? E.al(p, N, D) : E.shortAc(p, N, D);
      const poz = { yon: kYon, teminat: M, notional: N, boyut: r.q };
      const etki = (r.p1 / p - 1) * 100;
      if (N > D * 0.5) satir(kt, "⚠️ En fazla büyüklük", para(D * 0.5, 0) + " TL", "asagi");
      satir(kt, "Pozisyon büyüklüğü", para(N) + " TL");
      satir(kt, "Ortalama giriş", sayi(N / r.q));
      satir(kt, "Fiyatı iter", (etki >= 0 ? "+" : "") + etki.toFixed(2) + "% → " + sayi(r.p1), etki >= 0 ? "yukari" : "asagi");
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
    calistir($("bxSpotBtn"), () => api(spotYon === "al" ? "spotAl" : "spotSat", spotYon === "al" ? { btl: m } : { bkc: m })).then((r) => { if (r) $("bxSpotMiktar").value = ""; });
  });
  $("bxKBtn").addEventListener("click", () => {
    const M = Number($("bxTeminat").value), x = Number($("bxX").value);
    if (!(M >= 1)) { durumYaz("Teminat en az 1 TL.", true); return; }
    if (x >= 15 && !confirm(`${x}x kaldıraç çok riskli: fiyat yaklaşık %${(90 / x).toFixed(1)} ters giderse teminatın gider. Devam?`)) return;
    calistir($("bxKBtn"), () => api("pozAc", { yon: kYon, kaldirac: x, teminat: M })).then((r) => { if (r) $("bxTeminat").value = ""; });
  });

  // ---------------- Pozisyonlar ----------------
  function pozlarimCiz() {
    const tb = $("bxPozlarim");
    const benim = Object.values(d.poz).filter((p) => p.uid === profile.uid).sort((a, b) => b.acilis - a.acilis);
    tb.textContent = "";
    if (!benim.length) { const tr = el("tr"); const td = el("td", "muted", "Açık pozisyonun yok."); td.colSpan = 8; tr.append(td); tb.append(tr); return; }
    benim.forEach((p) => {
      const pnl = E.pnl(p, d.fiyat, d.derinlik), yuzde = (pnl / p.teminat) * 100;
      const tr = el("tr");
      const yon = el("td"); yon.append(el("span", "bx-rozet " + (p.yon === "long" ? "al" : "sat"), `${p.kaldirac}x ${p.yon === "long" ? "LONG" : "SHORT"}`));
      tr.append(yon, el("td", null, para(p.teminat) + " TL"), el("td", null, para(p.notional) + " TL"), el("td", null, sayi(p.giris)), el("td", null, sayi(d.fiyat)), el("td", "asagi", sayi(E.lik(p, d.derinlik))));
      const kz = el("td", pnl >= 0 ? "yukari" : "asagi"); kz.innerHTML = `<b>${isaretli(pnl)} TL</b><br><small>${isaretli(yuzde)}%</small>`; tr.append(kz);
      const td = el("td", "bx-butonlar");
      const kapat = el("button", "admin-btn reject", "Kapat");
      kapat.type = "button";
      kapat.addEventListener("click", () => calistir(kapat, () => api("pozKapat", { id: p.id })).then((r) => {
        if (r && r.sonuc) { toast(`${r.sonuc.pnl >= 0 ? "🤑" : "😬"} ${isaretli(r.sonuc.pnl)} TL (${isaretli(r.sonuc.yuzde)}%)`, 4000); if (r.sonuc.pnl > 0) paylasAc(r.sonuc, false); }
      }));
      const pay = el("button", "admin-btn", "📤");
      pay.type = "button"; pay.title = "Paylaş";
      pay.addEventListener("click", () => paylasAc(Object.assign({}, p, { pnl, yuzde, cikis: d.fiyat }), true));
      td.append(kapat, pay); tr.append(td);
      tb.append(tr);
    });
  }

  function arenaCiz() {
    const a = $("bxArena"); a.textContent = "";
    const hepsi = Object.values(d.poz).map((p) => Object.assign({}, p, { pnl: E.pnl(p, d.fiyat, d.derinlik) })).sort((x, y) => y.pnl / y.teminat - x.pnl / x.teminat);
    if (!hepsi.length) { a.append(el("p", "muted", "Kimse kaldıraçta değil. İlk sen ol.")); return; }
    hepsi.forEach((p) => {
      const yuzde = (p.pnl / p.teminat) * 100;
      const row = el("div", "bx-satir");
      row.append(el("b", null, p.ad), el("span", "bx-rozet " + (p.yon === "long" ? "al" : "sat"), `${p.kaldirac}x ${p.yon === "long" ? "LONG" : "SHORT"}`), el("span", "muted", para(p.notional, 0) + " TL"));
      const kz = el("span", "bx-sag " + (yuzde >= 0 ? "yukari" : "asagi"), isaretli(yuzde) + "%");
      row.append(kz);
      a.append(row);
    });
  }

  const AKIS = { al: "🟢 aldı", sat: "🔴 sattı", long: "📈 LONG açtı", short: "📉 SHORT açtı", kapat: "✅ pozisyon kapattı", lik: "💀 LİKİDE OLDU" };
  function akisCiz() {
    const a = $("bxAkis"); a.textContent = "";
    if (!d.akis.length) { a.append(el("p", "muted", "Henüz işlem yok.")); return; }
    d.akis.slice(0, 15).forEach((k) => {
      const row = el("div", "bx-satir" + (k.tur === "lik" ? " bx-lik" : ""));
      let ne = AKIS[k.tur] || k.tur;
      if (k.x && (k.tur === "long" || k.tur === "short" || k.tur === "kapat" || k.tur === "lik")) ne = `${k.x}x ` + ne;
      row.append(el("b", null, k.ad), el("span", null, ne), el("span", "muted", para(k.m, 0) + " TL"), el("span", "bx-sag muted", kacOnce(k.t)));
      a.append(row);
    });
  }

  function gecmisCiz() {
    const tb = $("bxGecmis"); tb.textContent = "";
    if (!gecmisListe.length) { const tr = el("tr"); const td = el("td", "muted", "Henüz kapanmış pozisyon yok."); td.colSpan = 7; tr.append(td); tb.append(tr); return; }
    gecmisListe.forEach((g) => {
      const tr = el("tr");
      const yon = el("td"); yon.append(el("span", "bx-rozet " + (g.yon === "long" ? "al" : "sat"), `${g.kaldirac}x ${g.yon === "long" ? "LONG" : "SHORT"}`));
      tr.append(el("td", null, new Date(g.kapanis).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })), yon, el("td", null, para(g.teminat) + " TL"), el("td", null, sayi(g.giris) + " → " + sayi(g.cikis)));
      const kz = el("td", g.pnl >= 0 ? "yukari" : "asagi"); kz.innerHTML = `<b>${isaretli(g.pnl)} TL</b><br><small>${isaretli(g.yuzde)}%</small>`; tr.append(kz);
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
      b.append(alt);
      const btn = el("button", "btn", "Satın al");
      btn.type = "button";
      btn.disabled = u.stok === 0;
      const ilerleme = el("div", "bx-ilerleme");
      const oran = cuzdan ? Math.min(1, cuzdan.bkc / u.fiyat) : 0;
      const bar = el("i"); bar.style.width = (oran * 100).toFixed(1) + "%"; ilerleme.append(bar);
      ilerleme.title = oran >= 1 ? "Alabilirsin!" : `%${(oran * 100).toFixed(0)} biriktirdin`;
      btn.addEventListener("click", () => {
        if (!confirm(`${u.emoji || "🎁"} ${u.ad} için ${u.fiyat} BERKAY harcanacak. Emin misin?`)) return;
        calistir(btn, () => api("marketAl", { urunId: u.id })).then((r) => { if (r) toast(r.mesaj, 5000); });
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
    ctx.fillStyle = "#f5b82e"; ctx.beginPath(); ctx.arc(130, 140, 54, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a2800"; ctx.font = `800 64px ${DISP}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("B", 130, 144);
    ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = `800 52px ${DISP}`; ctx.fillText("BERKAY", 210, 124);
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
    ctx.fillText((g.pnl >= 0 ? "+" : "") + para(g.pnl) + " TL", 80, 740);
    // detaylar
    const satirlar = [["Giriş fiyatı", sayi(g.giris)], [acik ? "Anlık fiyat" : "Çıkış fiyatı", sayi(g.cikis)], ["Teminat", para(g.teminat) + " TL"]];
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
    return `${kar ? "🤑" : "💀"} BERKAY ${g.kaldirac}x ${g.yon === "long" ? "LONG" : "SHORT"} ${acik ? "(açık)" : ""}\n` +
      `${(g.yuzde >= 0 ? "+" : "") + g.yuzde.toFixed(2)}%  ·  ${(g.pnl >= 0 ? "+" : "") + para(g.pnl)} TL\n` +
      `Giriş ${sayi(g.giris)} → ${acik ? "şimdi" : "çıkış"} ${sayi(g.cikis)}\n` +
      `Sen de dene: ${location.origin}/borsa`;
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

  // ---------------- Bildirim ----------------
  let toastZaman = null;
  function toast(msg, sure) {
    const t = $("bxToast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastZaman); toastZaman = setTimeout(() => { t.hidden = true; }, sure || 3000);
  }

  // Likide olunca kullanıcıya haber ver
  let oncekiPozIdleri = null;
  setInterval(() => {
    if (!d || !profile) return;
    const simdi = new Set(Object.values(d.poz).filter((p) => p.uid === profile.uid).map((p) => p.id));
    if (oncekiPozIdleri) oncekiPozIdleri.forEach((id) => {
      if (!simdi.has(id)) { const g = gecmisListe.find((x) => x.id === id); if (g && g.sebep === "likide") toast(`💀 ${g.kaldirac}x ${g.yon.toUpperCase()} pozisyonun likide oldu (−${para(g.teminat)} TL)`, 7000); }
    });
    oncekiPozIdleri = simdi;
  }, 2000);
})();
