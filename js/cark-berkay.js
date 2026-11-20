// ============================================================
// cark-berkay.js — cark.html: 💰 BERKAY Çarkı (Sınırsız Çark'tan bağımsız).
// Dilimler borsa/ekonomi.carkDilimler'den gelir: [{ ad, miktar (+/− BERKAY), agirlik }].
// Çevir'e basınca SUNUCU (api/borsa.js → carkCevir) dilimi seçer ve coin'i aktarır;
// burası sadece çarkı o dilime döndürür. Günde X bedava, sonrası ücretli.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const kutu = $("ekCark");
  if (!kutu || !window.CarkCiz) return;
  const VARSAYILAN = { acik: true, carkUcret: 10, carkGunlukBedava: 1, carkDilimler: [
    { ad: "+5", miktar: 5, agirlik: 30 }, { ad: "+20", miktar: 20, agirlik: 20 }, { ad: "−10", miktar: -10, agirlik: 18 },
    { ad: "+50", miktar: 50, agirlik: 8 }, { ad: "Boş", miktar: 0, agirlik: 15 }, { ad: "−25", miktar: -25, agirlik: 5 }, { ad: "+200 💎", miktar: 200, agirlik: 1 }] };
  let e = VARSAYILAN, benim = null, profile = null, donuyor = false, aci = 0, basladi = false;
  const tuval = $("ekCarkTuval");

  function dilimler() { return (e.carkDilimler || []).filter((x) => x.agirlik > 0); }
  function ciz() { if (!donuyor) CarkCiz.ciz(tuval, dilimler(), CarkCiz.RENKLER || undefined); }
  function bilgi() {
    const bugun = Ekonomi.bugun();
    const kullanilan = benim && benim.carkGun && benim.carkGun.tarih === bugun ? benim.carkGun.sayi : 0;
    const bedava = Math.max(0, (e.carkGunlukBedava || 0) - kullanilan);
    $("ekCarkBilgi").textContent = !e.acik ? "Şu an kapalı." : bedava > 0 ? `🎁 Bugün ${bedava} bedava hakkın var.` : `Bedava hakkın bitti. Bir çevirme ${e.carkUcret} BERKAY. Bakiye: ${benim ? Math.floor(benim.bkc) : 0}`;
    $("ekCarkBtn").disabled = donuyor || !e.acik;
    $("ekCarkBtn").textContent = bedava > 0 ? "🎁 Bedava çevir" : `Çevir (${e.carkUcret} BERKAY)`;
  }

  window.YaparmiAuth.onChange((p) => {
    profile = p;
    kutu.hidden = !p;
    if (!p || basladi || typeof db === "undefined" || !db) return;
    basladi = true;
    db.collection("borsa").doc("ekonomi").onSnapshot((s) => { e = Object.assign({}, VARSAYILAN, s.exists ? s.data() : {}); ciz(); bilgi(); }, () => { ciz(); bilgi(); });
    Ekonomi.cuzdanlar((l) => { benim = l.find((c) => c.uid === profile.uid) || null; bilgi(); });
    ciz(); bilgi();
  });

  function dondur(index) {
    return new Promise((resolve) => {
      const a = CarkCiz.acilar(dilimler())[index];
      const sapma = (Math.random() - 0.5) * (a.son - a.bas) * 0.7;
      const hedef = (((360 - ((a.bas + a.son) / 2 + sapma)) % 360) + 360) % 360;
      const simdi = ((aci % 360) + 360) % 360;
      let fark = hedef - simdi; if (fark < 0) fark += 360;
      const sure = 4 + Math.random() * 2;
      aci += 360 * 5 + fark;
      tuval.style.transition = "transform " + sure.toFixed(2) + "s cubic-bezier(.12,.72,.12,1)";
      tuval.style.transform = "rotate(" + aci + "deg)";
      let bitti = false; const son = () => { if (!bitti) { bitti = true; resolve(); } };
      tuval.addEventListener("transitionend", son, { once: true });
      setTimeout(son, sure * 1000 + 400);
    });
  }

  $("ekCarkBtn").addEventListener("click", async () => {
    if (donuyor) return;
    donuyor = true; bilgi();
    $("ekCarkSonuc").textContent = "";
    try {
      const r = await Ekonomi.api("carkCevir");
      // sunucu dilim listesi değiştiyse (admin) yeni listeyle çiz
      if (!dilimler()[r.index] || dilimler()[r.index].ad !== r.dilim.ad) { donuyor = false; ciz(); donuyor = true; }
      await dondur(r.index);
      const m = r.miktar;
      const s = $("ekCarkSonuc");
      s.className = "ek-cark-sonuc " + (m > 0 ? "yukari" : m < 0 ? "asagi" : "");
      s.textContent = m > 0 ? `🎉 ${r.dilim.ad}! +${m} BERKAY` : m < 0 ? `💸 ${r.dilim.ad}… ${m} BERKAY` : `😶 ${r.dilim.ad}`;
      if (m >= 100) Ekonomi.toast(`💎 BÜYÜK İKRAMİYE! +${m} BERKAY`, 6000);
    } catch (err) {
      $("ekCarkSonuc").textContent = "⚠️ " + err.message;
    } finally { donuyor = false; bilgi(); }
  });
})();
