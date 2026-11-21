// ============================================================
// kumarhane.js — sadece kumarhane.html: Crash + Düello.
// Bütün para işleri sunucuda (api/borsa.js → kumarIslem). Burası sadece gösterir.
//
// CRASH: tur zamanlaması herkes için aynı (30 sn: 7 sn bahis + uçuş). Çarpan saatten hesaplanır;
// roketin düşüp düşmediğini sunucuya sorarız (GET, Vercel'de 1 sn önbellekli → sunucuyu yormaz).
// DÜELLO: duello koleksiyonu dinlenir (son 40), kabul/iptal sunucuda.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const para = (x, k = 2) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const kacOnce = (t) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + " sn" : s < 3600 ? Math.round(s / 60) + " dk" : s < 86400 ? Math.round(s / 3600) + " sa" : Math.round(s / 86400) + " gün"; };

  let profile = null, basladi = false, cuzdan = null;

  $("ekGirisBtn").addEventListener("click", (e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); const t = $("authToggle"), p = $("authPanel"); if (t && p && p.hidden) t.click(); });
  if (typeof db === "undefined" || !db) { $("ekKapiYazi").textContent = "Şu an bağlı değil."; return; }
  window.YaparmiAuth.onChange((p) => {
    profile = p;
    if (!p) {
      $("ekIcerik").hidden = true; $("ekKapi").hidden = false;
      $("ekKapiYazi").innerHTML = "Kumarhaneye girmek için <b>kayıt olman</b> gerekiyor. Kayıt olunca hesabına 200 BERKAY hediye ediliyor.";
      $("ekGirisBtn").hidden = false;
      return;
    }
    $("ekKapi").hidden = true; $("ekIcerik").hidden = false;
    if (!basladi) { basladi = true; baslat(); }
  });

  function baslat() {
    // Cüzdan yoksa (hiç borsaya girmemiş) sunucu açsın
    Ekonomi.api("baslat").catch(() => {});
    Ekonomi.cuzdanim((c) => { cuzdan = c; $("kmBakiye").textContent = c ? para(c.bkc || 0) + " BERKAY" : "0 BERKAY"; benimCiz(); duelloCiz(); });
    crashBaslat();
    duelloBaslat();
  }

  function durumYaz(id, msg, hata) { const e = $(id); e.textContent = msg || ""; e.className = "bx-durum" + (hata ? " hata" : ""); }

  // ======================= CRASH =======================
  let ayar = { TUR_MS: 30000, BAHIS_MS: 7000, HIZ: 0.15, UST: 31.5, MIN: 1, MAX: 500 };
  let fark = null; // sunucu saati − yerel saat
  const dusen = {}; // tur → çöküş noktası (sunucu söyledikçe)
  let gecmis = [];
  let soruluyor = false, sonSoru = 0, cekiliyor = false, giriliyor = false;
  const simdi = () => Date.now() + (fark || 0);
  const anHesapla = (t) => { const tur = Math.floor(t / ayar.TUR_MS), bas = tur * ayar.TUR_MS; return { tur, bas, ucus: t - bas - ayar.BAHIS_MS }; };
  const carpanHesapla = (ucus) => (ucus <= 0 ? 1 : Math.min(ayar.UST, Math.floor(Math.exp((ayar.HIZ * ucus) / 1000) * 100) / 100));

  async function durumSor() {
    if (soruluyor) return;
    soruluyor = true; sonSoru = Date.now();
    try {
      const r = await fetch("/api/borsa?islem=crashDurum", { cache: "no-store" });
      const j = await r.json();
      if (!j || !j.ok) return;
      const f = j.sunucu - Date.now();
      // Önbellekten gelen cevap en fazla ~1 sn bayat: en tazesini (en büyüğünü) saat farkı say
      fark = fark == null ? f : Math.max(fark, f);
      if (j.ayar) ayar = Object.assign(ayar, j.ayar);
      (j.gecmis || []).forEach((g) => { dusen[g.tur] = g.nokta; });
      if (j.faz === "dustu" && j.nokta) dusen[j.tur] = j.nokta;
      gecmis = (j.gecmis || []).slice();
      gecmisCiz();
    } catch { /* ağ */ } finally { soruluyor = false; }
  }
  function gecmisCiz() {
    const k = $("crGecmis"); k.textContent = "";
    const an = anHesapla(simdi());
    const l = [];
    for (let t = an.tur; t > an.tur - 16; t--) if (dusen[t] && (t < an.tur || an.ucus >= 0)) l.push({ tur: t, nokta: dusen[t] });
    l.slice(0, 12).forEach((g) => k.append(el("span", "km-chip " + (g.nokta >= 10 ? "efsane" : g.nokta >= 2 ? "iyi" : "kotu"), g.nokta.toFixed(2) + "x")));
  }

  function crashBaslat() {
    durumSor();
    document.querySelectorAll("#crHizli button").forEach((b) => b.addEventListener("click", () => {
      const m = b.dataset.m === "hepsi" ? Infinity : Number(b.dataset.m);
      $("crMiktar").value = String(cuzdan ? Math.max(1, Math.min(m, Math.floor(cuzdan.bkc || 0))) : (m === Infinity ? 10 : m));
    }));
    $("crBtn").addEventListener("click", butonaBasildi);
    tuvalHazirla();
    requestAnimationFrame(dongu);
    setInterval(() => { if (!document.hidden) gecmisCiz(); }, 3000);
  }

  function benimBahis(an) {
    const b = cuzdan && cuzdan.crash;
    return b && b.tur === an.tur ? b : null;
  }
  async function butonaBasildi() {
    const an = anHesapla(simdi());
    const b = benimBahis(an);
    if (b && b.durum === "acik" && an.ucus >= 0 && !dusen[an.tur]) return cek();
    if (!b && an.ucus < 0) return gir();
  }
  async function gir() {
    if (giriliyor) return;
    const m = Math.round(Number($("crMiktar").value));
    if (!(m >= ayar.MIN)) { durumYaz("crDurum", `Bahis en az ${ayar.MIN} BERKAY.`, true); return; }
    const h = Number($("crHedef").value);
    giriliyor = true;
    try { const r = await Ekonomi.api("crashBahis", { miktar: m, hedef: h >= 1.01 ? h : undefined }); durumYaz("crDurum", "✅ " + r.mesaj); }
    catch (err) { durumYaz("crDurum", "⚠️ " + err.message, true); }
    finally { giriliyor = false; }
  }
  async function cek() {
    if (cekiliyor) return;
    cekiliyor = true;
    try {
      const r = await Ekonomi.api("crashCek");
      if (r.gec) durumYaz("crDurum", r.mesaj, !(r.sonuc && r.sonuc.odeme));
      else { durumYaz("crDurum", "🤑 " + r.mesaj); Ekonomi.toast(`🚀 ${r.carpan}x · +${para(r.odeme)} BERKAY`, 4000); }
    } catch (err) { durumYaz("crDurum", "⚠️ " + err.message, true); }
    finally { cekiliyor = false; }
  }

  // ---- çizim ----
  const tuval = $("crTuval"); let ctx = null, W = 0, H = 0;
  function tuvalHazirla() {
    const boyut = () => {
      const r = tuval.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(200, r.width); H = Math.max(160, r.height);
      tuval.width = Math.round(W * dpr); tuval.height = Math.round(H * dpr);
      ctx = tuval.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    boyut();
    window.addEventListener("resize", boyut);
  }
  let sonCizim = 0, sonFaz = "";
  function dongu() {
    requestAnimationFrame(dongu);
    if (document.hidden || $("crash").hidden) return; // başka sekmedeyken çizme, sunucuya sorma
    const now = performance.now();
    if (now - sonCizim < 33) return; // ~30 fps
    sonCizim = now;
    const t = simdi(), an = anHesapla(t);
    const nokta = dusen[an.tur];
    let faz, carpan;
    if (an.ucus < 0) { faz = "bahis"; carpan = 1; }
    else if (nokta && carpan_gecti(an.ucus, nokta)) { faz = "dustu"; carpan = nokta; }
    else { faz = "ucus"; carpan = carpanHesapla(an.ucus); }
    // Uçuşta saniyede bir "düştü mü?" diye sor (sayfa açıkken)
    if (faz === "ucus" && Date.now() - sonSoru > 1000) durumSor();
    if (faz === "bahis" && Date.now() - sonSoru > 8000) durumSor();
    if (faz !== sonFaz) { sonFaz = faz; if (faz === "dustu") gecmisCiz(); }

    // Otomatik çek: hedefe gelince
    const b = benimBahis(an);
    if (b && b.durum === "acik" && b.hedef && faz === "ucus" && carpan >= b.hedef) cek();

    // yazılar
    const cEl = $("crCarpan");
    cEl.textContent = carpan.toFixed(2) + "x";
    cEl.className = "km-carpan " + faz;
    $("crFaz").textContent = faz === "bahis" ? `🕒 Kalkışa ${Math.ceil(-an.ucus / 1000)} sn · bahisler açık` : faz === "ucus" ? "🚀 Uçuyor… zamanında çek!" : `💥 ${carpan.toFixed(2)}x'te patladı · yeni tur ${Math.ceil((an.bas + ayar.TUR_MS - t) / 1000)} sn sonra`;
    butonGuncelle(an, faz, carpan, b);
    tuvalCiz(an, faz, carpan);
  }
  // Sunucunun söylediği nokta yerel çarpana yetiştiyse düşmüş say
  function carpan_gecti(ucus, nokta) { return carpanHesapla(ucus) >= nokta || ucus >= (Math.log(nokta) / ayar.HIZ) * 1000; }

  function butonGuncelle(an, faz, carpan, b) {
    const btn = $("crBtn");
    let yazi, sinif = "al", kapali = false;
    if (b && b.durum === "acik") {
      if (faz === "bahis") { yazi = `✅ ${b.miktar} BERKAY ile girdin${b.hedef ? ` · oto ${b.hedef}x` : ""}`; kapali = true; }
      else if (faz === "ucus") { yazi = `💰 ÇEK · +${para(b.miktar * carpan)}`; sinif = "al km-cek"; kapali = cekiliyor; }
      else { yazi = b.hedef && carpan >= b.hedef ? `✅ Oto ${b.hedef}x'te çekildi` : "💥 Yandı"; sinif = "sat"; kapali = true; }
    } else if (b && b.durum === "kazandi") { yazi = `✅ ${b.carpan || b.hedef}x'te çektin · +${para(b.odeme || 0)}`; kapali = true; }
    else if (b && b.durum === "kaybetti") { yazi = "💥 Yandı"; sinif = "sat"; kapali = true; }
    else if (faz === "bahis") { yazi = "🚀 Tura gir"; kapali = giriliyor; }
    else { yazi = `Sonraki tur için bekle (${Math.ceil((an.bas + ayar.TUR_MS - simdi()) / 1000)} sn)`; kapali = true; sinif = "pasif"; }
    if (btn.textContent !== yazi) btn.textContent = yazi;
    btn.className = "bx-gonder km-buyuk " + sinif;
    btn.disabled = kapali;
  }

  function tuvalCiz(an, faz, carpan) {
    if (!ctx) return;
    const css = (ad, y) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim() || y;
    ctx.clearRect(0, 0, W, H);
    const maxUcus = ayar.TUR_MS - ayar.BAHIS_MS;
    const ust = Math.max(2, carpan * 1.25);
    const xOf = (ms) => 20 + (ms / maxUcus) * (W - 40);
    const yOf = (c) => H - 18 - (Math.log(c) / Math.log(ust)) * (H - 40);
    // yatay çizgiler
    ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1; ctx.font = "700 11px Manrope, sans-serif"; ctx.fillStyle = "rgba(255,255,255,.35)";
    [1.5, 2, 3, 5, 10, 20].filter((c) => c < ust).forEach((c) => { const y = Math.round(yOf(c)) + 0.5; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke(); ctx.fillText(c + "x", W - 44, y - 4); });
    if (faz === "bahis") {
      const oran = Math.max(0, Math.min(1, -an.ucus / ayar.BAHIS_MS));
      ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(20, H - 10, W - 40, 4);
      ctx.fillStyle = css("--accent", "#6d5cff"); ctx.fillRect(20, H - 10, (W - 40) * oran, 4);
      ctx.font = "34px sans-serif"; ctx.fillText("🚀", 14, H - 22);
      return;
    }
    const son = faz === "dustu" ? Math.min(an.ucus, (Math.log(carpan) / ayar.HIZ) * 1000) : an.ucus;
    const renk = faz === "dustu" ? "#ff5d6c" : "#3ddc84";
    const grad = ctx.createLinearGradient(0, H, 0, 0); grad.addColorStop(0, "rgba(61,220,132,0)"); grad.addColorStop(1, faz === "dustu" ? "rgba(255,93,108,.25)" : "rgba(61,220,132,.25)");
    ctx.beginPath(); ctx.moveTo(xOf(0), yOf(1));
    for (let ms = 0; ms <= son; ms += Math.max(50, son / 120)) ctx.lineTo(xOf(ms), yOf(carpanHesapla(ms) || 1));
    ctx.lineTo(xOf(son), yOf(carpan));
    ctx.lineWidth = 4; ctx.strokeStyle = renk; ctx.lineJoin = "round"; ctx.stroke();
    ctx.lineTo(xOf(son), H - 18); ctx.lineTo(xOf(0), H - 18); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.font = "30px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(faz === "dustu" ? "💥" : "🚀", xOf(son), yOf(carpan) - 6);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  function benimCiz() {
    const k = $("crBenim"); k.textContent = "";
    const l = (cuzdan && cuzdan.crashGecmis) || [];
    if (!l.length) { k.append(el("p", "muted", "Henüz oynamadın.")); return; }
    l.forEach((g) => {
      const r = el("div", "bx-satir");
      const kar = (g.odeme || 0) - g.miktar;
      r.append(el("span", null, g.odeme ? `✅ ${g.carpan}x'te çektin` : `💥 ${g.nokta ? g.nokta + "x'te patladı" : "yandı"}`), el("span", "muted", para(g.miktar, 0) + " BERKAY"), el("span", "bx-sag " + (kar >= 0 ? "yukari" : "asagi"), (kar >= 0 ? "+" : "") + para(kar)));
      k.append(r);
    });
  }

  // ======================= DÜELLO =======================
  let duOyun = "yazitura", duSecim = "yazi", duellolar = [], oncekiDurum = {};
  const ZAR = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  function duelloBaslat() {
    document.querySelectorAll("#duOyun button").forEach((b) => b.addEventListener("click", () => {
      duOyun = b.dataset.oyun;
      document.querySelectorAll("#duOyun button").forEach((x) => x.classList.toggle("on", x === b));
      $("duSecim").hidden = duOyun !== "yazitura";
    }));
    document.querySelectorAll("#duSecim button").forEach((b) => b.addEventListener("click", () => {
      duSecim = b.dataset.secim;
      document.querySelectorAll("#duSecim button").forEach((x) => x.classList.toggle("on", x === b));
    }));
    $("duBtn").addEventListener("click", async () => {
      const m = Math.round(Number($("duMiktar").value));
      if (!(m >= 1)) { durumYaz("duDurum", "Miktar en az 1 BERKAY.", true); return; }
      const rakip = $("duRakip").value.trim();
      $("duBtn").disabled = true;
      try {
        const r = await Ekonomi.api("duelloAc", { oyun: duOyun, secim: duSecim, miktar: m, rakip });
        durumYaz("duDurum", "✅ " + r.mesaj);
        $("duMiktar").value = ""; $("duRakip").value = "";
        paylas({ id: r.id, acan: profile.kullaniciAdi, miktar: m, oyun: duOyun, rakip });
      } catch (err) { durumYaz("duDurum", "⚠️ " + err.message, true); }
      finally { $("duBtn").disabled = false; }
    });
    $("duModalKapat").addEventListener("click", () => { $("duModal").hidden = true; });
    $("duModal").addEventListener("click", (e) => { if (e.target === $("duModal")) $("duModal").hidden = true; });
    db.collection("duello").orderBy("t", "desc").limit(40).onSnapshot((s) => {
      duellolar = s.docs.map((x) => Object.assign({ id: x.id }, x.data()));
      // Benim açtığım düello ben bakarken sonuçlandıysa sonucu göster
      duellolar.forEach((du) => {
        if (oncekiDurum[du.id] === "acik" && du.durum === "bitti" && profile && du.acanUid === profile.uid) sonucGoster(du, du.kazananUid === profile.uid);
        oncekiDurum[du.id] = du.durum;
      });
      duelloCiz();
      hashBak();
    }, (err) => { $("duAcik").innerHTML = '<p class="muted">Düellolar okunamadı (' + err.message + ').</p>'; });
  }
  const oyunAdi = (du) => (du.oyun === "zar" ? "🎲 Zar" : `🪙 Yazı-tura (${du.acan}: ${du.secim === "tura" ? "tura" : "yazı"})`);
  function duelloCiz() {
    if (!profile) return;
    const benimAd = (profile.kullaniciAdi || "").toLocaleLowerCase("tr");
    const acik = duellolar.filter((d) => d.durum === "acik");
    const biten = duellolar.filter((d) => d.durum === "bitti").slice(0, 12);
    const a = $("duAcik"); a.textContent = "";
    if (!acik.length) a.append(el("p", "muted", "Açık düello yok. İlk sen meydan oku!"));
    acik.forEach((du) => {
      const r = el("div", "bx-satir km-du-satir"); r.id = "du-" + du.id;
      r.append(Ekonomi.isim(du.acan, undefined, { unvan: false }), el("span", "muted", "→ " + (du.rakip || "herkes")), el("span", null, oyunAdi(du)), el("b", null, para(du.miktar, 0) + " BERKAY"));
      const sag = el("span", "bx-sag bx-butonlar");
      if (du.acanUid === profile.uid) {
        const ip = el("button", "admin-btn reject", "İptal"); ip.type = "button";
        ip.addEventListener("click", async () => { ip.disabled = true; try { const x = await Ekonomi.api("duelloIptal", { id: du.id }); Ekonomi.toast(x.mesaj); } catch (err) { Ekonomi.toast("⚠️ " + err.message); ip.disabled = false; } });
        const pay = el("button", "admin-btn", "📤"); pay.type = "button"; pay.title = "WhatsApp'ta paylaş";
        pay.addEventListener("click", () => paylas(du));
        sag.append(pay, ip);
      } else if (!du.rakip || du.rakip.toLocaleLowerCase("tr") === benimAd) {
        const kb = el("button", "admin-btn publish", "⚔️ Kabul et"); kb.type = "button";
        kb.disabled = !cuzdan || (cuzdan.bkc || 0) < du.miktar;
        if (kb.disabled) kb.title = `${du.miktar} BERKAY lazım`;
        kb.addEventListener("click", () => kabul(du, kb));
        sag.append(kb);
      } else sag.append(el("span", "muted", "özel"));
      r.append(sag);
      a.append(r);
    });
    const b = $("duBiten"); b.textContent = "";
    if (!biten.length) b.append(el("p", "muted", "Henüz yok."));
    biten.forEach((du) => {
      const r = el("div", "bx-satir");
      const atis = du.oyun === "zar" ? `${ZAR[du.zarAcan] || ""} ${du.zarAcan} – ${du.zarKabul} ${ZAR[du.zarKabul] || ""}` : `🪙 ${du.atis === "tura" ? "Tura" : "Yazı"}`;
      r.append(el("span", null, `${du.acan} vs ${du.kabul}`), el("span", "muted", atis), el("span", null, "🏆 " + du.kazanan), el("span", "bx-sag yukari", "+" + para(du.odul, 0)), el("span", "muted", kacOnce(du.bitis || du.t)));
      b.append(r);
    });
  }
  async function kabul(du, btn) {
    if (!confirm(`${du.acan} ile ${du.miktar} BERKAY'lık ${du.oyun === "zar" ? "zar" : "yazı-tura"} düellosu. Kabul ediyor musun?`)) return;
    btn.disabled = true;
    try {
      const r = await Ekonomi.api("duelloKabul", { id: du.id });
      sonucGoster(Object.assign({}, du, { kazanan: r.kazanan, odul: r.odul, zarAcan: r.zarAcan, zarKabul: r.zarKabul, atis: r.atis, kabul: profile.kullaniciAdi }), r.kazandin);
    } catch (err) { Ekonomi.toast("⚠️ " + err.message, 5000); btn.disabled = false; }
  }
  function sonucGoster(du, kazandim) {
    const atis = $("duAtis"); atis.textContent = ""; $("duSonuc").textContent = "";
    $("duModalBaslik").textContent = `⚔️ ${du.acan} vs ${du.kabul || "?"}`;
    $("duModal").hidden = false;
    const yavas = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (du.oyun === "zar") {
      const a = el("div", "km-zar"), b = el("div", "km-zar");
      atis.append(kutu(du.acan, a), el("span", "km-vs", "vs"), kutu(du.kabul, b));
      let n = 0;
      const z = setInterval(() => {
        a.textContent = ZAR[1 + Math.floor(Math.random() * 6)]; b.textContent = ZAR[1 + Math.floor(Math.random() * 6)];
        if (++n > (yavas ? 0 : 14)) { clearInterval(z); a.textContent = ZAR[du.zarAcan]; b.textContent = ZAR[du.zarKabul]; bitir(); }
      }, 90);
    } else {
      const p = el("div", "km-para" + (yavas ? "" : " donuyor"), "🪙");
      atis.append(p);
      setTimeout(() => { p.classList.remove("donuyor"); p.textContent = du.atis === "tura" ? "TURA" : "YAZI"; bitir(); }, yavas ? 50 : 1500);
    }
    function bitir() { $("duSonuc").textContent = kazandim ? `🏆 Kazandın! +${para(du.odul)} BERKAY` : `😬 ${du.kazanan} kazandı (+${para(du.odul)})`; $("duSonuc").className = "km-sonuc " + (kazandim ? "yukari" : "asagi"); }
    function kutu(ad, zar) { const k = el("div", "km-zar-kutu"); k.append(zar, el("small", null, ad || "?")); return k; }
  }
  function paylas(du) {
    const metin = `⚔️ ${du.acan} ${du.rakip ? du.rakip + "'e" : "herkese"} ${du.miktar} BERKAY'lık ${du.oyun === "zar" ? "🎲 zar" : "🪙 yazı-tura"} düellosu attı! Yüreğin yetiyorsa kabul et: ${location.origin}/kumarhane#d=${du.id}`;
    if (navigator.share) { navigator.share({ text: metin }).catch(() => {}); return; }
    window.open("https://wa.me/?text=" + encodeURIComponent(metin), "_blank", "noopener");
  }
  let hashBakildi = false;
  function hashBak() {
    if (hashBakildi) return;
    const m = location.hash.match(/^#d=([\w-]+)/);
    if (!m) { hashBakildi = true; return; }
    const r = $("du-" + m[1]);
    if (r) { hashBakildi = true; r.classList.add("km-vurgu"); r.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (duellolar.length) { hashBakildi = true; const du = duellolar.find((x) => x.id === m[1]); if (du && du.durum !== "acik") Ekonomi.toast("Bu düello " + (du.durum === "bitti" ? `bitti: ${du.kazanan} kazandı.` : "iptal edilmiş."), 5000); }
  }
})();
