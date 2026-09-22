// ============================================================
// ders.js — sadece ders.html'de çalışır. Gerçek bir sınav DEĞİL,
// tamamen şakadan bir "optik form" gösterisi: Türkçe (30),
// Matematik (30) ve Genel Kültür (60) satırları çiziliyor,
// optik okuyucu sürükleyip forma yaklaştırınca otomatik dolduruyor
// ve ekranda sabit "Tebrikler, 94 aldın!" mesajı çıkıyor.
// ============================================================

(function () {
  "use strict";

  const SECTIONS = [
    { key: "turkce", label: "TÜRKÇE (1-30)", count: 30 },
    { key: "matematik", label: "MATEMATİK (1-30)", count: 30 },
    { key: "gk", label: "GENEL KÜLTÜR (1-60)", count: 60 },
  ];
  const LETTERS = ["A", "B", "C", "D", "E"];

  const scene = document.getElementById("optikScene");
  if (!scene) return;

  const sheet = document.getElementById("optikSheet");
  const reader = document.getElementById("optikReader");
  const hint = document.getElementById("optikHint");
  const resultBox = document.getElementById("optikResult");
  const retryBtn = document.getElementById("optikRetry");
  const rowArea = document.getElementById("optikRowArea");

  let rowGlobalIndex = 0;
  let scanning = false;
  let scanned = false;

  function buildSections() {
    SECTIONS.forEach((sec) => {
      const wrap = sheet.querySelector('.optik-section[data-section="' + sec.key + '"] .optik-rows');
      if (!wrap) return;
      wrap.innerHTML = "";
      for (let n = 1; n <= sec.count; n++) {
        const row = document.createElement("div");
        row.className = "optik-row";

        const numEl = document.createElement("span");
        numEl.className = "optik-row-num";
        numEl.textContent = n + ".";
        row.appendChild(numEl);

        const answerIdx = Math.floor(Math.random() * LETTERS.length);
        LETTERS.forEach((letter, i) => {
          const bubble = document.createElement("span");
          bubble.className = "optik-bubble";
          bubble.textContent = letter;
          if (i === answerIdx) {
            bubble.dataset.answer = "true";
            bubble.style.transitionDelay = rowGlobalIndex * 9 + "ms";
          }
          row.appendChild(bubble);
        });

        rowGlobalIndex++;
        wrap.appendChild(row);
      }
    });
  }

  // ---------------- Sürükleme (Pointer Events: hem fare hem dokunma) ----------------
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function onPointerDown(e) {
    if (scanning || scanned) return;
    const containerRect = rowArea.getBoundingClientRect();
    const readerRect = reader.getBoundingClientRect();
    offsetX = e.clientX - readerRect.left;
    offsetY = e.clientY - readerRect.top;

    reader.style.left = readerRect.left - containerRect.left + "px";
    reader.style.top = readerRect.top - containerRect.top + "px";
    reader.style.right = "auto";

    dragging = true;
    reader.classList.add("is-dragging");
    reader.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const containerRect = rowArea.getBoundingClientRect();
    const readerRect = reader.getBoundingClientRect();
    let newLeft = e.clientX - containerRect.left - offsetX;
    let newTop = e.clientY - containerRect.top - offsetY;

    const maxLeft = containerRect.width - readerRect.width;
    const maxTop = containerRect.height - readerRect.height;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    reader.style.left = newLeft + "px";
    reader.style.top = newTop + "px";
  }

  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    reader.classList.remove("is-dragging");
    try {
      reader.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* yok say */
    }

    const readerRect = reader.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    if (rectsOverlap(readerRect, sheetRect)) {
      startScan();
    } else {
      hint.textContent = "👉 Optik okuyucuyu forma biraz daha yaklaştır.";
    }
  }

  reader.addEventListener("pointerdown", onPointerDown);
  reader.addEventListener("pointermove", onPointerMove);
  reader.addEventListener("pointerup", onPointerUp);
  reader.addEventListener("pointercancel", onPointerUp);

  function startScan() {
    if (scanning || scanned) return;
    scanning = true;
    hint.textContent = "📡 Taranıyor...";
    reader.classList.add("is-scanning");
    sheet.classList.add("is-scanning");

    const bubbles = sheet.querySelectorAll('.optik-bubble[data-answer="true"]');
    requestAnimationFrame(() => {
      bubbles.forEach((b) => b.classList.add("is-filled"));
    });

    const totalDelay = rowGlobalIndex * 9 + 500;
    setTimeout(() => {
      scanning = false;
      scanned = true;
      reader.classList.remove("is-scanning");
      hint.textContent = "✅ Tarama tamamlandı!";
      resultBox.hidden = false;
    }, totalDelay);
  }

  function reset() {
    scanning = false;
    scanned = false;
    resultBox.hidden = true;
    hint.textContent = "👉 Optik okuyucuyu sürükleyip forma yaklaştır.";
    sheet.classList.remove("is-scanning");
    sheet.querySelectorAll(".optik-bubble.is-filled").forEach((b) => b.classList.remove("is-filled"));
    reader.style.left = "";
    reader.style.top = "";
    reader.style.right = "";
  }

  if (retryBtn) retryBtn.addEventListener("click", reset);

  buildSections();
})();
