// ============================================================
// spor-admin.js — sadece admin.html'de çalışır.
// Spor sayfasındaki "Kasksız 85" oyununda kaza anında ekrana çıkan resmi
// yükler/kaldırır. Firestore: spor/motor -> { resim: "data:image/jpeg;base64,..." }
// ============================================================
(function () {
  "use strict";
  const dosya = document.getElementById("motorResimDosya");
  const onizleme = document.getElementById("motorResimOnizleme");
  const sil = document.getElementById("motorResimSil");
  const durum = document.getElementById("motorResimDurum");
  if (!dosya || typeof db === "undefined" || !db) return;

  let yuklendi = false;
  function goster(src) {
    onizleme.hidden = !src;
    sil.hidden = !src;
    if (src) onizleme.src = src;
  }
  function yukle() {
    if (yuklendi) return;
    yuklendi = true;
    db.collection("spor").doc("motor").get().then((snap) => {
      const r = snap.exists ? snap.data().resim : null;
      goster(typeof r === "string" && r.startsWith("data:image/") ? r : null);
    }).catch(() => { /* kural yoksa sessiz geç */ });
  }
  if (window.YaparmiAuth) {
    window.YaparmiAuth.onChange((p) => { if (p && p.rol === "admin") yukle(); });
  }

  dosya.addEventListener("change", async () => {
    const f = dosya.files[0];
    if (!f) return;
    durum.textContent = "Yükleniyor...";
    try {
      const dataUrl = await window.resizeImageToSquare(f, 480);
      await db.collection("spor").doc("motor").set({ resim: dataUrl });
      goster(dataUrl);
      durum.textContent = "✅ Kaza resmi güncellendi.";
    } catch (err) {
      durum.textContent = "⚠️ Yüklenemedi: " + err.message + " (Firestore kurallarında spor için 'motor' eklendi mi?)";
    }
    dosya.value = "";
  });

  sil.addEventListener("click", async () => {
    if (!confirm("Kaza resmi kaldırılsın mı?")) return;
    try {
      await db.collection("spor").doc("motor").delete();
      goster(null);
      durum.textContent = "Resim kaldırıldı (yerine 💥 görünecek).";
    } catch (err) {
      durum.textContent = "⚠️ Kaldırılamadı: " + err.message;
    }
  });
})();
