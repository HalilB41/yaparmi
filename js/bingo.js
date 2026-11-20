// ============================================================
// bingo.js — sadece bingo.html: Berkay Bingo.
// bingo/aktif  { tur, durum: acik|bitti, olaylar:[{id,ad}], isaretli:[id], odul, kazanan }
// bingo_kart/{tur}_{uid}  { hucreler: [25 olay id'si, ortası "FREE"] }
// Kart ve "BİNGO" kontrolü sunucuda (api/borsa.js → bingoKatil / bingoIddia).
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  let profile = null, basladi = false, bg = null, kart = null, kartKapat = null, sonTur = null, oncekiKazanan = null;

  $("ekGirisBtn").addEventListener("click", (e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); const t = $("authToggle"), p = $("authPanel"); if (t && p && p.hidden) t.click(); });
  if (typeof db === "undefined" || !db) { $("ekKapiYazi").textContent = "Şu an bağlı değil."; return; }
  window.YaparmiAuth.onChange((p) => {
    profile = p;
    if (!p) { $("ekIcerik").hidden = true; $("ekKapi").hidden = false; $("ekKapiYazi").innerHTML = "Bingo oynamak için <b>kayıt ol</b>."; $("ekGirisBtn").hidden = false; return; }
    $("ekKapi").hidden = true; $("ekIcerik").hidden = false;
    if (!basladi) { basladi = true; dinle(); }
  });

  function dinle() {
    db.collection("bingo").doc("aktif").onSnapshot((s) => {
      bg = s.exists ? s.data() : null;
      if (bg && bg.tur !== sonTur) {
        sonTur = bg.tur; kart = null;
        if (kartKapat) kartKapat();
        kartKapat = db.collection("bingo_kart").doc(bg.tur + "_" + profile.uid).onSnapshot((k) => { kart = k.exists ? k.data() : null; ciz(); }, () => {});
      }
      if (bg && bg.kazanan && oncekiKazanan === false) konfetiYok(bg.kazanan);
      oncekiKazanan = !!(bg && bg.kazanan);
      ciz();
    }, (err) => { $("bgUst").innerHTML = '<p class="muted">Bingo okunamadı (' + err.message + ').</p>'; });
  }
  function konfetiYok(k) { Ekonomi.toast(k.uid === profile.uid ? `🎉 BİNGO! +${k.odul} BERKAY senin!` : `🎱 ${k.ad} BİNGO yaptı! (+${k.odul} BERKAY)`, 7000); }

  function bingoVar(h, isaretli) {
    const ac = new Set(isaretli || []);
    const x = h.map((id) => id === "FREE" || ac.has(id));
    const L = [];
    for (let i = 0; i < 5; i++) { L.push([0, 1, 2, 3, 4].map((j) => i * 5 + j)); L.push([0, 1, 2, 3, 4].map((j) => j * 5 + i)); }
    L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
    const tam = L.filter((l) => l.every((i) => x[i]));
    return { var: tam.length > 0, hucreler: new Set(tam.flat()), eksikEnAz: Math.min(...L.map((l) => l.filter((i) => !x[i]).length)) };
  }

  function ciz() {
    const ust = $("bgUst"); ust.textContent = "";
    const kartEl = $("bgKart"); kartEl.textContent = "";
    const olayEl = $("bgOlaylar"); olayEl.textContent = "";
    const btn = $("bgBingoBtn"); btn.hidden = true;
    if (!bg || !bg.olaylar || !bg.olaylar.length) {
      ust.append(el("p", "muted", "Şu an aktif bingo turu yok. Admin yeni tur başlatınca burada kartını alırsın."));
      return;
    }
    const isaret = new Set(bg.isaretli || []);
    const ad = Object.fromEntries(bg.olaylar.map((o) => [o.id, o.ad]));
    const bilgi = el("div", "bg-bilgi");
    bilgi.append(el("b", null, `🎱 ${bg.tur}. tur`), el("span", null, `🏆 Ödül: ${bg.odul || 0} BERKAY`), el("span", null, `✅ ${isaret.size}/${bg.olaylar.length} olay oldu`));
    ust.append(bilgi);
    if (bg.kazanan) {
      const k = el("div", "bg-kazanan");
      k.append(el("span", null, "🎉 Kazanan: "), Ekonomi.isim(bg.kazanan.ad), el("span", null, ` · +${bg.kazanan.odul} BERKAY`));
      ust.append(k);
    } else if (bg.durum !== "acik") ust.append(el("p", "muted", "Bu tur kazanansız bitti."));

    // olay listesi
    bg.olaylar.forEach((o) => {
      const r = el("div", "bg-olay" + (isaret.has(o.id) ? " is-oldu" : ""));
      r.append(el("span", null, isaret.has(o.id) ? "✅" : "⬜"), el("span", null, o.ad));
      olayEl.append(r);
    });

    if (!kart) {
      if (bg.durum === "acik") {
        const katil = el("button", "btn bg-katil", "🎟️ Kartımı al");
        katil.type = "button";
        katil.addEventListener("click", async () => {
          katil.disabled = true;
          try { await Ekonomi.api("bingoKatil"); } catch (err) { $("bgDurum").textContent = "⚠️ " + err.message; katil.disabled = false; }
        });
        kartEl.append(katil);
      } else kartEl.append(el("p", "muted", "Bu tura katılmadın."));
      return;
    }
    const sonuc = bingoVar(kart.hucreler, bg.isaretli);
    kart.hucreler.forEach((id, i) => {
      const h = el("div", "bg-hucre" + (id === "FREE" ? " is-free" : isaret.has(id) ? " is-oldu" : "") + (sonuc.hucreler.has(i) ? " is-cizgi" : ""));
      h.textContent = id === "FREE" ? "⭐ BEDAVA" : ad[id] || "?";
      kartEl.append(h);
    });
    if (bg.durum === "acik") {
      btn.hidden = false;
      btn.disabled = !sonuc.var;
      btn.textContent = sonuc.var ? "🎉 BİNGO!" : sonuc.eksikEnAz === 1 ? "🔥 Bir kaldı!" : `Bingo için en az ${sonuc.eksikEnAz} olay daha`;
    }
  }

  $("bgBingoBtn").addEventListener("click", async () => {
    const b = $("bgBingoBtn"); b.disabled = true;
    try { const r = await Ekonomi.api("bingoIddia"); $("bgDurum").textContent = r.mesaj; }
    catch (err) { $("bgDurum").textContent = "⚠️ " + err.message; b.disabled = false; }
  });
})();
