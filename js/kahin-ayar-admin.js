// ============================================================
// kahin-ayar-admin.js — admin.html "🔮 Kâhin" sekmesi: bot düğmelerinin görünürlüğü.
//   ayarlar/kahin { sinirsizBot: bool } → ana sayfada "😈 Sınırsız bot" düğmesi görünsün mü
// Sadece görünürlük; yapay zekâ koduna dokunmaz (bkz. js/bot-gorunum.js).
// ============================================================
(function () {
  "use strict";
  const kutu = document.getElementById("kahinSinirsizBot");
  const durum = document.getElementById("kahinBotDurum");
  if (!kutu || typeof db === "undefined" || !db) return;
  let basladi = false;
  window.YaparmiAuth.onChange((p) => {
    if (!p || p.rol !== "admin" || basladi) return;
    basladi = true;
    db.collection("ayarlar").doc("kahin").onSnapshot((s) => {
      kutu.checked = !!(s.exists && s.data().sinirsizBot);
      durum.textContent = kutu.checked ? "😈 Sınırsız bot düğmesi ana sayfada GÖRÜNÜYOR." : "🙈 Sınırsız bot düğmesi gizli; ana sayfada sadece ULTRA MAXİMUS var.";
    }, (err) => { durum.textContent = "⚠️ " + err.message + " (Firestore kurallarına ayarlar eklendi mi?)"; });
    kutu.addEventListener("change", async () => {
      kutu.disabled = true;
      try { await db.collection("ayarlar").doc("kahin").set({ sinirsizBot: kutu.checked }, { merge: true }); }
      catch (err) { durum.textContent = "⚠️ " + err.message; kutu.checked = !kutu.checked; }
      finally { kutu.disabled = false; }
    });
  });
})();
