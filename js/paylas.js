// ============================================================
// paylas.js — sadece ana sayfa: kâhinin cevabını görsel kart yapıp paylaşır.
// Telefonda paylaşım menüsü açılır (WhatsApp, Instagram...), bilgisayarda PNG iner.
// ============================================================
(function () {
  "use strict";
  const btn = document.getElementById("paylasBtn");
  const form = document.getElementById("ask-form");
  const input = document.getElementById("question");
  const cevapEl = document.getElementById("answer-text");
  const cursor = document.getElementById("cursor");
  if (!btn || !form || !cevapEl || !cursor) return;

  let soru = "";
  form.addEventListener("submit", () => { soru = input.value.trim(); btn.hidden = true; }, true);
  // Cevap yazılıp bitince (yanıp sönen imleç kaybolunca) düğme görünür
  new MutationObserver(() => {
    const bitti = cursor.hidden && cevapEl.textContent.trim() && !/düşünüyor/i.test(cevapEl.textContent);
    btn.hidden = !bitti;
  }).observe(cursor, { attributes: true, attributeFilter: ["hidden"] });

  function satirla(ctx, metin, genislik) {
    const kelimeler = metin.split(/\s+/);
    const satirlar = [];
    let s = "";
    kelimeler.forEach((k) => {
      const dene = s ? s + " " + k : k;
      if (ctx.measureText(dene).width > genislik && s) { satirlar.push(s); s = k; } else s = dene;
    });
    if (s) satirlar.push(s);
    return satirlar;
  }
  function yuvarlak(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function kartYap() {
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const vurgu = css.getPropertyValue("--accent").trim() || "#5a3fd4";
    const DISPLAY = '"Bricolage Grotesque", "Manrope", sans-serif';
    const BODY = '"Manrope", sans-serif';
    try { await Promise.all([document.fonts.load("800 60px 'Bricolage Grotesque'"), document.fonts.load("700 30px Manrope")]); } catch { /* yoksa sistem yazısı */ }

    // zemin: vurgu rengi + sarı şerit
    ctx.fillStyle = vurgu; ctx.fillRect(0, 0, W, H);
    for (let x = -H; x < W; x += 90) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 45, 0); ctx.lineTo(x + 45 + H, H); ctx.lineTo(x + H, H); ctx.fill();
    }
    // kart
    yuvarlak(ctx, 70, 150, W - 140, H - 330, 48);
    ctx.fillStyle = "#fffdf8"; ctx.fill();
    // üst: logo
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(130, 85, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = vurgu; ctx.beginPath(); ctx.arc(130, 80, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f5b82e"; ctx.fillRect(116, 104, 28, 7);
    ctx.fillStyle = "#fff"; ctx.font = "800 54px " + DISPLAY; ctx.textBaseline = "middle";
    ctx.fillText("yaparmi.com", 185, 86);

    let y = 250;
    const X = 140, GEN = W - 280;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#878192"; ctx.font = "800 28px " + BODY;
    ctx.fillText("SORU", X, y);
    y += 62;
    ctx.fillStyle = "#1b1726"; ctx.font = "700 46px " + DISPLAY;
    satirla(ctx, "“" + (soru || "Berkay bunu yapar mı?") + "”", GEN).slice(0, 3).forEach((s) => { ctx.fillText(s, X, y); y += 58; });

    y += 34;
    ctx.fillStyle = "#efe9dc"; ctx.fillRect(X, y, GEN, 4);
    y += 74;
    ctx.fillStyle = vurgu; ctx.font = "800 28px " + BODY;
    ctx.fillText("KÂHİN KANZİ DİYOR Kİ", X, y);
    y += 30;

    // cevap: sığana kadar küçült
    const cevap = cevapEl.textContent.trim();
    let boyut = 64, satirlar;
    const altSinir = H - 230;
    do {
      ctx.font = "800 " + boyut + "px " + DISPLAY;
      satirlar = satirla(ctx, cevap, GEN);
      boyut -= 4;
    } while (y + satirlar.length * boyut * 1.3 > altSinir && boyut > 30);
    boyut += 4;
    // cevabı kalan boşlukta dikey ortala
    const yukseklik = satirlar.length * boyut * 1.25;
    y += Math.max(0, (altSinir - y - yukseklik) / 2 - 20);
    ctx.fillStyle = "#1b1726";
    satirlar.forEach((s) => { y += boyut * 1.25; ctx.fillText(s, X, y); });

    // alt
    ctx.fillStyle = "#fff"; ctx.font = "800 40px " + DISPLAY; ctx.textAlign = "center";
    ctx.fillText("Sen de sor → yaparmi.com", W / 2, H - 90);
    ctx.textAlign = "left";
    return new Promise((ok) => c.toBlob(ok, "image/png"));
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const blob = await kartYap();
      const dosya = new File([blob], "yaparmi-kahin.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [dosya] })) {
        await navigator.share({ files: [dosya], title: "Kâhin Kanzi", text: "Berkay yapar mı? yaparmi.com" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "yaparmi-kahin.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      if (window.Basarim) Basarim.say("paylas");
    } catch (err) {
      if (err && err.name !== "AbortError") console.warn("Paylaşılamadı:", err.message);
    } finally {
      btn.disabled = false;
    }
  });
})();
