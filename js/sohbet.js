// ============================================================
// sohbet.js — ana sayfadaki Sohbet'in (eski adıyla Berkayın Ahırı) görünümü.
// Mesaj gönderme ve takma ad mantığı js/script.js'te, ona dokunulmuyor. Bu dosya aynı mesajları
// (aynı sorgu: Firestore aynı dinlemeyi paylaşır, ek okuma yok) isim, saat, renkli avatar ve
// gruplanmış balonlarla yeniden çizer. script.js'in eski düz listesi gizli kalır; oradaki
// uyarılar ("yavaş ol" vb.) yakalanıp sohbetin içinde sistem satırı olarak gösterilir.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const panel = $("panel-ahir"), eski = $("ahirMessages"), btn = $("ahirBtn");
  if (!panel || !eski) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // --- Kurulum ---
  const akis = el("div", "sh-akis"); akis.id = "sohbetAkis"; akis.setAttribute("role", "log"); akis.setAttribute("aria-live", "polite");
  eski.before(akis);
  eski.classList.add("sh-gizli");
  const bos = el("div", "sh-bos"); bos.append(el("span", null, "💬"), el("b", null, "Henüz kimse yazmamış"), el("small", null, "İlk mesajı sen at 👋"));
  akis.append(bos);
  const yeniBtn = el("button", "sh-yeni", "↓ Yeni mesaj"); yeniBtn.type = "button"; yeniBtn.hidden = true;
  yeniBtn.addEventListener("click", () => { asagi(true); });
  akis.after(yeniBtn);

  // --- Yardımcılar ---
  const RENKLER = ["#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#2563eb", "#c026d3", "#ca8a04", "#dc2626", "#0d9488"];
  function renk(ad) { let h = 0; for (const ch of String(ad)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return RENKLER[h % RENKLER.length]; }
  const saat = (t) => t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  function gunYazi(t) {
    const g = new Date(t); g.setHours(0, 0, 0, 0);
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const fark = Math.round((bugun - g) / 86400000);
    return fark === 0 ? "Bugün" : fark === 1 ? "Dün" : g.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
  }
  // Metin + tıklanabilir bağlantılar (HTML asla çalıştırılmaz)
  function metin(kutu, yazi) {
    const parca = String(yazi).split(/(https?:\/\/[^\s]+)/g);
    parca.forEach((p, i) => {
      if (i % 2) { const a = el("a", null, p.length > 48 ? p.slice(0, 45) + "…" : p); a.href = p; a.target = "_blank"; a.rel = "noopener nofollow"; kutu.append(a); }
      else if (p) kutu.append(document.createTextNode(p));
    });
    // sadece emoji ise büyük göster
    if (/^\s*(\p{Extended_Pictographic}|‍|️|\s){1,8}$/u.test(yazi) && !/\w/.test(yazi)) kutu.classList.add("emoji");
  }
  function ismim() { try { return localStorage.getItem("yaparmi_username") || ""; } catch { return ""; } }

  // --- Çizim ---
  const beklenen = new Set(); // script.js'in eski listesine ekleyeceği yazılar (uyarıları ayırt etmek için)
  let sonGrup = null, sonGun = null, ilkGeldi = false;
  const altta = () => akis.scrollHeight - akis.scrollTop - akis.clientHeight < 90;
  function asagi(zorla) {
    akis.scrollTop = akis.scrollHeight;
    if (zorla) yeniBtn.hidden = true;
  }
  akis.addEventListener("scroll", () => { if (altta()) yeniBtn.hidden = true; });

  function mesajEkle(d) {
    if (!d || typeof d.mesaj !== "string") return;
    const u = typeof auth !== "undefined" && auth && auth.currentUser;
    const ben = !!(u && d.uid === u.uid);
    const ad = d.kullaniciAdi || "?";
    beklenen.add(ben ? d.mesaj : `${ad}: ${d.mesaj}`);
    const t = d.tarih && d.tarih.toDate ? d.tarih.toDate() : new Date();
    const asagidaydi = altta() || !ilkGeldi;
    bos.remove();

    const gun = gunYazi(t);
    if (gun !== sonGun) { akis.append(el("div", "sh-gun", gun)); sonGun = gun; sonGrup = null; }

    let g = sonGrup;
    if (!g || g.uid !== d.uid || t - g.son > 5 * 60000) {
      const kutu = el("div", "sh-grup" + (ben ? " ben" : ""));
      const av = el("div", "sh-avatar", ad.slice(0, 1).toLocaleUpperCase("tr-TR")); av.style.background = renk(ad); av.title = ad;
      const ic = el("div", "sh-icerik");
      if (!ben) {
        const bas = el("div", "sh-ad");
        const isim = window.Ekonomi && Ekonomi.isim ? Ekonomi.isim(ad, undefined, { link: false, unvan: false }) : el("b", null, ad);
        isim.style.color = renk(ad);
        bas.append(isim);
        ic.append(bas);
      }
      kutu.append(av, ic);
      akis.append(kutu);
      g = sonGrup = { uid: d.uid, kutu, ic, son: t };
    }
    g.son = t;
    const balon = el("div", "sh-balon");
    metin(balon, d.mesaj);
    balon.append(el("time", "sh-saat", saat(t)));
    balon.title = t.toLocaleString("tr-TR");
    g.ic.append(balon);

    if (asagidaydi || ben) asagi(true);
    else yeniBtn.hidden = false;
  }
  function sistem(yazi) {
    bos.remove();
    const s = el("div", "sh-sistem", yazi);
    akis.append(s); sonGrup = null;
    asagi(true);
    setTimeout(() => s.classList.add("sonuk"), 6000);
  }

  // script.js'in eski listesine düşen uyarıları yakala
  new MutationObserver((kayitlar) => {
    for (const k of kayitlar) for (const n of k.addedNodes) {
      if (n.nodeType !== 1) continue;
      setTimeout(() => { const y = n.textContent || ""; if (!beklenen.has(y)) sistem(y); }, 600);
    }
  }).observe(eski, { childList: true });

  // --- Dinleme ---
  let basladi = false;
  function baslat() {
    if (basladi || typeof db === "undefined" || !db || typeof auth === "undefined" || !auth) return;
    basladi = true;
    let dinliyor = false;
    auth.onAuthStateChanged((u) => {
      if (!u || dinliyor) return;
      dinliyor = true;
      db.collection("ahir_mesajlar").orderBy("tarih", "asc").limitToLast(50).onSnapshot((snap) => {
        snap.docChanges().forEach((ch) => { if (ch.type === "added") mesajEkle(ch.doc.data()); });
        if (!ilkGeldi) { ilkGeldi = true; requestAnimationFrame(() => asagi(true)); }
      }, () => {});
    });
  }
  if (btn) btn.addEventListener("click", () => { baslat(); setTimeout(() => { asagi(true); const i = $("ahirInput"); if (i && !i.disabled && matchMedia("(pointer: fine)").matches) i.focus(); }, 80); });
  if (!panel.hidden) baslat();
  // /#sohbet bağlantısı (bildirimler, ana sayfa kısayolu)
  function hashAc() { if (location.hash === "#sohbet" && btn) { btn.click(); panel.scrollIntoView({ behavior: "smooth", block: "center" }); } }
  window.addEventListener("hashchange", hashAc);
  hashAc();
  const kisayol = $("sohbetKisayol");
  if (kisayol) kisayol.addEventListener("click", (e) => { e.preventDefault(); if (location.hash !== "#sohbet") history.replaceState(null, "", "#sohbet"); hashAc(); });

  // Siteye giriş yapmışsa takma ad kutusunu kendi adıyla doldur (tek tıkla girsin)
  if (window.YaparmiAuth) YaparmiAuth.onChange((p) => {
    const inp = $("usernameInput");
    if (p && p.kullaniciAdi && inp && !inp.value && !ismim()) inp.value = String(p.kullaniciAdi).replace(/\s+/g, "").toLocaleLowerCase("tr-TR").slice(0, 12);
  });
})();
