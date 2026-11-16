// ============================================================
// arsiv.js — arsiv.html: soru kutusuna "berkay1", "kubi1", "ortak1", "hersey1"
// yazılınca gelinen sayfa. /api/ask'tan arşivi çekip madde madde gösterir.
// ============================================================
(function () {
  "use strict";
  const baslik = document.getElementById("arsivBaslik");
  const lead = document.getElementById("arsivLead");
  const icerik = document.getElementById("arsivIcerik");
  const params = new URLSearchParams(location.search);
  const kod = (params.get("k") || "").trim();
  const bot = params.get("bot") === "ahlakli" ? "ahlakli" : "sinirsiz";

  function hata(metin) {
    lead.textContent = metin;
    icerik.innerHTML = "";
  }

  if (!kod) { hata("Kod yok. Kâhin'in soru kutusuna örn. berkay1, kubi1, ortak1 ya da hersey1 yaz."); return; }

  fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: kod + "1", bot }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.arsiv || !d.arsiv.kisiler || !d.arsiv.kisiler.length) { hata("Böyle bir kod yok: " + kod + "1"); return; }
      const kisiler = d.arsiv.kisiler;
      const toplam = kisiler.reduce((t, k) => t + (k.facts || []).length, 0);
      if (kisiler.length === 1 && d.arsiv.kod !== "hersey") {
        baslik.innerHTML = "";
        baslik.appendChild(document.createTextNode(kisiler[0].name));
      } else {
        baslik.innerHTML = "Tüm <em>Bilgiler</em>";
      }
      lead.textContent = (bot === "ahlakli" ? "ULTRA MAXİMUS SINIRSIZ BOT" : "Sınırsız bot") + " · " + toplam + " madde · " + kisiler.length + " dosya";
      icerik.innerHTML = "";
      kisiler.forEach((k) => {
        const kart = document.createElement("section");
        kart.className = "card";
        kart.style.marginBottom = "18px";
        const h = document.createElement("h2");
        h.textContent = k.name;
        kart.appendChild(h);
        if (k.aliases && k.aliases.length) {
          const a = document.createElement("p");
          a.className = "muted";
          a.textContent = "Lakaplar: " + k.aliases.join(", ");
          kart.appendChild(a);
        }
        if (k.summary) {
          const oz = document.createElement("p");
          oz.textContent = k.summary;
          kart.appendChild(oz);
        }
        const ol = document.createElement("ol");
        ol.className = "cark-kural-liste";
        ol.style.maxWidth = "none";
        (k.facts || []).forEach((f) => {
          const li = document.createElement("li");
          li.textContent = f;
          ol.appendChild(li);
        });
        kart.appendChild(ol);
        icerik.appendChild(kart);
      });
    })
    .catch((e) => hata("Arşiv okunamadı: " + e.message));
})();
