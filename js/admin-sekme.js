// ============================================================
// admin-sekme.js — admin panelinin düzeni:
//   • Soldaki menü (telefonda üstte kayan şerit): bölümler. Adres: #borsa, #borsa/market gibi.
//   • Uzun bölümlerde alt sekmeler: bölümün data-altlar="ad:Etiket|..." tanımından otomatik çizilir,
//     kartlar data-alt="ad" ile gruplanır (data-alt="*" her alt sekmede görünür, etiketsiz kart da).
//   • Bir bölüm İLK açıldığında AdminSekme.acildi(ad) → o bölümün modülü verisini o an yükler
//     (Firestore okuma kotası: sayfayı açmak her şeyi birden okumasın).
//   • Genel bakış: bekleyen iş sayıları (sipariş, galeri önerisi, çark ödülü) + hızlı işlemler.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const sekmeler = Array.from(document.querySelectorAll(".adm-tabs [data-tab]"));
  const paneller = Array.from(document.querySelectorAll(".adm-panel"));
  if (!sekmeler.length) return;
  const AS = window.AdminSekme || { acildi() {}, acilinca(ad, f) { f(); } };

  // ---- Alt sekmeleri kur ----
  const altSecili = {}; // panel → alt
  paneller.forEach((p) => {
    const tanim = p.dataset.altlar;
    if (!tanim) return;
    const altlar = tanim.split("|").map((x) => { const i = x.indexOf(":"); return { ad: x.slice(0, i), etiket: x.slice(i + 1) }; });
    const nav = document.createElement("div");
    nav.className = "adm-alt-sekmeler wide";
    nav.setAttribute("role", "tablist");
    altlar.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.alt = a.ad; b.setAttribute("role", "tab");
      const e = document.createElement("span"); e.textContent = a.etiket; b.appendChild(e);
      const say = document.createElement("span"); say.className = "adm-say"; say.hidden = true; b.appendChild(say);
      b.addEventListener("click", () => git(p.dataset.panel, a.ad));
      nav.appendChild(b);
    });
    // Her alt sekmede sabit kalan kartlardan (data-alt="*") sonra yerleştir, yoksa en başa
    const sabit = Array.from(p.children).filter((c) => c.dataset && c.dataset.alt === "*");
    if (sabit.length) sabit[sabit.length - 1].after(nav); else p.prepend(nav);
    p._altlar = altlar.map((a) => a.ad);
    p._altNav = nav;
  });

  function altGoster(p, alt) {
    if (!p._altlar) return;
    if (!p._altlar.includes(alt)) alt = p._altlar[0];
    altSecili[p.dataset.panel] = alt;
    Array.from(p.children).forEach((c) => {
      if (c === p._altNav) return;
      const a = c.dataset && c.dataset.alt;
      if (!a || a === "*") return; // etiketsiz/sabit: her zaman görünür
      c.hidden = a !== alt;
    });
    p._altNav.querySelectorAll("button").forEach((b) => { const on = b.dataset.alt === alt; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    // Gizliyken boyutu 0 olan grafikler toparlansın
    window.dispatchEvent(new Event("resize"));
  }

  function ac(ad, alt) {
    if (!paneller.some((p) => p.dataset.panel === ad)) ad = "genel";
    sekmeler.forEach((b) => { const on = b.dataset.tab === ad; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    paneller.forEach((p) => {
      const on = p.dataset.panel === ad;
      p.hidden = !on;
      if (on) altGoster(p, alt || altSecili[ad]);
    });
    AS.acildi(ad);
    const hedef = "#" + ad + (altSecili[ad] ? "/" + altSecili[ad] : "");
    if (location.hash !== hedef) history.replaceState(null, "", hedef);
    // telefonda seçili menü öğesi görünsün
    const aktif = sekmeler.find((b) => b.dataset.tab === ad);
    if (aktif && aktif.scrollIntoView && window.matchMedia("(max-width: 900px)").matches) aktif.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function git(ad, alt) { ac(ad, alt); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function hashtenAc() { const [ad, alt] = decodeURIComponent(location.hash.slice(1)).split("/"); ac(ad, alt); }

  sekmeler.forEach((b) => b.addEventListener("click", () => git(b.dataset.tab)));
  window.addEventListener("hashchange", () => { hashtenAc(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  window.AdminSekme.git = git;

  // ---- Sayılar: menü rozetleri → Genel bakış kutuları ve alt sekme rozetleri ----
  // admOneriSay: admin.js (galeri önerileri). admSiparisSay / admCarkSay: aşağıdaki hafif sorgular
  // (bölümler henüz açılmadan da sayı görünsün; sadece bekleyenler okunur).
  const ALT_ROZET = { admSiparisSay: ["borsa", "market"], admCarkSay: ["cark", "sonuc"], admOneriSay: ["galeri", "oneri"], admItirafSay: ["topluluk", "itiraf"] };
  function rozetYay(id) {
    const r = $(id); if (!r) return;
    const n = r.hidden ? 0 : Number(r.textContent) || 0;
    document.querySelectorAll(`.adm-kutu[data-ayna="${id}"]`).forEach((k) => { k.querySelector("b").textContent = String(n); k.classList.toggle("var", n > 0); });
    const [panel, alt] = ALT_ROZET[id] || [];
    const p = paneller.find((x) => x.dataset.panel === panel);
    const b = p && p._altNav && p._altNav.querySelector(`[data-alt="${alt}"] .adm-say`);
    if (b) { b.hidden = !n; b.textContent = String(n); }
  }
  Object.keys(ALT_ROZET).forEach((id) => {
    const r = $(id); if (!r) return;
    new MutationObserver(() => rozetYay(id)).observe(r, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    rozetYay(id);
  });
  function rozetYaz(id, n) { const r = $(id); if (!r) return; r.hidden = !n; r.textContent = String(n); }
  let sayacBasladi = false;
  function sayaclar() {
    if (sayacBasladi || typeof db === "undefined" || !db) return;
    sayacBasladi = true;
    db.collection("borsa_siparis").where("durum", "==", "bekliyor").onSnapshot((s) => rozetYaz("admSiparisSay", s.size), () => {});
    db.collection("cark_sonuclari").where("istendi", "==", true).onSnapshot((s) => rozetYaz("admCarkSay", s.docs.filter((d) => !d.data().verildi).length), () => {});
    db.collection("itiraf_bekleyen").onSnapshot((s) => rozetYaz("admItirafSay", s.size), () => {});
  }
  // Galeri önerileri sayacı (admin.js'in listesi değişince)
  const kuyruk = $("queueList"), oneriSay = $("admOneriSay");
  if (kuyruk && oneriSay) {
    const guncelle = () => { const n = kuyruk.querySelectorAll(".admin-queue-item").length; oneriSay.hidden = n === 0; oneriSay.textContent = String(n); };
    new MutationObserver(guncelle).observe(kuyruk, { childList: true, subtree: true });
    guncelle();
  }
  if (window.YaparmiAuth) window.YaparmiAuth.onChange((p) => { if (p && p.rol === "admin") sayaclar(); });

  hashtenAc();
})();
