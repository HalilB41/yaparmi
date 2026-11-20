// ============================================================
// kahin-paylas.js — admin.html "🔮 Kâhin" sekmesi: sorulan bir soruyu
// "kim sordu" bilgisiyle görsel kart yapıp WhatsApp'ta paylaşır.
//   window.KahinPaylas({ soru, cevap, kullaniciAdi, tarih })
// Telefonda: resim + yazı paylaşım menüsünden (WhatsApp seçilir).
// Bilgisayarda: yazı WhatsApp'a gider, resim ayrıca indirilip eklenebilir.
// Sadece gösterim/paylaşım: yapay zekâ koduna (api/ask.js) dokunmaz.
// ============================================================
(function () {
  "use strict";

  let veri = null, blob = null;

  function modalKur() {
    if (document.getElementById("kpModal")) return;
    const m = document.createElement("div");
    m.className = "cark-modal";
    m.id = "kpModal";
    m.hidden = true;
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.innerHTML =
      '<div class="card cark-modal-kart kp-kart">' +
      '<h2>📤 Soruyu paylaş</h2>' +
      '<img id="kpResim" alt="Paylaşım kartı" />' +
      '<div class="cark-modal-butonlar">' +
      '<button type="button" class="btn" id="kpWp">💬 WhatsApp\'ta paylaş</button>' +
      '<button type="button" class="btn" id="kpIndir">⬇️ Resmi indir</button>' +
      '<button type="button" class="link-btn" id="kpKapat">Kapat</button>' +
      "</div></div>";
    document.body.appendChild(m);
    const kapat = () => { m.hidden = true; };
    m.addEventListener("click", (e) => { if (e.target === m) kapat(); });
    document.getElementById("kpKapat").addEventListener("click", kapat);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") kapat(); });
    document.getElementById("kpWp").addEventListener("click", wpPaylas);
    document.getElementById("kpIndir").addEventListener("click", indir);
  }

  function soran(v) { return (v && v.kullaniciAdi) || "Misafir"; }

  function metin(v) {
    return "🔮 Kâhin Kanzi'ye soruldu\n" +
      "🙋 Soran: " + soran(v) + "\n" +
      "❓ " + (v.soru || "") + "\n" +
      "💬 " + (v.cevap || "") + "\n\n" +
      "Sen de sor → " + location.origin;
  }

  function satirla(ctx, yazi, genislik) {
    const kelimeler = String(yazi).split(/\s+/);
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

  async function kartYap(v) {
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const vurgu = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5a3fd4";
    const DISPLAY = '"Bricolage Grotesque", "Manrope", sans-serif';
    const BODY = '"Manrope", sans-serif';
    try { await Promise.all([document.fonts.load("800 60px 'Bricolage Grotesque'"), document.fonts.load("700 30px Manrope")]); } catch { /* sistem yazısı */ }

    // zemin: vurgu rengi + çapraz şeritler
    ctx.fillStyle = vurgu; ctx.fillRect(0, 0, W, H);
    for (let x = -H; x < W; x += 90) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 45, 0); ctx.lineTo(x + 45 + H, H); ctx.lineTo(x + H, H); ctx.fill();
    }
    // logo: konuşma balonu + soru işareti
    ctx.save();
    ctx.translate(96, 50); ctx.scale(3, 3);
    ctx.fillStyle = "#fff";
    ctx.fill(new Path2D("M8 3h8a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5h-6.3l-3.7 3.3c-.5.45-1.3.1-1.3-.57v-3.1A5 5 0 0 1 3 12V8a5 5 0 0 1 5-5z"));
    ctx.strokeStyle = vurgu; ctx.lineWidth = 2.3; ctx.lineCap = "round";
    ctx.stroke(new Path2D("M9.7 8.2a2.4 2.4 0 1 1 3.5 2.15c-.75.38-1.2.95-1.2 1.75v.25"));
    ctx.fillStyle = vurgu; ctx.beginPath(); ctx.arc(12, 14.9, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.font = "800 54px " + DISPLAY; ctx.textBaseline = "middle";
    ctx.fillText("yaparmı?", 185, 88);

    // kart
    yuvarlak(ctx, 70, 150, W - 140, H - 330, 48);
    ctx.fillStyle = "#ffffff"; ctx.fill();

    const X = 140, GEN = W - 280;
    let y = 210;

    // SORAN rozeti
    const ad = "🙋 Soran: " + soran(v);
    ctx.font = "800 34px " + BODY; ctx.textBaseline = "middle";
    const rw = Math.min(GEN, ctx.measureText(ad).width + 48);
    yuvarlak(ctx, X, y, rw, 64, 32);
    ctx.fillStyle = "#f5b82e"; ctx.fill();
    ctx.fillStyle = "#2a1d00"; ctx.fillText(ad, X + 24, y + 33, GEN - 48);
    y += 64;
    if (v.tarih && v.tarih !== "-") {
      ctx.font = "700 24px " + BODY; ctx.fillStyle = "#8a8fa6";
      ctx.fillText(v.tarih, X + rw + 20, y - 32, GEN - rw - 20);
    }

    // soru
    ctx.textBaseline = "alphabetic";
    y += 70;
    ctx.fillStyle = "#8a8fa6"; ctx.font = "800 28px " + BODY;
    ctx.fillText("SORU", X, y);
    y += 60;
    ctx.fillStyle = "#16182a"; ctx.font = "700 44px " + DISPLAY;
    const soruSatir = satirla(ctx, "“" + (v.soru || "Berkay bunu yapar mı?") + "”", GEN);
    soruSatir.slice(0, 4).forEach((s, i) => { ctx.fillText(i === 3 && soruSatir.length > 4 ? s + "…" : s, X, y); y += 56; });

    y += 24;
    ctx.fillStyle = "#e5e7f6"; ctx.fillRect(X, y, GEN, 4);
    y += 70;
    ctx.fillStyle = vurgu; ctx.font = "800 28px " + BODY;
    ctx.fillText("KÂHİN KANZİ DİYOR Kİ", X, y);
    y += 24;

    // cevap: sığana kadar küçült
    const cevap = String(v.cevap || "").trim() || "…";
    const altSinir = H - 220;
    let boyut = 60, satirlar;
    do {
      ctx.font = "800 " + boyut + "px " + DISPLAY;
      satirlar = satirla(ctx, cevap, GEN);
      boyut -= 4;
    } while (y + satirlar.length * boyut * 1.3 > altSinir && boyut > 26);
    boyut += 4;
    const yukseklik = satirlar.length * boyut * 1.25;
    y += Math.max(0, (altSinir - y - yukseklik) / 2 - 20);
    ctx.fillStyle = "#16182a";
    satirlar.forEach((s) => { y += boyut * 1.25; if (y < altSinir + boyut) ctx.fillText(s, X, y); });

    // alt
    ctx.fillStyle = "#fff"; ctx.font = "800 40px " + DISPLAY; ctx.textAlign = "center";
    ctx.fillText("Sen de sor → yaparmi.com", W / 2, H - 90);
    ctx.textAlign = "left";
    return new Promise((ok) => c.toBlob(ok, "image/png"));
  }

  async function wpPaylas() {
    if (!veri) return;
    const yazi = metin(veri);
    if (blob && navigator.canShare) {
      const dosya = new File([blob], "yaparmi-kahin.png", { type: "image/png" });
      if (navigator.canShare({ files: [dosya] })) {
        try { await navigator.share({ files: [dosya], text: yazi }); return; } catch (err) { if (err && err.name === "AbortError") return; }
      }
    }
    window.open("https://wa.me/?text=" + encodeURIComponent(yazi), "_blank", "noopener");
  }
  function indir() {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "yaparmi-kahin.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  window.KahinPaylas = async function (v) {
    modalKur();
    veri = v || {};
    blob = null;
    const img = document.getElementById("kpResim");
    img.removeAttribute("src");
    document.getElementById("kpModal").hidden = false;
    blob = await kartYap(veri);
    if (blob) img.src = URL.createObjectURL(blob);
  };
})();
