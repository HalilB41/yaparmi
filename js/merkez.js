// ============================================================
// merkez.js — topluluk.html: Berkaypedia · İtiraflar bölümleri arasında geçiş.
// Kaldırılan bölümlerin eski adresleri (#tahmin, #harita, #soz…) Berkaypedia'yı açar.
// ============================================================
(function () {
  "use strict";
  const BOLUM = { itiraf: "itiraf", wiki: "wiki" };
  // #wiki/Kasksız_85 gibi alt yollar: bölüm ilk parçadan anlaşılır
  const anahtar = () => decodeURIComponent(location.hash.slice(1)).split("/")[0];
  const sekmeler = [...document.querySelectorAll(".mk-sekmeler [data-bolum]")];
  const bolumler = [...document.querySelectorAll(".mk-bolum")];
  let acikBolum = null;
  function ac(ad, kaydir) {
    const hash = anahtar();
    if (!bolumler.some((b) => b.dataset.bolum === ad)) ad = "wiki";
    sekmeler.forEach((b) => { const on = b.dataset.bolum === ad; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    bolumler.forEach((b) => { b.hidden = b.dataset.bolum !== ad; });
    acikBolum = ad;
    if (BOLUM[hash] !== ad) {
      // bölümün kendi açık alt sekmesi varsa onu yaz (#vardiya gibi), yoksa bölüm adını
      const alt = document.querySelector(`.mk-bolum[data-bolum="${ad}"] .adm-tabs [data-tab].active`);
      history.replaceState(null, "", "#" + (alt ? alt.dataset.tab : ad));
    }
    document.title = ({ itiraf: "İtiraflar", wiki: "Berkaypedia" })[ad] + " · yaparmi.com";
    window.dispatchEvent(new CustomEvent("mk-bolum", { detail: ad }));
    if (kaydir) document.querySelector(".mk-sekmeler").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  sekmeler.forEach((b) => b.addEventListener("click", () => ac(b.dataset.bolum)));
  window.addEventListener("hashchange", () => { const b = BOLUM[anahtar()]; if (b && b !== acikBolum) ac(b, true); });
  ac(BOLUM[anahtar()] || "wiki");
  window.Merkez = { ac };
})();
