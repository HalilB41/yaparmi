// ============================================================
// itiraf-admin.js — admin.html › Topluluk › 🤫 İtiraflar: bekleyenleri onayla/düzelt/reddet, yayındakini sil.
// Sadece Topluluk bölümü açılınca okur.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("itirafAdminBekleyen")) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const zaman = (t) => new Date(t || Date.now()).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  let basladi = false;
  async function karar(id, k, metin, kutu) {
    kutu.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try { await Ekonomi.api("adminItiraf", { id, karar: k, metin }); kutu.classList.add("bitti"); }
    catch (err) { alert(err.message); kutu.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
  }
  function basla() {
    if (basladi || typeof db === "undefined" || !db) return;
    basladi = true;
    db.collection("itiraf_bekleyen").orderBy("t", "asc").onSnapshot((s) => {
      const k = $("itirafAdminBekleyen"); k.textContent = "";
      if (s.empty) { k.append(el("p", "muted", "Bekleyen itiraf yok 🎉")); return; }
      s.docs.forEach((d) => {
        const x = d.data(), kutu = el("div", "it-admin");
        const ta = el("textarea"); ta.value = x.metin; ta.maxLength = 280; ta.rows = 3;
        const alt = el("div", "it-admin-alt");
        const on = el("button", "admin-btn publish", "✅ Yayınla"); on.type = "button";
        on.addEventListener("click", () => karar(d.id, "onayla", ta.value, kutu));
        const red = el("button", "admin-btn reject", "🗑️ Reddet"); red.type = "button";
        red.addEventListener("click", () => { if (confirm("Bu itiraf silinsin mi?")) karar(d.id, "reddet", null, kutu); });
        alt.append(el("small", "muted", zaman(x.t)), on, red);
        kutu.append(ta, alt);
        k.append(kutu);
      });
    }, (err) => { $("itirafAdminBekleyen").textContent = "Okunamadı: " + err.message; });
    db.collection("itiraf_yayin").orderBy("t", "desc").limit(30).onSnapshot((s) => {
      const k = $("itirafAdminYayin"); k.textContent = "";
      if (s.empty) { k.append(el("p", "muted", "Henüz yayında itiraf yok.")); return; }
      s.docs.forEach((d) => {
        const x = d.data(), kutu = el("div", "it-admin");
        const tep = Object.entries(x.tepki || {}).map(([e, n]) => e + " " + n).join("  ");
        kutu.append(el("p", null, x.metin));
        const alt = el("div", "it-admin-alt");
        const sil = el("button", "admin-btn reject", "Kaldır"); sil.type = "button";
        sil.addEventListener("click", () => { if (confirm("Yayından kaldırılsın mı?")) karar(d.id, "sil", null, kutu); });
        alt.append(el("small", "muted", zaman(x.yayin || x.t) + (tep ? " · " + tep : "")), sil);
        kutu.append(alt);
        k.append(kutu);
      });
    }, () => {});
  }
  if (window.YaparmiAuth) window.YaparmiAuth.onChange((p) => { if (p && p.rol === "admin") (window.AdminSekme ? window.AdminSekme.acilinca("topluluk", basla) : basla()); });
})();
