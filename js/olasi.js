// ============================================================
// olasi.js — topluluk.html "🤔 Kim daha olası?": soru çıkar, bir isme bas, sonucu gör.
// Firestore: olasi_soru/{id} {soru, ekleyen, sayim: {ad: n}, toplam}, olasi_oy/{soruId_uid} {secim}.
// Oy = oy belgesi + soru sayacının +1'i birlikte (batch); kurallar herkesin her soruya bir kez,
// sadece seçtiği kişiye +1 vermesine izin verir. Sayaçlar soruda durduğu için sonuçlar ek okuma istemez.
// İsimler: borsa özetindeki (siteye kayıtlı, cüzdanı olan) herkes.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const bolum = $("olasiBolum");
  if (!bolum || typeof db === "undefined" || !db) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const RENKLER = ["#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#2563eb", "#c026d3", "#ca8a04", "#dc2626", "#0d9488"];
  function renk(ad) { let h = 0; for (const ch of String(ad)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return RENKLER[h % RENKLER.length]; }

  let profile = null, basladi = false, sorular = [], benimOy = new Map(), isimler = [], sira = [], simdiki = null, sonucta = false;
  const KART = $("olKart");

  window.YaparmiAuth.onChange((p) => { profile = p; $("olForm").hidden = !p; if (basladi) yukle(); });
  window.addEventListener("mk-bolum", (e) => { if (e.detail === "olasi") baslat(); });
  if (!bolum.hidden) baslat();

  function baslat() {
    if (basladi) return;
    basladi = true;
    Ekonomi.ozet((o) => {
      const yeni = Object.values((o && o.kisi) || {}).map((k) => k.ad).filter((a) => a && a !== "admin").sort((a, b) => a.localeCompare(b, "tr"));
      if (yeni.join() !== isimler.join()) { isimler = yeni; if (simdiki && !sonucta) kartCiz(); }
    });
    yukle();
  }
  async function yukle() {
    try {
      const [ss, os] = await Promise.all([
        db.collection("olasi_soru").get(),
        profile ? db.collection("olasi_oy").where("uid", "==", profile.uid).get() : Promise.resolve({ docs: [] }),
      ]);
      sorular = ss.docs.map((d) => ({ id: d.id, ...d.data() }));
      benimOy = new Map(os.docs.map((d) => [d.data().soruId, d.data().secim]));
    } catch (e) { KART.textContent = "Yüklenemedi: " + e.message; return; }
    sira = sorular.filter((s) => !benimOy.has(s.id)).sort(() => Math.random() - 0.5);
    sonraki();
    unvanCiz();
  }
  function sonraki() {
    sonucta = false;
    simdiki = sira.shift() || null;
    if (!simdiki) {
      // hepsi cevaplandı: rastgele bir cevaplananın sonucunu göster
      const cevapli = sorular.filter((s) => benimOy.has(s.id));
      if (cevapli.length) { simdiki = cevapli[Math.floor(Math.random() * cevapli.length)]; sonucta = true; }
    }
    kartCiz();
  }
  function kartCiz() {
    KART.textContent = "";
    if (!simdiki) {
      const b = el("div", "ol-bos"); b.append(el("span", null, "🤔"), el("b", null, "Henüz soru yok"), el("small", "muted", profile ? "Aşağıdan ilk soruyu sen ekle." : "Giriş yapıp ilk soruyu sen ekle."));
      KART.append(b); return;
    }
    const kalan = sira.length;
    const ust = el("div", "ol-ust");
    ust.append(el("small", "muted", sonucta && !kalan ? "Hepsini cevapladın, işte bir tanesi:" : `${kalan} soru daha var`), el("small", "muted", `ekleyen: ${simdiki.ekleyen}`));
    KART.append(ust, el("h2", "ol-soru", simdiki.soru));
    if (sonucta || benimOy.has(simdiki.id)) return sonucCiz();
    if (!profile) { KART.append(el("p", "muted", "Oy vermek için giriş yap.")); const g = el("button", "btn ghost", "Sonuçları gör"); g.type = "button"; g.addEventListener("click", () => { sonucta = true; kartCiz(); }); KART.append(g); return; }
    const izgara = el("div", "ol-isimler");
    (isimler.length ? isimler : [profile.kullaniciAdi]).forEach((ad) => {
      const b = el("button", "ol-isim"); b.type = "button";
      const av = el("span", "ol-av", ad.slice(0, 1).toLocaleUpperCase("tr-TR")); av.style.background = renk(ad);
      b.append(av, el("span", null, ad));
      b.addEventListener("click", () => oyVer(ad, b));
      izgara.append(b);
    });
    KART.append(izgara);
    const alt = el("div", "ol-kart-alt");
    const atla = el("button", "link-btn", "Atla →"); atla.type = "button";
    atla.addEventListener("click", () => { sira.push(simdiki); sonraki(); });
    alt.append(atla);
    KART.append(alt);
  }
  async function oyVer(ad, btn) {
    const s = simdiki;
    KART.querySelectorAll(".ol-isim").forEach((b) => (b.disabled = true));
    btn.classList.add("secili");
    try {
      const batch = db.batch();
      batch.set(db.collection("olasi_oy").doc(s.id + "_" + profile.uid), { soruId: s.id, uid: profile.uid, secim: ad, tarih: firebase.firestore.FieldValue.serverTimestamp() });
      batch.update(db.collection("olasi_soru").doc(s.id), new firebase.firestore.FieldPath("sayim", ad), firebase.firestore.FieldValue.increment(1), "toplam", firebase.firestore.FieldValue.increment(1));
      await batch.commit();
      s.sayim = { ...(s.sayim || {}) }; s.sayim[ad] = (s.sayim[ad] || 0) + 1; s.toplam = (s.toplam || 0) + 1;
      benimOy.set(s.id, ad);
      sonucta = true; kartCiz(); unvanCiz();
    } catch (e) {
      KART.querySelectorAll(".ol-isim").forEach((b) => (b.disabled = false)); btn.classList.remove("secili");
      KART.append(el("p", "suggest-status", "⚠️ " + (/permission/i.test(e.message) ? "Bu soruya zaten oy vermişsin." : e.message)));
    }
  }
  function sonucCiz() {
    const s = simdiki, top = s.toplam || 0, benim = benimOy.get(s.id);
    const liste = Object.entries(s.sayim || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const kutu = el("div", "ol-sonuc");
    if (!liste.length) kutu.append(el("p", "muted", "Henüz kimse oy vermedi."));
    liste.forEach(([ad, n], i) => {
      const yuzde = Math.round((n / top) * 100);
      const satir = el("div", "ol-bar" + (i === 0 ? " lider" : "") + (ad === benim ? " benim" : ""));
      const dolgu = el("i"); dolgu.style.width = yuzde + "%"; dolgu.style.background = renk(ad);
      const yazi = el("span", "ol-bar-yazi");
      yazi.append(el("b", null, (i === 0 ? "👑 " : "") + ad), el("span", null, `%${yuzde} · ${n} oy${ad === benim ? " · sen" : ""}`));
      satir.append(dolgu, yazi);
      kutu.append(satir);
    });
    KART.append(kutu);
    const alt = el("div", "ol-kart-alt");
    const pay = el("button", "btn ghost", "📤 Gruba at"); pay.type = "button";
    pay.addEventListener("click", () => {
      const l = liste[0];
      const metin = `🤔 ${s.soru}\n${l ? `Site diyor ki: 👑 ${l[0]} (%${Math.round((l[1] / top) * 100)})` : "Kimse oy vermedi"}\nSen ne dersin? ${location.origin}/topluluk#olasi`;
      if (navigator.share) navigator.share({ text: metin }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(metin), "_blank", "noopener");
    });
    const ileri = el("button", "btn", sira.length ? "Sonraki soru →" : "Başka bir tane göster"); ileri.type = "button";
    ileri.addEventListener("click", sonraki);
    alt.append(pay, ileri);
    if (profile && (s.ekleyenUid === profile.uid || profile.rol === "admin")) {
      const sil = el("button", "link-btn", "🗑️ Soruyu sil"); sil.type = "button";
      sil.addEventListener("click", async () => { if (!confirm("Bu soru silinsin mi?")) return; try { await db.collection("olasi_soru").doc(s.id).delete(); sorular = sorular.filter((x) => x.id !== s.id); sonraki(); unvanCiz(); } catch (e) { alert(e.message); } });
      alt.append(sil);
    }
    KART.append(alt);
  }
  // Grubun unvanları: her sorunun liderine o soru "unvan" olarak yazılır
  function unvanCiz() {
    const k = $("olUnvan"); k.textContent = "";
    const kisi = {};
    sorular.forEach((s) => {
      const l = Object.entries(s.sayim || {}).sort((a, b) => b[1] - a[1])[0];
      if (!l || !l[1]) return;
      (kisi[l[0]] || (kisi[l[0]] = [])).push({ soru: s.soru, yuzde: Math.round((l[1] / (s.toplam || 1)) * 100) });
    });
    const sirali = Object.entries(kisi).sort((a, b) => b[1].length - a[1].length);
    if (!sirali.length) { k.append(el("p", "muted", "Oylar geldikçe burada kimin neyle meşhur olduğu çıkacak.")); return; }
    sirali.forEach(([ad, l]) => {
      const d = el("details", "ol-unvan");
      const sm = el("summary");
      const av = el("span", "ol-av", ad.slice(0, 1).toLocaleUpperCase("tr-TR")); av.style.background = renk(ad);
      sm.append(av, el("b", null, ad), el("span", "muted", `${l.length} unvan`));
      d.append(sm);
      const ul = el("ul");
      l.forEach((x) => { const li = el("li"); li.append(x.soru.replace(/^Kimin\s+/i, "").replace(/\?$/, ""), el("small", "muted", ` · %${x.yuzde}`)); ul.append(li); });
      d.append(ul);
      k.append(d);
    });
  }

  // Soru ekle
  $("olForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    let soru = $("olSoru").value.trim().replace(/\s+/g, " ");
    if (soru.length < 8) { $("olDurum").textContent = "⚠️ Biraz daha uzun yaz."; return; }
    if (!/[?？]$/.test(soru)) soru += "?";
    const b = e.target.querySelector("button"); b.disabled = true;
    try {
      const ref = await db.collection("olasi_soru").add({ soru, ekleyen: profile.kullaniciAdi, ekleyenUid: profile.uid, tarih: firebase.firestore.FieldValue.serverTimestamp(), sayim: {}, toplam: 0 });
      const yeni = { id: ref.id, soru, ekleyen: profile.kullaniciAdi, ekleyenUid: profile.uid, sayim: {}, toplam: 0 };
      sorular.push(yeni);
      if (simdiki && !sonucta) sira.unshift(simdiki);
      simdiki = yeni; sonucta = false; kartCiz();
      $("olSoru").value = ""; $("olDurum").textContent = "✅ Eklendi, ilk oyu sen ver!";
      KART.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) { $("olDurum").textContent = "⚠️ " + err.message; }
    finally { b.disabled = false; }
  });
})();
