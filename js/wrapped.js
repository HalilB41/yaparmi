// ============================================================
// wrapped.js — Berkay Wrapped: kişinin yıl içinde sitede yaptıklarının Spotify tarzı özeti.
// Veriler: kendi cüzdanım (c.yil[yıl] sayaçları, rekorlar, seviye, lig kupaları),
// kapanan pozisyonlarım (borsa_gecmis, uid'ime göre tek sorgu) ve sunucu özeti (zenginlik sırası).
// Herkese 15 Aralık'tan itibaren açılır; admin her zaman önizleyebilir.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const sayi = (x, k = 0) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  const isaretli = (x) => (x >= 0 ? "+" : "−") + sayi(Math.abs(x));
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const yavas = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const simdiTR = new Date(Date.now() + 3 * 3600000);
  // Aralık–Ocak arası: o yılın özeti (Ocak'ta geçen yılınki)
  const YIL = simdiTR.getUTCMonth() === 0 ? simdiTR.getUTCFullYear() - 1 : simdiTR.getUTCFullYear();
  const ACILIS = Date.UTC(YIL, 11, 15) - 3 * 3600000; // 15 Aralık 00:00 İstanbul
  const acik = Date.now() >= ACILIS;

  $("ekGirisBtn").addEventListener("click", (e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); const t = $("authToggle"), p = $("authPanel"); if (t && p && p.hidden) t.click(); });
  if (typeof db === "undefined" || !db) { $("ekKapiYazi").textContent = "Şu an bağlı değil."; return; }
  let basladi = false;
  window.YaparmiAuth.onChange((p) => {
    if (!p) {
      $("ekIcerik").hidden = true; $("ekKapi").hidden = false;
      $("ekKapiYazi").innerHTML = `<b>Berkay Wrapped ${YIL}</b><br>Yılın nasıl geçtiğini görmek için giriş yap.`;
      $("ekGirisBtn").hidden = false;
      return;
    }
    if (!acik && p.rol !== "admin") {
      $("ekIcerik").hidden = true; $("ekKapi").hidden = false; $("ekGirisBtn").hidden = true;
      const kalan = Math.ceil((ACILIS - Date.now()) / 86400000);
      $("ekKapiYazi").innerHTML = `<b>🎁 Berkay Wrapped ${YIL}</b><br>Yıl sonu özetin <b>15 Aralık</b>'ta açılıyor (${kalan} gün kaldı).<br>O zamana kadar oyna, XP topla, düello at: hepsi özetine girecek.`;
      return;
    }
    $("ekKapi").hidden = true; $("ekIcerik").hidden = false;
    if (!basladi) { basladi = true; baslat(p, !acik); }
  });

  async function baslat(profil, onizleme) {
    $("wrKart").innerHTML = '<div class="wr-yukleniyor">✨ Yılın hazırlanıyor…</div>';
    const [cs, gs, oz] = await Promise.all([
      db.collection("borsa_cuzdan").doc(profil.uid).get(),
      db.collection("borsa_gecmis").where("uid", "==", profil.uid).get().catch(() => ({ docs: [] })),
      db.collection("borsa").doc("ozet").get().catch(() => null),
    ]);
    const c = cs.exists ? cs.data() : null;
    if (!c) { $("wrKart").innerHTML = '<div class="wr-yukleniyor">Bu yıl sitede hiç cüzdan açmamışsın. Seneye 🙂</div>'; return; }
    const yilBas = Date.UTC(YIL, 0, 1) - 3 * 3600000, yilSon = Date.UTC(YIL + 1, 0, 1) - 3 * 3600000;
    const gecmis = gs.docs.map((x) => x.data()).filter((g) => g.kapanis >= yilBas && g.kapanis < yilSon && g.sebep !== "yenileme");
    const ozet = oz && oz.exists ? oz.data() : null;
    const kartlar = kartlariHazirla(c, c.yil && c.yil[String(YIL)] || {}, gecmis, ozet, profil, onizleme);
    oynat(kartlar);
  }

  // ---------------- Kartlar ----------------
  function kartlariHazirla(c, y, gecmis, ozet, profil, onizleme) {
    const ad = c.ad || profil.kullaniciAdi;
    const K = [];
    const kart = (renk, ikon, ust, buyuk, alt, ek) => K.push({ renk, ikon, ust, buyuk, alt, ek });

    kart("mor", "🎁", onizleme ? `ÖN İZLEME · ${YIL}` : `BERKAY WRAPPED ${YIL}`, `${ad}, yılın böyle geçti`, "Hazırsan dokun, başlayalım →");
    // Site
    const gun = y.gun || 0;
    if (gun) kart("turuncu", "📅", "SİTEYE UĞRADIĞIN GÜN", `${sayi(gun)} gün`, y.enUzunSeri ? `En uzun serin ${y.enUzunSeri} gün üst üste. ${y.enUzunSeri >= 7 ? "Bağımlılık tescillendi." : "Daha sadık olabilirdin 😏"}` : "Her gelişin sayıldı.");
    // Borsa
    const kz = gecmis.reduce((t, g) => t + (g.pnl || 0), 0);
    const lik = gecmis.filter((g) => g.sebep === "likide");
    if (gecmis.length) {
      const enIyi = gecmis.reduce((a, g) => (!a || g.pnl > a.pnl ? g : a), null);
      kart(kz >= 0 ? "yesil" : "kirmizi", kz >= 0 ? "📈" : "📉", "BORSADA KALDIRAÇ", `${sayi(gecmis.length)} pozisyon`, `Net ${isaretli(kz)} USDT. ${kz >= 0 ? "Fena değil, Warren." : "Para buhar oldu ama tecrübe kazandın."}`,
        enIyi && enIyi.pnl > 0 ? `En iyi işlemin: ${enIyi.coin || "BERKAY"} ${enIyi.kaldirac}x ${String(enIyi.yon).toUpperCase()} · +${sayi(enIyi.pnl)} USDT (%${sayi(enIyi.yuzde)})` : null);
    }
    if (lik.length) kart("kirmizi", "💀", "LİKİDASYON", `${sayi(lik.length)} kez likide oldun`, `Toplam ${sayi(lik.reduce((t, g) => t + (g.teminat || 0), 0))} USDT teminat yandı.`, lik.length >= 5 ? "Kaldıraç senin için bir yaşam tarzı." : "Olur öyle, kaldıraç affetmez.");
    const coinSay = Object.assign({}, y.coinler || {});
    gecmis.forEach((g) => { const s = g.coin || "BERKAY"; coinSay[s] = (coinSay[s] || 0) + 1; });
    const favori = Object.entries(coinSay).sort((a, b) => b[1] - a[1])[0];
    if (favori) kart("sari", "🪙", "EN SEVDİĞİN COIN", favori[0], `${sayi(favori[1])} işlem. ${favori[0] === "BERKAY" ? "Berkay'a inandın, saygı." : favori[0] === "BTC" ? "Gerçekçisin." : `${favori[0]} senin kalbinde.`}`);
    // Kumarhane
    if (y.kumarOyun) {
      const net = (y.kumarKazanc || 0) - (y.kumarBahis || 0);
      const enCok = [["Crash", y.crashOyun], ["Mines", y.minesOyun], ["Plinko", y.plinkoOyun], ["Blackjack", y.bjOyun]].filter((x) => x[1]).sort((a, b) => b[1] - a[1])[0];
      kart("pembe", "🎰", "KUMARHANE", `${sayi(y.kumarOyun)} el oynadın`, `${sayi(y.kumarBahis || 0)} BERKAY yatırdın, net ${isaretli(net)}. ${net >= 0 ? "Kasayı soydun!" : "Kasa her zaman kazanır."}`,
        enCok ? `En çok oynadığın: ${enCok[0]} (${sayi(enCok[1])} kez)` : null);
      const rekorlar = [];
      if (y.crashEnYuksek > 1) rekorlar.push(`🚀 Crash'te en yüksek çekişin ${sayi(y.crashEnYuksek, 2)}x`);
      if (y.plinkoEnYuksek > 1) rekorlar.push(`🔻 Plinko'da en iyi topun ${sayi(y.plinkoEnYuksek, 1)}x`);
      if (y.minesEnCok) rekorlar.push(`💣 Mines'ta bir oyunda ${y.minesEnCok} elmas`);
      if (y.bjBlackjack) rekorlar.push(`🃏 ${y.bjBlackjack} kez blackjack yaptın`);
      if (y.enBuyukKazanc > 0) rekorlar.push(`💰 Tek seferde en büyük kârın +${sayi(y.enBuyukKazanc)} BERKAY`);
      if (rekorlar.length) kart("lacivert", "🏅", "KUMARHANE REKORLARIN", rekorlar[0], rekorlar.slice(1).join(" · "));
    }
    // Düello
    const dG = y.duelloG || 0, dM = y.duelloM || 0;
    if (dG + dM) {
      const rakipler = Object.entries(y.rakipler || {});
      const ezeli = rakipler.sort((a, b) => (b[1].g + b[1].m) - (a[1].g + a[1].m))[0];
      kart(dG >= dM ? "yesil" : "kirmizi", "⚔️", "DÜELLOLAR", `${dG} galibiyet · ${dM} mağlubiyet`, dG >= dM ? "Meydan okumaktan korkmadın." : "Cesaretin kazancından büyüktü.",
        ezeli ? `Ezeli rakibin: ${ezeli[0]} (${ezeli[1].g}-${ezeli[1].m})` : null);
    }
    // Diğer
    const kucuk = [];
    if (y.tahmin) kucuk.push(`🎲 ${y.tahmin} tahmin`);
    if (y.cark) kucuk.push(`🎡 ${y.cark} çark (${isaretli(y.carkKazanc || 0)} BERKAY)`);
    if (y.gorev) kucuk.push(`🎯 ${y.gorev} görev`);
    if (y.market) kucuk.push(`🛒 ${y.market} market alışverişi`);
    const oyunlar = Object.entries(y.oyunlar || {}).sort((a, b) => b[1] - a[1]);
    if (oyunlar[0]) kucuk.push(`🥊 en çok oynadığın oyun: ${({ boks: "Boks", penalti: "Penaltı", motor: "Kasksız 85", g2048: "2048", yilan: "Yılan" })[oyunlar[0][0]] || oyunlar[0][0]}`);
    if (kucuk.length) kart("turkuaz", "✨", "BİR DE BUNLAR VAR", kucuk[0], kucuk.slice(1).join(" · "));
    // Seviye + lig
    const sv = Oyuncu.seviye(c.xp), u = Oyuncu.unvan(sv);
    const kupalar = (c.ligKupa || []).filter((x) => String(x.hafta).startsWith(String(YIL)));
    kart("mor", u.ikon, "SEVİYEN", `Seviye ${sv} · ${u.ad}`, `${sayi(c.xp || 0)} XP topladın${y.xp ? ` (bu yıl ${sayi(y.xp)})` : ""}.`,
      kupalar.length ? `Haftalık ligde ${kupalar.length} kupa: ${kupalar.filter((x) => x.sira === 1).length} şampiyonluk 👑` : null);
    // Zenginlik
    const ben = ozet && ozet.kisi && ozet.kisi[c.uid || profil.uid];
    const toplamKisi = ozet && ozet.kisi ? Object.keys(ozet.kisi).length : 0;
    if (ben) kart("sari", "🐳", "ZENGİNLER LİSTESİ", `${ben.sira}. sıradasın`, `${toplamKisi} kişi arasında. Servetin ≈ ${sayi(ben.deger)} USDT.`, ben.sira === 1 ? "Kral sensin 👑" : ben.sira <= 3 ? "Podyumdasın!" : null);
    // Kişilik
    const p = kisilik(y, gecmis, lik);
    kart("pembe", p.ikon, `${YIL} KİŞİLİĞİN`, p.ad, p.aciklama);
    // Final
    K.push({ final: true, renk: "mor", ad, sv, u, gun, kz, gecmisSay: gecmis.length, lik: lik.length, y, p, ben });
    return K;
  }
  function kisilik(y, gecmis, lik) {
    const sk = { kumar: y.kumarOyun || 0, borsa: (y.islem || 0) + gecmis.length * 2, duello: ((y.duelloG || 0) + (y.duelloM || 0)) * 4, sadik: (y.gun || 0) * 2 };
    if (lik.length >= 5) return { ikon: "💀", ad: "Likidasyon Kralı", aciklama: "20x'i görünce aklın gidiyor. Teminat senin için bir öneri." };
    const enb = Object.entries(sk).sort((a, b) => b[1] - a[1])[0][0];
    if (enb === "kumar") return (y.kumarKazanc || 0) >= (y.kumarBahis || 0) ? { ikon: "🎩", ad: "Kasanın Kâbusu", aciklama: "Kumarhaneye girdin ve kazanarak çıktın. Bu nadir görülür." } : { ikon: "🎰", ad: "Kumarhane Faresi", aciklama: "Bir el daha… bir el daha… Kasa sana teşekkür ediyor." };
    if (enb === "borsa") return { ikon: "🐺", ad: "Borsa Kurdu", aciklama: "Grafiği senden iyi okuyan yok. Ya da öyle sanıyorsun." };
    if (enb === "duello") return { ikon: "⚔️", ad: "Düello Ustası", aciklama: "Kimseye 'hayır' demedin. Yazı mı tura mı, fark etmez." };
    return { ikon: "🏠", ad: "Sitenin Demirbaşı", aciklama: "Her gün buradaydın. Berkay bile bu kadar sadık değil." };
  }

  // ---------------- Oynatıcı ----------------
  let K = [], i = 0, zamanlayici = null;
  const SURE = 6500;
  function oynat(kartlar) {
    K = kartlar; i = 0;
    const il = $("wrIlerleme"); il.textContent = "";
    K.forEach(() => il.append(el("span", null)));
    goster();
    $("wrIleri").addEventListener("click", ileri);
    $("wrGeri").addEventListener("click", geri);
    $("wrKapat").addEventListener("click", () => { location.href = "/profil"; });
    document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); ileri(); } if (e.key === "ArrowLeft") geri(); });
    let x0 = null;
    $("wrSahne").addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    $("wrSahne").addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) (dx < 0 ? ileri : geri)(); x0 = null; });
  }
  function ileri() { if (i < K.length - 1) { i++; goster(); } }
  function geri() { if (i > 0) { i--; goster(); } }
  function goster() {
    clearTimeout(zamanlayici);
    const k = K[i], kutu = $("wrKart");
    $("wrSahne").dataset.renk = k.renk;
    [...$("wrIlerleme").children].forEach((s, j) => { s.className = j < i ? "dolu" : j === i ? "aktif" : ""; s.style.setProperty("--sure", SURE + "ms"); });
    kutu.textContent = "";
    kutu.classList.remove("giris"); void kutu.offsetWidth; kutu.classList.add("giris");
    if (k.final) { finalCiz(kutu, k); return; }
    kutu.append(el("div", "wr-ikon", k.ikon), el("small", "wr-ust", k.ust), el("h1", "wr-buyuk", k.buyuk));
    if (k.alt) kutu.append(el("p", "wr-alt", k.alt));
    if (k.ek) kutu.append(el("p", "wr-ek", k.ek));
    if (!yavas) zamanlayici = setTimeout(ileri, SURE);
  }

  // Final: paylaşılabilir özet görseli (1080×1920)
  function finalCiz(kutu, k) {
    kutu.append(el("small", "wr-ust", `${YIL} ÖZETİN`));
    const tuval = document.createElement("canvas");
    tuval.width = 1080; tuval.height = 1920; tuval.className = "wr-gorsel";
    gorselCiz(tuval, k);
    kutu.append(tuval);
    const bt = el("div", "wr-butonlar");
    const pay = el("button", "btn", "📤 Paylaş"); pay.type = "button";
    pay.addEventListener("click", () => paylas(tuval, k));
    const ind = el("button", "btn ghost", "⬇️ İndir"); ind.type = "button";
    ind.addEventListener("click", () => { const a = document.createElement("a"); a.download = `berkay-wrapped-${YIL}.png`; a.href = tuval.toDataURL("image/png"); a.click(); });
    const bas = el("button", "btn ghost", "↺ Baştan"); bas.type = "button";
    bas.addEventListener("click", () => { i = 0; goster(); });
    bt.append(pay, ind, bas);
    kutu.append(bt);
  }
  function gorselCiz(cv, k) {
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
    const DISP = '"Bricolage Grotesque", Manrope, system-ui, sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#2b1a6b"); g.addColorStop(0.55, "#6d28d9"); g.addColorStop(1, "#e0457b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // dekor
    ctx.globalAlpha = 0.12; ctx.fillStyle = "#fff";
    for (let j = 0; j < 7; j++) { ctx.beginPath(); ctx.arc(150 + j * 160, 260 + (j % 2) * 90, 60 + (j % 3) * 30, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff"; ctx.textAlign = "left";
    ctx.font = `800 54px ${DISP}`; ctx.fillText("BERKAY WRAPPED", 90, 170);
    ctx.font = `800 54px ${MONO}`; ctx.globalAlpha = 0.7; ctx.fillText(String(YIL), 90, 240); ctx.globalAlpha = 1;
    ctx.font = `800 96px ${DISP}`; ctx.fillText(k.ad, 90, 470);
    ctx.font = `700 46px ${DISP}`; ctx.fillText(`${k.p.ikon} ${k.p.ad}`, 90, 560);
    const satirlar = [
      ["Seviye", `${k.sv} · ${k.u.ad}`],
      ["Siteye uğradığı gün", sayi(k.gun)],
      ["Kaldıraç pozisyonu", sayi(k.gecmisSay)],
      ["Borsa net K/Z", isaretli(k.kz) + " USDT"],
      ["Likidasyon", sayi(k.lik)],
      ["Kumarhane eli", sayi(k.y.kumarOyun || 0)],
      ["Düello", `${k.y.duelloG || 0} G · ${k.y.duelloM || 0} M`],
      ["Zenginler listesi", k.ben ? k.ben.sira + ". sıra" : "—"],
    ];
    let yy = 720;
    satirlar.forEach(([a, b]) => {
      ctx.globalAlpha = 0.16; ctx.fillStyle = "#fff"; ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(80, yy - 70, W - 160, 108, 26) : ctx.rect(80, yy - 70, W - 160, 108)); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = `700 34px ${DISP}`; ctx.textAlign = "left"; ctx.fillText(a, 120, yy);
      ctx.fillStyle = "#fff"; ctx.font = `800 42px ${MONO}`; ctx.textAlign = "right"; ctx.fillText(b, W - 120, yy + 2);
      yy += 130;
    });
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = `700 36px ${DISP}`;
    ctx.fillText("Seninkine bak → yaparmi.com/wrapped", 90, H - 110);
  }
  async function paylas(cv, k) {
    const metin = `🎁 Berkay Wrapped ${YIL}: ${k.p.ikon} ${k.p.ad}! Seviye ${k.sv}, ${k.gecmisSay} pozisyon, ${k.y.kumarOyun || 0} el kumar. Seninkine bak: ${location.origin}/wrapped`;
    try {
      const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
      const dosya = new File([blob], `berkay-wrapped-${YIL}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [dosya] })) { await navigator.share({ files: [dosya], text: metin }); return; }
    } catch { /* aşağıda */ }
    window.open("https://wa.me/?text=" + encodeURIComponent(metin), "_blank", "noopener");
  }
})();
