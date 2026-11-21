// ============================================================
// merkez.js — topluluk.html: Anket & Vardiya · Tahmin · Sözler · İtiraflar bölümleri arasında geçiş.
// Eski adresler (/tahmin, /soz) buraya yönlenir. Adres çubuğundaki #, alt sekmeyi de taşır
// (#vardiya → Anket & Vardiya bölümünde Vardiya, #borc → Sözler'de Borçlar).
// ============================================================
(function () {
  "use strict";
  const BOLUM = { topluluk: "topluluk", anket: "topluluk", vardiya: "topluluk", lider: "topluluk", sayac: "topluluk",
    tahmin: "tahmin", soz: "soz", borc: "soz", bekliyor: "soz", odendi: "soz", yandi: "soz", itiraf: "itiraf",
    wiki: "wiki", olasi: "olasi", harita: "harita" };
  // #wiki/Kasksız_85 gibi alt yollar: bölüm ilk parçadan anlaşılır
  const anahtar = () => decodeURIComponent(location.hash.slice(1)).split("/")[0];
  const sekmeler = [...document.querySelectorAll(".mk-sekmeler [data-bolum]")];
  const bolumler = [...document.querySelectorAll(".mk-bolum")];
  let acikBolum = null;
  function ac(ad, kaydir) {
    const hash = anahtar();
    if (!bolumler.some((b) => b.dataset.bolum === ad)) ad = "topluluk";
    sekmeler.forEach((b) => { const on = b.dataset.bolum === ad; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    bolumler.forEach((b) => { b.hidden = b.dataset.bolum !== ad; });
    acikBolum = ad;
    if (BOLUM[hash] !== ad) {
      // bölümün kendi açık alt sekmesi varsa onu yaz (#vardiya gibi), yoksa bölüm adını
      const alt = document.querySelector(`.mk-bolum[data-bolum="${ad}"] .adm-tabs [data-tab].active`);
      history.replaceState(null, "", "#" + (alt ? alt.dataset.tab : ad));
    }
    document.title = ({ topluluk: "Topluluk", tahmin: "Tahmin Pazarı", soz: "Söz Defteri", itiraf: "İtiraflar", wiki: "Berkaypedia", olasi: "Kim daha olası?", harita: "Efsaneler haritası" })[ad] + " · yaparmi.com";
    window.dispatchEvent(new CustomEvent("mk-bolum", { detail: ad }));
    if (kaydir) document.querySelector(".mk-sekmeler").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  sekmeler.forEach((b) => b.addEventListener("click", () => ac(b.dataset.bolum)));
  window.addEventListener("hashchange", () => { const b = BOLUM[anahtar()]; if (b && b !== acikBolum) ac(b, true); });
  ac(BOLUM[anahtar()] || "topluluk");
  window.Merkez = { ac };
})();
// Sözler sekmesinde açık borç sayısı (soz.js'in kendi sayacını yansıt)
(function () {
  const kaynak = document.getElementById("sozSay_borc"), hedef = document.getElementById("mkSozSay");
  if (!kaynak || !hedef) return;
  const yansit = () => { hedef.textContent = kaynak.textContent; hedef.hidden = kaynak.hidden || !kaynak.textContent; };
  new MutationObserver(yansit).observe(kaynak, { attributes: true, childList: true, characterData: true, subtree: true });
})();
