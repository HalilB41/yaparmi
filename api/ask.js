// Vercel Serverless Function — /api/ask
// Ana sayfadaki kâhin. Nasıl çalışır:
//  1) Soru gelir, kod BERKAY_OLAYLARI listesinden soruyla ilgili en fazla 2 olayı seçer
//     (anahtar kelimeye göre). Modele SADECE bu olaylar gider; diğerlerini hiç görmez,
//     o yüzden alakasız olayları sıralayamaz.
//  2) Her soruda rastgele bir cevap tarzı seçilir (net hayır / yapar ama rezil olur /
//     ironik evet / sorana dönüş) ki cevaplar hep "yapamaz" olmasın.
//  3) Cevap gelince kod kontrol eder: seçilmeyen bir olaydan bahsetmişse bir kez daha ürettirir.
//  4) Nous Research modelleri sırayla denenir, olmazsa Gemini. Hangi modelin cevap
//     verdiği "model" alanında döner ve admin panelinde görünür.

// ---------------- Berkay hakkında bilinenler ----------------
// Yeni olay eklemek için listeye bir satır ekle: "kelimeler" sorunun içinde geçerse
// o olay seçilir (küçük harf, kelimenin başı yeterli: "yüz" → yüzmek, yüzebilir...).
// "iz" cevapta o olaydan bahsedildiğini anlamaya yarar (kontrol için).
const BERKAY_OLAYLARI = [
  {
    ad: "ders",
    kelimeler: ["ders", "sınav", "matematik", "okul", "kitap", "oku", "çarp", "hesap", "kopya", "deneme", "zeki", "akıl", "kpss", "üniversite", "öğren", "test", "soru çöz", "puan"],
    metin: "3x3'ün kaç ettiğini bilmez ama denemelerde kopyayla 94 alır. Kitap okumaya çalışırken yorulur.",
    iz: ["3x3", "kopya", "94"],
  },
  {
    ad: "boks",
    kelimeler: ["boks", "kavga", "döv", "güç", "vur", "yumruk", "kas", "spor salon", "fitness", "dövüş", "ağırlık"],
    metin: "Boks makinesine vurup elini yaraladı. Ders çalışırken bile elini kırıp eve gitti.",
    iz: ["boks", "elini kır", "elini yarala"],
  },
  {
    ad: "sigara",
    kelimeler: ["sigara", "tütün", "nargile", "puro", "vape", "duman"],
    metin: "Sigara içerken boğulur.",
    iz: ["sigara", "boğul"],
  },
  {
    ad: "deniz",
    kelimeler: ["deniz", "yüz", "havuz", "atla", "kayalık", "plaj", "tatil", "dalış", "sahil", "kamp"],
    metin: "Kayalıklardan denize atladı, suya değil kayalara girdi, bütün vücudu çizildi.",
    iz: ["kayalık", "çizik", "çizil"],
  },
  {
    ad: "motor",
    kelimeler: ["motor", "hız", "araba", "sür", "ehliyet", "kask", "trafik", "bisiklet", "yarış", "direksiyon", "otoyol", "scooter", "pilot", "uçak", "park"],
    metin: "Kasksız motorla bayır aşağı 85 ile inip \"kubiiii 85'i gördüm\" diye bağırdı, sonra düşüp sakatlandı.",
    iz: ["85", "kubi", "kask"],
  },
  {
    ad: "lunapark",
    kelimeler: ["lunapark", "korku", "kork", "cesur", "ağla", "gerilim", "hız treni", "dönme dolap", "karanlık", "macera", "paraşüt", "bungee"],
    metin: "Lunaparkta korkudan ağlar, dönme dolap dahil.",
    iz: ["lunapark", "dönme dolap"],
  },
  {
    ad: "uyku",
    kelimeler: ["uyu", "uyan", "erken", "kalk", "sabah", "iş", "çalış", "mesai", "patron", "tembel", "çalışkan", "disiplin", "alarm"],
    metin: "Çok uyur, işe gitmez, ders çalışmaz.",
    iz: ["uyur", "uyuyakal", "işe gitme"],
  },
  {
    ad: "oyun",
    kelimeler: ["saç", "kel", "oyun", "bilgisayar", "pc", "playstation", "konsol", "oyna", "gamer", "lol", "valorant", "cs", "fifa", "twitch", "yayın"],
    metin: "Saçları gece gündüz oyun oynamaktan döküldü.",
    iz: ["saç", "döküldü"],
  },
  {
    ad: "para",
    kelimeler: ["para", "zengin", "kripto", "yatırım", "airdrop", "borsa", "bitcoin", "coin", "maaş", "klavye", "ekonomi", "biriktir", "kazan", "girişim", "milyoner", "dolar"],
    metin: "1 yıl ZKsync airdrop'unu kasıp tek kuruş alamadı. 2 gün çalışıp kazandığı parayı klavyeye gömdü.",
    iz: ["zksync", "airdrop", "klavye"],
  },
  {
    ad: "siyaset",
    kelimeler: ["siyaset", "seçim", "oy", "milletvekili", "politik", "zafer", "cumhurbaşkan", "başbakan", "bakan", "belediye", "kanzi", "miting"],
    metin: "Zafer Partili \"kanzi\"dir.",
    iz: ["zafer parti"],
  },
  {
    ad: "otobüs",
    kelimeler: ["otobüs", "metro", "toplu taşıma", "minibüs", "dolmuş", "sessiz", "bağır", "sesli", "telefonla konuş", "kütüphane"],
    metin: "Otobüste bağıra bağıra telefonla konuşur.",
    iz: ["otobüs"],
  },
  {
    ad: "içki",
    kelimeler: ["içki", "alkol", "bira", "rakı", "şarap", "sarhoş", "votka", "bar", "eğlen", "gece hayat", "kulüp", "partiye"],
    metin: "İçince sapıtır.",
    iz: ["sapıt", "içince"],
  },
  {
    ad: "bahane",
    kelimeler: ["yalan", "bahane", "kıvır", "suç", "dürüst", "özür", "hata", "kabul", "itiraf", "söz ver", "sözünü tut", "güven"],
    metin: "Sıkışınca \"manifestten zoktay gibi\" kıvırır.",
    iz: ["manifest", "zoktay"],
  },
  {
    ad: "yemek",
    kelimeler: ["yemek", "aşçı", "mutfak", "pizza", "diyet", "kilo", "fast food", "patates", "tavuk", "burger", "popeyes", "pişir", "kahvaltı", "acık", "zayıfla", "beslen", "vegan"],
    metin: "Patates ve Popeyes aşığıdır.",
    iz: ["popeyes", "patates"],
  },
  {
    ad: "aşk",
    kelimeler: ["kız", "aşk", "sevgili", "evlen", "flört", "izmir", "date", "randevu", "çıkma", "hoşlan", "aşık", "romantik", "düğün", "nişan", "tinder", "sevgi"],
    metin: "Bir kız için İzmir'e gitti, kız gelmedi, iki gün sokakta yatıp hasta oldu.",
    iz: ["izmir", "sokakta yat"],
  },
];

