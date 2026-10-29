// ============================================================
// bildirim.js — TÜM sayfalarda: uygulama olarak yükleme + Ahır bildirimleri.
// Bildirim, site (ya da yüklenen uygulama) açıkken veya arka planda bir sekmede dururken
// Ahır'a başkası yazınca gelir. Site tamamen kapalıyken bildirim için Firebase Cloud
// Messaging + sunucu gerekir (README'de anlatıldı).
// ============================================================
(function () {
  "use strict";
  const ANAHTAR = "yaparmi_bildirim";
  const btn = document.getElementById("bildirimBtn");
  const not = document.getElementById("bildirimNot");
  const destek = "Notification" in window && "serviceWorker" in navigator;
  let kayit = null;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then((r) => (kayit = r)).catch(() => { /* yerelde olmayabilir */ });
  }

  // ---------------- Uygulama olarak yükle ----------------
  let yuklemeIstegi = null;
  const yukleBtn = document.createElement("button");
  yukleBtn.type = "button";
  yukleBtn.className = "tema-bildirim";
  yukleBtn.textContent = "📲 Uygulama olarak yükle";
  yukleBtn.hidden = true;
  if (btn) btn.parentNode.insertBefore(yukleBtn, btn);
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); yuklemeIstegi = e; yukleBtn.hidden = false; });
  yukleBtn.addEventListener("click", async () => {
    if (!yuklemeIstegi) return;
    yuklemeIstegi.prompt();
    await yuklemeIstegi.userChoice.catch(() => null);
    yuklemeIstegi = null;
    yukleBtn.hidden = true;
  });
  addEventListener("appinstalled", () => { yukleBtn.hidden = true; if (window.Basarim) Basarim.say("uygulama"); });

  // ---------------- Bildirim düğmesi ----------------
  function acikMi() {
    try { return destek && Notification.permission === "granted" && localStorage.getItem(ANAHTAR) === "1"; } catch { return false; }
  }
  function ciz() {
    if (!btn) return;
    if (!destek) {
      btn.disabled = true;
      btn.textContent = "🔕 Bu tarayıcı bildirim desteklemiyor";
      if (not) not.textContent = "iPhone'da önce Safari'den 'Ana Ekrana Ekle' ile uygulama olarak yükle, sonra buradan aç.";
      return;
    }
    if (Notification.permission === "denied") {
      btn.textContent = "🔕 Bildirimler engellenmiş";
      if (not) not.textContent = "Tarayıcının site ayarlarından bildirim iznini aç.";
      return;
    }
    btn.textContent = acikMi() ? "🔕 Ahır bildirimlerini kapat" : "🔔 Ahır bildirimlerini aç";
    if (not) not.textContent = acikMi() ? "Ahır'a biri yazınca haber vereceğim (site açıkken ya da arka plandayken)." : "";
  }
  if (btn) {
    btn.addEventListener("click", async () => {
      if (!destek) return;
      if (acikMi()) {
        try { localStorage.setItem(ANAHTAR, "0"); } catch { /* yok */ }
        ciz();
        return;
      }
      const izin = await Notification.requestPermission();
      if (izin === "granted") {
        try { localStorage.setItem(ANAHTAR, "1"); } catch { /* yok */ }
        if (window.Basarim) Basarim.say("bildirim");
        goster("🔔 Bildirimler açık", "Ahır'a biri yazınca buradan haber vereceğim.");
        dinle();
      }
      ciz();
    });
  }
  ciz();

  async function goster(baslik, govde, url) {
    const ayar = { body: govde, icon: "/images/ikon-192.png", badge: "/images/ikon-192.png", tag: "ahir", renotify: true, data: { url: url || "/" } };
    try {
      const r = kayit || (await navigator.serviceWorker.getRegistration());
      if (r) return r.showNotification(baslik, ayar);
    } catch { /* aşağıdaki yedek */ }
    try { new Notification(baslik, ayar); } catch { /* yok */ }
  }

  // ---------------- Ahır'ı dinle ----------------
  let dinliyor = false;
  function dinle() {
    if (dinliyor || !acikMi() || typeof db === "undefined" || !db || typeof auth === "undefined" || !auth) return;
    dinliyor = true;
    const kapat = auth.onAuthStateChanged((user) => {
      if (!user) { auth.signInAnonymously().catch(() => { dinliyor = false; }); return; }
      kapat && kapat();
      let ilk = true;
      db.collection("ahir_mesajlar").orderBy("tarih", "asc").limitToLast(1).onSnapshot((snap) => {
        if (ilk) { ilk = false; return; }
        snap.docChanges().forEach((ch) => {
          if (ch.type !== "added") return;
          const d = ch.doc.data();
          if (!d || typeof d.mesaj !== "string" || d.uid === user.uid || !acikMi()) return;
          const ahirAcik = !document.hidden && document.getElementById("panel-ahir") && !document.getElementById("panel-ahir").hidden;
          if (ahirAcik) return;
          goster("🐴 Berkayın Ahırı", (d.kullaniciAdi || "?") + ": " + d.mesaj.slice(0, 140), "/#ahir");
        });
      }, () => { dinliyor = false; });
    });
  }
  dinle();
})();
