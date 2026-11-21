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
      const dataUrl = await window.resizeImageToSquare(f, 720);
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

// ---------------- Rekorları sıfırla (admin › Oyunlar) ----------------
(function () {
  "use strict";
  const btn = document.getElementById("rekorSifirBtn");
  if (!btn) return;
  const durum = (m) => { document.getElementById("rekorSifirDurum").textContent = m; };
  btn.addEventListener("click", async () => {
    const oyun = document.getElementById("rekorSifirOyun").value;
    const ad = document.getElementById("rekorSifirOyun").selectedOptions[0].textContent;
    if (!confirm(`${ad}: grup rekor tablosu ve herkesin kişisel rekoru silinecek. Emin misin?`)) return;
    btn.disabled = true; durum("Siliniyor…");
    try {
      const s = await db.collection("rekorlar").where("oyun", "==", oyun).get();
      for (const d of s.docs) await d.ref.delete();
      const r = await Ekonomi.api("adminRekorSifirla", { oyun });
      durum(`✅ ${s.size} tablo kaydı ve ${r.cuzdan} kişisel rekor silindi.`);
    } catch (err) { durum("⚠️ " + err.message); }
    finally { btn.disabled = false; }
  });
})();
