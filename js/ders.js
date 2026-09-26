// ============================================================
// ders.js — sadece ders.html'de çalışır. Gerçek bir sınav DEĞİL,
// tamamen şakadan bir "optik form" gösterisi: Türkçe (30),
// Matematik (30) ve Genel Kültür (60) satırları çiziliyor. Telefonu
// sürükleyip optiğin sağ üstündeki karekoda tutunca deklanşör sesi
// çıkıyor, ekran flaş gibi parlıyor, optik kendi kendine dolup her
// seferinde RASTGELE 85-99 arası bir puan veriyor.
// ============================================================

(function () {
  "use strict";

  const SECTIONS = [
    { key: "turkce", label: "Türkçe", count: 30 },
    { key: "matematik", label: "Matematik", count: 30 },
    { key: "gk", label: "Genel Kültür", count: 60 },
  ];
  const LETTERS = ["A", "B", "C", "D", "E"];
  const MIN_SCORE = 85;
  const MAX_SCORE = 99;

  const FUNNY_LINES = [
    "3x3'ü hâlâ bilmiyor ama karekodu okutmayı biliyor.",
    "Sınav boyunca 2 kere uyuyakaldı, yine de bu puan.",
    "Kitapçığı hiç açmadı, kapağındaki karekod yetti.",
    "Hoca 'bu nasıl oldu' diye sordu, Berkay 'manifestten zoktay gibi' dedi.",
    "Puanı kutlamak için hemen Popeyes'a koştu.",
    "Bir soruyu kendisi çözdü, o da yanlış çıktı.",
  ];

  const scene = document.getElementById("optikScene");
  if (!scene) return;

  const sheet = document.getElementById("optikSheet");
  const phone = document.getElementById("optikPhone");
  const qr = document.getElementById("optikQr");
  const flash = document.getElementById("cameraFlash");
  const hint = document.getElementById("optikHint");
  const resultBox = document.getElementById("optikResult");
  const resultText = document.getElementById("optikResultText");
  const resultDetail = document.getElementById("optikResultDetail");
  const retryBtn = document.getElementById("optikRetry");
  const rowArea = document.getElementById("optikRowArea");

  const HINT_DEFAULT = "👉 Telefonu sürükleyip optiğin sağ üstündeki karekoda tut.";

  let rowGlobalIndex = 0;
  let scanning = false;
  let scanned = false;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ---------------- Öylesine (sahte) karekod ----------------
  // Gerçek bir QR değil, sadece karekod gibi görünen rastgele bir desen:
  // 21x21 kare, üç köşesinde QR'ların klasik "göz" kareleri var.
  function buildFakeQr() {
    const N = 21;
    const cells = [];
    function isFinder(x, y) {
      const inBox = (bx, by) => x >= bx && x < bx + 7 && y >= by && y < by + 7;
      return inBox(0, 0) || inBox(N - 7, 0) || inBox(0, N - 7);
    }
    function finderOn(x, y) {
      const lx = x >= N - 7 ? x - (N - 7) : x;
      const ly = y >= N - 7 ? y - (N - 7) : y;
      const ring = Math.min(lx, ly, 6 - lx, 6 - ly);
      return ring === 0 || ring >= 2;
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let on;
        if (isFinder(x, y)) on = finderOn(x, y);
        else if ((x === 7 || y === 7) && (x < 8 || x > N - 9) && (y < 8 || y > N - 9)) on = false;
        else on = Math.random() < 0.48;
        if (on) cells.push('<rect x="' + x + '" y="' + y + '" width="1" height="1"/>');
      }
    }
    qr.innerHTML =
      '<svg viewBox="-1 -1 ' + (N + 2) + " " + (N + 2) + '" shape-rendering="crispEdges">' +
      '<rect x="-1" y="-1" width="' + (N + 2) + '" height="' + (N + 2) + '" fill="#fff"/>' +
      '<g fill="#111">' + cells.join("") + "</g></svg>";
  }

  // ---------------- Deklanşör sesi (dosya gerekmez, Web Audio ile) ----------------
  let audioCtx = null;
  function playShutter() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;

      // İki kısa "klik": perde açılıyor + kapanıyor
      [0, 0.09].forEach((offset, i) => {
        const len = Math.floor(audioCtx.sampleRate * 0.06);
        const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < len; j++) {
          data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 3);
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = i === 0 ? 2600 : 1800;
        filter.Q.value = 0.8;
        const gain = audioCtx.createGain();
        gain.gain.value = i === 0 ? 1.1 : 0.8;
        src.connect(filter).connect(gain).connect(audioCtx.destination);
        src.start(now + offset);
      });
    } catch (err) {
      /* ses çalınamazsa sorun değil, flaş yine çalışır */
    }
  }

  function doFlash() {
    if (!flash) return;
    flash.classList.remove("is-on");
    void flash.offsetWidth; // animasyonu yeniden başlat
    flash.classList.add("is-on");
  }

  // ---------------- Optik satırları ----------------
  function buildSections() {
    rowGlobalIndex = 0;
    SECTIONS.forEach((sec) => {
      const wrap = sheet.querySelector('.optik-section[data-section="' + sec.key + '"] .optik-rows');
      if (!wrap) return;
      wrap.innerHTML = "";
      for (let n = 1; n <= sec.count; n++) {
        const row = document.createElement("div");
        row.className = "optik-row";
        row.dataset.section = sec.key;

        const numEl = document.createElement("span");
        numEl.className = "optik-row-num";
        numEl.textContent = n + ".";
        row.appendChild(numEl);

        LETTERS.forEach((letter) => {
          const bubble = document.createElement("span");
          bubble.className = "optik-bubble";
          bubble.textContent = letter;
          row.appendChild(bubble);
        });

        row.dataset.order = String(rowGlobalIndex);
        rowGlobalIndex++;
        wrap.appendChild(row);
      }
    });
  }

  // Her taramada puanı ve hangi soruların yanlış olacağını rastgele seç.
  function planResult() {
    const score = randInt(MIN_SCORE, MAX_SCORE);
    const total = SECTIONS.reduce((s, x) => s + x.count, 0);
    const wrongCount = total - Math.round((score / 100) * total);

    const rows = Array.from(sheet.querySelectorAll(".optik-row"));
    const shuffled = rows.slice().sort(() => Math.random() - 0.5);
    const wrongSet = new Set(shuffled.slice(0, wrongCount));

    const perSection = {};
    SECTIONS.forEach((s) => (perSection[s.key] = s.count));

    rows.forEach((row) => {
      const bubbles = row.querySelectorAll(".optik-bubble");
      const pick = randInt(0, LETTERS.length - 1);
      const b = bubbles[pick];
      b.dataset.fill = wrongSet.has(row) ? "wrong" : "right";
      b.style.transitionDelay = Number(row.dataset.order) * 9 + "ms";
      if (wrongSet.has(row)) perSection[row.dataset.section]--;
    });

    return { score, perSection };
  }

  // ---------------- Sürükleme (Pointer Events: hem fare hem dokunma) ----------------
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function onPointerDown(e) {
    if (scanning || scanned) return;
    const containerRect = rowArea.getBoundingClientRect();
    const phoneRect = phone.getBoundingClientRect();
    offsetX = e.clientX - phoneRect.left;
    offsetY = e.clientY - phoneRect.top;

    phone.style.left = phoneRect.left - containerRect.left + "px";
    phone.style.top = phoneRect.top - containerRect.top + "px";
    phone.style.right = "auto";

    dragging = true;
    phone.classList.add("is-dragging");
    phone.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const containerRect = rowArea.getBoundingClientRect();
    const phoneRect = phone.getBoundingClientRect();
    let newLeft = e.clientX - containerRect.left - offsetX;
    let newTop = e.clientY - containerRect.top - offsetY;

    const maxLeft = containerRect.width - phoneRect.width;
    const maxTop = containerRect.height - phoneRect.height;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    phone.style.left = newLeft + "px";
    phone.style.top = newTop + "px";

    qr.classList.toggle("is-target", rectsOverlap(phone.getBoundingClientRect(), qr.getBoundingClientRect()));
  }

  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    phone.classList.remove("is-dragging");
    qr.classList.remove("is-target");
    try {
      phone.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* yok say */
    }

    if (rectsOverlap(phone.getBoundingClientRect(), qr.getBoundingClientRect())) {
      startScan();
    } else {
      hint.textContent = "👉 Telefonu optiğin sağ üstündeki karekodun üstüne götür.";
    }
  }

  phone.addEventListener("pointerdown", onPointerDown);
  phone.addEventListener("pointermove", onPointerMove);
  phone.addEventListener("pointerup", onPointerUp);
  phone.addEventListener("pointercancel", onPointerUp);

  function startScan() {
    if (scanning || scanned) return;
    scanning = true;

    playShutter();
    doFlash();
    phone.classList.add("is-scanning");
    qr.classList.add("is-scanned");
    hint.textContent = "📸 Karekod okundu! Cevaplar yükleniyor...";

    const plan = planResult();
    sheet.classList.add("is-scanning");
    sheet.scrollTop = 0;

    setTimeout(() => {
      sheet.querySelectorAll(".optik-bubble[data-fill]").forEach((b) => {
        b.classList.add(b.dataset.fill === "wrong" ? "is-wrong" : "is-filled");
      });
    }, 350);

    const totalDelay = rowGlobalIndex * 9 + 900;
    setTimeout(() => {
      scanning = false;
      scanned = true;
      phone.classList.remove("is-scanning");
      hint.textContent = "✅ Optik dolduruldu!";
      resultText.innerHTML = "Tebrikler, <strong>" + plan.score + "</strong> aldın!";
      const parts = SECTIONS.map((s) => s.label + " " + plan.perSection[s.key] + "/" + s.count);
      resultDetail.textContent =
        parts.join(" · ") + " — " + FUNNY_LINES[randInt(0, FUNNY_LINES.length - 1)];
      resultBox.hidden = false;
    }, totalDelay);
  }

  function reset() {
    scanning = false;
    scanned = false;
    resultBox.hidden = true;
    hint.textContent = HINT_DEFAULT;
    sheet.classList.remove("is-scanning");
    qr.classList.remove("is-scanned");
    buildSections();
    buildFakeQr();
    phone.style.left = "";
    phone.style.top = "";
    phone.style.right = "";
  }

  if (retryBtn) retryBtn.addEventListener("click", reset);

  buildSections();
  buildFakeQr();
})();
