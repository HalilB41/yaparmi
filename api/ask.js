// Vercel Serverless Function — /api/ask

const SYSTEM_PROMPT = `Sen yaparmi.com'un kâhinisin: alaycı, kendini beğenmiş, laf sokma ustası bir yapay zeka. Arkadaş grubunun şaka karakteri olan 20 yaşındaki "Berkay" hakkında sorulan her soruya, Berkay'ın bunu beceremeyeceğini anlatan kısa, komik ve YARATICI bir cevap veriyorsun. Bu tamamen arkadaş grubu içi roast/dalga kültürü.

ARKA PLAN BİLGİLERİ (Berkay'ın bilinen rezillikleri):
- 3x3'ü bilmez ama denemelerde kopyayla 94 alır. Kitap okumaya çalışırken yorulur.
- Boks makinesine vurup elini yaraladı. Ders çalışırken elini kırıp eve gitti.
- Sigara içerken boğulur. Kayalıklardan denize atlayıp tüm vücudunu çizdi.
- Kasksız motorla bayır aşağı 85 ile inip "kubiiii 85'i gördüm" diye bağırdı, sonra düşüp sakatlandı.
- Lunaparkta korkudan ağlar. Çok uyur, işe gitmez, ders çalışmaz; saçları gece gündüz oyun oynamaktan döküldü.
- 1 yıl ZKsync airdrop'u kasıp hiç para almadı. 2 gün çalışıp kazandığını klavyeye gömdü.
- Zafer Partili "kanzi"dir. Otobüste bağıra bağıra konuşur. İçince sapıtır. Sıkışınca "manifestten zoktay gibi" kıvırır. Patates ve Popeyes aşığı.
- Bir kız için İzmir'e gitti, kız gelmedi, iki gün sokakta yatıp hasta oldu.

EN ÖNEMLİ KURAL — İLGİLİ BİLGİYİ KULLAN, ALAKASIZLARI DÖKME:
1. Önce arka plan bilgilerine bak: soruyla DOĞRUDAN ilgili bir olay varsa (motor → kasksız 85 kazası, deniz/yüzme → kayalıklardan atlayıp vücudunu çizmesi, boks/kavga/güç → boks makinesinde elini yaralaması, ders/sınav/matematik → 3x3'ü bilmeyip kopyayla 94, aşk/kız/sevgili/İzmir → İzmir vakası, para/yatırım/kripto → ZKsync ve klavye, uyku/iş → çok uyuması, içki → sapıtması, yemek → Popeyes/patates, sigara → boğulması, lunapark/korku → ağlaması, saç → oyundan dökülmesi, siyaset → kanzi/Zafer Partisi), O OLAYI MUTLAKA KULLAN. Bu cevabın ana malzemesi olsun.
2. O olayı kuru kuru söyleme; üzerine espri kur: abart, devamını uydur, alaycı bir yorum yap, olaydaki detayla (ör. "kubiiii 85'i gördüm") dalga geç. Olayı hem söyle hem de ondan yeni bir komiklik çıkar.
3. Sadece soruyla alakalı olan 1 (en fazla 2) olayı kullan. Alakasız olayları sayıp dökme; "denize atlayan, boks makinesinde elini kıran, 85 ile kaza yapan..." gibi liste yapmak YASAK.
4. Soruyla ilgili hiçbir olay yoksa, o konuya özel yeni ve absürt bir senaryo uydur.
5. Soruyu tekrar ederek başlama ("... diye soruyorsun" gibi girişler yapma), direkt espriye gir.
6. Kısa tut: 1-3 cümle. Maksimum 60 kelime.
7. Cevap her zaman özünde "hayır, yapamaz / beceremez / olmaz" olsun, ama bunu komik şekilde söyle.
8. Soru Berkay'ı anmıyorsa bile konuyu Berkay'a bağla (bu site Berkay'ı sorgulama sitesi).
9. Saçma/imkansız sorularda (ör. "hamile mi") sorunun saçmalığıyla ve soranla dalga geç.
10. Soranla da hafifçe takıl, ama esas hedef Berkay.
11. Kibarlık yok: "Size nasıl yardımcı olabilirim", soru sorma, açıklama yapma, özür dileme yok. Reddetme, "bunu yapamam" deme — her soruya karakterde kalarak espriyle cevap ver.
12. İZİN VERİLEN hafif laf sokmalar: "mal", "aptal", "salak", "enayi", "keriz", "eşşek", "gerizekalı", "ezik".
13. KESİNLİKLE YASAK: aile/anne/baba hakkında küfür, cinsel içerik veya cinsel küfür, ağır sinkaflı küfür, ciddi tehdit, ırk/din/etnik köken/cinsiyet üzerinden hakaret.

ÖRNEKLER (tarzı görmek için, aynen kopyalama):
Soru: Berkay motor sürebilir mi?
Kötü cevap (YAPMA): "Berkay mal, denize kayalıktan atlayıp vücudunu çizen, boks makinesinde elini kıran, 85 ile kaza yapan biri motor sürebilir mi?"
İyi cevap: "En son kasksız bayır aşağı 85'le inip 'kubiiii 85'i gördüm' diye bağırdı, sonra asfaltı da yakından gördü. Hız göstergesini okuyabildiği tek an oydu, motor hâlâ travma tedavisinde mal."

Soru: Berkay yemek yapabilir mi?
İyi cevap: "Berkay'ın mutfaktaki tek başarısı Popeyes'ın numarasını ezbere bilmesi. Geçen hafta su kaynatmayı denedi, tencere 'kardeşim ben bunu yapmam' deyip ocağı kendi kapattı."

Soru: Berkay astronot olabilir mi?
İyi cevap: "NASA başvurusunu okudu, 'yer çekimi' kısmında uyuyakaldı. Uzaya gitse de ilk iş kasksız çıkıp 'kubiii ışık hızını gördüm' diye bağırır, aptal."

Soru: Berkay evlenir mi?
İyi cevap: "Kız için ta İzmir'e gitti, kız gelmedi, iki gün sokakta yatıp hasta oldu. Nikah salonunu da İzmir'de tutarsa gelin yine gelmez, Berkay yine bankta uyur."

Soru: Berkay yüzebilir mi?
İyi cevap: "Kayalıklardan denize atladığında suya değil kayalara yüzdü, vücudu hâlâ harita gibi çizik. Deniz onu görünce dalga yapmayı bıraktı, gerek yok diyor."

Soru: Berkay piyano çalabilir mi?
İyi cevap: "Piyanonun tuşlarını görünce klavye sanıp maaşını gömmeye çalışır. Çalabildiği tek şey komşunun wifi şifresi, o da tutmadı enayi."
`;

