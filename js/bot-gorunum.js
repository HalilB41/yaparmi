// ============================================================
// bot-gorunum.js — sadece index.html. Kâhin'deki bot düğmelerinin GÖRÜNÜRLÜĞÜ.
// Yapay zekâ koduna (js/script.js, api/ask.js) DOKUNMAZ; sadece düğmeleri
// gizler/gösterir ve gerekirse mevcut "ULTRA MAXİMUS" düğmesine tıklar.
//
//   ayarlar/kahin { sinirsizBot: bool }   (admin panelinden: Kâhin → Bot düğmeleri)
//     false/yok → "😈 Sınırsız bot" düğmesi GİZLİ, sadece ULTRA MAXİMUS görünür
//     true      → iki düğme de görünür (eski hali)
//
// Düğme gizliyken: kurallar daha önce kabul edildiyse ULTRA MAXİMUS otomatik seçilir.
// Kabul edilmediyse ilk soruda (gönder / örnek soru) kurallar penceresi açılır;
// kabul edilince soru ULTRA MAXİMUS'a gider. Gizli bota hiçbir soru gitmez.
// ============================================================
(function () {
  "use strict";
  const sinirsizBtn = document.querySelector('.bot-btn[data-bot="sinirsiz"]');
  const ultraBtn = document.querySelector('.bot-btn[data-bot="ahlakli"]');
  const form = document.getElementById("ask-form");
  if (!sinirsizBtn || !ultraBtn || !form) return;

  let sinirsizAcik = false;
  let bekleyenSoru = false;

  function ultraSecili() { return ultraBtn.classList.contains("active"); }
  function uygula() {
    sinirsizBtn.hidden = !sinirsizAcik;
    document.querySelector(".bot-switch") && document.querySelector(".bot-switch").classList.toggle("tek-bot", !sinirsizAcik);
    if (!sinirsizAcik && !ultraSecili()) {
      // Kurallar daha önce kabul edildiyse sessizce Ultra'yı seç (script.js'in kendi tıklama akışıyla)
      let onayli = false;
      try { onayli = localStorage.getItem("yaparmi_maximus_kural_v1") === "1"; } catch { /* yok */ }
      if (onayli) ultraBtn.click();
    }
  }
  uygula();

  // Sınırsız gizliyken Ultra seçili değilse soru gitmesin: kuralları aç, kabul edilince soruyu gönder
  window.addEventListener("submit", (e) => {
    if (e.target !== form || sinirsizAcik || ultraSecili()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    bekleyenSoru = true;
    ultraBtn.click();
  }, true);
  new MutationObserver(() => {
    if (bekleyenSoru && ultraSecili()) {
      bekleyenSoru = false;
      setTimeout(() => (form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }))), 50);
    }
  }).observe(ultraBtn, { attributes: true, attributeFilter: ["class"] });
  // Kurallar penceresinde "Vazgeç" denirse bekleyen soruyu unut
  const vazgec = document.getElementById("maximusKuralKapat");
  if (vazgec) vazgec.addEventListener("click", () => { bekleyenSoru = false; });

  if (typeof db !== "undefined" && db) {
    db.collection("ayarlar").doc("kahin").onSnapshot((s) => {
      sinirsizAcik = !!(s.exists && s.data().sinirsizBot);
      uygula();
    }, () => { /* okunamazsa varsayılan: gizli */ });
  }
})();
