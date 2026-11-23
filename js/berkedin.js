// ============================================================
// berkedin.js — BerkedIn: grubun LinkedIn parodisi.
//   Sabit profil: js/berkedin-veri.js
//   Firestore: berkedin_onay/{uid} {ad, onaylar: {"uye|beceri": true}, t}
//              berkedin_tavsiye/{id} {hedef, metin, yazanUid, yazan, t}
//              berkedin_ilan/{id} {baslik, sirket, maas, aciklama, yazanUid, yazan, t, basvuranlar[]}
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const V = window.BERKEDIN, IDLER = Object.keys(V);
  let profil = null, secili = (location.hash.slice(1) in V) ? location.hash.slice(1) : "berkay";
  let onaylar = [], tavsiyeler = [], ilanlar = [];
  const durum = (t) => { $("biDurum").textContent = t || ""; };
  const zaman = (t) => { const ms = t && t.toMillis ? t.toMillis() : Date.now(); const g = Math.floor((Date.now() - ms) / 86400000); return g <= 0 ? "bugün" : g + " gün önce"; };
  const benimOnay = () => (profil && (onaylar.find((o) => o.uid === profil.uid) || {}).onaylar) || {};

  // ---- kişiler listesi ----
  function kisiler() {
    const k = $("biKisiler"); k.textContent = ""; k.append(el("b", "bi-yan-bas", "Ağın"));
    IDLER.forEach((id) => {
      const u = V[id], b = el("button", "bi-kisi" + (id === secili ? " on" : "")); b.type = "button";
      const av = el("span", "bi-av", u.emoji); av.style.background = u.renk;
      const t = el("div"); t.append(el("b", null, u.ad), el("small", null, u.unvan.split(" · ")[0]));
      b.append(av, t); b.onclick = () => { secili = id; history.replaceState(null, "", "#" + id); kisiler(); profilCiz(); };
      k.append(b);
    });
  }

  // ---- onay sayıları ----
  function onaySay(id) {
    const m = new Map();
    for (const o of onaylar) for (const key of Object.keys(o.onaylar || {})) {
      const [kim, ...b] = key.split("|"); if (kim !== id) continue;
      const beceri = b.join("|"); if (!m.has(beceri)) m.set(beceri, []); m.get(beceri).push(o.ad || "?");
    }
    return m;
  }
  async function onayla(id, beceri) {
    if (!profil) { durum("Onaylamak için giriş yap."); return; }
    const o = Object.assign({}, benimOnay()), key = id + "|" + beceri;
    if (o[key]) delete o[key]; else { if (Object.keys(o).length >= 150) { durum("En fazla 150 onay verebilirsin."); return; } o[key] = true; }
    try { await db.collection("berkedin_onay").doc(profil.uid).set({ ad: profil.kullaniciAdi, onaylar: o, t: firebase.firestore.FieldValue.serverTimestamp() }); durum(""); }
    catch (e) { durum("⚠️ " + e.message); }
  }

  // ---- profil ----
  function bolum(baslik) { const s = el("div", "card bi-kart"); s.append(el("h2", null, baslik)); return s; }
  function profilCiz() {
    const u = V[secili], p = $("biProfil"); p.textContent = "";
    // kapak
    const kap = el("div", "card bi-kapak");
    const band = el("div", "bi-band"); band.style.background = `linear-gradient(120deg, ${u.renk}, #0f172a)`;
    const av = el("span", "bi-buyuk-av", u.emoji); av.style.background = u.renk;
    const bilgi = el("div", "bi-bilgi");
    const ad = el("h1", null, u.ad); ad.append(el("small", null, " (" + u.lakap + ")"));
    bilgi.append(ad, el("p", "bi-unvan", u.unvan), el("p", "muted", `📍 ${u.konum} · 🔗 ${u.baglanti}`));
    const btn = el("div", "bi-btnler");
    const bag = el("button", "btn", "➕ Bağlantı kur"); bag.type = "button";
    bag.onclick = () => { bag.textContent = rastgele(["⏳ Beklemede (görüldü)", "✅ Bağlandınız. Ücretsiz izinde olduğu için cevap gecikebilir.", "❌ 'Gelcem' dedi, gelmedi"]); };
    const msj = el("button", "btn btn-ghost", "✉️ Mesaj"); msj.type = "button"; msj.onclick = () => { msj.textContent = "🔒 Premium gerekli (12 TL)"; };
    btn.append(bag, msj); bilgi.append(btn);
    kap.append(band, av, bilgi); p.append(kap);
    // hakkında
    const hk = bolum("Hakkında"); hk.append(el("p", null, u.hakkinda)); p.append(hk);
    // deneyim
    const dn = bolum("Deneyim");
    u.deneyim.forEach(([poz, yer, sure, acik]) => { const d = el("div", "bi-deneyim"); d.append(el("span", "bi-sirket", "🏢")); const t = el("div"); t.append(el("b", null, poz), el("small", null, `${yer} · ${sure}`), el("p", null, acik)); d.append(t); dn.append(d); });
    p.append(dn);
    const eg = bolum("Eğitim ve Sertifikalar");
    u.egitim.forEach(([a, b]) => { const d = el("div", "bi-deneyim"); d.append(el("span", "bi-sirket", "🎓")); const t = el("div"); t.append(el("b", null, a), el("small", null, b)); d.append(t); eg.append(d); });
    p.append(eg);
    // yetenekler
    const yt = bolum("Yetenekler");
    const say = onaySay(secili), benim = benimOnay();
    const tum = [...new Set([...u.yetenek, ...[...say.keys()]])].sort((a, b) => (say.get(b) || []).length - (say.get(a) || []).length);
    tum.forEach((b) => {
      const kim = say.get(b) || [], d = el("div", "bi-yetenek");
      const t = el("div"); t.append(el("b", null, b), el("small", null, kim.length ? `${kim.length} onay · ${kim.slice(0, 4).join(", ")}${kim.length > 4 ? "…" : ""}` : "Henüz onay yok"));
      const on = el("button", "bi-onay" + (benim[secili + "|" + b] ? " on" : ""), benim[secili + "|" + b] ? "✓ Onayladın" : "+ Onayla"); on.type = "button"; on.onclick = () => onayla(secili, b);
      d.append(t, on); yt.append(d);
    });
    const ekle = el("form", "bi-form bi-satir-form");
    const inp = el("input"); inp.maxLength = 40; inp.placeholder = `${u.ad}'e yeni yetenek ekle (ör. Satmak)`;
    const eb = el("button", "btn", "Ekle ve onayla"); eb.type = "submit";
    ekle.append(inp, eb); ekle.onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim().replace(/\|/g, "/"); if (v.length < 2) return; inp.value = ""; onayla(secili, v); };
    yt.append(ekle); p.append(yt);
    // tavsiyeler
    const tv = bolum("Tavsiyeler");
    const liste = tavsiyeler.filter((t) => t.hedef === secili);
    if (!liste.length) tv.append(el("p", "muted", `${u.ad} için henüz tavsiye yazılmadı. İlk sen yaz.`));
    liste.forEach((t) => {
      const d = el("div", "bi-tavsiye");
      const bas = el("div", "bi-tavsiye-bas"); bas.append(el("b", null, t.yazan), el("small", null, " · " + zaman(t.t)));
      if (profil && (profil.uid === t.yazanUid || profil.rol === "admin")) { const sil = el("button", "bi-sil", "Sil"); sil.type = "button"; sil.onclick = () => db.collection("berkedin_tavsiye").doc(t.id).delete().catch((e) => durum("⚠️ " + e.message)); bas.append(sil); }
      d.append(bas, el("p", null, "“" + t.metin + "”")); tv.append(d);
    });
    if (profil) {
      const f = el("form", "bi-form"); const ta = el("textarea"); ta.maxLength = 400; ta.rows = 3; ta.placeholder = `${u.ad} için tavsiye yaz (ör. "${u.ad} ile 3 yıl çalıştım, bir kez işe geldi.")`;
      const sb = el("button", "btn", "Tavsiyeyi yayınla"); sb.type = "submit"; f.append(ta, sb);
      f.onsubmit = async (e) => {
        e.preventDefault(); const metin = ta.value.trim(); if (metin.length < 3) return; sb.disabled = true;
        try { await db.collection("berkedin_tavsiye").add({ hedef: secili, metin, yazanUid: profil.uid, yazan: profil.kullaniciAdi, t: firebase.firestore.FieldValue.serverTimestamp() }); ta.value = ""; durum(""); }
        catch (err) { durum("⚠️ " + err.message); } finally { sb.disabled = false; }
      };
      tv.append(f);
    } else tv.append(el("p", "muted", "Tavsiye yazmak için giriş yap."));
    p.append(tv);
  }
  const rastgele = (l) => l[Math.floor(Math.random() * l.length)];

  // ---- ilanlar ----
  function ilanCiz() {
    const k = $("biIlanlar"); k.textContent = "";
    $("biIlanSay").textContent = ilanlar.length ? `(${ilanlar.length})` : "";
    if (!ilanlar.length) k.append(el("p", "muted", "Henüz ilan yok. İlk ilanı sen ver (ör. 'Tekel bayisi, Berkay yapamaz')."));
    ilanlar.forEach((i) => {
      const d = el("div", "card bi-ilan");
      const ust = el("div", "bi-ilan-ust"); ust.append(el("span", "bi-sirket", "💼"));
      const t = el("div"); t.append(el("b", null, i.baslik), el("small", null, `${i.sirket}${i.maas ? " · " + i.maas : ""} · ${i.yazan} · ${zaman(i.t)}`)); ust.append(t);
      d.append(ust);
      if (i.aciklama) d.append(el("p", null, i.aciklama));
      const b = i.basvuranlar || [];
      const alt = el("div", "bi-ilan-alt"); alt.append(el("small", "muted", b.length ? `${b.length} başvuru: ${b.join(", ")}` : "Henüz başvuru yok"));
      if (profil && !b.includes(profil.kullaniciAdi)) {
        const bv = el("button", "btn", "Kolay Başvuru"); bv.type = "button";
        bv.onclick = async () => { bv.disabled = true; try { await db.collection("berkedin_ilan").doc(i.id).update({ basvuranlar: firebase.firestore.FieldValue.arrayUnion(profil.kullaniciAdi) }); } catch (e) { durum("⚠️ " + e.message); bv.disabled = false; } };
        alt.append(bv);
      } else if (profil) alt.append(el("span", "bi-basvurdu", "✓ Başvurdun · Ücretsiz izinden dönünce dönüş yapılacak"));
      if (profil && (profil.uid === i.yazanUid || profil.rol === "admin")) { const sil = el("button", "bi-sil", "Sil"); sil.type = "button"; sil.onclick = () => db.collection("berkedin_ilan").doc(i.id).delete().catch((e) => durum("⚠️ " + e.message)); alt.append(sil); }
      d.append(alt); k.append(d);
    });
  }
  $("biIlanForm").addEventListener("submit", async (e) => {
    e.preventDefault(); if (!profil) return;
    const v = (id) => $(id).value.trim();
    if (v("biIlanBaslik").length < 2 || v("biIlanSirket").length < 2) { durum("Pozisyon ve şirket yaz."); return; }
    try {
      await db.collection("berkedin_ilan").add({ baslik: v("biIlanBaslik"), sirket: v("biIlanSirket"), maas: v("biIlanMaas"), aciklama: v("biIlanAciklama"), yazanUid: profil.uid, yazan: profil.kullaniciAdi, t: firebase.firestore.FieldValue.serverTimestamp(), basvuranlar: [] });
      ["biIlanBaslik", "biIlanSirket", "biIlanMaas", "biIlanAciklama"].forEach((id) => ($(id).value = "")); durum("✅ İlan yayında.");
    } catch (err) { durum("⚠️ " + err.message); }
  });

  // ---- sekmeler ----
  document.querySelectorAll(".bi-sekmeler [data-sekme]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".bi-sekmeler [data-sekme]").forEach((x) => x.classList.toggle("on", x === b));
    $("biProfilBolum").hidden = b.dataset.sekme !== "profil"; $("biIlanBolum").hidden = b.dataset.sekme !== "ilan";
  }));

  // ---- veri ----
  kisiler(); profilCiz();
  if (typeof db === "undefined" || !db) return;
  db.collection("berkedin_onay").onSnapshot((s) => { onaylar = s.docs.map((d) => Object.assign({ uid: d.id }, d.data())); profilCiz(); }, () => {});
  db.collection("berkedin_tavsiye").orderBy("t", "desc").limit(150).onSnapshot((s) => { tavsiyeler = s.docs.map((d) => Object.assign({ id: d.id }, d.data())); profilCiz(); }, () => {});
  db.collection("berkedin_ilan").orderBy("t", "desc").limit(40).onSnapshot((s) => { ilanlar = s.docs.map((d) => Object.assign({ id: d.id }, d.data())); ilanCiz(); }, () => {});
  window.YaparmiAuth.onChange((p) => { profil = p; $("biIlanForm").hidden = !p; $("biIlanGiris").hidden = !!p; profilCiz(); ilanCiz(); });
})();
