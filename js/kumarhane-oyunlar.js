// ============================================================
// kumarhane-oyunlar.js — kumarhane.html: oyun sekmeleri, seviye şeridi, görevler + lig,
// Mines, Plinko, Blackjack. (Crash + Düello: kumarhane.js)
// Bütün sonuçlar sunucuda (api/borsa.js → kumarIslem); burası sadece gösterir ve canlandırır.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const para = (x, k = 2) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const yavas = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof db === "undefined" || !db) return;

  let profile = null, cuzdan = null, basladi = false, ozetVeri = null;
  function durumYaz(id, msg, hata) { const e = $(id); e.textContent = msg || ""; e.className = "bx-durum" + (hata ? " hata" : ""); }

  // ---------------- Sekmeler ----------------
  const sekmeler = [...document.querySelectorAll(".km-sekmeler [data-oyun]")];
  const bolumler = [...document.querySelectorAll(".km-oyun")];
  function ac(ad, kaydir) {
    if (!bolumler.some((b) => b.dataset.oyun === ad)) ad = "crash";
    sekmeler.forEach((b) => { const on = b.dataset.oyun === ad; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    bolumler.forEach((b) => { b.hidden = b.dataset.oyun !== ad; });
    if (!location.hash.startsWith("#d=") && location.hash.slice(1) !== ad) history.replaceState(null, "", "#" + ad);
    window.dispatchEvent(new Event("resize")); // gizliyken boyutu 0 olan tuvaller toparlansın
    if (ad === "plinko") plinkoCiz();
    window.dispatchEvent(new CustomEvent("km-sekme", { detail: ad }));
    if (kaydir) document.querySelector(".km-sekmeler").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  sekmeler.forEach((b) => b.addEventListener("click", () => ac(b.dataset.oyun)));
  const hashOyun = () => (location.hash.startsWith("#d=") ? "duello" : location.hash.slice(1));
  window.addEventListener("hashchange", () => ac(hashOyun(), true));
  ac(hashOyun());

  window.YaparmiAuth.onChange((p) => {
    profile = p;
    if (p && !basladi) { basladi = true; baslat(); }
  });

  function baslat() {
    Ekonomi.cuzdanim((c) => {
      cuzdan = c;
      const s = $("kmSeviye"); s.textContent = ""; s.append(Oyuncu.seviyeKarti(c));
      Oyuncu.seviyeKutla(c);
      Oyuncu.gorevlerCiz($("kmGorevler"), c, Oyuncu.gorevAl);
      gorevSayaci(c);
      minesDurumdan(c);
      bjDurumdan(c);
    });
    Ekonomi.ozet((o) => { ozetVeri = o; Oyuncu.ligCiz($("kmLig"), o, profile && profile.uid); });
  }
  async function gorevSayaci(c) {
    const gun = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
    const l = await Oyuncu.gunGorevleri(gun);
    const gv = c && c.gorev && c.gorev.g === gun ? c.gorev : { s: {}, al: [] };
    const hazir = l.filter((g) => ((gv.s || {})[g.id] || 0) >= g.hedef && !(gv.al || []).includes(g.id)).length;
    const r = $("kmGorevSay"); r.hidden = !hazir; r.textContent = String(hazir);
  }

  // ================= MINES =================
  let mn = null; // son görünüm (sunucu cevabı ya da cüzdandan)
  let mnMesgul = false;
  const izgara = $("mnIzgara");
  for (let i = 0; i < 25; i++) {
    const b = el("button", "km-kutu"); b.type = "button"; b.dataset.i = String(i); b.setAttribute("aria-label", `Kutu ${i + 1}`);
    b.addEventListener("click", () => minesAc(i));
    izgara.append(b);
  }
  $("mnBomba").addEventListener("input", () => { $("mnBombaYazi").textContent = $("mnBomba").value; minesCiz(); });
  // Sunucuyla aynı: adil çarpan × %97
  function minesCarpan(bomba, k) { let x = 0.97; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - i - bomba); return Math.floor(x * 100) / 100; }
  function minesDurumdan(c) {
    // Sayfa yenilenince açık oyun kaldığı yerden devam etsin (cüzdandan; bombalar orada yok)
    if (!c || !c.mines) return;
    if (!mn || mn.acilan.length !== c.mines.acilan.length || mn.durum !== c.mines.durum) {
      if (c.mines.durum === "acik" || !mn) mn = Object.assign({ bombalar: null }, c.mines, { carpan: c.mines.acilan.length ? minesCarpan(c.mines.bomba, c.mines.acilan.length) : 1 });
    }
    minesCiz();
  }
  function minesCiz() {
    const acik = mn && mn.durum === "acik";
    const bitti = mn && mn.durum !== "acik";
    [...izgara.children].forEach((b, i) => {
      const acildi = mn && mn.acilan.includes(i);
      const bomba = bitti && mn.bombalar && mn.bombalar.includes(i);
      b.className = "km-kutu" + (acildi ? " elmas" : "") + (bomba ? (mn.patlayan === i ? " bomba patlayan" : " bomba") : "") + (bitti && !acildi && !bomba ? " sonuk" : "");
      b.textContent = acildi ? "💎" : bomba ? "💣" : "";
      b.disabled = !acik || acildi || mnMesgul;
    });
    const bomba = acik ? mn.bomba : Number($("mnBomba").value);
    const k = acik ? mn.acilan.length : 0;
    $("mnCarpan").textContent = (acik ? mn.carpan || 1 : bitti && mn.durum === "cekildi" ? minesCarpan(mn.bomba, mn.acilan.length) : 1).toFixed(2) + "x";
    $("mnSonraki").textContent = k < 25 - bomba ? `Sonraki kutu: ${minesCarpan(bomba, k + 1).toFixed(2)}x` : "Hepsi açıldı";
    $("mnBomba").disabled = !!acik; $("mnMiktar").disabled = !!acik;
    const btn = $("mnBtn");
    if (acik && mn.acilan.length) { btn.textContent = `💰 Çek · +${para(mn.miktar * mn.carpan)}`; btn.className = "bx-gonder al km-buyuk km-cek"; btn.disabled = mnMesgul; }
    else if (acik) { btn.textContent = "Bir kutu aç…"; btn.className = "bx-gonder km-buyuk pasif"; btn.disabled = true; }
    else { btn.textContent = "💣 Başla"; btn.className = "bx-gonder al km-buyuk"; btn.disabled = mnMesgul; }
  }
  async function minesIstek(islem, veri) {
    mnMesgul = true; minesCiz();
    try { const r = await Ekonomi.api(islem, veri); mn = r.mines; return r; }
    catch (err) { durumYaz("mnDurum", "⚠️ " + err.message, true); return null; }
    finally { mnMesgul = false; minesCiz(); }
  }
  $("mnBtn").addEventListener("click", async () => {
    if (mn && mn.durum === "acik") {
      const r = await minesIstek("minesCek");
      if (r) { durumYaz("mnDurum", `🤑 ${r.mines.carpan.toFixed(2)}x'te çektin: +${para(r.mines.odeme)} BERKAY`); Ekonomi.toast(`💎 Mines · +${para(r.mines.odeme)} BERKAY`, 3500); }
      return;
    }
    const m = Math.round(Number($("mnMiktar").value));
    if (!(m >= 1)) { durumYaz("mnDurum", "Bahis en az 1 BERKAY.", true); return; }
    const r = await minesIstek("minesBasla", { miktar: m, bomba: Number($("mnBomba").value) });
    if (r) durumYaz("mnDurum", `${m} BERKAY · ${r.mines.bomba} bomba. Bir kutu seç!`);
  });
  async function minesAc(i) {
    if (!mn || mn.durum !== "acik" || mnMesgul) return;
    const r = await minesIstek("minesAc", { kutu: i });
    if (!r) return;
    if (r.mines.durum === "patladi") { durumYaz("mnDurum", "💥 Bombaya bastın, bahis yandı.", true); izgara.classList.add("salla"); setTimeout(() => izgara.classList.remove("salla"), 450); }
    else if (r.mines.durum === "cekildi") durumYaz("mnDurum", `🏆 Bütün elmasları buldun: +${para(r.mines.odeme)} BERKAY`);
    else durumYaz("mnDurum", `💎 Güvenli! Çekersen +${para(r.mines.miktar * r.mines.carpan)} BERKAY`);
  }
  minesCiz();

  // ================= PLINKO =================
  const PLINKO = {
    dusuk: [10, 3, 1.6, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.6, 3, 10],
    orta: [30, 10, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 10, 30],
    yuksek: [100, 20, 8, 2.2, 0.6, 0.3, 0.2, 0.3, 0.6, 2.2, 8, 20, 100],
  };
  const SIRA = 12;
  let risk = "orta";
  const toplar = []; // { yol, t0, kutu, carpan, bitti }
  const vurgu = {}; // kutu → zaman (parlama)
  document.querySelectorAll("#plRisk button").forEach((b) => b.addEventListener("click", () => {
    if (toplar.some((t) => !t.bitti)) return; // düşen top varken değiştirme
    risk = b.dataset.risk;
    document.querySelectorAll("#plRisk button").forEach((x) => x.classList.toggle("on", x === b));
    plinkoCiz();
  }));
  const tuval = $("plTuval"); let ctx = null, W = 0, H = 0;
  function boyut() {
    const r = tuval.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width) return;
    W = r.width; H = r.height;
    tuval.width = Math.round(W * dpr); tuval.height = Math.round(H * dpr);
    ctx = tuval.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    plinkoCiz();
  }
  window.addEventListener("resize", boyut);
  // Geometri: sıra r'de r+3 çivi (üstte 3), son sıranın altında 13 kutu
  const geo = () => {
    const ust = 24, alt = 46, aralik = Math.min((W - 30) / (SIRA + 2), (H - ust - alt) / SIRA);
    return { ust, aralik, merkez: W / 2, kutuY: ust + SIRA * aralik + 6 };
  };
  const civi = (g, r, i) => ({ x: g.merkez + (i - (r + 2) / 2) * g.aralik, y: g.ust + r * g.aralik });
  function topKonum(t, g, an) {
    // Her sırada yarım aralık sola/sağa; sıralar arası küçük bir zıplama eğrisi
    const sure = 2200, ilerleme = Math.min(1, (an - t.t0) / sure) * (SIRA + 1);
    const r = Math.min(SIRA, Math.floor(ilerleme)), f = Math.min(1, ilerleme - r);
    let x = 0; for (let i = 0; i < r && i < SIRA; i++) x += t.yol[i] ? 0.5 : -0.5;
    const hedefX = r < SIRA ? x + (t.yol[r] ? 0.5 : -0.5) : x;
    const xx = x + (hedefX - x) * f;
    const y0 = g.ust - g.aralik * 0.6 + r * g.aralik, y1 = y0 + g.aralik;
    const yy = r < SIRA ? y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * g.aralik * 0.35 : g.kutuY + 10;
    return { x: g.merkez + xx * g.aralik, y: yy, bitti: ilerleme >= SIRA + 1 };
  }
  function renk(m) { return m >= 10 ? "#e5484d" : m >= 3 ? "#f76b15" : m >= 1.5 ? "#f5b82e" : m >= 1 ? "#46a758" : "#3b82f6"; }
  let ciziliyor = false;
  function plinkoCiz() {
    if (!ctx || $("plinko").hidden) return;
    const an = performance.now(), g = geo();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let r = 0; r < SIRA; r++) for (let i = 0; i < r + 3; i++) { const p = civi(g, r, i); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, g.aralik * 0.1), 0, Math.PI * 2); ctx.fill(); }
    // kutular
    const t = PLINKO[risk], kw = g.aralik * 0.92;
    t.forEach((m, i) => {
      const x = g.merkez + (i - 6) * g.aralik - kw / 2, y = g.kutuY;
      const parla = vurgu[i] && an - vurgu[i] < 500 ? 1 - (an - vurgu[i]) / 500 : 0;
      ctx.fillStyle = renk(m); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y + parla * 4, kw, 26, 6) : ctx.rect(x, y, kw, 26); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.max(8, Math.min(12, kw * 0.32))}px JetBrains Mono, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(m + (m < 10 ? "x" : ""), x + kw / 2, y + 13 + parla * 4);
    });
    // toplar
    let devam = false;
    toplar.forEach((tp) => {
      if (tp.bitti) return;
      const k = topKonum(tp, g, an);
      if (k.bitti) { tp.bitti = true; vurgu[tp.kutu] = an; topDustu(tp); devam = true; return; }
      devam = true;
      ctx.fillStyle = "#ff3d8b"; ctx.beginPath(); ctx.arc(k.x, k.y, Math.max(4, g.aralik * 0.22), 0, Math.PI * 2); ctx.fill();
    });
    if (devam || Object.values(vurgu).some((v) => an - v < 500)) { if (!ciziliyor) { ciziliyor = true; requestAnimationFrame(() => { ciziliyor = false; plinkoCiz(); }); } }
  }
  function topDustu(tp) {
    const son = $("plSon");
    son.prepend(el("span", "km-chip " + (tp.carpan >= 10 ? "efsane" : tp.carpan >= 1 ? "iyi" : "kotu"), tp.carpan + "x"));
    while (son.children.length > 12) son.lastChild.remove();
    durumYaz("plDurum", tp.odeme >= tp.miktar ? `🤑 ${tp.carpan}x · +${para(tp.odeme)} BERKAY` : `${tp.carpan}x · ${para(tp.odeme)} BERKAY geri`);
    if (tp.carpan >= 10) Ekonomi.toast(`🔻 Plinko ${tp.carpan}x! +${para(tp.odeme)} BERKAY`, 4000);
  }
  let plMesgul = false;
  $("plBtn").addEventListener("click", async () => {
    if (plMesgul) return;
    const m = Math.round(Number($("plMiktar").value));
    if (!(m >= 1)) { durumYaz("plDurum", "Bahis en az 1 BERKAY.", true); return; }
    plMesgul = true; $("plBtn").disabled = true;
    try {
      const r = await Ekonomi.api("plinko", { miktar: m, risk });
      toplar.push({ yol: r.yol, kutu: r.kutu, carpan: r.carpan, odeme: r.odeme, miktar: m, t0: performance.now() - (yavas ? 99999 : 0) });
      while (toplar.length > 30) toplar.shift();
      plinkoCiz();
    } catch (err) { durumYaz("plDurum", "⚠️ " + err.message, true); }
    finally { setTimeout(() => { plMesgul = false; $("plBtn").disabled = false; }, 350); }
  });
  setTimeout(boyut, 50);

  // ================= BLACKJACK =================
  let bj = null, bjMesgul = false;
  const RENK = ["♠", "♥", "♦", "♣"], DEGER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  function kart(i, gizli, gecikme) {
    const k = el("div", "km-kart-yuz" + (gizli ? " arka" : ""));
    if (!gizli) {
      const r = Math.floor(i / 13), kirmizi = r === 1 || r === 2;
      k.classList.add(kirmizi ? "kirmizi" : "siyah");
      k.append(el("b", null, DEGER[i % 13]), el("span", null, RENK[r]));
      k.setAttribute("aria-label", DEGER[i % 13] + " " + ["maça", "kupa", "karo", "sinek"][r]);
    } else k.setAttribute("aria-label", "kapalı kart");
    if (gecikme != null && !yavas) k.style.animationDelay = gecikme + "ms";
    return k;
  }
  let oncekiKartSay = { sen: 0, kasa: 0 };
  function bjCiz() {
    const sen = $("bjSen"), kasa = $("bjKasa");
    sen.textContent = ""; kasa.textContent = "";
    const oyunda = bj && bj.durum === "oyun";
    if (bj) {
      bj.oyuncu.forEach((k, i) => sen.append(kart(k, false, i >= oncekiKartSay.sen ? (i - oncekiKartSay.sen) * 150 : null)));
      bj.kasa.forEach((k, i) => kasa.append(kart(k, false, i >= oncekiKartSay.kasa ? (i - oncekiKartSay.kasa) * 150 + 100 : null)));
      if (oyunda) kasa.append(kart(0, true));
      oncekiKartSay = { sen: bj.oyuncu.length, kasa: bj.kasa.length };
      $("bjSenT").textContent = String(bj.oyuncuToplam);
      $("bjKasaT").textContent = String(bj.kasaToplam) + (oyunda ? "+?" : "");
      const S = { blackjack: ["🃏 BLACKJACK!", "yukari"], kazandi: ["🏆 Kazandın", "yukari"], berabere: ["🤝 Berabere, bahis iade", ""], kaybetti: ["😬 Kasa kazandı", "asagi"], patladi: ["💥 21'i geçtin", "asagi"], kasaBJ: ["🃏 Kasada blackjack", "asagi"] };
      const s = bj.sonuc && S[bj.sonuc];
      $("bjSonuc").textContent = oyunda ? `${para(bj.miktar, 0)} BERKAY oynanıyor${bj.ikiye ? " (ikiye katlandı)" : ""}` : s ? `${s[0]}${bj.odeme ? " · +" + para(bj.odeme) : ""}` : "";
      $("bjSonuc").className = "km-masa-orta " + (s ? s[1] : "");
    } else { $("bjSenT").textContent = ""; $("bjKasaT").textContent = ""; }
    $("bjBasla").hidden = oyunda; $("bjMiktar").disabled = oyunda;
    ["bjKart", "bjDur"].forEach((id) => { $(id).hidden = !oyunda; $(id).disabled = bjMesgul; });
    $("bjIkiye").hidden = !(oyunda && bj.oyuncu.length === 2); $("bjIkiye").disabled = bjMesgul;
    $("bjBasla").disabled = bjMesgul;
  }
  function bjToplam(kartlar) { let t = 0, as = 0; for (const k of kartlar) { const v = k % 13; if (v === 0) { as++; t += 11; } else t += Math.min(10, v + 1); } while (t > 21 && as) { t -= 10; as--; } return t; }
  function bjDurumdan(c) {
    // Yarım kalan el sayfa yenilenince geri gelsin
    if (!c || !c.bj || bj) return;
    if (c.bj.durum === "oyun") {
      bj = { miktar: c.bj.miktar, oyuncu: c.bj.oyuncu, kasa: c.bj.kasa, durum: "oyun", ikiye: !!c.bj.ikiye, oyuncuToplam: bjToplam(c.bj.oyuncu), kasaToplam: bjToplam([c.bj.kasa[0]]) };
      oncekiKartSay = { sen: bj.oyuncu.length, kasa: bj.kasa.length };
      bjCiz();
    }
  }
  async function bjIstek(islem, veri) {
    bjMesgul = true; bjCiz();
    try {
      const r = await Ekonomi.api(islem, veri);
      if (islem === "bjBasla") oncekiKartSay = { sen: 0, kasa: 0 };
      bj = r.bj;
      durumYaz("bjDurum", "");
      if (bj.durum !== "oyun" && bj.odeme > bj.miktar) Ekonomi.toast(`🃏 +${para(bj.odeme)} BERKAY`, 3000);
    } catch (err) { durumYaz("bjDurum", "⚠️ " + err.message, true); }
    finally { bjMesgul = false; bjCiz(); }
  }
  $("bjBasla").addEventListener("click", () => {
    const m = Math.round(Number($("bjMiktar").value));
    if (!(m >= 1)) { durumYaz("bjDurum", "Bahis en az 1 BERKAY.", true); return; }
    bjIstek("bjBasla", { miktar: m });
  });
  $("bjKart").addEventListener("click", () => bjIstek("bjKart"));
  $("bjDur").addEventListener("click", () => bjIstek("bjDur"));
  $("bjIkiye").addEventListener("click", () => bjIstek("bjIkiye"));
  bjCiz();
})();
