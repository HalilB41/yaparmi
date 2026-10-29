// admin-sekme.js — admin panelindeki kategoriler (İçerik / Oyun ayarları / Galeri / Kâhin).
// Seçilen sekme adres çubuğunda (#galeri gibi) tutulur, sayfa yenilenince aynı sekme açılır.
(function () {
  "use strict";
  const sekmeler = Array.from(document.querySelectorAll(".adm-tabs [data-tab]"));
  const paneller = Array.from(document.querySelectorAll(".adm-panel"));
  if (!sekmeler.length) return;

  function ac(ad) {
    if (!paneller.some((p) => p.dataset.panel === ad)) ad = "icerik";
    sekmeler.forEach((b) => {
      const on = b.dataset.tab === ad;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    paneller.forEach((p) => (p.hidden = p.dataset.panel !== ad));
    if (location.hash.slice(1) !== ad) history.replaceState(null, "", "#" + ad);
  }
  sekmeler.forEach((b) => b.addEventListener("click", () => ac(b.dataset.tab)));
  ac(location.hash.slice(1));

  // Galeri sekmesinde bekleyen öneri sayısı
  const kuyruk = document.getElementById("queueList");
  const say = document.getElementById("admOneriSay");
  if (kuyruk && say) {
    const guncelle = () => {
      const n = kuyruk.querySelectorAll(".admin-queue-item").length;
      say.hidden = n === 0;
      say.textContent = String(n);
    };
    new MutationObserver(guncelle).observe(kuyruk, { childList: true, subtree: true });
    guncelle();
  }
})();
