// ============================================================
// kartlar.js — Koleksiyon kartları: paket açma, albüm, bozma, takas, sıralama.
// Coin hareketleri sunucuda (api/borsa.js → kartIslem). Okuma: kart_koleksiyon, kart_teklif.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const KAT = window.KART_KATALOG, KART = new Map(KAT.kartlar.map((k) => [k.id, k]));
  const NADIR = { siradan: { ad: "Sıradan", renk: "#94a3b8" }, nadir: { ad: "Nadir", renk: "#38bdf8" }, epik: { ad: "Epik", renk: "#a855f7" }, efsanevi: { ad: "Efsanevi", renk: "#f59e0b" } };
  const BOZ = { siradan: 5, nadir: 15, epik: 60, efsanevi: 300 };
  let profil = null, kol = { kartlar: {} }, herkes = [], sekme = "album";
  const durum = (t) => { $("krDurum").textContent = t || ""; };

  function kartEl(k, adet, kucuk) {
    const n = NADIR[k.nadir], sahip = adet > 0;
    const d = el("button", "kr-kart" + (sahip ? "" : " kr-yok") + (kucuk ? " kr-kucuk" : "")); d.type = "button";
    d.style.setProperty("--nadir", n.renk); d.dataset.nadir = k.nadir;
    d.append(el("span", "kr-kart-emoji", sahip ? k.emoji : "❔"), el("b", null, sahip ? k.ad : "???"), el("small", null, n.ad));
    if (adet > 1) d.append(el("span", "kr-adet", "×" + adet));
    if (sahip) d.addEventListener("click", () => detay(k));
    return d;
  }
  function album() {
    const kutu = $("krAlbum"); kutu.textContent = "";
    const sahip = KAT.kartlar.filter((k) => kol.kartlar[k.id] > 0).length;
    $("krSay").textContent = `${sahip}/${KAT.kartlar.length}`;
    for (const [sid, s] of Object.entries(KAT.setler)) {
      const ks = KAT.kartlar.filter((k) => k.set === sid), tam = ks.every((k) => kol.kartlar[k.id] > 0);
      const blok = el("div", "card kr-set" + (tam ? " kr-tam" : ""));
      const bas = el("h2", null, `${s.emoji} ${s.ad}`); bas.append(el("small", null, ` ${ks.filter((k) => kol.kartlar[k.id] > 0).length}/${ks.length}` + (tam ? " · ✅ tamamlandı" : "")));
      const izgara = el("div", "kr-izgara");
      ks.forEach((k) => izgara.append(kartEl(k, kol.kartlar[k.id] || 0)));
      blok.append(bas, izgara); kutu.append(blok);
    }
  }
  function detay(k) {
    const ic = $("krDetayIc"); ic.textContent = "";
    const adet = kol.kartlar[k.id] || 0;
    const buyuk = kartEl(k, adet); buyuk.classList.add("kr-buyuk"); buyuk.disabled = true;
    ic.append(buyuk, el("p", null, k.aciklama), el("p", "muted", `Sende ${adet} tane · ${NADIR[k.nadir].ad} · ${KAT.setler[k.set].ad}`));
    const btnler = el("div", "kr-btnler");
    if (adet > 1) {
      const b = el("button", "btn", `🔨 1 fazlayı boz (+${BOZ[k.nadir]} BERKAY)`); b.type = "button";
      b.onclick = async () => { b.disabled = true; try { const r = await Ekonomi.api("kartBoz", { kart: k.id }); kol = r.kol; bakiye(r.cuzdan); album(); Ekonomi.toast("🔨 " + r.mesaj); kapatDetay(); } catch (e) { durum("⚠️ " + e.message); b.disabled = false; } };
      btnler.append(b);
    }
    const t = el("button", "btn btn-ghost", "🤝 Takasa koy"); t.type = "button";
    t.onclick = () => { kapatDetay(); sekmeAc("takas"); $("krVer").value = k.id; };
    const x = el("button", "btn btn-ghost", "Kapat"); x.type = "button"; x.onclick = kapatDetay;
    btnler.append(t, x); ic.append(btnler);
    $("krDetay").hidden = false;
  }
  function kapatDetay() { $("krDetay").hidden = true; }
  $("krDetay").addEventListener("click", (e) => { if (e.target === $("krDetay")) kapatDetay(); });

  function bakiye(c) { if (c) $("krBakiye").textContent = `Cüzdan: ${Math.floor(c.bkc || 0).toLocaleString("tr-TR")} BERKAY`; }

  // ---- paket açma ----
  document.querySelectorAll(".kr-paket").forEach((b) => b.addEventListener("click", async () => {
    if (!profil) { durum("Paket açmak için giriş yap."); return; }
    document.querySelectorAll(".kr-paket").forEach((x) => (x.disabled = true)); durum("Paket açılıyor…");
    try {
      const r = await Ekonomi.api("kartPaket", { tip: b.dataset.tip });
      kol = r.kol; bakiye(r.cuzdan); durum(""); acilis(r);
    } catch (e) { durum("⚠️ " + e.message); }
    finally { document.querySelectorAll(".kr-paket").forEach((x) => (x.disabled = false)); }
  }));
  function acilis(r) {
    const k = $("krAcilisKartlar"); k.textContent = "";
    $("krAcilis").hidden = false; $("krAcilisKapat").hidden = true;
    const yeni = new Set(r.yeniler);
    r.cikan.forEach((id, i) => {
      const kart = KART.get(id), sar = el("div", "kr-cevir"); sar.style.animationDelay = (i * 0.55) + "s";
      const on = el("div", "kr-cevir-on", "🃏"), arka = el("div", "kr-cevir-arka");
      const kk = kartEl(kart, 1); kk.disabled = true; arka.append(kk);
      if (yeni.has(id)) { arka.append(el("span", "kr-yeni", "YENİ!")); yeni.delete(id); }
      sar.append(on, arka); k.append(sar);
    });
    const efs = r.cikan.some((id) => KART.get(id).nadir === "efsanevi");
    $("krAcilisYazi").textContent = (efs ? "🌟 EFSANEVİ KART ÇIKTI! " : "") + (r.setler && r.setler.length ? `✅ Set tamamlandı: +${r.odul} BERKAY` : "");
    setTimeout(() => { $("krAcilisKapat").hidden = false; }, r.cikan.length * 550 + 500);
  }
  $("krAcilisKapat").addEventListener("click", () => { $("krAcilis").hidden = true; album(); });

  // ---- sekmeler ----
  function sekmeAc(s) {
    sekme = s;
    document.querySelectorAll(".kr-sekmeler [data-sekme]").forEach((b) => b.classList.toggle("on", b.dataset.sekme === s));
    $("krAlbum").hidden = s !== "album"; $("krTakas").hidden = s !== "takas"; $("krSiralama").hidden = s !== "siralama";
    if (s === "takas") takasHazirla(); if (s === "siralama") siralama();
  }
  document.querySelectorAll(".kr-sekmeler [data-sekme]").forEach((b) => b.addEventListener("click", () => sekmeAc(b.dataset.sekme)));

  // ---- takas ----
  function secenekler(sel, idler, bos) {
    const once = sel.value; sel.textContent = "";
    if (!idler.length) sel.append(new Option(bos, ""));
    idler.forEach((id) => { const k = KART.get(id); sel.append(new Option(`${k.emoji} ${k.ad} (${NADIR[k.nadir].ad})`, id)); });
    if (idler.includes(once)) sel.value = once;
  }
  function takasHazirla() {
    const kisi = herkes.filter((h) => profil && h.uid !== profil.uid);
    const once = $("krKime").value; $("krKime").textContent = "";
    if (!kisi.length) $("krKime").append(new Option("Henüz kimse kart açmadı", ""));
    kisi.forEach((h) => $("krKime").append(new Option(h.ad, h.uid)));
    if (kisi.some((h) => h.uid === once)) $("krKime").value = once;
    secenekler($("krVer"), Object.keys(kol.kartlar).filter((id) => kol.kartlar[id] > 0 && KART.has(id)), "Kartın yok");
    ister();
  }
  function ister() {
    const h = herkes.find((x) => x.uid === $("krKime").value);
    secenekler($("krIste"), h ? Object.keys(h.kartlar || {}).filter((id) => h.kartlar[id] > 0 && KART.has(id)) : [], "Kartı yok");
  }
  $("krKime").addEventListener("change", ister);
  $("krTeklifBtn").addEventListener("click", async () => {
    const alan = $("krKime").value, ver = $("krVer").value, iste = $("krIste").value;
    if (!alan || !ver || !iste) { durum("Kişiyi ve iki kartı seç."); return; }
    $("krTeklifBtn").disabled = true;
    try { const r = await Ekonomi.api("kartTeklif", { alan, ver, iste }); Ekonomi.toast("🤝 " + r.mesaj); durum(""); }
    catch (e) { durum("⚠️ " + e.message); } finally { $("krTeklifBtn").disabled = false; }
  });
  function teklifSatir(t, gelen) {
    const s = el("div", "kr-teklif");
    const v = KART.get(t.ver), i = KART.get(t.iste);
    s.append(el("span", null, gelen ? `${t.verenAd}: ` : `${t.alanAd}'e: `), kartEl(v, 1, true), el("span", "kr-ok", "⇄"), kartEl(i, 1, true));
    const btn = (yazi, islem, cls) => { const b = el("button", "btn " + (cls || ""), yazi); b.type = "button"; b.onclick = async () => { b.disabled = true; try { const r = await Ekonomi.api(islem, { id: t.id }); Ekonomi.toast(r.mesaj || (r.ok ? "Tamam" : r.hata)); if (r.kol) { kol = r.kol; album(); } } catch (e) { durum("⚠️ " + e.message); b.disabled = false; } }; return b; };
    const b = el("div", "kr-btnler");
    if (gelen) b.append(btn("✅ Kabul", "kartKabul"), btn("❌ Reddet", "kartReddet", "btn-ghost")); else b.append(btn("Geri çek", "kartIptal", "btn-ghost"));
    s.append(b); return s;
  }
  function teklifCiz(liste, kutu, gelen) {
    kutu.textContent = "";
    const acik = liste.filter((t) => t.durum === "acik");
    if (!acik.length) kutu.append(el("p", "muted", gelen ? "Gelen teklif yok." : "Açık teklifin yok."));
    acik.forEach((t) => kutu.append(teklifSatir(t, gelen)));
    if (gelen) { $("krTeklifSay").hidden = !acik.length; $("krTeklifSay").textContent = acik.length; }
  }

  // ---- sıralama ----
  function siralama() {
    const k = $("krSiraListe"); k.textContent = "";
    const s = herkes.map((h) => ({ h, farkli: Object.keys(h.kartlar || {}).filter((id) => h.kartlar[id] > 0 && KART.has(id)).length, set: Object.keys(h.setOdul || {}).length, efs: Object.keys(h.kartlar || {}).filter((id) => h.kartlar[id] > 0 && KART.has(id) && KART.get(id).nadir === "efsanevi").length }))
      .sort((a, b) => b.farkli - a.farkli || b.set - a.set);
    if (!s.length) k.append(el("p", "muted", "Henüz kimse paket açmadı."));
    s.forEach((x, i) => {
      const r = el("div", "kr-sira");
      r.append(el("b", "kr-no", ["🥇", "🥈", "🥉"][i] || i + 1 + "."), window.Ekonomi ? Ekonomi.isim(x.h.ad) : el("b", null, x.h.ad), el("span", "muted", `${x.farkli}/${KAT.kartlar.length} kart · ${x.set} set · 🌟 ${x.efs} efsanevi · ${x.h.acilan || 0} paket`));
      k.append(r);
    });
  }

  // ---- veri ----
  if (typeof db === "undefined" || !db) { durum("Şu an bağlı değil."); return; }
  db.collection("kart_koleksiyon").onSnapshot((s) => {
    herkes = s.docs.map((d) => Object.assign({ uid: d.id }, d.data()));
    if (profil) { const ben = herkes.find((h) => h.uid === profil.uid); if (ben) kol = ben; }
    album(); if (sekme === "takas") takasHazirla(); if (sekme === "siralama") siralama();
  }, () => album());
  let dinle = [];
  window.YaparmiAuth.onChange((p) => {
    profil = p; dinle.forEach((f) => f()); dinle = [];
    if (!p) { kol = { kartlar: {} }; album(); $("krBakiye").textContent = "Paket açmak için giriş yap."; return; }
    const ben = herkes.find((h) => h.uid === p.uid); kol = ben || { kartlar: {} }; album();
    if (window.Ekonomi) Ekonomi.cuzdanim((c) => bakiye(c));
    dinle.push(db.collection("kart_teklif").where("alan", "==", p.uid).onSnapshot((s) => teklifCiz(s.docs.map((d) => Object.assign({ id: d.id }, d.data())), $("krGelen"), true), () => {}));
    dinle.push(db.collection("kart_teklif").where("veren", "==", p.uid).onSnapshot((s) => teklifCiz(s.docs.map((d) => Object.assign({ id: d.id }, d.data())), $("krGiden"), false), () => {}));
  });
  album();
})();
