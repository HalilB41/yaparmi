// basarimlar.js — sadece basarimlar.html: bütün rozetleri kategorilere göre listeler.
(function () {
  "use strict";
  const kutu = document.getElementById("bsSayfa");
  const ozet = document.getElementById("bsOzet");
  if (!kutu || !window.Basarim) return;
  const B = window.Basarim;

  function tarih(ms) {
    return new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  }
  function ciz() {
    const d = B.durum();
    const toplam = B.LISTE.length;
    const acilan = B.LISTE.filter((b) => d.acik[b.id]).length;
    const yuzde = Math.round((acilan / toplam) * 100);
    ozet.innerHTML =
      '<div class="bs-ozet-sayi"><b>' + acilan + "</b><span>/ " + toplam + " açıldı</span></div>" +
      '<div class="bs-ozet-bar"><i style="width:' + yuzde + '%"></i></div>' +
      '<p class="muted">' + (acilan === 0 ? "Henüz hiçbiri açılmadı. Berkay'la aynı seviyedesin." : yuzde >= 50 ? "Berkay'ı çoktan geçtin." : "Berkay'ı geçmene az kaldı. (Zaten zor değil.)") + "</p>";
    kutu.innerHTML = "";
    B.KATEGORILER.forEach(([k, ikon, ad]) => {
      const liste = B.LISTE.filter((b) => b.k === k);
      const acik = liste.filter((b) => d.acik[b.id]).length;
      const bolum = document.createElement("section");
      bolum.className = "bs-bolum";
      bolum.innerHTML = '<div class="bs-bolum-ust"><h2></h2><span class="muted"></span></div><div class="bs-grid"></div>';
      bolum.querySelector("h2").textContent = ikon + " " + ad;
      bolum.querySelector(".bs-bolum-ust span").textContent = acik + " / " + liste.length;
      const grid = bolum.querySelector(".bs-grid");
      liste.forEach((b) => {
        const ac = d.acik[b.id];
        const gizli = b.gizli && !ac;
        const deger = Math.min(d.sayac[b.sayac] || 0, b.hedef);
        const kart = document.createElement("div");
        kart.className = "bs-kart" + (ac ? " is-acik" : "") + (gizli ? " is-gizli" : "");
        kart.innerHTML = '<span class="bs-ikon"></span><div class="bs-metin"><b></b><span></span><small></small></div>';
        kart.querySelector(".bs-ikon").textContent = gizli ? "?" : b.ikon;
        kart.querySelector("b").textContent = gizli ? "Gizli başarım" : b.ad;
        kart.querySelector(".bs-metin span").textContent = gizli ? "Açınca göreceksin." : b.acik;
        const alt = kart.querySelector("small");
        if (ac) alt.textContent = "✓ " + tarih(ac);
        else if (!gizli && b.hedef > 1) {
          alt.innerHTML = '<i class="bs-ilerleme"><i></i></i>';
          alt.querySelector("i i").style.width = Math.round((deger / b.hedef) * 100) + "%";
          alt.append(" " + deger.toLocaleString("tr-TR") + " / " + b.hedef.toLocaleString("tr-TR"));
        } else alt.textContent = "🔒 Kilitli";
        grid.appendChild(kart);
      });
      kutu.appendChild(bolum);
    });
  }
  ciz();
  document.addEventListener("basarim", ciz);

  const sif = document.getElementById("bsSifirla"), onay = document.getElementById("bsSifirlaOnay");
  sif.onclick = () => { onay.hidden = false; sif.hidden = true; };
  document.getElementById("bsSifirlaHayir").onclick = () => { onay.hidden = true; sif.hidden = false; };
  document.getElementById("bsSifirlaEvet").onclick = () => { B.sifirla(); onay.hidden = true; sif.hidden = false; ciz(); };
})();
