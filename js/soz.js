// ============================================================
// soz.js — soz.html: Söz ve İddia Defteri.
// Grupta verilen sözler ("Berkay geçerse herkese dondurma") buraya yazılır.
//   ⏳ bekliyor → koşul daha belli değil
//   💸 borc     → koşul gerçekleşti, borç başladı (gün gün sayılır, Borç duvarında görünür)
//   ✅ odendi   → ödeyen kanıt fotoğrafını yükledi
//   🔥 yandi    → koşul gerçekleşmedi, söz düştü
//
// Firestore:
//   sozler/{id}        { veren, kime, metin, kosul, sonTarih "YYYY-MM-DD"|"", durum,
//                        kaydeden, kaydedenUid, sahitler: [kullaniciAdi], tarih, guncelleme,
//                        borcTarihi?, degistiren? }   (herkes okur, giriş yapan yazar)
//   soz_kanitlar/{id}  { resim (base64), yukleyen, yukleyenUid, tarih }  (ödeme kanıtı, ayrı
//                        tutuluyor ki liste açılırken bütün fotoğraflar inmesin)
// Kurallar "Claude outputs/firestore.rules" içinde. Admin her şeyi geri alabilir/silebilir.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("sozSayfa")) return;
  if (typeof db === "undefined" || !db) {
    $("sozSayfa").insertAdjacentHTML("beforeend", '<p class="muted">Firebase bağlı değil.</p>');
    return;
  }

  const FV = firebase.firestore.FieldValue;
  const DURUMLAR = ["borc", "bekliyor", "odendi", "yandi"];
  const ETIKET = { bekliyor: "⏳ Bekliyor", borc: "💸 Borç", odendi: "✅ Ödendi", yandi: "🔥 Yandı" };
  const TEMEL_ISIMLER = ["Herkese", "Berkay", "Alihan", "Burger", "Kurban", "Halil", "İbo", "Cem", "Salih", "Alpaslan"];
  const GUN = 86400000;

  let profile = null;
  let sozler = [];

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function girisli() { return !!(profile && profile.kullaniciAdi); }
  function adminMi() { return !!(profile && profile.rol === "admin"); }
  function ms(ts) { return ts && typeof ts.toMillis === "function" ? ts.toMillis() : Date.now(); }
  function tarihYaz(ts) { try { return ts && ts.toDate ? ts.toDate().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "az önce"; } catch { return ""; } }
  function gunYaz(str) { try { return new Date(str + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" }); } catch { return str; } }
  function anahtar(isim) { return String(isim || "").trim().toLocaleLowerCase("tr-TR"); }
  function gunSay(ts) { return Math.max(0, Math.floor((Date.now() - ms(ts)) / GUN)); }

  // ---------------- Sekmeler ----------------
  const sekmeler = Array.from(document.querySelectorAll(".adm-tabs [data-tab]"));
  const paneller = Array.from(document.querySelectorAll(".adm-panel"));
  function ac(ad) {
    if (!paneller.some((p) => p.dataset.panel === ad)) ad = "borc";
    sekmeler.forEach((b) => { const on = b.dataset.tab === ad; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    paneller.forEach((p) => (p.hidden = p.dataset.panel !== ad));
    if (location.hash.slice(1) !== ad) history.replaceState(null, "", "#" + ad);
  }
  sekmeler.forEach((b) => b.addEventListener("click", () => ac(b.dataset.tab)));
  ac(location.hash.slice(1));

  // ---------------- Kanıt fotoğrafı: kare kırpmadan küçült ----------------
  // Ekran görüntüsü/fiş olabileceği için kırpılmıyor, uzun kenar 1080px'e iniyor.
  async function kanitKucult(file) {
    const bitmap = await createImageBitmap(file);
    let boy = 1080;
    let dataUrl = "";
    while (boy >= 480) {
      const oran = Math.min(1, boy / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bitmap.width * oran);
      c.height = Math.round(bitmap.height * oran);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      for (let q = 0.82; q > 0.3; q -= 0.12) {
        dataUrl = c.toDataURL("image/jpeg", q);
        if (dataUrl.length < 880000) return dataUrl;
      }
      boy -= 200;
    }
    throw new Error("Fotoğraf çok büyük, daha küçük bir fotoğraf dene.");
  }

  // ---------------- İşlemler ----------------
  async function durumDegistir(s, yeni) {
    if (!girisli()) return;
    const soru = yeni === "borc"
      ? "Koşul gerçekleşti mi? " + s.veren + " artık borçlu sayılacak ve gün sayılmaya başlayacak."
      : "Bu söz yansın mı? (Koşul gerçekleşmedi, kimse kimseye borçlu değil.)";
    if (!confirm(soru)) return;
    const veri = { durum: yeni, guncelleme: FV.serverTimestamp(), degistiren: profile.kullaniciAdi };
    if (yeni === "borc") veri.borcTarihi = FV.serverTimestamp();
    try { await db.collection("sozler").doc(s.id).update(veri); }
    catch (err) { alert("Değiştirilemedi: " + err.message); }
  }

  async function odendi(s, file, durumYazi) {
    if (!girisli() || !file) return;
    durumYazi.textContent = "Kanıt yükleniyor…";
    try {
      const kanitRef = db.collection("soz_kanitlar").doc(s.id);
      const var_ = await kanitRef.get();
      if (!var_.exists) {
        const resim = await kanitKucult(file);
        await kanitRef.set({ resim, yukleyen: profile.kullaniciAdi, yukleyenUid: profile.uid, tarih: FV.serverTimestamp() });
      }
      await db.collection("sozler").doc(s.id).update({ durum: "odendi", guncelleme: FV.serverTimestamp(), degistiren: profile.kullaniciAdi });
      durumYazi.textContent = "";
    } catch (err) {
      console.error("Kanıt yüklenemedi:", err.message);
      durumYazi.textContent = "Olmadı: " + err.message;
    }
  }

  async function sahitOl(s) {
    if (!girisli()) return;
    try { await db.collection("sozler").doc(s.id).update({ sahitler: FV.arrayUnion(profile.kullaniciAdi) }); }
    catch (err) { alert("Olmadı: " + err.message); }
  }

  async function kanitGoster(s) {
    const modal = $("sozKanitModal");
    $("sozKanitResim").removeAttribute("src");
    $("sozKanitBilgi").textContent = "Yükleniyor…";
    modal.hidden = false;
    try {
      const d = await db.collection("soz_kanitlar").doc(s.id).get();
      if (!d.exists) { $("sozKanitBilgi").textContent = "Kanıt bulunamadı."; return; }
      const k = d.data();
      $("sozKanitResim").src = k.resim;
      $("sozKanitBilgi").textContent = "Yükleyen: " + (k.yukleyen || "?") + " · " + tarihYaz(k.tarih);
    } catch (err) { $("sozKanitBilgi").textContent = "Açılamadı: " + err.message; }
  }
  $("sozKanitKapat").addEventListener("click", () => ($("sozKanitModal").hidden = true));
  $("sozKanitModal").addEventListener("click", (e) => { if (e.target.id === "sozKanitModal") e.currentTarget.hidden = true; });

  async function geriAl(s) {
    if (!confirm("Bu söz tekrar \"Bekliyor\" durumuna dönsün mü? Varsa kanıt fotoğrafı silinir.")) return;
    try {
      await db.collection("soz_kanitlar").doc(s.id).delete().catch(() => {});
      await db.collection("sozler").doc(s.id).update({
        durum: "bekliyor", guncelleme: FV.serverTimestamp(), degistiren: profile.kullaniciAdi, borcTarihi: FV.delete(),
      });
    } catch (err) { alert("Geri alınamadı: " + err.message); }
  }

  async function sil(s) {
    if (!confirm("Bu söz defterden tamamen silinsin mi?")) return;
    try {
      if (adminMi()) await db.collection("soz_kanitlar").doc(s.id).delete().catch(() => {});
      await db.collection("sozler").doc(s.id).delete();
    } catch (err) { alert("Silinemedi: " + err.message); }
  }

  // ---------------- Çizim ----------------
  function buton(metin, cls, fn) {
    const b = el("button", cls, metin);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function sozKart(s) {
    const kart = el("article", "card soz-kart is-" + s.durum);

    const ust = el("div", "tpl-anket-ust");
    ust.appendChild(el("span", "tpl-etiket soz-etiket", ETIKET[s.durum] || s.durum));
    ust.appendChild(el("span", "muted", tarihYaz(s.tarih)));
    kart.appendChild(ust);

    const kisi = el("p", "soz-kisi");
    kisi.appendChild(el("b", null, s.veren));
    kisi.appendChild(document.createTextNode(" → " + (s.kime || "herkese")));
    kart.appendChild(kisi);
    kart.appendChild(el("h3", null, s.metin));
    if (s.kosul) kart.appendChild(el("p", "soz-kosul", "Koşul: " + s.kosul));
    if (s.sonTarih) {
      const gecti = s.durum !== "odendi" && s.durum !== "yandi" && new Date(s.sonTarih + "T23:59:59") < new Date();
      kart.appendChild(el("p", "soz-kosul" + (gecti ? " soz-gecti" : ""), "📅 Son tarih: " + gunYaz(s.sonTarih) + (gecti ? " · SÜRE GEÇTİ" : "")));
    }

    if (s.durum === "borc") {
      const g = gunSay(s.borcTarihi || s.guncelleme);
      const sayac = el("div", "soz-gun");
      sayac.appendChild(el("b", null, String(g)));
      sayac.appendChild(el("span", null, g === 0 ? "bugün borçlandı" : "gündür ödenmedi"));
      kart.appendChild(sayac);
    }
    if (s.durum === "odendi") kart.appendChild(el("p", "soz-odendi", "✅ " + tarihYaz(s.guncelleme) + " tarihinde ödendi" + (s.degistiren ? " (kanıtı yükleyen: " + s.degistiren + ")" : "")));
    if (s.durum === "yandi") kart.appendChild(el("p", "soz-kosul", "🔥 Söz yandı" + (s.degistiren ? " · işaretleyen: " + s.degistiren : "")));

    const sahitler = Array.isArray(s.sahitler) ? s.sahitler : [];
    const alt = el("div", "soz-alt");
    const bilgi = el("p", "muted soz-bilgi", "✍️ Yazan: " + (s.kaydeden || "?") + (sahitler.length ? " · 👂 Şahitler: " + sahitler.join(", ") : ""));
    alt.appendChild(bilgi);

    const aksiyon = el("div", "soz-aksiyon");
    const durumYazi = el("p", "suggest-status");
    if (girisli()) {
      if (!sahitler.includes(profile.kullaniciAdi) && (s.durum === "bekliyor" || s.durum === "borc")) {
        aksiyon.appendChild(buton("👂 Ben de duydum" + (sahitler.length ? " (" + sahitler.length + ")" : ""), "admin-btn reject se-small", () => sahitOl(s)));
      }
      if (s.durum === "bekliyor") {
        aksiyon.appendChild(buton("💸 Koşul gerçekleşti", "admin-btn publish se-small", () => durumDegistir(s, "borc")));
        aksiyon.appendChild(buton("🔥 Söz yandı", "admin-btn reject se-small", () => durumDegistir(s, "yandi")));
      }
      if (s.durum === "borc") {
        const lbl = el("label", "admin-btn publish se-small soz-kanit-btn");
        lbl.appendChild(document.createTextNode("📸 Ödendi, kanıt yükle"));
        const inp = el("input");
        inp.type = "file"; inp.accept = "image/*"; inp.hidden = true;
        inp.addEventListener("change", () => { if (inp.files[0]) odendi(s, inp.files[0], durumYazi); });
        lbl.appendChild(inp);
        aksiyon.appendChild(lbl);
      }
    }
    if (s.durum === "odendi") aksiyon.appendChild(buton("🧾 Kanıtı gör", "admin-btn reject se-small", () => kanitGoster(s)));
    if (adminMi() && s.durum !== "bekliyor") aksiyon.appendChild(buton("↺ Geri al", "admin-btn reject se-small", () => geriAl(s)));
    const kendisi = girisli() && s.kaydedenUid === profile.uid && s.durum === "bekliyor" && !sahitler.length;
    if (adminMi() || kendisi) aksiyon.appendChild(buton("🗑️ Sil", "admin-btn reject se-small", () => sil(s)));
    if (aksiyon.childNodes.length) alt.appendChild(aksiyon);
    alt.appendChild(durumYazi);
    kart.appendChild(alt);
    return kart;
  }

  function duvarCiz() {
    const borclar = sozler.filter((s) => s.durum === "borc");
    $("sozDuvar").hidden = !borclar.length;
    const kutu = $("sozDuvarListe");
    kutu.innerHTML = "";
    const grup = new Map();
    borclar.forEach((s) => {
      const k = anahtar(s.veren);
      const g = grup.get(k) || { ad: s.veren, adet: 0, enEski: 0 };
      g.adet++;
      g.enEski = Math.max(g.enEski, gunSay(s.borcTarihi || s.guncelleme));
      grup.set(k, g);
    });
    Array.from(grup.values())
      .sort((a, b) => b.enEski - a.enEski || b.adet - a.adet)
      .forEach((g, i) => {
        const k = el("div", "soz-duvar-kart" + (i === 0 ? " is-lider" : ""));
        k.appendChild(el("span", "soz-duvar-ico", i === 0 ? "🐷" : "💸"));
        k.appendChild(el("b", "soz-duvar-ad", g.ad));
        k.appendChild(el("span", "soz-duvar-sayi", g.adet + " borç · " + (g.enEski ? "en eskisi " + g.enEski + " gün" : "bugün başladı")));
        kutu.appendChild(k);
      });
  }

  function isimleriDoldur() {
    const set = new Map();
    TEMEL_ISIMLER.concat(sozler.flatMap((s) => [s.veren, s.kime])).forEach((n) => {
      if (n && !set.has(anahtar(n))) set.set(anahtar(n), n.trim());
    });
    const dl = $("sozIsimler");
    dl.innerHTML = "";
    set.forEach((n) => { const o = el("option"); o.value = n; dl.appendChild(o); });
  }

  function ciz() {
    DURUMLAR.forEach((d) => {
      const liste = sozler.filter((s) => s.durum === d);
      if (d === "borc") liste.sort((a, b) => ms(a.borcTarihi || a.guncelleme) - ms(b.borcTarihi || b.guncelleme));
      const kutu = $("sozListe_" + d);
      kutu.innerHTML = "";
      if (!liste.length) {
        kutu.appendChild(el("p", "muted", {
          borc: "Ödenmemiş borç yok. Şimdilik herkes temiz.",
          bekliyor: "Koşulu beklenen söz yok.",
          odendi: "Henüz ödenen söz yok.",
          yandi: "Yanan söz yok.",
        }[d]));
      }
      liste.forEach((s) => kutu.appendChild(sozKart(s)));
      const say = $("sozSay_" + d);
      if (say) { say.hidden = !liste.length; say.textContent = String(liste.length); }
    });
    duvarCiz();
    isimleriDoldur();
  }

  // ---------------- Yeni söz formu ----------------
  $("sozForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!girisli()) return;
    const durumYazi = $("sozFormDurum");
    const btn = e.target.querySelector("button[type=submit]");
    const veren = $("sozVeren").value.trim();
    const metin = $("sozMetin").value.trim();
    if (!veren || !metin) return;
    const durum = $("sozDurum").value === "borc" ? "borc" : "bekliyor";
    const veri = {
      veren,
      kime: $("sozKime").value.trim() || "Herkese",
      metin,
      kosul: $("sozKosul").value.trim(),
      sonTarih: $("sozSonTarih").value || "",
      durum,
      kaydeden: profile.kullaniciAdi,
      kaydedenUid: profile.uid,
      sahitler: [],
      tarih: FV.serverTimestamp(),
      guncelleme: FV.serverTimestamp(),
    };
    if (durum === "borc") veri.borcTarihi = FV.serverTimestamp();
    btn.disabled = true;
    durumYazi.textContent = "Yazılıyor…";
    try {
      await db.collection("sozler").add(veri);
      durumYazi.textContent = "Deftere yazıldı. 🤝";
      e.target.reset();
      ac(durum);
    } catch (err) {
      console.error("Söz yazılamadı:", err.message);
      durumYazi.textContent = "Yazılamadı: " + err.message;
    }
    btn.disabled = false;
  });

  // ---------------- Veri + giriş ----------------
  db.collection("sozler").orderBy("tarih", "desc").limit(300).onSnapshot(
    (snap) => {
      sozler = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      ciz();
    },
    (err) => {
      console.error("Söz defteri okunamadı:", err.message);
      $("sozListe_borc").innerHTML = '<p class="muted">Söz defteri yüklenemedi. (Firestore kuralları yayınlandı mı?)</p>';
    }
  );

  // Borç günleri gece yarısı değişsin diye arada bir yeniden çiz.
  setInterval(ciz, 10 * 60 * 1000);

  if (window.YaparmiAuth) {
    window.YaparmiAuth.onChange((p) => {
      profile = p;
      $("sozGiris").hidden = girisli();
      $("sozYeni").hidden = !girisli();
      ciz();
    });
  } else {
    $("sozGiris").hidden = false;
  }
})();