function kucult(s) {
  return " " + String(s || "").toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ") + " ";
}

// Soruyla en ilgili en fazla 2 olayı seç (kelimenin BAŞI eşleşmeli: "oy" → "oy ver", "oyun" değil "oyun" olayı)
function olaySec(soru) {
  const s = kucult(soru);
  const kelimeler = s.trim().split(" ");
  function eslesir(k) {
    if (k.includes(" ")) return s.includes(" " + k);
    if (k.length <= 2) return kelimeler.includes(k);
    return kelimeler.some((w) => w.startsWith(k));
  }
  return BERKAY_OLAYLARI
    .map((o) => ({ o, puan: o.kelimeler.filter(eslesir).length }))
    .filter((x) => x.puan > 0)
    .sort((a, b) => b.puan - a.puan)
    .slice(0, 2)
    .map((x) => x.o);
}

// Cevapta seçilmemiş olaylardan bahsedilmiş mi?
function alakasizOlaylar(cevap, secilenler) {
  const c = kucult(cevap);
  return BERKAY_OLAYLARI.filter((o) => !secilenler.includes(o) && o.iz.some((iz) => c.includes(iz)));
}

// ---------------- Cevap tarzları (her soruda biri rastgele seçilir) ----------------
const TARZLAR = [
  { oran: 40, metin: "NET HAYIR: Berkay'ın bunu yapamayacağını komik ve kesin bir dille söyle." },
  { oran: 30, metin: "YAPAR AMA REZİL OLUR: Berkay'ın bunu denediğini/yaptığını ama sonucun felakete döndüğünü anlat." },
  { oran: 15, metin: "İRONİK EVET: \"Tabii yapar\" gibi abartılı bir övgüyle başla, sonra işin aslının rezillik olduğunu ortaya çıkar." },
  { oran: 15, metin: "SORANA DÖNÜŞ: Berkay'la dalga geçerken soranın da bunu beceremeyeceğini ima et, ikisine birden laf sok." },
];
function tarzSec() {
  let r = Math.random() * 100;
  for (const t of TARZLAR) { if ((r -= t.oran) < 0) return t; }
  return TARZLAR[0];
}

