// ============================================================
// macera-admin.js — admin.html "Oyunlar": Macera bölüm kilitleri.
//   ayarlar/macera { baslangic: 1-50, adminHepsi: bool, kim }
//   baslangic: o bölüme kadar herkese açık · adminHepsi: adminlerde 50 bölüm açık (js/macera.js okur)
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("maceraKaydet") || typeof db === "undefined" || !db) return;
  const sec = $("maceraBaslangic"), hepsi = $("maceraAdminHepsi"), durum = $("maceraDurum");
  const SEV = window.MACERA_SEVIYELER || [];
  const TOPLAM = Math.max(50, SEV.length);
  for (let i = 1; i <= TOPLAM; i++) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = i === 1 ? "1. bölüm (normal düzen)" : `${i}. bölüm${SEV[i - 1] ? " · " + SEV[i - 1].ad : ""}`;
    sec.append(o);
  }
  let profil = null, basladi = false;
  window.YaparmiAuth.onChange((p) => {
    profil = p;
    if (!p || p.rol !== "admin" || basladi) return;
    basladi = true;
    db.collection("ayarlar").doc("macera").get().then((s) => {
      const d = s.exists ? s.data() : {};
      sec.value = String(d.baslangic || 1); hepsi.checked = !!d.adminHepsi;
      durum.textContent = d.kim ? `Son değiştiren: ${d.kim}` : "";
    }).catch((e) => { durum.textContent = "⚠️ " + e.message; });
  });
  $("maceraKaydet").addEventListener("click", async () => {
    const btn = $("maceraKaydet"), baslangic = Number(sec.value) || 1;
    btn.disabled = true; durum.textContent = "Kaydediliyor…";
    try {
      await db.collection("ayarlar").doc("macera").set({ baslangic, adminHepsi: hepsi.checked, kim: (profil && profil.kullaniciAdi) || "admin" });
      durum.textContent = `✅ Kaydedildi. Herkes ${baslangic === 1 ? "1. bölümden başlıyor" : baslangic + ". bölüme kadar açık"}${hepsi.checked ? ", adminlerde 50 bölüm açık" : ""}.`;
    } catch (e) { durum.textContent = "⚠️ " + e.message + " (Firestore kurallarına ayarlar/macera eklendi mi?)"; }
    finally { btn.disabled = false; }
  });
})();
