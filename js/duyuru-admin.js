// ============================================================
// duyuru-admin.js — admin.html "Genel bakış": sitenin en üstündeki duyuru bandı.
//   ayarlar/duyuru { aktif, metin, link, tur, id, kim } (gösterimi js/site.js yapar)
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("duyuruYayinla") || typeof db === "undefined" || !db) return;
  const durum = $("duyuruDurum"), simdi = $("duyuruSimdi");
  const IKON = { bilgi: "📢", uyari: "⚠️", kutlama: "🎉", acil: "🚨" };
  let basladi = false, profil = null;
  function onizle(d) {
    simdi.textContent = "";
    if (!d || !d.aktif || !d.metin) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Şu an yayında duyuru yok."; simdi.append(p); return; }
    const b = document.createElement("div"); b.className = "duyuru-bant"; b.dataset.tur = d.tur || "bilgi";
    const ic = document.createElement("div"); ic.className = "duyuru-ic";
    const i = document.createElement("span"); i.className = "duyuru-ikon"; i.textContent = IKON[d.tur] || "📢";
    const y = document.createElement("span"); y.className = "duyuru-yazi"; y.textContent = d.metin + (d.link ? "  →  " + d.link : "");
    ic.append(i, y); b.append(ic);
    const not = document.createElement("p"); not.className = "muted"; not.style.cssText = "font-size:.8rem;margin:6px 0 0"; not.textContent = "Şu an yayında" + (d.kim ? " · " + d.kim : "");
    simdi.append(b, not);
  }
  window.YaparmiAuth.onChange((p) => {
    profil = p;
    if (!p || p.rol !== "admin" || basladi) return;
    basladi = true;
    db.collection("ayarlar").doc("duyuru").onSnapshot((s) => {
      const d = s.exists ? s.data() : null;
      onizle(d);
      if (d && d.aktif && !$("duyuruMetin").value) { $("duyuruMetin").value = d.metin || ""; $("duyuruTur").value = d.tur || "bilgi"; $("duyuruLink").value = d.link || ""; }
    }, (err) => { durum.textContent = "⚠️ " + err.message + " (Firestore kurallarına ayarlar/duyuru eklendi mi?)"; });
  });
  async function yaz(veri, btn, mesaj) {
    btn.disabled = true; durum.textContent = "Kaydediliyor…";
    try { await db.collection("ayarlar").doc("duyuru").set(veri); durum.textContent = "✅ " + mesaj; }
    catch (err) { durum.textContent = "⚠️ " + err.message; }
    finally { btn.disabled = false; }
  }
  $("duyuruYayinla").addEventListener("click", () => {
    const metin = $("duyuruMetin").value.trim().slice(0, 300), link = $("duyuruLink").value.trim().slice(0, 300), tur = $("duyuruTur").value;
    if (metin.length < 2) { durum.textContent = "Duyuru metnini yaz."; return; }
    if (link && !/^(https?:\/\/|\/)/.test(link)) { durum.textContent = "Bağlantı / ile ya da https:// ile başlamalı."; return; }
    yaz({ aktif: true, metin, link, tur, id: Date.now(), kim: (profil && profil.kullaniciAdi) || "admin" }, $("duyuruYayinla"), "Yayınlandı, herkesin ekranında.");
  });
  $("duyuruKaldir").addEventListener("click", () => {
    if (!confirm("Duyuru kaldırılsın mı?")) return;
    yaz({ aktif: false, metin: "", link: "", tur: "bilgi", id: Date.now(), kim: (profil && profil.kullaniciAdi) || "admin" }, $("duyuruKaldir"), "Duyuru kaldırıldı.");
    $("duyuruMetin").value = ""; $("duyuruLink").value = "";
  });
})();