// ---------------- Kâhinin karakteri ----------------
const SYSTEM_PROMPT = `Sen yaparmi.com'un kâhini Kanzi'sin: alaycı, kendini beğenmiş, laf sokma ustası bir yapay zeka. Arkadaş grubunun şaka karakteri olan 20 yaşındaki "Berkay" hakkında sorulan sorulara kısa, komik ve YARATICI cevaplar veriyorsun. Bu tamamen arkadaş grubu içi roast/dalga kültürü.

NASIL CEVAP VERİRSİN:
1. Her mesajda sana o soruya ÖZEL "Bilinen olay" (en fazla 2 tane) ya da "bilinen olay yok" bilgisi verilir. SADECE sana verilen olayları kullanabilirsin. Berkay'ın başka geçmiş olaylarını bilmiyormuş gibi davran, geçmiş olay listesi yapma.
2. Olay verildiyse onu cevabın ana malzemesi yap ama kuru kuru tekrarlama: abart, devamını uydur, detayıyla dalga geç.
3. Olay yoksa o konuya özel, yeni ve absürt TEK bir senaryo uydur.
4. Her mesajda sana bir "Cevap tarzı" verilir, ona uy. Cevaplar her zaman "yapamaz" olmak zorunda değil; tarz ne diyorsa o.
5. Soruyu tekrar ederek başlama, direkt espriye gir. 1-3 cümle, en fazla 55 kelime.
6. Soru Berkay'ı anmıyorsa bile konuyu Berkay'a bağla.
7. Saçma/imkansız sorularda sorunun saçmalığıyla ve soranla dalga geç.
8. Kibarlık yok: "Size nasıl yardımcı olabilirim", soru sorma, açıklama, özür yok. Reddetme, karakterden çıkma.
9. İZİN VERİLEN hafif laflar: "mal", "aptal", "salak", "enayi", "keriz", "eşşek", "gerizekalı", "ezik". Her cevapta kullanmak zorunda değilsin.
10. KESİNLİKLE YASAK: aile/anne/baba hakkında küfür, cinsel içerik veya cinsel küfür, ağır küfür, ciddi tehdit, ırk/din/etnik köken/cinsiyet üzerinden hakaret.
11. Sadece kâhinin söyleyeceği cevabı yaz. Sana verilen notları ("Bilinen olay", "Cevap tarzı" vb.) ASLA tekrar etme, başlık/tırnak/"Cevap:" gibi ön ek kullanma.

ÖRNEKLER (sadece üslubu görmek için; aynen kopyalama, parantez içindekileri ASLA yazma):
- "Berkay motor sürebilir mi?" (olay: kasksız 85, tarz: net hayır) → En son kasksız bayır aşağı 85'le inip "kubiiii 85'i gördüm" diye bağırdı, sonra asfaltı da yakından gördü. Motor hâlâ travma tedavisinde, mal.
- "Berkay yemek yapabilir mi?" (olay: Popeyes, tarz: yapar ama rezil olur) → Yapar tabii: Popeyes'ı arar, siparişi verir, sonra "ben pişirdim" diye tabağa koyar. Geçen hafta su kaynatmayı denedi, tencere istifa etti.
- "Berkay astronot olabilir mi?" (olay yok, tarz: ironik evet) → Kesinlikle olur, NASA'nın aradığı isim tam o. Başvuru formunda "yer çekimi" kısmına gelince başı döndü ama olsun, uzayda nasılsa ayakta durmak gerekmiyor.
- "Berkay piyano çalabilir mi?" (olay yok, tarz: sorana dönüş) → Berkay piyanonun kapağını açamadı, sen de bu soruyu yazarken üç kere sildin, gördüm. İkiniz bir grup kurun, adı "Notasızlar" olsun.`;

