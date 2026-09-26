// ============================================================
// sosyal.js — sadece sosyal.html'de çalışır. "Hikaye seç" oyunu:
// ortada Berkay'ın resmi, altında metin ve seçenek butonları. Hangi
// seçeneğe basılırsa o düğüme geçilir, seçeneği olmayan düğüm SON'dur.
// Hikayenin kendisi admin panelinden (Sosyal Hayat Düzenle) değiştirilir.
// ============================================================

(function () {
  "use strict";

  const stage = document.getElementById("storyStage");
  if (!stage || !window.SosyalHikaye) return;

  const imgEl = document.getElementById("storyImg");
  const fallbackEl = document.getElementById("storyFallback");
  const emojiEl = document.getElementById("storyEmoji");
  const textEl = document.getElementById("storyText");
  const choicesEl = document.getElementById("storyChoices");
  const stepEl = document.getElementById("storyStep");
  const restartBtn = document.getElementById("storyRestart");

  let hikaye = null;
  let adim = 0;

  function goster(id) {
    const d = hikaye.dugumler[id];
    stage.classList.remove("is-in");
    void stage.offsetWidth;
    stage.classList.add("is-in");

    if (!d) {
      textEl.textContent = "Berkay yolda kayboldu (bu hikaye dalı henüz yazılmamış). SON.";
      emojiEl.textContent = "❓";
      choicesEl.innerHTML = "";
      restartBtn.hidden = false;
      return;
    }

    adim++;
    emojiEl.textContent = d.emoji || "";
    emojiEl.hidden = !d.emoji;
    textEl.textContent = d.metin;
    choicesEl.innerHTML = "";

    const gecerli = d.secenekler.filter((s) => s.etiket);
    gecerli.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "story-choice";
      btn.textContent = s.etiket;
      btn.addEventListener("click", () => goster(s.hedef));
      choicesEl.appendChild(btn);
    });

    const son = gecerli.length === 0;
    restartBtn.hidden = !son;
    stage.classList.toggle("is-end", son);
    stepEl.textContent = son ? "🏁 Hikaye bitti (" + adim + ". adım)" : adim + ". adım";
  }

  function basla() {
    adim = 0;
    goster(hikaye.baslangic);
  }

  restartBtn.addEventListener("click", basla);

  window.SosyalHikaye.yukle().then(({ hikaye: h, resim }) => {
    hikaye = h;
    if (resim) {
      imgEl.src = resim;
      imgEl.hidden = false;
      fallbackEl.hidden = true;
    }
    basla();
  });
})();
