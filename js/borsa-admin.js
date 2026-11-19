// ============================================================
// borsa-admin.js — admin.html "📈 Borsa" sekmesi.
//   - Özet: fiyat, arz, kasa, dolaşım, açık pozisyonlar, piyasa aç/kapat
//   - Fiyatı yönet: grafiğe çizgi çiz → fiyat o rotayı izler; ya da anında fiyat ver
//   - Ayarlar: derinlik, oynaklık, maksimum kaldıraç
//   - Arz: kullanıcıya BERKAY/TL gönder ya da geri al, toplam arzı bas/yak
//   - Cüzdanlar, kaldıraç pozisyonları (kapat / likide et), siparişler, market, para hareketleri
// Para değiştiren her şey /api/borsa üzerinden (sunucuda) yapılır.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("bxaOzet")) return;
  const E = window.BorsaEgri, api = window.BorsaApi, sayi = window.BorsaSayi;
  const para = (x, k = 2) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  const isaretli = (x, k = 2) => (x >= 0 ? "+" : "") + para(x, k);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const tarih = (ms) => (ms ? new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-");

  let basladi = false, d = null, cuzdanlar = [], grafik = null, eskiMumlar = new Map(), cizilen = null, cizimAcik = false, gizli = null;

  window.YaparmiAuth.onChange((p) => { if (p && p.rol === "admin" && !basladi) { basladi = true; baslat(); } });

  async function islem(btn, durumEl, ad, veri) {
    if (btn) btn.disabled = true;
    durumEl.textContent = "İşleniyor…";
    try { const r = await api(ad, veri); durumEl.textContent = "✅ " + (r.mesaj || "Tamam"); return r; }
    catch (err) { durumEl.textContent = "⚠️ " + err.message; return null; }
    finally { if (btn) btn.disabled = false; }
  }

  function baslat() {
    grafik = new window.BorsaGrafik($("bxaGrafik"));
    api("tick").catch((err) => { $("bxaGenelDurum").textContent = "⚠️ Sunucu: " + err.message; });
    setInterval(() => { if (document.visibilityState === "visible" && !$("bxaOzet").closest(".adm-panel").hidden) api("tick").catch(() => {}); }, 10000);

    db.collection("borsa").doc("durum").onSnapshot((s) => {
      if (!s.exists) { $("bxaOzet").innerHTML = '<p class="muted">Borsa henüz başlamadı. Biri borsaya girince (ya da bu sayfa sunucuya ulaşınca) kurulur.</p>'; return; }
      d = s.data(); d.poz = d.poz || {}; d.son = d.son || [];
      ozetCiz(); pozlarCiz(); cuzdanlarCiz(); grafikCiz(); ayarDoldur();
    }, (err) => { $("bxaGenelDurum").textContent = "⚠️ " + err.message; });

    db.collection("borsa").doc("gizli").onSnapshot((s) => {
      gizli = s.exists ? s.data() : null;
      const r = gizli && gizli.rota;
      grafik.rota(r ? r.noktalar : null);
      mmCiz();
      $("bxaRotaBilgi").textContent = r ? `🟡 Aktif rota: ${sayi(r.noktalar[0].p)} → ${sayi(r.noktalar[r.noktalar.length - 1].p)} · bitiş ${tarih(r.noktalar[r.noktalar.length - 1].t)}` : "Aktif rota yok, fiyat serbest.";
    }, () => {});

    db.collection("borsa_cuzdan").onSnapshot((s) => {
      cuzdanlar = s.docs.map((x) => x.data());
      cuzdanlarCiz(); ozetCiz(); kisilerDoldur();
    }, (err) => { $("bxaCuzdanlar").innerHTML = `<tr><td colspan="8">⚠️ ${err.message} (Firestore kurallarını güncelledin mi?)</td></tr>`; });

    db.collection("borsa_siparis").orderBy("ms", "desc").limit(200).onSnapshot((s) => siparislerCiz(s.docs.map((x) => Object.assign({ id: x.id }, x.data()))), () => {});
    db.collection("borsa_market").onSnapshot((s) => urunlerCiz(s.docs.map((x) => Object.assign({ id: x.id }, x.data())).sort((a, b) => (a.sira || 99) - (b.sira || 99))), () => {});
    db.collection("borsa_log").orderBy("ms", "desc").limit(300).onSnapshot((s) => logCiz(s.docs.map((x) => x.data())), () => {});

    for (let i = 0; i < 4; i++) {
      const g = window.BorsaGun(Date.now() - i * 86400000);
      db.collection("borsa_grafik").doc(g).get().then((s) => { if (s.exists) { (s.data().m || []).forEach((m) => eskiMumlar.set(m.t, m)); grafikCiz(); } }).catch(() => {});
    }
    kisilerDoldur();
  }

  // ---------------- Özet ----------------
  function acikKZ() { return Object.values(d.poz).reduce((t, p) => t + E.pnl(p, d.fiyat, d.derinlik), 0); }
  function ozetCiz() {
    if (!d) return;
    const kullanicilarda = cuzdanlar.reduce((t, c) => t + (c.bkc || 0), 0);
    const btlToplam = cuzdanlar.reduce((t, c) => t + (c.btl || 0), 0);
    const poz = Object.values(d.poz);
    const kz = acikKZ();
    const kutular = [
      ["Fiyat", sayi(d.fiyat) + " TL"],
      ["Toplam arz", para(d.toplamArz, 0) + " BERKAY"],
      ["Kasada (admin)", para(d.kasaBKC, 2) + " BERKAY"],
      ["Kullanıcılarda", para(kullanicilarda, 2) + " BERKAY"],
      ["Arz kontrolü", Math.abs(kullanicilarda + d.kasaBKC - d.toplamArz) < 0.01 ? "✅ Tutuyor" : "⚠️ " + para(kullanicilarda + d.kasaBKC - d.toplamArz)],
      ["Kullanıcılardaki TL", para(btlToplam) + " TL"],
      ["Cüzdan sayısı", String(cuzdanlar.length)],
      ["Açık pozisyon", poz.length + " · " + para(poz.reduce((t, p) => t + p.notional, 0), 0) + " TL"],
      ["Kaldıraçtakilerin K/Z", isaretli(kz) + " TL"],
      ["Piyasa değeri", para(d.fiyat * (d.toplamArz - d.kasaBKC), 0) + " TL"],
      ["Piyasa", d.acik ? "🟢 Açık" : "🔴 Kapalı"],
      ["Rota", d.rotaVar ? "🟡 Çizgi izleniyor" : "Serbest"],
    ];
    const o = $("bxaOzet"); o.textContent = "";
    kutular.forEach(([a, b]) => { const div = el("div"); div.append(el("span", null, a), el("b", null, b)); o.append(div); });
    $("bxaAcBtn").hidden = !!d.acik; $("bxaKapatBtn").hidden = !d.acik;
  }
  $("bxaAcBtn").addEventListener("click", () => islem($("bxaAcBtn"), $("bxaGenelDurum"), "adminAyar", { acik: true }));
  $("bxaKapatBtn").addEventListener("click", () => { if (confirm("Piyasa kapanınca kimse alım-satım/kaldıraç yapamaz ve fiyat donar. Kapatılsın mı?")) islem($("bxaKapatBtn"), $("bxaGenelDurum"), "adminAyar", { acik: false }); });

  // ---------------- Grafik + çizim ----------------
  function grafikCiz() {
    if (!grafik || !d) return;
    const m = new Map(eskiMumlar); d.son.forEach((x) => m.set(x.t, x));
    grafik.canliFiyat = d.fiyat;
    grafik.veri([...m.values()].sort((a, b) => a.t - b.t));
    const cizgiler = [];
    Object.values(d.poz).forEach((p) => cizgiler.push({ p: E.lik(p, d.derinlik), renk: "#e8590c", yazi: `${p.ad} ${p.kaldirac}x lik.` }));
    grafik.cizgiler(cizgiler);
  }
  function cizimGuncelle() {
    grafik.cizimModu({
      acik: cizimAcik,
      sureMs: Number($("bxaSure").value),
      carpan: Number($("bxaCarpan").value),
      bitti: (n) => { cizilen = n; $("bxaRotaUygula").disabled = false; $("bxaFiyatDurum").textContent = `Çizildi: ${sayi(n[0].p)} → ${sayi(n[n.length - 1].p)}. "Rotayı uygula" de.`; },
    });
    $("bxaCizimBtn").textContent = cizimAcik ? "✋ Çizim modunu kapat" : "✏️ Çizim modunu aç";
  }
  $("bxaCizimBtn").addEventListener("click", () => { cizimAcik = !cizimAcik; cizilen = null; $("bxaRotaUygula").disabled = true; cizimGuncelle(); });
  $("bxaSure").addEventListener("change", () => { cizilen = null; $("bxaRotaUygula").disabled = true; cizimGuncelle(); });
  $("bxaCarpan").addEventListener("change", cizimGuncelle);
  $("bxaRotaUygula").addEventListener("click", async () => {
    if (!cizilen) return;
    // çizim yapıldıktan sonra geçen süre kadar ileri kaydır (rota "şimdi"den başlasın)
    const kay = Date.now() - cizilen[0].t;
    const noktalar = cizilen.map((q) => ({ t: Math.round(q.t + kay), p: q.p }));
    const r = await islem($("bxaRotaUygula"), $("bxaFiyatDurum"), "adminRota", { noktalar });
    if (r) { cizilen = null; $("bxaRotaUygula").disabled = true; grafik.cizimModu({ noktalar: [] }); }
  });
  $("bxaRotaSil").addEventListener("click", () => islem($("bxaRotaSil"), $("bxaFiyatDurum"), "adminRota", { noktalar: null }));
  $("bxaFiyatBtn").addEventListener("click", () => {
    const f = Number($("bxaFiyat").value);
    if (!(f > 0)) { $("bxaFiyatDurum").textContent = "Fiyat yaz."; return; }
    if (!confirm(`Fiyat anında ${f} olacak. Kaldıraçta olanlar likide olabilir. Emin misin?`)) return;
    islem($("bxaFiyatBtn"), $("bxaFiyatDurum"), "adminFiyat", { fiyat: f });
  });

  // ---------------- Piyasa yapıcı (MM) ----------------
  let mmDolu = false;
  function mmCiz() {
    const mm = (gizli && gizli.mm) || null;
    if (!mmDolu && mm) {
      mmDolu = true;
      $("bxaMMAcik").checked = !!mm.acik; $("bxaMMMod").value = mm.mod || "denge";
      $("bxaMMDakika").value = mm.dakikalik ?? ""; $("bxaMMHedef").value = mm.hedef ?? ""; $("bxaMMBant").value = mm.bant ?? 2;
      mmModGoster();
    }
    const st = $("bxaMMDurum");
    if (!mm) { st.textContent = "Piyasa yapıcı hiç açılmadı."; return; }
    const al = mm.alinan || 0, sat = mm.satilan || 0;
    const son = mm.sonIslem ? ` · son işlem ${tarih(mm.sonIslem.t)}: ${mm.sonIslem.N > 0 ? "🟢 aldı" : "🔴 sattı"} ${para(Math.abs(mm.sonIslem.N))} TL → ${sayi(mm.sonIslem.f)}` : "";
    st.textContent = `${mm.acik ? "🟢 Çalışıyor" : "⚪ Kapalı"} · toplam alım ${para(al)} TL · toplam satış ${para(sat)} TL · net ${isaretli(al - sat)} TL${son}`;
  }
  function mmModGoster() { const denge = $("bxaMMMod").value === "denge"; $("bxaMMHedefKutu").hidden = !denge; $("bxaMMBantKutu").hidden = !denge; }
  $("bxaMMMod").addEventListener("change", mmModGoster);
  $("bxaMMHedefSimdi").addEventListener("click", () => { if (d) $("bxaMMHedef").value = Number(d.fiyat.toPrecision(4)); });
  async function mmKaydet(sifirla) {
    const r = await islem($("bxaMMKaydet"), $("bxaMMSonuc"), "adminMM", {
      acik: $("bxaMMAcik").checked, mod: $("bxaMMMod").value, dakikalik: Number($("bxaMMDakika").value) || 0,
      hedef: Number($("bxaMMHedef").value) || 0, bant: Number($("bxaMMBant").value) || 0, sifirla: !!sifirla,
    });
    return r;
  }
  $("bxaMMKaydet").addEventListener("click", () => mmKaydet(false));
  $("bxaMMSifirla").addEventListener("click", () => { if (confirm("MM istatistikleri (toplam alım/satım) sıfırlansın mı?")) mmKaydet(true); });

  // ---------------- Ayarlar ----------------
  let ayarDolu = false;
  function ayarDoldur() {
    if (ayarDolu || !d) return;
    ayarDolu = true;
    $("bxaDerinlik").value = d.derinlik; $("bxaOynaklik").value = d.oynaklik; $("bxaMaxX").value = d.maxKaldirac;
  }
  $("bxaAyarKaydet").addEventListener("click", () => islem($("bxaAyarKaydet"), $("bxaAyarDurum"), "adminAyar", {
    derinlik: Number($("bxaDerinlik").value), oynaklik: Number($("bxaOynaklik").value), maxKaldirac: Number($("bxaMaxX").value),
  }));

  // ---------------- Arz + gönder ----------------
  let kisiler = [];
  async function kisilerDoldur() {
    try {
      if (!kisiler.length) {
        const s = await db.collection("kullanicilar").get();
        kisiler = s.docs.map((x) => ({ uid: x.id, ad: x.data().kullaniciAdi || "?" }));
      }
    } catch { /* kural yoksa sadece cüzdanlar */ }
    const harita = new Map(kisiler.map((k) => [k.uid, k.ad]));
    cuzdanlar.forEach((c) => harita.set(c.uid, c.ad));
    const sel = $("bxaKisi"), secili = sel.value;
    sel.textContent = ""; sel.append(new Option("Seç…", ""));
    [...harita.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr")).forEach(([uid, ad]) => {
      const c = cuzdanlar.find((x) => x.uid === uid);
      sel.append(new Option(c ? `${ad} (${para(c.bkc, 0)} BERKAY · ${para(c.btl, 0)} TL)` : `${ad} (cüzdan yok)`, uid));
    });
    sel.value = secili;
  }
  $("bxaGonder").addEventListener("click", async () => {
    const uid = $("bxaKisi").value, bkc = Number($("bxaBkc").value) || 0, btl = Number($("bxaBtl").value) || 0;
    if (!uid) { $("bxaParaDurum").textContent = "Kullanıcı seç."; return; }
    const r = await islem($("bxaGonder"), $("bxaParaDurum"), "adminTransfer", { uid, bkc, btl });
    if (r) { $("bxaBkc").value = ""; $("bxaBtl").value = ""; }
  });
  $("bxaArzBtn").addEventListener("click", () => {
    const deg = Number($("bxaArz").value);
    if (!deg) { $("bxaParaDurum").textContent = "Değişim yaz."; return; }
    if (!confirm(deg > 0 ? `${deg} BERKAY basılıp kasaya eklenecek.` : `${-deg} BERKAY kasadan yakılacak.`)) return;
    islem($("bxaArzBtn"), $("bxaParaDurum"), "adminArz", { degisim: deg }).then((r) => { if (r) $("bxaArz").value = ""; });
  });

  // ---------------- Cüzdanlar ----------------
  function cuzdanlarCiz() {
    const tb = $("bxaCuzdanlar"); tb.textContent = "";
    if (!d) return;
    if (!cuzdanlar.length) { tb.innerHTML = '<tr><td colspan="8" class="muted">Henüz kimse borsaya girmedi.</td></tr>'; return; }
    const satirlar = cuzdanlar.map((c) => {
      const poz = Object.values(d.poz).filter((p) => p.uid === c.uid);
      const teminat = poz.reduce((t, p) => t + p.teminat, 0);
      const kz = poz.reduce((t, p) => t + E.pnl(p, d.fiyat, d.derinlik), 0);
      const toplam = c.bkc * d.fiyat + c.btl + poz.reduce((t, p) => t + Math.max(0, p.teminat + E.pnl(p, d.fiyat, d.derinlik)), 0);
      return { c, poz, teminat, kz, toplam };
    }).sort((a, b) => b.toplam - a.toplam);
    satirlar.forEach(({ c, poz, teminat, kz, toplam }) => {
      const tr = el("tr");
      tr.append(el("td", null, c.ad), el("td", null, para(c.bkc, 4)), el("td", null, ((c.bkc / d.toplamArz) * 100).toFixed(3) + "%"), el("td", null, para(c.btl)),
        el("td", null, poz.length ? `${poz.length} poz · ${para(teminat)} TL` : "—"),
        el("td", kz >= 0 ? "yukari" : "asagi", poz.length ? isaretli(kz) : "—"),
        el("td", (c.gerceklesen || 0) >= 0 ? "yukari" : "asagi", isaretli(c.gerceklesen || 0)),
        el("td", null, para(toplam) + " TL"));
      tb.append(tr);
    });
  }

  // ---------------- Pozisyonlar ----------------
  function pozlarCiz() {
    const tb = $("bxaPozlar"); tb.textContent = "";
    const liste = Object.values(d.poz).sort((a, b) => b.notional - a.notional);
    if (!liste.length) { tb.innerHTML = '<tr><td colspan="9" class="muted">Açık pozisyon yok.</td></tr>'; return; }
    liste.forEach((p) => {
      const pnl = E.pnl(p, d.fiyat, d.derinlik);
      const tr = el("tr");
      const yon = el("td"); yon.append(el("span", "bx-rozet " + (p.yon === "long" ? "al" : "sat"), `${p.kaldirac}x ${p.yon.toUpperCase()}`));
      tr.append(el("td", null, p.ad), yon, el("td", null, para(p.teminat)), el("td", null, para(p.notional)), el("td", null, sayi(p.giris)), el("td", "asagi", sayi(E.lik(p, d.derinlik))));
      const kz = el("td", pnl >= 0 ? "yukari" : "asagi"); kz.innerHTML = `<b>${isaretli(pnl)}</b> <small>(${isaretli((pnl / p.teminat) * 100)}%)</small>`; tr.append(kz);
      tr.append(el("td", null, tarih(p.acilis)));
      const td = el("td", "bx-butonlar");
      const kapat = el("button", "admin-btn", "Kapat"); kapat.type = "button"; kapat.title = "Normal kapat, kâr/zarar sahibine";
      kapat.addEventListener("click", () => { if (confirm(`${p.ad} kişisinin pozisyonu kapatılsın mı? (${isaretli(pnl)} TL sahibine)`)) islem(kapat, $("bxaGenelDurum"), "adminPozKapat", { id: p.id, mod: "kapat" }); });
      const lik = el("button", "admin-btn reject", "💀 Likide et"); lik.type = "button";
      lik.addEventListener("click", () => { if (confirm(`${p.ad} kişisinin ${p.teminat} TL teminatı yanacak. Likide edilsin mi?`)) islem(lik, $("bxaGenelDurum"), "adminPozKapat", { id: p.id, mod: "likide" }); });
      td.append(kapat, lik); tr.append(td);
      tb.append(tr);
    });
  }

  // ---------------- Siparişler ----------------
  const SIP = { bekliyor: "⏳ Bekliyor", teslim: "✅ Teslim", iptal: "↩️ İptal" };
  function siparislerCiz(liste) {
    const tb = $("bxaSiparisler"); tb.textContent = "";
    const bekleyen = liste.filter((x) => x.durum === "bekliyor").length;
    const say = $("admSiparisSay"); say.hidden = !bekleyen; say.textContent = String(bekleyen);
    if (!liste.length) { tb.innerHTML = '<tr><td colspan="6" class="muted">Sipariş yok.</td></tr>'; return; }
    liste.forEach((s) => {
      const tr = el("tr");
      tr.append(el("td", null, tarih(s.ms)), el("td", null, s.ad), el("td", null, (s.emoji || "🎁") + " " + s.urunAd), el("td", null, para(s.fiyat, 0) + " BERKAY"), el("td", null, SIP[s.durum] || s.durum));
      const td = el("td", "bx-butonlar");
      if (s.durum === "bekliyor") {
        const t = el("button", "admin-btn publish", "✅ Teslim edildi"); t.type = "button";
        t.addEventListener("click", () => islem(t, $("bxaGenelDurum"), "adminSiparis", { id: s.id, durum: "teslim" }));
        const i = el("button", "admin-btn reject", "↩️ İptal + iade"); i.type = "button";
        i.addEventListener("click", () => { if (confirm(`${s.fiyat} BERKAY ${s.ad} kişisine iade edilsin mi?`)) islem(i, $("bxaGenelDurum"), "adminSiparis", { id: s.id, durum: "iptal" }); });
        td.append(t, i);
      } else if (s.durum === "teslim") {
        const g = el("button", "admin-btn", "Geri al"); g.type = "button";
        g.addEventListener("click", () => islem(g, $("bxaGenelDurum"), "adminSiparis", { id: s.id, durum: "bekliyor" }));
        td.append(g);
      }
      tr.append(td); tb.append(tr);
    });
  }

  // ---------------- Market ----------------
  function urunlerCiz(liste) {
    const k = $("bxaUrunler"); k.textContent = "";
    if (!liste.length) { k.append(el("p", "muted", "Ürün yok.")); return; }
    liste.forEach((u) => {
      const row = el("div", "bx-satir");
      row.append(el("b", null, (u.emoji || "🎁") + " " + u.ad), el("span", "muted", para(u.fiyat, 0) + " BERKAY · stok " + (u.stok < 0 ? "∞" : u.stok) + (u.aktif === false ? " · satışta değil" : "")));
      const sag = el("span", "bx-sag bx-butonlar");
      const duz = el("button", "admin-btn", "Düzenle"); duz.type = "button";
      duz.addEventListener("click", () => {
        $("bxaUrunId").value = u.id; $("bxaUrunEmoji").value = u.emoji || ""; $("bxaUrunAd").value = u.ad || ""; $("bxaUrunAciklama").value = u.aciklama || "";
        $("bxaUrunFiyat").value = u.fiyat; $("bxaUrunStok").value = u.stok; $("bxaUrunSira").value = u.sira || 10; $("bxaUrunAktif").checked = u.aktif !== false;
        $("bxaUrunBaslik").textContent = "✏️ Ürünü düzenle"; $("bxaUrunAd").focus();
      });
      const sil = el("button", "admin-btn reject", "Sil"); sil.type = "button";
      sil.addEventListener("click", () => { if (confirm(`${u.ad} silinsin mi?`)) islem(sil, $("bxaUrunDurum"), "adminUrunSil", { id: u.id }); });
      sag.append(duz, sil); row.append(sag); k.append(row);
    });
  }
  function urunTemizle() {
    ["bxaUrunId", "bxaUrunEmoji", "bxaUrunAd", "bxaUrunAciklama", "bxaUrunFiyat"].forEach((id) => { $(id).value = ""; });
    $("bxaUrunStok").value = "-1"; $("bxaUrunSira").value = "10"; $("bxaUrunAktif").checked = true;
    $("bxaUrunBaslik").textContent = "➕ Ürün ekle";
  }
  $("bxaUrunTemizle").addEventListener("click", urunTemizle);
  $("bxaUrunKaydet").addEventListener("click", async () => {
    const r = await islem($("bxaUrunKaydet"), $("bxaUrunDurum"), "adminUrun", {
      id: $("bxaUrunId").value || undefined, emoji: $("bxaUrunEmoji").value, ad: $("bxaUrunAd").value, aciklama: $("bxaUrunAciklama").value,
      fiyat: Number($("bxaUrunFiyat").value), stok: Number($("bxaUrunStok").value), sira: Number($("bxaUrunSira").value), aktif: $("bxaUrunAktif").checked,
    });
    if (r) urunTemizle();
  });

  // ---------------- Log ----------------
  const TUR = { bonus: "🎁 Bonus", "spot-al": "🟢 Spot al", "spot-sat": "🔴 Spot sat", "poz-ac": "⚡ Poz aç", "poz-kapat": "✅ Poz kapat", likidasyon: "💀 Likidasyon", market: "🛒 Market", "admin-transfer": "💸 Admin gönderim", admin: "⚙️ Admin" };
  function logCiz(liste) {
    const tb = $("bxaLog"); tb.textContent = "";
    if (!liste.length) { tb.innerHTML = '<tr><td colspan="6" class="muted">Kayıt yok.</td></tr>'; return; }
    liste.forEach((l) => {
      const tr = el("tr");
      tr.append(el("td", null, tarih(l.ms)), el("td", null, l.ad), el("td", null, TUR[l.tur] || l.tur), el("td", "bx-detay", l.detay),
        el("td", l.bkc > 0 ? "yukari" : l.bkc < 0 ? "asagi" : "muted", l.bkc ? isaretli(l.bkc, 4) : "—"),
        el("td", l.btl > 0 ? "yukari" : l.btl < 0 ? "asagi" : "muted", l.btl ? isaretli(l.btl) : "—"));
      tb.append(tr);
    });
  }
  setInterval(() => { if (d) { pozlarCiz(); } }, 15000);
})();
