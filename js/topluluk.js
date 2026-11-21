// ============================================================
// topluluk.js — topluluk.html: Günün Sorusu / Anketler / Haftanın Rezili,
// Sayaçlar, Hepsiburada vardiya takvimi ve Liderlik tablosu.
//
// Firestore:
//   anketler/{id}     { tur: "gunun"|"anket"|"rezillik", baslik, secenekler: [..], acik: bool,
//                       dogru: int|null, tarih, kapanis? }   (admin yazar, herkes okur)
//   anket_oylar/{anketId_uid} { anketId, uid, kullaniciAdi, secim, tarih }  (kişi başı 1 oy)
//   sayaclar/grup     { liste: [{ emoji, ad, deger }] }  (admin yazar; "Berkay napıcak" sayacı gibi)
//   vardiyalar/{tarih_uid} { uid, kullaniciAdi, tarih: "YYYY-MM-DD", vardiya: "gece"|"gunduz"|"sabah",
//                       bolum, tl, not, olusturma }  (kişi kendi kaydını girer, admin hepsini düzenler)
//   cark_sonuclari, rekorlar → liderlik için okunur
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("toplulukSayfa")) return;
  if (typeof db === "undefined" || !db) {
    $("toplulukSayfa").innerHTML = '<p class="muted">Firebase bağlı değil.</p>';
    return;
  }

  let profile = null;
  const TUR = { gunun: ["🌞", "Günün Sorusu"], anket: ["🗳️", "Anket"], rezillik: ["🤡", "Haftanın Rezili"] };
  const VARDIYA = { gece: "🌙 Gece", gunduz: "☀️ Gündüz", sabah: "🌅 Sabah" };

  function tarihYaz(ts) { try { return ts && ts.toDate ? ts.toDate().toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) : ""; } catch { return ""; } }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function girisGerekli() { return !(profile && profile.kullaniciAdi); }

  // ---------------- Sayfa sekmeleri ----------------
  // Topluluk merkezinde başka bölümlerle aynı sayfada: sadece kendi bölümündeki sekmeler
  const kokBolum = document.getElementById("toplulukSayfa");
  const sekmeler = Array.from(kokBolum.querySelectorAll(".adm-tabs [data-tab]"));
  const paneller = Array.from(kokBolum.querySelectorAll(".adm-panel"));
  function ac(ad) {
    if (!paneller.some((p) => p.dataset.panel === ad)) ad = "anket";
    sekmeler.forEach((b) => { const on = b.dataset.tab === ad; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    paneller.forEach((p) => (p.hidden = p.dataset.panel !== ad));
    if (!kokBolum.hidden && location.hash.slice(1) !== ad) history.replaceState(null, "", "#" + ad);
  }
  sekmeler.forEach((b) => b.addEventListener("click", () => ac(b.dataset.tab)));
  ac(location.hash.slice(1));

  // ---------------- Anketler ----------------
  let anketler = [];
  let oylar = {}; // anketId -> [{uid, kullaniciAdi, secim}]
  let benimOylarim = {}; // anketId -> secim
  const anketListe = $("anketListe");
  const anketKapali = $("anketKapali");

  function anketKart(a) {
    const kart = el("article", "card tpl-anket" + (a.acik ? "" : " is-kapali"));
    const ust = el("div", "tpl-anket-ust");
    const [ico, ad] = TUR[a.tur] || TUR.anket;
    ust.appendChild(el("span", "tpl-etiket", ico + " " + ad));
    ust.appendChild(el("span", "muted", (a.acan ? "✍️ " + a.acan + " · " : "") + tarihYaz(a.tarih) + (a.acik ? "" : " · kapandı")));
    if (a.acik && profile && a.acanUid && a.acanUid === profile.uid) {
      const kap = el("button", "link-btn tpl-kapat", "Anketi kapat");
      kap.type = "button";
      kap.addEventListener("click", () => { if (confirm("Anketin kapansın mı? Kimse oy veremez.")) db.collection("anketler").doc(a.id).update({ acik: false }).catch((e) => alert(e.message)); });
      ust.appendChild(kap);
    }
    kart.appendChild(ust);
    kart.appendChild(el("h3", null, a.baslik));

    const liste = oylar[a.id] || [];
    const toplam = liste.length;
    const sayim = a.secenekler.map((_, i) => liste.filter((o) => o.secim === i).length);
    const benim = benimOylarim[a.id];
    const gosterSonuc = !a.acik || benim != null;

    const secKutu = el("div", "tpl-secenekler");
    a.secenekler.forEach((metin, i) => {
      const b = el("button", "tpl-secenek" + (benim === i ? " is-benim" : "") + (a.dogru === i ? " is-dogru" : ""));
      b.type = "button";
      const yuzde = toplam ? Math.round((sayim[i] / toplam) * 100) : 0;
      if (gosterSonuc) { const bar = el("i"); bar.style.width = yuzde + "%"; b.appendChild(bar); }
      const yazi = el("span", "tpl-secenek-yazi", (a.dogru === i ? "✅ " : "") + metin);
      b.appendChild(yazi);
      if (gosterSonuc) b.appendChild(el("span", "tpl-secenek-sayi", sayim[i] + " oy · %" + yuzde));
      b.disabled = !a.acik || benim != null || girisGerekli();
      b.addEventListener("click", () => oyVer(a, i));
      secKutu.appendChild(b);
    });
    kart.appendChild(secKutu);

    const alt = el("div", "tpl-anket-alt muted");
    if (girisGerekli() && a.acik) alt.textContent = "Oy vermek için giriş yap.";
    else if (a.acik && benim == null) alt.textContent = toplam + " kişi oy verdi.";
    else alt.textContent = toplam + " oy" + (benim != null ? " · senin oyun: " + a.secenekler[benim] : "");
    if (gosterSonuc && toplam) {
      const kimler = el("details", "tpl-kimler");
      kimler.appendChild(el("summary", null, "Kim ne dedi?"));
      a.secenekler.forEach((metin, i) => {
        const isimler = liste.filter((o) => o.secim === i).map((o) => o.kullaniciAdi).join(", ");
        if (isimler) kimler.appendChild(el("p", null, metin + ": " + isimler));
      });
      alt.appendChild(kimler);
    }
    if (a.dogru != null) {
      const bilenler = liste.filter((o) => o.secim === a.dogru).map((o) => o.kullaniciAdi);
      alt.appendChild(el("p", "tpl-bilenler", bilenler.length ? "🎯 Bilenler: " + bilenler.join(", ") : "🎯 Kimse bilemedi."));
    }
    kart.appendChild(alt);
    return kart;
  }

  async function oyVer(a, secim) {
    if (girisGerekli() || !a.acik) return;
    const id = a.id + "_" + profile.uid;
    try {
      await db.collection("anket_oylar").doc(id).set({
        anketId: a.id, uid: profile.uid, kullaniciAdi: profile.kullaniciAdi, secim,
        tarih: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (window.Basarim) Basarim.say("anket");
    } catch (err) { alert("Oy verilemedi: " + err.message); }
  }

  function anketleriCiz() {
    anketListe.innerHTML = ""; anketKapali.innerHTML = "";
    const acik = anketler.filter((a) => a.acik);
    const kapali = anketler.filter((a) => !a.acik);
    if (!acik.length) anketListe.appendChild(el("p", "muted", "Şu an açık anket yok. Yukarıdan ilkini sen aç!"));
    acik.forEach((a) => anketListe.appendChild(anketKart(a)));
    if (!kapali.length) anketKapali.appendChild(el("p", "muted", "Henüz kapanan anket yok."));
    kapali.slice(0, 30).forEach((a) => anketKapali.appendChild(anketKart(a)));
    liderlikCiz();
  }

  // ---------------- Anket aç (herkes, onaysız) ----------------
  $("kAnketOlustur").addEventListener("click", async () => {
    const durum = $("kAnketDurum");
    if (girisGerekli()) { durum.textContent = "Anket açmak için sağ üstten giriş yap."; return; }
    const baslik = $("kAnketBaslik").value.trim().slice(0, 160);
    const secenekler = [...new Set($("kAnketSecenek").value.split("\n").map((x) => x.trim().slice(0, 80)).filter(Boolean))].slice(0, 10);
    if (baslik.length < 3 || secenekler.length < 2) { durum.textContent = "Soru ve en az 2 farklı seçenek yaz."; return; }
    const btn = $("kAnketOlustur"); btn.disabled = true; durum.textContent = "Yayınlanıyor…";
    try {
      await db.collection("anketler").add({
        tur: TUR[$("kAnketTur").value] ? $("kAnketTur").value : "anket",
        baslik, secenekler, acik: true, dogru: null,
        acan: profile.kullaniciAdi, acanUid: profile.uid,
        tarih: firebase.firestore.FieldValue.serverTimestamp(),
      });
      $("kAnketBaslik").value = ""; $("kAnketSecenek").value = "";
      durum.textContent = "✅ Yayında!";
      $("anketAcKutu").open = false;
    } catch (err) { durum.textContent = "⚠️ Olmadı: " + err.message; }
    finally { btn.disabled = false; }
  });

  db.collection("anketler").orderBy("tarih", "desc").limit(100).onSnapshot((snap) => {
    anketler = snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id, tur: TUR[v.tur] ? v.tur : "anket", baslik: String(v.baslik || ""),
        secenekler: (Array.isArray(v.secenekler) ? v.secenekler : []).map(String).slice(0, 10),
        acik: !!v.acik, dogru: Number.isInteger(v.dogru) ? v.dogru : null, tarih: v.tarih,
        acan: typeof v.acan === "string" ? v.acan : "", acanUid: v.acanUid || "",
      };
    });
    anketleriCiz();
  }, (err) => { anketListe.innerHTML = '<p class="muted">Anketler okunamadı (Firestore kuralları?): ' + err.message + "</p>"; });

  db.collection("anket_oylar").limit(3000).onSnapshot((snap) => {
    oylar = {}; benimOylarim = {};
    snap.forEach((d) => {
      const v = d.data();
      (oylar[v.anketId] = oylar[v.anketId] || []).push({ uid: v.uid, kullaniciAdi: v.kullaniciAdi || "?", secim: v.secim });
      if (profile && v.uid === profile.uid) benimOylarim[v.anketId] = v.secim;
    });
    anketleriCiz();
  });

  // ---------------- Sayaçlar ----------------
  const sayacKutu = $("sayacKutu");
  let sayaclar = [];
  db.collection("sayaclar").doc("grup").onSnapshot((snap) => {
    const v = snap.exists ? snap.data() : {};
    sayaclar = (Array.isArray(v.liste) ? v.liste : []).filter((s) => s && typeof s.ad === "string");
    sayacKutu.innerHTML = "";
    if (!sayaclar.length) { sayacKutu.appendChild(el("p", "muted", "Henüz sayaç yok.")); return; }
    sayaclar.forEach((s) => {
      const k = el("div", "tpl-sayac");
      k.appendChild(el("div", "tpl-sayac-emoji", String(s.emoji || "🔢")));
      k.appendChild(el("div", "tpl-sayac-deger", String(Number(s.deger) || 0)));
      k.appendChild(el("div", "tpl-sayac-ad", s.ad));
      sayacKutu.appendChild(k);
    });
  });

  // ---------------- Vardiya takvimi ----------------
  const vardiyaListe = $("vardiyaListe");
  const vardiyaOzet = $("vardiyaOzet");
  const vardiyaForm = $("vardiyaForm");
  const vardiyaDurum = $("vardiyaDurum");
  let vardiyalar = [];

  function bugun() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  if ($("vardiyaTarih")) $("vardiyaTarih").value = bugun();

  vardiyaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (girisGerekli()) { vardiyaDurum.textContent = "Kaydetmek için giriş yap."; return; }
    const tarih = $("vardiyaTarih").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) { vardiyaDurum.textContent = "Tarih seç."; return; }
    const veri = {
      uid: profile.uid, kullaniciAdi: profile.kullaniciAdi, tarih,
      vardiya: VARDIYA[$("vardiyaTur").value] ? $("vardiyaTur").value : "gece",
      bolum: $("vardiyaBolum").value.trim().slice(0, 30),
      tl: Math.max(0, Math.min(99999, Math.round(Number($("vardiyaTl").value) || 0))),
      not: $("vardiyaNot").value.trim().slice(0, 120),
      olusturma: firebase.firestore.FieldValue.serverTimestamp(),
    };
    vardiyaDurum.textContent = "Kaydediliyor…";
    try {
      await db.collection("vardiyalar").doc(tarih + "_" + profile.uid).set(veri);
      vardiyaDurum.textContent = "✅ Kaydedildi. Sınırsız!";
      $("vardiyaNot").value = "";
      if (window.Basarim) Basarim.say("vardiya");
    } catch (err) { vardiyaDurum.textContent = "⚠️ Kaydedilemedi: " + err.message; }
  });

  db.collection("vardiyalar").orderBy("tarih", "desc").limit(500).onSnapshot((snap) => {
    vardiyalar = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    vardiyaCiz(); liderlikCiz();
  }, (err) => { vardiyaListe.innerHTML = '<p class="muted">Vardiyalar okunamadı: ' + err.message + "</p>"; });

  function vardiyaCiz() {
    vardiyaListe.innerHTML = ""; vardiyaOzet.innerHTML = "";
    if (!vardiyalar.length) { vardiyaListe.appendChild(el("p", "muted", "Henüz vardiya girilmedi. İlk 'sınırsız'ı sen gir.")); return; }
    // Özet kutuları
    const kisi = {};
    vardiyalar.forEach((v) => { const k = kisi[v.kullaniciAdi] = kisi[v.kullaniciAdi] || { gun: 0, tl: 0 }; k.gun++; k.tl += Number(v.tl) || 0; });
    const toplamGun = vardiyalar.length, toplamTl = vardiyalar.reduce((t, v) => t + (Number(v.tl) || 0), 0);
    [["♾️", toplamGun, "sınırsız vardiya"], ["💸", toplamTl.toLocaleString("tr-TR") + " ₺", "toplam yevmiye"], ["👷", Object.keys(kisi).length, "amele"]].forEach(([e, d, a]) => {
      const k = el("div", "tpl-sayac"); k.appendChild(el("div", "tpl-sayac-emoji", e)); k.appendChild(el("div", "tpl-sayac-deger", String(d))); k.appendChild(el("div", "tpl-sayac-ad", a)); vardiyaOzet.appendChild(k);
    });
    // Güne göre grupla
    const gunler = {};
    vardiyalar.forEach((v) => (gunler[v.tarih] = gunler[v.tarih] || []).push(v));
    Object.keys(gunler).sort().reverse().forEach((t) => {
      const gun = el("div", "tpl-gun");
      const d = new Date(t + "T12:00:00");
      gun.appendChild(el("h4", null, isNaN(d) ? t : d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })));
      gunler[t].forEach((v) => {
        const satir = el("div", "tpl-vardiya" + (profile && v.uid === profile.uid ? " is-benim" : ""));
        satir.appendChild(el("b", null, v.kullaniciAdi || "?"));
        satir.appendChild(el("span", "tpl-etiket", VARDIYA[v.vardiya] || v.vardiya || ""));
        if (v.bolum) satir.appendChild(el("span", "muted", v.bolum));
        satir.appendChild(el("span", "tpl-tl", v.tl ? Number(v.tl).toLocaleString("tr-TR") + " ₺" : "—"));
        if (v.not) satir.appendChild(el("span", "muted tpl-not", "“" + v.not + "”"));
        if (profile && (v.uid === profile.uid || profile.rol === "admin")) {
          const sil = el("button", "link-btn", "sil"); sil.type = "button";
          sil.addEventListener("click", () => { if (confirm("Bu vardiya kaydı silinsin mi?")) db.collection("vardiyalar").doc(v.id).delete().catch((e) => alert(e.message)); });
          satir.appendChild(sil);
        }
        gun.appendChild(satir);
      });
      vardiyaListe.appendChild(gun);
    });
  }

  // ---------------- Liderlik ----------------
  const liderKutu = $("liderKutu");
  let carkSonuclari = [], rekorlar = [];
  db.collection("cark_sonuclari").limit(1000).onSnapshot((snap) => { carkSonuclari = snap.docs.map((d) => d.data()); liderlikCiz(); }, () => { carkSonuclari = []; liderlikCiz(); });
  db.collection("rekorlar").onSnapshot((snap) => { rekorlar = snap.docs.map((d) => d.data()); liderlikCiz(); }, () => {});

  function tablo(baslik, satirlar, birim) {
    const k = el("div", "card tpl-lider");
    k.appendChild(el("h3", null, baslik));
    if (!satirlar.length) { k.appendChild(el("p", "muted", "Henüz veri yok.")); return k; }
    const ol = el("ol", "tpl-lider-liste");
    satirlar.slice(0, 8).forEach(([ad, deger], i) => {
      const li = el("li");
      li.appendChild(el("span", "tpl-lider-sira", ["🥇", "🥈", "🥉"][i] || (i + 1) + "."));
      li.appendChild(el("span", "tpl-lider-ad", ad));
      li.appendChild(el("span", "tpl-lider-deger", typeof deger === "number" ? deger.toLocaleString("tr-TR") + (birim || "") : String(deger)));
      ol.appendChild(li);
    });
    k.appendChild(ol);
    return k;
  }
  function topla(liste, anahtar, deger) {
    const m = {};
    liste.forEach((x) => { const k = x[anahtar] || "?"; m[k] = (m[k] || 0) + (deger ? deger(x) : 1); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }
  function liderlikCiz() {
    if (!liderKutu) return;
    liderKutu.innerHTML = "";
    liderKutu.appendChild(tablo("♾️ En çok vardiya", topla(vardiyalar, "kullaniciAdi"), " gün"));
    liderKutu.appendChild(tablo("💸 En çok yevmiye", topla(vardiyalar, "kullaniciAdi", (v) => Number(v.tl) || 0), " ₺"));
    // Anket: doğru bilme
    const bilen = {};
    anketler.filter((a) => a.dogru != null).forEach((a) => (oylar[a.id] || []).filter((o) => o.secim === a.dogru).forEach((o) => { bilen[o.kullaniciAdi] = (bilen[o.kullaniciAdi] || 0) + 1; }));
    liderKutu.appendChild(tablo("🎯 Anket kâhini (doğru bilen)", Object.entries(bilen).sort((a, b) => b[1] - a[1]), " doğru"));
    const oyveren = {};
    Object.values(oylar).flat().forEach((o) => { oyveren[o.kullaniciAdi] = (oyveren[o.kullaniciAdi] || 0) + 1; });
    liderKutu.appendChild(tablo("🗳️ En çok oy veren", Object.entries(oyveren).sort((a, b) => b[1] - a[1]), " oy"));
    liderKutu.appendChild(tablo("🎡 Çarktan en çok ödül", topla(carkSonuclari.filter((s) => s.cark === "sinirsiz" && !s.maximusBileti), "kullaniciAdi"), " ödül"));
    liderKutu.appendChild(tablo("🌟 Maximus bileti", topla(carkSonuclari.filter((s) => s.maximusBileti), "kullaniciAdi"), " bilet"));
    const oyunAd = { boks: "🥊 Boks makinesi", penalti: "⚽ Penaltı serisi", motor: "🏍️ Kasksız 85" };
    Object.keys(oyunAd).forEach((oyun) => {
      const satirlar = rekorlar.filter((r) => r.oyun === oyun).sort((a, b) => b.skor - a.skor).map((r) => [r.ad || "?", Number(r.skor) || 0]);
      liderKutu.appendChild(tablo(oyunAd[oyun], satirlar, ""));
    });
  }

  // ---------------- Giriş ----------------
  const girisNot = $("toplulukGiris");
  if (window.YaparmiAuth) {
    window.YaparmiAuth.onChange((p) => {
      profile = p && p.kullaniciAdi ? p : null;
      if (girisNot) girisNot.hidden = !!profile;
      anketleriCiz(); vardiyaCiz(); liderlikCiz();
    });
  }
})();
