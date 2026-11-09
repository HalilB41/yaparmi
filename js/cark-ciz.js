// ============================================================
// cark-ciz.js — çark çizimi (cark.html ve admin paneli ortak kullanır).
// Dilimin büyüklüğü = çıkma şansı. "sans" ne kadar büyükse dilim o kadar
// geniş ve o kadar sık çıkar. Açılar tepeden (ok) başlar, saat yönünde.
// ============================================================
(function () {
  "use strict";

  const RENKLER = ["#5a3fd4", "#f5b82e", "#e05a8a", "#2fa36b", "#3fa7d6", "#ff7a59", "#8b5cf6", "#14b8a6"];
  const MAXIMUS_RENKLER = ["#3a2f12", "#f5b82e", "#4a3300", "#ffcf5c", "#6b4a00", "#fdf0cc"];
  const ACIK_RENKLER = ["#f5b82e", "#ffcf5c", "#fdf0cc"];

  function toplamSans(dilimler) {
    return dilimler.reduce((t, d) => t + Math.max(0, Number(d.agirlik) || 0), 0);
  }

  // Her dilimin başlangıç ve bitiş açısı (derece, tepeden saat yönünde).
  function acilar(dilimler) {
    const toplam = toplamSans(dilimler);
    let a = 0;
    return dilimler.map((d) => {
      const pay = toplam ? (Math.max(0, Number(d.agirlik) || 0) / toplam) * 360 : 360 / dilimler.length;
      const r = { bas: a, son: a + pay };
      a += pay;
      return r;
    });
  }

  // Tepeden saat yönünde verilen açıya (derece) denk gelen dilimin sırası.
  function dilimBul(dilimler, derece) {
    const d = ((derece % 360) + 360) % 360;
    const l = acilar(dilimler);
    for (let i = 0; i < l.length; i++) if (d >= l[i].bas && d < l[i].son) return i;
    return l.length - 1;
  }

  function renkSec(dilimler, i, renkler) {
    if (dilimler[i].maximus) return "#1b1726";
    let renk = renkler[i % renkler.length];
    // Son dilim ilk dilimle aynı renk olup yan yana gelmesin
    if (dilimler.length > 1 && i === dilimler.length - 1 && i % renkler.length === 0) renk = renkler[1];
    return renk;
  }

  function ciz(tuval, dilimler, renkler, secenek) {
    secenek = secenek || {};
    renkler = renkler || RENKLER;
    const ctx = tuval.getContext("2d");
    const W = tuval.width;
    const r = W / 2;
    ctx.clearRect(0, 0, W, W);
    if (!dilimler.length || !toplamSans(dilimler)) {
      ctx.fillStyle = "#e2dbcb";
      ctx.beginPath(); ctx.arc(r, r, r - 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#878192";
      ctx.font = "700 26px Manrope, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(secenek.bosYazi || "Ödül eklenmedi", r, r);
      return;
    }
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;
    const l = acilar(dilimler);
    dilimler.forEach((d, i) => {
      const a0 = rad(l[i].bas);
      const a1 = rad(l[i].son);
      const secili = secenek.secili === i;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r - 6, a0, a1);
      ctx.closePath();
      const renk = renkSec(dilimler, i, renkler);
      ctx.fillStyle = renk;
      ctx.globalAlpha = secenek.secili != null && !secili ? 0.55 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 3;
      ctx.stroke();

      const genislik = l[i].son - l[i].bas; // derece
      if (genislik < 4) return; // çok ince dilime yazı sığmaz
      ctx.save();
      ctx.translate(r, r);
      const orta = (a0 + a1) / 2;
      const solda = Math.cos(orta) < 0; // sol yarıdaki yazılar ters görünmesin
      ctx.rotate(solda ? orta + Math.PI : orta);
      ctx.textAlign = solda ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = d.maximus ? "#ffcf5c" : ACIK_RENKLER.includes(renk) ? "#1b1726" : "#ffffff";
      // Yazı boyutu dilimin genişliğine göre küçülür
      const yay = (genislik * Math.PI / 180) * (r * 0.62);
      const boyut = Math.max(12, Math.min(24, Math.floor(yay * 0.55)));
      ctx.font = "800 " + boyut + "px Manrope, sans-serif";
      let yazi = (d.maximus ? "🌟 " : "") + (d.ad || "(isimsiz)");
      const maxGen = r - 70;
      while (yazi.length > 3 && ctx.measureText(yazi).width > maxGen) yazi = yazi.slice(0, -2) + "…";
      ctx.fillText(yazi, solda ? -(r - 24) : r - 24, 0);
      ctx.restore();
    });
    if (secenek.secili != null && dilimler[secenek.secili]) {
      const s = l[secenek.secili];
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r - 6, rad(s.bas), rad(s.son));
      ctx.closePath();
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#e03131";
      ctx.stroke();
    }
    // Orta göbek
    ctx.beginPath(); ctx.arc(r, r, 34, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = "#1b1726"; ctx.stroke();
  }

  window.CarkCiz = { RENKLER, MAXIMUS_RENKLER, ciz, acilar, dilimBul, toplamSans };
})();