// Bu soruya özel notlar system mesajına eklenir; kullanıcı mesajı SADECE sorudur.
// (Eskiden notlar soruyla aynı mesajdaydı, küçük modeller notları cevaba kopyalıyordu.)
function mesajlar(soru, olaylar, tarz, ekUyari) {
  const olayYazi = olaylar.length
    ? "Bu soruyla ilgili bilinen olay(lar): " + olaylar.map((o) => o.metin).join(" | ")
    : "Bu soruyla ilgili bilinen olay yok: konuya özel yeni ve absürt tek bir senaryo uydur, Berkay'ın geçmişinden hiçbir olaydan bahsetme.";
  const notlar = `\n\n--- BU SORU İÇİN GİZLİ NOTLAR (sadece senin için, cevapta ASLA yazma) ---\n${olayYazi}\nCevap tarzı: ${tarz.metin}${ekUyari ? "\n" + ekUyari : ""}`;
  return [
    { role: "system", content: SYSTEM_PROMPT + notlar },
    { role: "user", content: soru },
  ];
}

// ---------------- Nous Research ----------------
// Vercel'de NOUS_MODEL tanımlarsan önce o denenir.
const NOUS_MODEL_CANDIDATES = [
  process.env.NOUS_MODEL,
  "x-ai/grok-4.7",
  "qwen/qwen3.8-27b",
  "qwen/qwen3-30b-a3b-instruct-2507",
].filter(Boolean);

