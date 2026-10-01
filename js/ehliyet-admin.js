// ============================================================
// ehliyet-admin.js — sadece admin.html'de çalışır.
// Ehliyet sayfasındaki 3 aracın şoför koltuğu resmini ve çarpışma
// sesini yükler/kaldırır. Firestore: ehliyet/ayarlar ->
// { araba1, araba2, araba3 (data:image/...), carpmaSesi (data:audio/...) }
// ============================================================
(function () {
  "use strict";
  if (typeof db === "undefined" || !db) return;

  const DOC = () => db.collection("ehliyet").doc("ayarlar");
  let yuklendi = false;

  function resimSatiri(no) {
    return {
      dosya: document.getElementById("ehResim" + no + "Dosya"),
      onizleme: document.getElementById("ehResim" + no + "Onizleme"),
      sil: document.getElementById("ehResim" + no + "Sil"),
      durum: document.getElementById("ehResim" + no + "Durum"),
    };
  }
  const satirlar = [1, 2, 3].map(resimSatiri).filter((s) => s.dosya);

  const sesDosya = document.getElementById("ehSesDosya");
  const sesOynat = document.getElementById("ehSesOynat");
  const sesSil = document.getElementById("ehSesSil");
  const sesDurum = document.getElementById("ehSesDurum");

  if (!satirlar.length && !sesDosya) return;

  let mevcutSes = null;

  function resimGoster(satir, src) {
    satir.onizleme.hidden = !src;
    satir.sil.hidden = !src;
    if (src) satir.onizleme.src = src;
  }
  function sesGoster(src) {
    mevcutSes = src || null;
    if (sesOynat) sesOynat.hidden = !src;
    if (sesSil) sesSil.hidden = !src;
  }

  function yukle() {
    if (yuklendi) return;
    yuklendi = true;
    DOC()
      .get()
      .then((snap) => {
        const d = snap.exists ? snap.data() || {} : {};
        satirlar.forEach((satir, i) => {
          const r = d["araba" + (i + 1)];
          resimGoster(satir, typeof r === "string" && r.startsWith("data:image/") ? r : null);
        });
        sesGoster(typeof d.carpmaSesi === "string" && d.carpmaSesi.startsWith("data:audio/") ? d.carpmaSesi : null);
      })
      .catch(() => {
        /* kural yoksa / bağlı değilse sessiz geç */
      });
  }
  if (window.YaparmiAuth) {
    window.YaparmiAuth.onChange((p) => {
      if (p && p.rol === "admin") yukle();
    });
  }

  satirlar.forEach((satir, i) => {
    satir.dosya.addEventListener("change", async () => {
      const f = satir.dosya.files[0];
      if (!f) return;
      satir.durum.textContent = "Yükleniyor...";
      try {
        const dataUrl = await window.resizeImageToSquare(f, 480);
        await DOC().set({ ["araba" + (i + 1)]: dataUrl }, { merge: true });
        resimGoster(satir, dataUrl);
        satir.durum.textContent = "✅ Güncellendi.";
      } catch (err) {
        satir.durum.textContent = "⚠️ Yüklenemedi: " + err.message;
      }
      satir.dosya.value = "";
    });

    satir.sil.addEventListener("click", async () => {
      if (!confirm("Bu aracın şoför resmi kaldırılsın mı?")) return;
      try {
        await DOC().set({ ["araba" + (i + 1)]: firebase.firestore.FieldValue.delete() }, { merge: true });
        resimGoster(satir, null);
        satir.durum.textContent = "Resim kaldırıldı (yerine 🧑 görünecek).";
      } catch (err) {
        satir.durum.textContent = "⚠️ Kaldırılamadı: " + err.message;
      }
    });
  });

  // ---------------- Çarpışma sesi ----------------
  const MAX_SES_BOYUT = 900000; // ~900KB, Firestore belge sınırı altında kalsın

  function dosyayiOku(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Dosya okunamadı"));
      reader.readAsDataURL(file);
    });
  }

  if (sesDosya) {
    sesDosya.addEventListener("change", async () => {
      const f = sesDosya.files[0];
      if (!f) return;
      sesDurum.textContent = "Yükleniyor...";
      try {
        const dataUrl = await dosyayiOku(f);
        if (dataUrl.length > MAX_SES_BOYUT) {
          throw new Error("Ses dosyası çok büyük (~900KB altı, kısa bir klip kullan)");
        }
        await DOC().set({ carpmaSesi: dataUrl }, { merge: true });
        sesGoster(dataUrl);
        sesDurum.textContent = "✅ Çarpışma sesi güncellendi.";
      } catch (err) {
        sesDurum.textContent = "⚠️ Yüklenemedi: " + err.message;
      }
      sesDosya.value = "";
    });
  }

  if (sesOynat) {
    sesOynat.addEventListener("click", () => {
      if (!mevcutSes) return;
      const a = new Audio(mevcutSes);
      a.play().catch(() => {});
    });
  }

  if (sesSil) {
    sesSil.addEventListener("click", async () => {
      if (!confirm("Çarpışma sesi kaldırılsın mı? (Yerine otomatik ses çalacak)")) return;
      try {
        await DOC().set({ carpmaSesi: firebase.firestore.FieldValue.delete() }, { merge: true });
        sesGoster(null);
        sesDurum.textContent = "Ses kaldırıldı (yerine otomatik çarpışma sesi gelecek).";
      } catch (err) {
        sesDurum.textContent = "⚠️ Kaldırılamadı: " + err.message;
      }
    });
  }
})();