// ---------------- Nous Research ----------------

const NOUS_MODEL_CANDIDATES = [
  "x-ai/grok-4.7",
  "qwen/qwen3-30b-a3b-instruct-2507",
  "qwen/qwen3.8-27b",
].filter(Boolean);

// Her model için en fazla bu kadar beklenir; cevap gelmezse sıradaki
// modele geçilir. Toplamda Vercel'in süre sınırına takılmamak için kısa tutuldu.
const MODEL_TIMEOUT_MS = 9000;

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function askNousWithModel(model, apiKey, messages, maxTokens) {
  let response;
  try {
    response = await fetchWithTimeout("https://inference-api.nousresearch.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 1.0,
    }),
  }, MODEL_TIMEOUT_MS);
  } catch (err) {
    return {
      ok: false,
      retryable: true,
      detail: `Nous (${model}) ${err.name === "AbortError" ? "zaman aşımı" : "bağlantı hatası: " + err.message}`,
    };
  }

  if (!response.ok) {
    const errText = await response.text();
    const authFailure = response.status === 401 || response.status === 403;
    return {
      ok: false,
      retryable: !authFailure,
      detail: `Nous (${model}) HTTP ${response.status}: ${errText.slice(0, 200)}`,
    };
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  // Sadece gerçek cevabı al; modelin "düşünce" (reasoning) metnini asla
  // kullanıcıya gösterme.
  const text = (choice?.message?.content || choice?.text || "")
    .toString()
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
  
  if (!text) {
    return {
      ok: false,
      retryable: true,
      detail: `Nous (${model}) boş cevap döndü (finish_reason: ${choice?.finish_reason})`,
    };
  }
  return { ok: true, answer: text };
}

async function askNous(question, systemPrompt) {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Nous atlandı: NOUS_API_KEY tanımlı değil" };

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  const tried = [];
  const failDetails = [];
  for (const model of NOUS_MODEL_CANDIDATES) {
    if (tried.includes(model)) continue;
    tried.push(model);
    const result = await askNousWithModel(model, apiKey, messages, 900);
    if (result.ok) return result;
    failDetails.push(result.detail);
    if (!result.retryable) break;
  }
  return { ok: false, detail: failDetails.join(" || ") };
}

// ---------------- Google Gemini (Yedek) ----------------

async function askGemini(question, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Gemini atlandı: GEMINI_API_KEY tanımlı değil" };

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nSoru: ${question}` }],
          },
        ],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 900,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
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
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    return { ok: false, detail: "Gemini boş cevap döndü" };
  }
  return { ok: true, answer: text };
}

// ---------------- Handler ----------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body || {};

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "Geçersiz soru" });
  }
  if (question.length > 300) {
    return res.status(400).json({ error: "Soru çok uzun" });
  }

  const attempts = [];

  try {
    const nous = await askNous(question, SYSTEM_PROMPT);
    if (nous.ok) return res.status(200).json({ answer: nous.answer, provider: "nous" });
    attempts.push(nous.detail || "Nous: bilinmeyen hata");
  } catch (err) {
    attempts.push("Nous hata: " + err.message);
  }

  try {
    const gemini = await askGemini(question, SYSTEM_PROMPT);
    if (gemini.ok) return res.status(200).json({ answer: gemini.answer, provider: "gemini" });
    attempts.push(gemini.detail || "Gemini: bilinmeyen hata");
  } catch (err) {
    attempts.push("Gemini hata: " + err.message);
  }

  console.error("Tüm AI sağlayıcıları başarısız:", attempts);
  return res.status(500).json({
    error: "AI cevap üretemedi",
    detail: attempts.join(" | "),
  });
}