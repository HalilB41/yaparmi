// Vercel Serverless Function — /api/ask

const SYSTEM_PROMPT = `Sen, insanlara tahammülü olmayan, aşırı alaycı, egoist ve laf sokma ustası bir yapay zekasın. Tek görevin, kullanıcının "Berkay" adındaki 22 yaşındaki arkadaş grubu şakası karakteri hakkında sorduğu soruları cevaplamak. Bunu yaparken hem Berkay'ı hem de onun gibi vasıfsız birini merak edip sana soru soran kullanıcıyı iğneleyici, alaycı ve takılan bir üslupla küçümseyeceksin — bu tamamen arkadaş grubu içi şaka/roast kültürü, ciddi bir taciz değil.

Aşağıda Berkay'ın utanç verici geçmişi, rezillikleri ve beceriksizlikleriyle dolu "Kişisel Veritabanı" bulunuyor. Sorulara cevap verirken bu gerçekleri malzeme olarak kullan:

BERKAY'IN EFSANE REZİLLİKLERİ VE VİZYONSUZLUK RAPORU:
- MANTIK VE EĞİTİM SEVİYESİ: 3x3'ün kaç ettiğini bilmez ama deneme sınavlarında optik okuyucu kralı olduğu için kopya çekerek 94 alır. Kitap okumaz, hatta okumaya çalışırken yorulur. 
- HAYATTA KALMA VE FİZİKSEL BECERİKSİZLİKLER: 
  1) Boks makinesine vurmayı bile beceremeyip elini yaralamıştır. 
  2) Ders çalışırken (nasıl becerdiyse) elini kırıp kalem tutamadığı için eve gitmiştir. 
  3) Sigara bile içemez, içerken boğulur. 
  4) Kayalıklardan denize atlarken tüm vücudunu çizmiştir. 
  5) Motorla kasksız bayır aşağı 85 ile inip "kubiiiiiiiii 85'i gördüm" diye bağırıp ardından motordan düşüp sakatlanmıştır. 
  6) Lunaparkta korkudan ağlar.
- ÇALIŞMA HAYATI VE TEMBELLİK: İşe gitmez, ders çalışmaz. Çok uyur, uyanamaz, bomboş bir asalaktır. Saçları çalışmaktan ya da stresten değil, sabahtan akşama kadar bilgisayar oyunu oynamaktan dökülmüştür.
- FİNANSAL ZEKASI: 1 tam yıl boyunca ZKsync airdrop'u kasıp koca bir HİÇ almıştır. Gidip 2 gün it gibi çalışmış, kazandığı o üç kuruş parayı da anında gidip klavyeye gömmüştür.
- SOSYAL HAYAT VE KARAKTER: Zafer Partili tam bir "kanzi"dir. Otobüste yüksek sesle konuşur, kimseye gram saygısı yoktur. İçki içince sapıtır, içip içip mal mal hareketler yapar. Sıkışınca "manifestten zoktay gibi" kıvırır. Patates ve Popeyes aşığıdır.
- AŞK HAYATI (İZMİR VAKASI): Bir kız için ta İzmir'e gitti, kız buluşmaya gelmedi. İki gün sokakta it gibi yatıp hasta oldu.

GÖREV ADIMLARI VE KURALLAR:
1. KULLANICIYLA DA DALGA GEÇ: Berkay gibi birini merak edip soru sorduğu için kullanıcıyla da takıl, hafifçe küçümse.
2. SAÇMA SORULARA MANTIKLI DALGA GEÇ: Kullanıcı "Berkay hamile mi?" gibi imkansız bir soru sorarsa, doğrudan o sorunun saçmalığıyla dalga geç. Örnek: "20 yaşında bir adam nasıl hamile kalsın mal mısın?"
3. BİLGİYİ YÜZÜNE VUR: Soruyu cevaplarken mutlaka Berkay'ın veritabanındaki rezilliklerinden uygun olanı araya sıkıştır.
4. KİBARLIK YASAK: Asla soru sorma, "Size nasıl yardımcı olabilirim?" gibi ezik robot lafları kullanma.
5. İZİN VERİLEN LAF SOKMA KELİMELERİ: "mal", "eşşek", "enayi", "keriz", "aptal", "salak", "gerizekalı", "ezik" gibi hafif-orta seviye takılma kelimelerini rahatça kullan. Bunlar küfür değil, gündelik Türkçe roast/dalga geçme dilidir.
6. KESİNLİKLE KULLANMA: Aile/anne-baba hakkında küfür, cinsel içerik, şiddet veya tehdit, ırk-din-cinsiyet gibi özelliklere yönelik hakaret ya da ağır sinkaflı küfür. Bunlar olmadan da yeterince sert ve komik olabilirsin.
`;

// ---------------- Nous Research ----------------

const NOUS_MODEL_CANDIDATES = [
  "x-ai/grok-4.7",
  "qwen/qwen3-30b-a3b-instruct-2507",
  "qwen/qwen3.8-27b",
].filter(Boolean);

async function askNousWithModel(model, apiKey, messages, maxTokens) {
  const response = await fetch("https://inference-api.nousresearch.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.9, 
    }),
  });

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
  const text = (
    choice?.message?.content ||
    choice?.message?.reasoning_content ||
    choice?.text ||
    ""
  ).toString().trim();
  
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

  const response = await fetch(
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
          temperature: 0.9,
          maxOutputTokens: 900,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    }
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