// ============================================================
// wiki.js — topluluk.html "📖 Berkaypedia": grubun sahte ansiklopedisi.
// Firestore: wiki/{id} (güncel makale), wiki_gecmis/{id_sürüm} (her düzenleme), wiki_resim/{id} (bilgi kutusu fotoğrafı).
// Her kayıt makale + geçmiş kaydı birlikte (batch) yazılır; kurallar sürüm numarasının sırayla artmasını
// ve geçmiş kaydının gerçekten yazılmasını şart koşar, yani kimin neyi değiştirdiği silinemez.
// Yazım: == Başlık ==, **kalın**, [[Makale]] / [[Makale|yazı]], * madde, | Anahtar: Değer (bilgi kutusu), {{kaynak}}
// Adresler: #wiki · #wiki/Makale · #wiki/Makale/duzenle · #wiki/Makale/gecmis · #wiki/Makale/s/3 · #wiki/~yeni · #wiki/~son
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const bolum = $("wikiBolum");
  if (!bolum || typeof db === "undefined" || !db) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const ICERIK = $("wkIcerik");
  const ONERILER = ["Berkay", "Kasksız 85", "Mez4", "Burger", "Kurban", "Halil", "Alihan", "Ehliyet sınavı", "Berkay Borsası"];
  const SABLON = "| Doğum: \n| Meslek: \n| Bilinen olayı: \n| Ehliyet: Yok\n\n'''X''', ... {{kaynak}}\n\n== Erken yaşamı ==\n\n== Kariyeri ==\n\n== Tartışmalar ==\n* \n";

  // ---------- yardımcılar ----------
  const slugYap = (t) => String(t).trim().replace(/\s+/g, "_").replace(/[\/#?%\[\]|\\]/g, "").replace(/^[~.]+/, "").replace(/^__|__$/g, "").slice(0, 60);
  const idYap = (t) => slugYap(t).toLocaleLowerCase("tr-TR");
  const gosterAd = (slug) => String(slug).replace(/_/g, " ");
  const link = (baslik, ek) => "#wiki/" + encodeURIComponent(slugYap(baslik)) + (ek ? "/" + ek : "");
  const tsMs = (t) => (t && t.toMillis ? t.toMillis() : typeof t === "number" ? t : Date.now());
  const tarihYaz = (t) => new Date(tsMs(t)).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  function once(t) {
    const s = Math.max(0, (Date.now() - tsMs(t)) / 1000);
    if (s < 60) return "az önce"; if (s < 3600) return Math.floor(s / 60) + " dk önce";
    if (s < 86400) return Math.floor(s / 3600) + " saat önce"; if (s < 86400 * 30) return Math.floor(s / 86400) + " gün önce";
    return new Date(tsMs(t)).toLocaleDateString("tr-TR");
  }
  let profile = null;
  const makaleler = new Map(); // id → veri
  let yuklendi = false, dinliyor = false;

  // ---------- metni çiz (HTML asla çalıştırılmaz, her şey DOM ile kurulur) ----------
  function satirIci(yazi, kutu) {
    const parca = String(yazi).split(/(\*\*[^*]+\*\*|'''[^']+'''|\[\[[^\]]+\]\]|\{\{kaynak\}\}|https?:\/\/[^\s]+)/g);
    parca.forEach((p, i) => {
      if (!p) return;
      if (i % 2 === 0) { kutu.append(document.createTextNode(p)); return; }
      if (p.startsWith("**") || p.startsWith("'''")) { const b = el("b"); satirIci(p.replace(/^\*\*|\*\*$|^'''|'''$/g, ""), b); kutu.append(b); return; }
      if (p === "{{kaynak}}") { const s = el("sup", "wk-kaynak", "[kaynak belirtilmeli]"); kutu.append(s); return; }
      if (p.startsWith("[[")) {
        const [hedef, yazi2] = p.slice(2, -2).split("|");
        const a = el("a", "wk-ic", (yazi2 || hedef).trim());
        a.href = link(hedef.trim());
        if (!makaleler.has(idYap(hedef))) { a.classList.add("yok"); a.title = "Bu madde henüz yazılmadı (yazmak için tıkla)"; }
        kutu.append(a); return;
      }
      const a = el("a", null, p.length > 50 ? p.slice(0, 47) + "…" : p); a.href = p; a.target = "_blank"; a.rel = "noopener nofollow"; kutu.append(a);
    });
  }
  function metinCiz(metin, kutu) {
    const bilgi = [], govde = el("div", "wk-govde");
    let liste = null, paragraf = [];
    const paragrafBitir = () => { if (paragraf.length) { const p = el("p"); satirIci(paragraf.join(" "), p); govde.append(p); paragraf = []; } };
    String(metin || "").split("\n").forEach((satir) => {
      const t = satir.trim();
      const b = t.match(/^\|\s*([^:]{1,30}):\s*(.*)$/);
      if (b) { bilgi.push([b[1].trim(), b[2].trim()]); return; }
      const h = t.match(/^==+\s*(.+?)\s*==+$/) || t.match(/^##\s+(.+)$/);
      if (h) { paragrafBitir(); liste = null; govde.append(el("h3", null, h[1])); return; }
      const m = t.match(/^[*-]\s+(.+)$/);
      if (m) { paragrafBitir(); if (!liste) { liste = el("ul"); govde.append(liste); } const li = el("li"); satirIci(m[1], li); liste.append(li); return; }
      liste = null;
      if (!t) { paragrafBitir(); return; }
      paragraf.push(t);
    });
    paragrafBitir();
    kutu.append(govde);
    return bilgi;
  }
  function bilgiKutusu(baslik, bilgi, id, resimVar) {
    if (!bilgi.length && !resimVar) return null;
    const k = el("aside", "wk-bilgi");
    k.append(el("div", "wk-bilgi-bas", baslik));
    if (resimVar) {
      const img = el("img"); img.alt = baslik; img.loading = "lazy";
      k.append(img);
      db.collection("wiki_resim").doc(id).get().then((s) => { if (s.exists) img.src = s.data().resim; else img.remove(); }).catch(() => img.remove());
    }
    if (bilgi.length) {
      const t = el("table");
      bilgi.forEach(([a, b]) => { const tr = el("tr"); const th = el("th", null, a); const td = el("td"); satirIci(b, td); tr.append(th, td); t.append(tr); });
      k.append(t);
    }
    return k;
  }
  function baglantiVerenler(id) {
    const sonuc = [];
    makaleler.forEach((m) => {
      if (m.id === id) return;
      const re = /\[\[([^\]|]+)/g; let x;
      while ((x = re.exec(m.metin || ""))) if (idYap(x[1]) === id) { sonuc.push(m); break; }
    });
    return sonuc;
  }

  // ---------- görünümler ----------
  function sekmeler(slug, aktif, varMi) {
    const n = el("nav", "wk-sekme");
    [["", "📄 Madde"], ["duzenle", varMi ? "✏️ Düzenle" : "✍️ Oluştur"], ["gecmis", "🕓 Geçmiş"]].forEach(([ek, ad]) => {
      if (!varMi && ek === "gecmis") return;
      const a = el("a", ek === aktif ? "on" : null, ad); a.href = link(slug, ek); n.append(a);
    });
    return n;
  }
  function anaSayfa() {
    ICERIK.textContent = "";
    const liste = [...makaleler.values()].sort((a, b) => a.baslik.localeCompare(b.baslik, "tr"));
    const hos = el("div", "card wk-hos");
    const duzenleme = liste.reduce((t, m) => t + (m.surum || 0), 0);
    hos.append(el("h2", null, "Berkaypedia'ya hoş geldin"));
    const p = el("p"); p.append("Herkesin düzenleyebildiği, hiçbir bilgisinin doğruluğu garanti edilmeyen ansiklopedi. ", el("b", null, `${liste.length} madde`), ", ", el("b", null, `${duzenleme} düzenleme`), ".");
    hos.append(p);
    ICERIK.append(hos);
    if (liste.length) {
      // Günün maddesi: tarihe göre herkes aynı maddeyi görür
      const gun = Math.floor((Date.now() + 3 * 3600000) / 86400000);
      const m = liste[gun % liste.length];
      const gk = el("div", "card wk-gunun");
      gk.append(el("small", "wk-etiket", "⭐ GÜNÜN MADDESİ"));
      const a = el("a", "wk-gunun-bas", m.baslik); a.href = link(m.baslik); gk.append(a);
      const ilk = (m.metin || "").split("\n").map((x) => x.trim()).find((x) => x && !x.startsWith("|") && !x.startsWith("=") && !x.startsWith("#")) || "";
      const pp = el("p"); satirIci(ilk.length > 260 ? ilk.slice(0, 257) + "…" : ilk, pp); gk.append(pp);
      const devam = el("a", "link-btn", "Devamını oku →"); devam.href = link(m.baslik); gk.append(devam);
      ICERIK.append(gk);
    }
    const izgara = el("div", "wk-izgara");
    const tum = el("div", "card wk-liste"); tum.append(el("h3", null, "📚 Tüm maddeler"));
    if (!liste.length) tum.append(el("p", "muted", "Henüz madde yok. İlk maddeyi sen yaz!"));
    else { const ul = el("ul"); liste.forEach((m) => { const li = el("li"); const a = el("a", null, m.baslik); a.href = link(m.baslik); li.append(a, el("small", "muted", ` · ${once(m.guncelleme)}`)); ul.append(li); }); tum.append(ul); }
    // Yazılmayı bekleyenler: başka maddelerde kırmızı link olanlar + öneriler
    const istenen = new Map();
    liste.forEach((m) => { const re = /\[\[([^\]|]+)/g; let x; while ((x = re.exec(m.metin || ""))) { const id = idYap(x[1]); if (!makaleler.has(id)) istenen.set(id, (istenen.get(id) || { ad: x[1].trim(), n: 0 })), istenen.get(id).n++; } });
    ONERILER.forEach((o) => { const id = idYap(o); if (!makaleler.has(id) && !istenen.has(id)) istenen.set(id, { ad: o, n: 0 }); });
    const bek = el("div", "card wk-liste"); bek.append(el("h3", null, "🔴 Yazılmayı bekleyenler"));
    const ul2 = el("ul");
    [...istenen.values()].sort((a, b) => b.n - a.n).slice(0, 14).forEach((x) => { const li = el("li"); const a = el("a", "wk-ic yok", x.ad); a.href = link(x.ad, "duzenle"); li.append(a); if (x.n) li.append(el("small", "muted", ` · ${x.n} maddede geçiyor`)); ul2.append(li); });
    bek.append(ul2);
    izgara.append(tum, bek);
    ICERIK.append(izgara);
  }
  function oku(slug) {
    const id = idYap(slug), m = makaleler.get(id);
    ICERIK.textContent = "";
    const kutu = el("article", "card wk-madde");
    kutu.append(sekmeler(slug, "", !!m));
    kutu.append(el("h1", "wk-baslik", m ? m.baslik : gosterAd(slug)));
    kutu.append(el("div", "wk-alt", "Berkaypedia, özgür ansiklopedi"));
    if (!m) {
      const p = el("p", "wk-yok"); p.append("Berkaypedia'da ", el("b", null, gosterAd(slug)), " adında bir madde yok. ");
      const a = el("a", "btn", "✍️ Bu maddeyi oluştur"); a.href = link(slug, "duzenle"); p.append(a);
      kutu.append(p);
    } else {
      const govdeKutu = el("div", "wk-metin");
      const bilgi = metinCiz(m.metin, govdeKutu);
      const bk = bilgiKutusu(m.baslik, bilgi, id, m.resimVar);
      if (bk) kutu.append(bk);
      kutu.append(govdeKutu);
      const bv = baglantiVerenler(id);
      if (bv.length) {
        const b = el("div", "wk-bv"); b.append(el("b", null, "Bu maddeye bağlantı verenler: "));
        bv.forEach((x, i) => { const a = el("a", "wk-ic", x.baslik); a.href = link(x.baslik); b.append(a); if (i < bv.length - 1) b.append(" · "); });
        kutu.append(b);
      }
      const ayak = el("footer", "wk-ayak");
      ayak.append(`Bu sayfa en son ${tarihYaz(m.guncelleme)} tarihinde `, el("b", null, m.guncelleyen || "?"), ` tarafından değiştirildi. ${m.surum}. sürüm. İlk yazan: `, el("b", null, m.olusturan || "?"), ".");
      kutu.append(ayak);
    }
    ICERIK.append(kutu);
  }
  let bekleyenResim = null; // { url } | { sil: true } | null
  function duzenle(slug, hazirMetin, ozetHazir) {
    const id = idYap(slug), m = makaleler.get(id);
    ICERIK.textContent = "";
    const kutu = el("div", "card wk-madde wk-duzen");
    kutu.append(sekmeler(slug, "duzenle", !!m));
    if (!profile) {
      kutu.append(el("h1", "wk-baslik", m ? m.baslik : gosterAd(slug)), el("p", "muted", "Düzenlemek için sağ üstten giriş yap. Okumak serbest."));
      ICERIK.append(kutu); return;
    }
    const yeni = !m;
    kutu.append(el("h1", "wk-baslik", (yeni ? "Oluşturuluyor: " : "Düzenleniyor: ") + (m ? m.baslik : gosterAd(slug))));
    let baslikInp = null;
    if (yeni) {
      baslikInp = el("input", "wk-inp"); baslikInp.maxLength = 60; baslikInp.placeholder = "Madde adı (ör. Kasksız 85)";
      baslikInp.value = slug === "~yeni" ? "" : gosterAd(slug);
      kutu.append(baslikInp);
    }
    const arac = el("div", "wk-arac");
    const ipucu = el("small", "muted", "== Başlık ==  ·  **kalın**  ·  [[Madde]]  ·  * madde  ·  | Doğum: 1999 (bilgi kutusu)  ·  {{kaynak}}");
    const sablonBtn = el("button", "link-btn", "📋 Şablon ekle"); sablonBtn.type = "button";
    arac.append(ipucu, sablonBtn);
    const ta = el("textarea", "wk-ta"); ta.rows = 16; ta.maxLength = 8000;
    ta.value = hazirMetin != null ? hazirMetin : m ? m.metin : "";
    if (!ta.value && yeni) ta.placeholder = "'''" + (gosterAd(slug) === "~yeni" ? "Madde" : gosterAd(slug)) + "''', ... diye başla. Bilgi kutusu için 📋 Şablon ekle'ye bas.";
    sablonBtn.addEventListener("click", () => { const b = (baslikInp ? baslikInp.value : m.baslik) || "Madde"; ta.value = SABLON.replace("X", b) + ta.value; ta.focus(); });
    const say = el("small", "muted wk-say", "");
    const sayGuncel = () => { say.textContent = `${ta.value.length} / 8000`; };
    ta.addEventListener("input", sayGuncel); sayGuncel();
    // fotoğraf
    bekleyenResim = null;
    const foto = el("div", "wk-foto");
    const fotoLbl = el("label", "link-btn", m && m.resimVar ? "📷 Bilgi kutusu fotoğrafını değiştir" : "📷 Bilgi kutusuna fotoğraf ekle");
    const fin = el("input"); fin.type = "file"; fin.accept = "image/*"; fin.hidden = true; fotoLbl.append(fin);
    const onizle = el("img", "wk-foto-on"); onizle.hidden = true;
    const fotoSil = el("button", "link-btn", "🗑️ Fotoğrafı kaldır"); fotoSil.type = "button"; fotoSil.hidden = !(m && m.resimVar);
    fin.addEventListener("change", async () => {
      const f = fin.files[0]; if (!f) return;
      try { const url = await resimKucult(f, 700, 260000); bekleyenResim = { url }; onizle.src = url; onizle.hidden = false; fotoSil.hidden = false; }
      catch (e) { durum.textContent = "⚠️ " + e.message; }
    });
    fotoSil.addEventListener("click", () => { bekleyenResim = { sil: true }; onizle.hidden = true; fotoSil.hidden = true; });
    foto.append(fotoLbl, onizle, fotoSil);
    const ozet = el("input", "wk-inp wk-ozet"); ozet.maxLength = 100; ozet.placeholder = "Değişiklik özeti (ne yaptın? ör. 'gerçekleri ekledim', 'halil yalan yazmış düzelttim')";
    if (ozetHazir) ozet.value = ozetHazir;
    const alt = el("div", "wk-duzen-alt");
    const kaydet = el("button", "btn", "💾 Kaydet"); kaydet.type = "button";
    const onBtn = el("button", "btn ghost", "👁️ Önizle"); onBtn.type = "button";
    const vaz = el("a", "link-btn", "Vazgeç"); vaz.href = m ? link(m.baslik) : "#wiki";
    alt.append(kaydet, onBtn, vaz);
    const durum = el("p", "suggest-status");
    const onizKutu = el("div", "wk-oniz"); onizKutu.hidden = true;
    onBtn.addEventListener("click", () => {
      onizKutu.hidden = !onizKutu.hidden; onizKutu.textContent = "";
      if (!onizKutu.hidden) { onizKutu.append(el("small", "wk-etiket", "ÖNİZLEME")); const b = metinCiz(ta.value, onizKutu); if (b.length) onizKutu.prepend(bilgiKutusu((baslikInp && baslikInp.value) || (m && m.baslik) || "", b, id, false)); }
    });
    kaydet.addEventListener("click", async () => {
      const baslik = yeni ? baslikInp.value.trim().replace(/\s+/g, " ") : m.baslik;
      const yid = idYap(baslik);
      const metin = ta.value.replace(/\r/g, "").trim();
      if (baslik.length < 2) { durum.textContent = "⚠️ Madde adı en az 2 karakter."; return; }
      if (!metin) { durum.textContent = "⚠️ Boş madde olmaz."; return; }
      if (yeni && makaleler.has(yid)) { durum.textContent = "⚠️ Bu adda bir madde zaten var."; return; }
      if (!yeni && metin === m.metin && !bekleyenResim) { durum.textContent = "Hiçbir şey değişmedi."; return; }
      kaydet.disabled = true; durum.textContent = "Kaydediliyor…";
      try {
        const ts = firebase.firestore.FieldValue.serverTimestamp();
        const surum = yeni ? 1 : (m.surum || 0) + 1;
        const resimVar = bekleyenResim ? !!bekleyenResim.url : !!(m && m.resimVar);
        const batch = db.batch();
        const ref = db.collection("wiki").doc(yid);
        if (yeni) batch.set(ref, { baslik, metin, surum, olusturan: profile.kullaniciAdi, olusturanUid: profile.uid, olusturma: ts, guncelleyen: profile.kullaniciAdi, guncelleyenUid: profile.uid, guncelleme: ts, resimVar });
        else batch.update(ref, { metin, surum, guncelleyen: profile.kullaniciAdi, guncelleyenUid: profile.uid, guncelleme: ts, resimVar });
        batch.set(db.collection("wiki_gecmis").doc(yid + "_" + surum), { slug: yid, baslik, metin, surum, yazan: profile.kullaniciAdi, yazanUid: profile.uid, tarih: ts, ozet: ozet.value.trim().slice(0, 100), fark: metin.length - (m ? (m.metin || "").length : 0) });
        if (bekleyenResim && bekleyenResim.url) batch.set(db.collection("wiki_resim").doc(yid), { resim: bekleyenResim.url, yukleyen: profile.kullaniciAdi, yukleyenUid: profile.uid, tarih: ts });
        await batch.commit();
        // yerelde hemen güncelle (dinleyici birazdan da getirir)
        makaleler.set(yid, { ...(m || {}), id: yid, baslik, metin, surum, resimVar, guncelleyen: profile.kullaniciAdi, guncelleme: Date.now(), olusturan: m ? m.olusturan : profile.kullaniciAdi });
        location.hash = link(baslik);
        if (window.Ekonomi) Ekonomi.toast(yeni ? "📖 Madde oluşturuldu" : "📖 Kaydedildi", 2500);
      } catch (e) {
        durum.textContent = /permission|PERMISSION/.test(e.message) ? "⚠️ Kaydedilemedi: bu arada biri bu maddeyi değiştirmiş olabilir. Sayfayı yenileyip tekrar dene." : "⚠️ " + e.message;
        kaydet.disabled = false;
      }
    });
    kutu.append(arac, ta, say, foto, ozet, alt, durum, onizKutu);
    ICERIK.append(kutu);
    (yeni && !baslikInp.value ? baslikInp : ta).focus();
  }
  async function gecmis(slug, surumGoster) {
    const id = idYap(slug), m = makaleler.get(id);
    ICERIK.textContent = "";
    const kutu = el("div", "card wk-madde");
    kutu.append(sekmeler(slug, surumGoster ? "" : "gecmis", !!m));
    kutu.append(el("h1", "wk-baslik", (m ? m.baslik : gosterAd(slug)) + (surumGoster ? ` (${surumGoster}. sürüm)` : ": Geçmiş")));
    const liste = el("div", "wk-gecmis"); liste.append(el("p", "muted", "Yükleniyor…"));
    kutu.append(liste);
    ICERIK.append(kutu);
    let surumler;
    try { surumler = (await db.collection("wiki_gecmis").where("slug", "==", id).get()).docs.map((d) => d.data()).sort((a, b) => b.surum - a.surum); }
    catch (e) { liste.textContent = "Geçmiş yüklenemedi: " + e.message; return; }
    liste.textContent = "";
    if (surumGoster) {
      const s = surumler.find((x) => x.surum === Number(surumGoster));
      if (!s) { liste.append(el("p", "muted", "Bu sürüm bulunamadı.")); return; }
      const not = el("div", "wk-eski"); not.append(`Bu, maddenin ${tarihYaz(s.tarih)} tarihinde `, el("b", null, s.yazan), " tarafından kaydedilmiş eski bir sürümü. ");
      const geri = el("a", "link-btn", "↩️ Bu sürüme geri dön"); geri.href = link(m ? m.baslik : slug, "geri/" + s.surum); not.append(geri);
      liste.append(not);
      const govde = el("div", "wk-metin"); const b = metinCiz(s.metin, govde);
      const bk = bilgiKutusu(s.baslik, b, id, false); if (bk) liste.append(bk);
      liste.append(govde); return;
    }
    // Katkıda bulunanlar + "en çok silen" ödülü
    const kisi = {};
    surumler.forEach((s) => { const k = kisi[s.yazan] || (kisi[s.yazan] = { n: 0, ekledi: 0, sildi: 0 }); k.n++; if (s.fark > 0) k.ekledi += s.fark; else k.sildi -= s.fark || 0; });
    const ozetK = el("div", "wk-katki");
    ozetK.append(el("b", null, "Katkıda bulunanlar: "));
    Object.entries(kisi).sort((a, b) => b[1].n - a[1].n).forEach(([ad, k], i, arr) => { ozetK.append(`${ad} (${k.n} düzenleme, +${k.ekledi}/−${k.sildi})`); if (i < arr.length - 1) ozetK.append(" · "); });
    const vandal = Object.entries(kisi).filter(([, k]) => k.sildi > 0).sort((a, b) => b[1].sildi - a[1].sildi)[0];
    if (vandal) ozetK.append(el("div", "wk-vandal", `🧨 Vandal ödülü: ${vandal[0]} (${vandal[1].sildi} karakter sildi)`));
    liste.append(ozetK);
    const ul = el("ul", "wk-surumler");
    surumler.forEach((s) => {
      const li = el("li");
      const gor = el("a", null, tarihYaz(s.tarih)); gor.href = link(m ? m.baslik : slug, "s/" + s.surum);
      const fark = el("span", "wk-fark " + ((s.fark || 0) >= 0 ? "arti" : "eksi"), ((s.fark || 0) >= 0 ? "+" : "−") + Math.abs(s.fark || 0));
      li.append(el("span", "wk-no", "#" + s.surum), gor, el("b", null, s.yazan), fark);
      if (s.ozet) li.append(el("i", "muted", `(${s.ozet})`));
      if (m && s.surum !== m.surum) { const g = el("a", "link-btn", "geri dön"); g.href = link(m.baslik, "geri/" + s.surum); li.append(g); }
      ul.append(li);
    });
    liste.append(ul);
  }
  async function geriDon(slug, n) {
    const id = idYap(slug);
    try {
      const s = await db.collection("wiki_gecmis").doc(id + "_" + n).get();
      if (!s.exists) throw new Error("Sürüm bulunamadı");
      duzenle(slug, s.data().metin, `${n}. sürüme geri alındı`);
    } catch (e) { ICERIK.textContent = "⚠️ " + e.message; }
  }
  async function sonDegisiklikler() {
    ICERIK.textContent = "";
    const kutu = el("div", "card wk-madde");
    kutu.append(el("h1", "wk-baslik", "Son değişiklikler"), el("div", "wk-alt", "Kim neyi ne zaman bozdu"));
    const ul = el("ul", "wk-surumler"); ul.append(el("li", "muted", "Yükleniyor…"));
    kutu.append(ul); ICERIK.append(kutu);
    try {
      const s = await db.collection("wiki_gecmis").orderBy("tarih", "desc").limit(40).get();
      ul.textContent = "";
      if (s.empty) ul.append(el("li", "muted", "Henüz değişiklik yok."));
      s.docs.forEach((d) => {
        const x = d.data(), li = el("li");
        const a = el("a", "wk-ic", x.baslik); a.href = link(x.baslik);
        const fark = el("span", "wk-fark " + ((x.fark || 0) >= 0 ? "arti" : "eksi"), ((x.fark || 0) >= 0 ? "+" : "−") + Math.abs(x.fark || 0));
        li.append(el("span", "muted", once(x.tarih)), a, el("b", null, x.yazan), fark);
        if (x.surum === 1) li.append(el("span", "wk-yeni-et", "YENİ"));
        if (x.ozet) li.append(el("i", "muted", `(${x.ozet})`));
        ul.append(li);
      });
    } catch (e) { ul.textContent = "Yüklenemedi: " + e.message; }
  }

  // ---------- yönlendirme ----------
  function yol() {
    const h = location.hash.slice(1).split("/").map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
    return h[0] === "wiki" ? h.slice(1) : null;
  }
  function ciz() {
    const p = yol();
    if (!p || bolum.hidden || !yuklendi) return;
    window.scrollTo({ top: Math.min(window.scrollY, bolum.offsetTop - 80) });
    if (!p[0]) return anaSayfa();
    if (p[0] === "~yeni") return duzenle(p[1] || "~yeni");
    if (p[0] === "~son") return sonDegisiklikler();
    if (p[1] === "duzenle") return duzenle(p[0]);
    if (p[1] === "gecmis") return gecmis(p[0]);
    if (p[1] === "s" && p[2]) return gecmis(p[0], p[2]);
    if (p[1] === "geri" && p[2]) return geriDon(p[0], p[2]);
    return oku(p[0]);
  }
  function baslat() {
    if (dinliyor) return;
    dinliyor = true;
    db.collection("wiki").onSnapshot((s) => {
      makaleler.clear();
      s.docs.forEach((d) => makaleler.set(d.id, { id: d.id, ...d.data() }));
      const ilk = !yuklendi; yuklendi = true;
      // düzenleme ekranındayken başkasının kaydı yazdığın metni silmesin
      const p = yol() || [];
      if (ilk || !(p[1] === "duzenle" || p[0] === "~yeni" || p[1] === "geri")) ciz();
    }, (e) => { ICERIK.textContent = "Berkaypedia yüklenemedi: " + e.message; });
  }
  window.addEventListener("hashchange", ciz);
  window.addEventListener("mk-bolum", (e) => { if (e.detail === "wiki") { baslat(); if (!yol()) history.replaceState(null, "", "#wiki"); ciz(); } });
  window.YaparmiAuth.onChange((p) => { profile = p; const y = yol() || []; if (yuklendi && (y[1] === "duzenle" || y[0] === "~yeni")) ciz(); });
  if (!bolum.hidden) baslat();

  // ---------- arama + rastgele ----------
  const ara = $("wkAra"), oneri = $("wkOneri");
  ara.addEventListener("input", () => {
    const q = ara.value.trim().toLocaleLowerCase("tr-TR");
    oneri.textContent = "";
    if (!q) { oneri.hidden = true; return; }
    const bul = [...makaleler.values()].filter((m) => m.baslik.toLocaleLowerCase("tr-TR").includes(q) || (m.metin || "").toLocaleLowerCase("tr-TR").includes(q)).slice(0, 8);
    bul.forEach((m) => { const a = el("a", null, m.baslik); a.href = link(m.baslik); oneri.append(a); });
    const yeni = el("a", "wk-ic yok", `✍️ "${ara.value.trim()}" maddesini oluştur`); yeni.href = link(ara.value.trim(), "duzenle"); oneri.append(yeni);
    oneri.hidden = false;
  });
  ara.addEventListener("keydown", (e) => { if (e.key === "Enter") { const a = oneri.querySelector("a"); if (a) location.hash = a.getAttribute("href"); oneri.hidden = true; ara.value = ""; } });
  oneri.addEventListener("click", () => { oneri.hidden = true; ara.value = ""; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".wk-ara")) oneri.hidden = true; });
  $("wkRastgele").addEventListener("click", () => {
    const l = [...makaleler.values()];
    if (l.length) location.hash = link(l[Math.floor(Math.random() * l.length)].baslik);
  });
})();
