// ============================================================
// belgesel.js — Grup Belgeseli (Netflix tarzı). Veri Firestore'da: belgesel/veri
//   { karakterler: {id:{ad,emoji,renk}}, bolumler: [{id,tur,baslik,alt,emoji,renk,sahneler:[{kim,baslik,metin,alinti,tarih?}]}] }
// Sadece giriş yapmış (anonim olmayan) üyeler okuyabilir (Firestore kuralı). Veriyi admin panelinden yükler.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let veri = null, bolum = null, i = 0, zaman = null, durdu = false, kalan = 0, son = 0;

  $("bgGirisBtn").addEventListener("click", (e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); const t = $("authToggle"), p = $("authPanel"); if (t && p && p.hidden) t.click(); });
  if (typeof db === "undefined" || !db) { $("bgKapiYazi").textContent = "Şu an bağlı değil."; return; }

  let yuklendi = false;
  window.YaparmiAuth.onChange((p) => {
    if (!p) {
      $("bgIcerik").hidden = true; $("bgKapi").hidden = false; $("bgGirisBtn").hidden = false;
      $("bgKapiYazi").innerHTML = "<b>🎬 Grubun Belgeseli</b><br>Sadece grup üyeleri izleyebilir. Giriş yap.";
      return;
    }
    if (yuklendi) return; yuklendi = true;
    $("bgKapiYazi").textContent = "Belgesel yükleniyor…"; $("bgGirisBtn").hidden = true;
    db.collection("belgesel").doc("veri").get().then((s) => {
      if (!s.exists || !s.data().bolumler) { $("bgKapiYazi").innerHTML = "<b>🎬 Belgesel henüz yüklenmedi.</b><br>Admin panelinden yüklenince burada izlenebilecek."; return; }
      veri = s.data(); kur();
    }).catch((err) => { $("bgKapiYazi").textContent = "⚠️ " + (err.code === "permission-denied" ? "Belgeseli sadece giriş yapmış üyeler izleyebilir." : err.message); yuklendi = false; });
  });

  function kart(b) {
    const k = el("button", "bg-kart"); k.type = "button";
    k.style.setProperty("--renk", b.renk || "#7c3aed");
    const ust = el("div", "bg-kart-gorsel"); ust.append(el("span", "bg-kart-emoji", b.emoji || "🎬"));
    const izlendi = izlenen()[b.id]; if (izlendi) { const bar = el("i", "bg-kart-bar"); bar.style.width = Math.min(100, (izlendi / b.sahneler.length) * 100) + "%"; ust.append(bar); }
    k.append(ust, el("b", null, b.baslik), el("small", null, `${b.sahneler.length} sahne`));
    k.addEventListener("click", () => ac(b, 0));
    return k;
  }
  function kur() {
    $("bgKapi").hidden = true; $("bgIcerik").hidden = false;
    $("bgKarakter").textContent = ""; $("bgDestan").textContent = "";
    for (const b of veri.bolumler) (b.tur === "karakter" ? $("bgKarakter") : $("bgDestan")).append(kart(b));
    const top = veri.bolumler.reduce((t, b) => t + b.sahneler.length, 0);
    $("bgHeroAlt").textContent = `${Object.keys(veri.karakterler || {}).length} kişi, ${veri.bolumler.length} bölüm, ${top} sahne. Hepsi gerçek, hepsi grup arşivinden.`;
    const sonIzlenen = (() => { try { return JSON.parse(localStorage.getItem("belgesel_son") || "null"); } catch { return null; } })();
    if (sonIzlenen && veri.bolumler.find((b) => b.id === sonIzlenen.id)) { $("bgDevam").hidden = false; $("bgDevam").onclick = () => ac(veri.bolumler.find((b) => b.id === sonIzlenen.id), sonIzlenen.i); }
  }
  $("bgBasla").addEventListener("click", () => veri && ac(veri.bolumler[0], 0));
  $("bgRastgele").addEventListener("click", () => veri && ac(veri.bolumler[Math.floor(Math.random() * veri.bolumler.length)], 0));

  function izlenen() { try { return JSON.parse(localStorage.getItem("belgesel_izlenen") || "{}"); } catch { return {}; } }
  function kaydet() {
    try {
      const iz = izlenen(); iz[bolum.id] = Math.max(iz[bolum.id] || 0, i + 1); localStorage.setItem("belgesel_izlenen", JSON.stringify(iz));
      localStorage.setItem("belgesel_son", JSON.stringify({ id: bolum.id, i }));
    } catch { /* yok */ }
  }

  function ac(b, bas) {
    bolum = b; i = Math.max(0, Math.min(bas || 0, b.sahneler.length - 1)); durdu = false;
    $("bgOynatici").hidden = false; document.body.classList.add("bg-acik");
    $("bgOynatici").style.setProperty("--renk", b.renk || "#7c3aed");
    $("bgBolumAd").textContent = `${b.emoji || "🎬"} ${b.baslik}`;
    $("bgIlerleme").textContent = "";
    b.sahneler.forEach(() => { const s = el("span"); s.append(el("i")); $("bgIlerleme").append(s); });
    goster();
  }
  function kapat() { clearTimeout(zaman); $("bgOynatici").hidden = true; document.body.classList.remove("bg-acik"); if (veri) kur(); }
  function sureHesap(s) { return Math.min(16000, Math.max(5500, ((s.metin || "").length + (s.alinti || "").length) * 55)); }
  function goster() {
    clearTimeout(zaman);
    const s = bolum.sahneler[i], k = (veri.karakterler || {})[s.kim] || { ad: s.kim, emoji: "👤", renk: "#64748b" };
    const sahne = $("bgSahne"); sahne.textContent = ""; sahne.classList.remove("bg-giris"); void sahne.offsetWidth; sahne.classList.add("bg-giris");
    $("bgOynatici").style.setProperty("--kisi", k.renk || "#7c3aed");
    if (i === 0) {
      const g = el("div", "bg-bolum-giris");
      g.append(el("div", "bg-buyuk-emoji", bolum.emoji || "🎬"), el("h2", null, bolum.baslik));
      if (bolum.alt) g.append(el("p", null, bolum.alt));
      if (bolum.lakaplar && bolum.lakaplar.length) g.append(el("p", "bg-lakap", "Lakaplar: " + bolum.lakaplar.join(" · ")));
      sahne.append(g);
    }
    const kutu = el("article", "bg-kutu");
    const kim = el("div", "bg-kim"); kim.append(el("span", "bg-kim-emoji", k.emoji), el("b", null, k.ad)); if (s.tarih) kim.append(el("time", null, s.tarih));
    kutu.append(kim);
    if (s.baslik) kutu.append(el("h3", null, s.baslik));
    if (s.alinti) kutu.append(el("blockquote", null, "“" + s.alinti + "”"));
    kutu.append(el("p", null, s.metin));
    sahne.append(kutu);
    [...$("bgIlerleme").children].forEach((sp, j) => { const bar = sp.firstChild; bar.style.transition = "none"; bar.style.width = j < i ? "100%" : "0%"; });
    $("bgSayac").textContent = `${i + 1} / ${bolum.sahneler.length}`;
    kaydet();
    kalan = sureHesap(s) + (i === 0 ? 2500 : 0);
    if (!durdu) baslat();
  }
  function baslat() {
    son = performance.now();
    const bar = $("bgIlerleme").children[i].firstChild;
    const toplam = sureHesap(bolum.sahneler[i]) + (i === 0 ? 2500 : 0), simdi = 100 * (1 - kalan / toplam);
    bar.style.transition = "none"; bar.style.width = simdi + "%"; void bar.offsetWidth;
    bar.style.transition = `width ${kalan}ms linear`; bar.style.width = "100%";
    zaman = setTimeout(ileri, kalan);
  }
  function durdur() {
    if (durdu) { durdu = false; $("bgDur").textContent = "⏸ Durdur"; baslat(); return; }
    durdu = true; $("bgDur").textContent = "▶ Devam"; clearTimeout(zaman); kalan = Math.max(300, kalan - (performance.now() - son));
    const bar = $("bgIlerleme").children[i].firstChild, w = getComputedStyle(bar).width; bar.style.transition = "none"; bar.style.width = w;
  }
  function ileri() {
    if (i < bolum.sahneler.length - 1) { i++; goster(); return; }
    // bölüm bitti: sonraki bölüme geç
    const n = veri.bolumler.indexOf(bolum);
    const sahne = $("bgSahne"); sahne.textContent = "";
    const son = el("div", "bg-bolum-giris"); son.append(el("div", "bg-buyuk-emoji", "🎞️"), el("h2", null, "Bölüm bitti"));
    const sonraki = veri.bolumler[n + 1];
    if (sonraki) { const btn = el("button", "bg-oynat", `▶ Sonraki: ${sonraki.emoji} ${sonraki.baslik}`); btn.type = "button"; btn.onclick = () => ac(sonraki, 0); son.append(btn); zaman = setTimeout(() => ac(sonraki, 0), 6000); }
    const geri = el("button", "bg-ikincil", "Bölümlere dön"); geri.type = "button"; geri.onclick = kapat; son.append(geri);
    sahne.append(son);
  }
  function geri() { if (i > 0) { i--; goster(); } else goster(); }
  $("bgKapat").addEventListener("click", kapat);
  $("bgIleri").addEventListener("click", () => { durdu = false; $("bgDur").textContent = "⏸ Durdur"; ileri(); });
  $("bgGeri").addEventListener("click", () => { durdu = false; $("bgDur").textContent = "⏸ Durdur"; geri(); });
  $("bgDur").addEventListener("click", durdur);
  addEventListener("keydown", (e) => {
    if ($("bgOynatici").hidden) return;
    if (e.key === "Escape") kapat();
    else if (e.key === "ArrowRight") { e.preventDefault(); ileri(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); geri(); }
    else if (e.key === " ") { e.preventDefault(); durdur(); }
  });
})();