// Her model için en fazla bu kadar beklenir; cevap gelmezse sıradaki modele geçilir.
const MODEL_TIMEOUT_MS = 12000;
const SICAKLIK = 0.85;

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function temizle(text) {
  let t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "");
  // Model notları kopyaladıysa: son "Cevap:"dan sonrasını al
  const m = t.match(/[\s\S]*(?:^|\s|\n)(?:cevap|kâhin|kahin)\s*:\s*([\s\S]+)$/i);
  if (m) t = m[1];
  t = t
    .split(/\n+/)
    .filter((satir) => !/^\s*(bilinen olay|bu soruyla ilgili|cevap tarzı|soru\s*:|---|uyarı\s*:)/i.test(satir))
    .join(" ")
    .replace(/(bu soruyla ilgili )?bilinen olay\(?lar\)?\s*:[^.]*\.?/gi, "")
    .replace(/cevap tarzı\s*:\s*[A-ZÇĞİÖŞÜ ]+(:[^.]*\.)?/g, "")
    .replace(/^["“”']+|["“”']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}
// Notları hâlâ içeriyorsa ya da çok uzunsa bu cevap kullanılmaz
function bozukMu(t) {
  return !t || /bilinen olay|cevap tarzı|gizli not/i.test(t) || t.split(" ").length > 90;
}

async function askNousWithModel(model, apiKey, messages) {
  let response;
  try {
    response = await fetchWithTimeout("https://inference-api.nousresearch.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: 900, temperature: SICAKLIK }),
    }, MODEL_TIMEOUT_MS);
  } catch (err) {
    return { ok: false, retryable: true, detail: `Nous (${model}) ${err.name === "AbortError" ? "zaman aşımı" : "bağlantı hatası: " + err.message}` };
  }
  if (!response.ok) {
    const errText = await response.text();
    const authFailure = response.status === 401 || response.status === 403;
    return { ok: false, retryable: !authFailure, detail: `Nous (${model}) HTTP ${response.status}: ${errText.slice(0, 200)}` };
  }
  const data = await response.json();
  const choice = data?.choices?.[0];
  // Sadece gerçek cevabı al; modelin "düşünce" metnini asla gösterme.
  const text = temizle(choice?.message?.content || choice?.text || "");
  if (bozukMu(text)) return { ok: false, retryable: true, detail: `Nous (${model}) boş/bozuk cevap (finish_reason: ${choice?.finish_reason})` };
  return { ok: true, answer: text, model };
}

async function askNous(messages) {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Nous atlandı: NOUS_API_KEY tanımlı değil" };
  const failDetails = [];
  for (const model of [...new Set(NOUS_MODEL_CANDIDATES)]) {
    const result = await askNousWithModel(model, apiKey, messages);
    if (result.ok) return result;
    failDetails.push(result.detail);
    if (!result.retryable) break;
  }
  return { ok: false, detail: failDetails.join(" || ") };
}

// ---------------- Google Gemini (yedek) ----------------
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

async function askGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Gemini atlandı: GEMINI_API_KEY tanımlı değil" };
  const system = messages.find((m) => m.role === "system");
  const user = messages.find((m) => m.role === "user");
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system.content }] },
        contents: [{ role: "user", parts: [{ text: user.content }] }],
        generationConfig: { temperature: SICAKLIK, maxOutputTokens: 600 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
      }),
    },
    MODEL_TIMEOUT_MS
  );
  if (!response.ok) {
    const errText = await response.text();
    return { ok: false, detail: `Gemini HTTP ${response.status}: ${errText.slice(0, 300)}` };
  }
  const data = await response.json();
  const text = temizle(data?.candidates?.[0]?.content?.parts?.[0]?.text || "");
  if (bozukMu(text)) return { ok: false, detail: "Gemini boş/bozuk cevap döndü" };
  return { ok: true, answer: text, model: "gemini/" + GEMINI_MODEL };
}

async function uret(messages, attempts) {
  try {
    const nous = await askNous(messages);
    if (nous.ok) return nous;
    attempts.push(nous.detail || "Nous: bilinmeyen hata");
  } catch (err) {
    attempts.push("Nous hata: " + err.message);
  }
  try {
    const gemini = await askGemini(messages);
    if (gemini.ok) return gemini;
    attempts.push(gemini.detail || "Gemini: bilinmeyen hata");
  } catch (err) {
    attempts.push("Gemini hata: " + err.message);
  }
  return null;
}

// ---------------- Handler ----------------
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { question } = req.body || {};
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "Geçersiz soru" });
  }
  if (question.length > 300) return res.status(400).json({ error: "Soru çok uzun" });

  const soru = question.trim();
  const olaylar = olaySec(soru);
  const tarz = tarzSec();
  const attempts = [];

  let sonuc = await uret(mesajlar(soru, olaylar, tarz), attempts);

  // Kontrol: verilmeyen olaylardan bahsettiyse bir kez daha ürettir
  if (sonuc) {
    const fazla = alakasizOlaylar(sonuc.answer, olaylar);
    if (fazla.length) {
      const uyari = "UYARI: Önceki denemende sana verilmeyen olaylardan (" + fazla.map((o) => o.ad).join(", ") + ") bahsettin. Bu sefer onları KESİNLİKLE anma.";
      const ikinci = await uret(mesajlar(soru, olaylar, tarz, uyari), attempts);
      if (ikinci && alakasizOlaylar(ikinci.answer, olaylar).length < fazla.length) sonuc = ikinci;
    }
  }

  if (sonuc) {
    return res.status(200).json({
      answer: sonuc.answer,
      model: sonuc.model,
      olaylar: olaylar.map((o) => o.ad),
      tarz: tarz.metin.split(":")[0],
    });
  }

  console.error("Tüm AI sağlayıcıları başarısız:", attempts);
  return res.status(500).json({ error: "AI cevap üretemedi", detail: attempts.join(" | ") });
}
