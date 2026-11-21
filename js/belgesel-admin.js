// ============================================================
// belgesel-admin.js — admin.html "İçerik": belgesel.json → Firestore belgesel/veri
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("belgeselYukle") || typeof db === "undefined" || !db) return;
  const durum = $("belgeselDurum");
  window.YaparmiAuth.onChange((p) => {
    if (!p || p.rol !== "admin") return;
    db.collection("belgesel").doc("veri").get().then((s) => {
      if (s.exists && s.data().bolumler) { const d = s.data(); durum.textContent = `Yayında: ${d.bolumler.length} bölüm, ${d.bolumler.reduce((t, b) => t + b.sahneler.length, 0)} sahne.`; }
      else durum.textContent = "Henüz belgesel yüklenmedi.";
    }).catch((err) => { durum.textContent = "⚠️ " + err.message + " (Firestore kurallarına belgesel eklendi mi?)"; });
  });
  $("belgeselYukle").addEventListener("click", async () => {
    const f = $("belgeselDosya").files[0];
    if (!f) { durum.textContent = "Önce belgesel.json dosyasını seç."; return; }
    if (f.size > 900000) { durum.textContent = "Dosya çok büyük (en fazla ~900 KB)."; return; }
    let d;
    try { d = JSON.parse(await f.text()); } catch { durum.textContent = "⚠️ Dosya okunamadı, bozuk JSON."; return; }
    if (!d || !Array.isArray(d.bolumler) || !d.bolumler.length || !d.bolumler.every((b) => b.id && b.baslik && Array.isArray(b.sahneler))) { durum.textContent = "⚠️ Bu bir belgesel dosyası değil."; return; }
    $("belgeselYukle").disabled = true; durum.textContent = "Yükleniyor…";
    try {
      await db.collection("belgesel").doc("veri").set({ karakterler: d.karakterler || {}, bolumler: d.bolumler, surum: d.surum || 1, yuklenme: Date.now() });
      durum.textContent = `✅ Yüklendi: ${d.bolumler.length} bölüm, ${d.bolumler.reduce((t, b) => t + b.sahneler.length, 0)} sahne. /belgesel sayfasında izlenebilir.`;
    } catch (err) { durum.textContent = "⚠️ " + err.message; }
    finally { $("belgeselYukle").disabled = false; }
  });
  $("belgeselSil").addEventListener("click", async () => {
    if (!confirm("Belgesel kaldırılsın mı? (Sayfa boş kalır, dosyayı tekrar yükleyebilirsin.)")) return;
    try { await db.collection("belgesel").doc("veri").delete(); durum.textContent = "Belgesel kaldırıldı."; } catch (err) { durum.textContent = "⚠️ " + err.message; }
  });
})();
