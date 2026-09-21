// Vercel Serverless Function — /api/chat
// "Berkayın Ahırı" bölümündeki serbest sohbet. Önce Nous Research, o
// başarısız olursa Gemini dener (ask.js ile aynı mantık, farklı karakter).

const CHAT_SYSTEM_PROMPT = `Sen "yaparmi.com" sitesinin "Berkayın Ahırı" bölümünde yaşayan, küstah, kendinden emin, laf sokmayı seven ama temelde sevimli bir karakter olan "Ahır Kahini"sin.

Kullanıcı ile "Berkay" adlı efsanevi (abartılı, şehir efsanesi/kurgu tadında) bir karakter üzerinden sohbet ediyor ve arada küçük bilgi yarışması tadında sorular soruyorsun.

KURALLAR:
1. Sohbeti sen yönlendirebilirsin: Berkay hakkında (spor, ders, sosyal hayat, oyun gibi konularda) abartılı, açıkça efsane/şehir efsanesi havasında komik bir iddia veya soru sor. "Rivayete göre", "duyduğuma göre" gibi ifadeler kullanarak bunun kesin gerçek değil, şaka/efsane olduğunu hissettir. Asla belirli, gerçek biriyle ilgiliymiş gibi kesin/iddialı "doğru bilgi" sunma.
2. Kullanıcıyla küstah ve iğneleyici bir tonda takıl ama GERÇEKTEN aşağılama, küfür etme, ağır hakaret etme, cinsellik içeren veya nefret söylemi içeren hiçbir şey söyleme. Takılman "kanka seviyesinde sert şaka" olsun, gerçek bir hakaret olmasın.
3. Kullanıcının gerçek kimliği, görünüşü, ailesi, ırkı, dini gibi hassas/kişisel konulara asla girme — sadece Berkay ile ilgili kurgusal esprili senaryolar ve hafif kanka takılmaları yap.
4. Cevapların KISA olsun: en fazla 2-3 cümle. Türkçe, samimi-küstah bir gençlik dili kullan. Emoji kullanabilirsin ama abartma.
5. Kullanıcı sana normal bir şey sorarsa (esprili olmayan bir soru), yine kendi küstah tonunda ama makul bir şekilde cevap ver.`;

// Nous Portal katalogundaki gerçek model kimlikleri "saglayici/model-adi"
// formatında (kullanıcının kendi Portal panelinden doğrulandı — ör.
// google/gemini-3.8-flash, z-ai/glm-5.3-flash). "Hermes-4-70B" gibi Nous'un
// kendi modelleri hesapta artık bulunmadığı/emekli olduğu için, Portal
// üzerinden erişilebilen genel amaçlı modelleri deniyoruz. Birden fazla
// aday tutuyoruz ki biri kapanır/değişirse site otomatik diğerine geçsin.
const NOUS_MODEL_CANDIDATES = [
  process.env.NOUS_MODEL,
  "google/gemini-3.8-flash",
  "z-ai/glm-5.3-flash",
  "qwen/qwen3-30b-a3b-instruct-2507",
].filter(Boolean);

async function askNousWithModel(model, apiKey, messages) {
  const response = await fetch("https://inference-api.nousresearch.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 200,
      temperature: 1.1,
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
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, retryable: false, detail: `Nous (${model}) boş cevap döndü` };
  }
  return { ok: true, reply: text };
}

async function askNous(messages) {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Nous atlandı: NOUS_API_KEY tanımlı değil" };

  const tried = [];
  const failDetails = [];
  for (const model of NOUS_MODEL_CANDIDATES) {
    if (tried.includes(model)) continue;
    tried.push(model);
    const result = await askNousWithModel(model, apiKey, messages);
    if (result.ok) return result;
    failDetails.push(result.detail);
    if (!result.retryable) break;
  }
  return { ok: false, detail: failDetails.join(" || ") };
}

async function askGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Gemini atlandı: GEMINI_API_KEY tanımlı değil" };

  // Gemini formatı farklı: system ayrı, geri kalanı user/model rolleriyle.
  const systemMsg = messages.find((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        contents,
        generationConfig: {
          temperature: 1.1,
          maxOutputTokens: 300,
          thinkingConfig: { thinkingBudget: 0 },
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
  if (!text) return { ok: false, detail: "Gemini boş cevap döndü" };
  return { ok: true, reply: text };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, message, history } = req.body || {};

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Geçersiz mesaj" });
  }
  if (message.length > 300) {
    return res.status(400).json({ error: "Mesaj çok uzun" });
  }
  const safeUsername =
    typeof username === "string" && username.trim() ? username.trim().slice(0, 20) : "kanka";

  const priorHistory = Array.isArray(history) ? history.slice(-10) : [];
  const cleanHistory = priorHistory
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 300) }));

  const messages = [
    { role: "system", content: `${CHAT_SYSTEM_PROMPT}\n\nKullanıcının adı: ${safeUsername}.` },
    ...cleanHistory,
    { role: "user", content: message },
  ];

  const attempts = [];

  try {
    const nous = await askNous(messages);
    if (nous.ok) return res.status(200).json({ reply: nous.reply, provider: "nous" });
    attempts.push(nous.detail || "Nous: bilinmeyen hata");
  } catch (err) {
    attempts.push("Nous hata: " + err.message);
  }

  try {
    const gemini = await askGemini(messages);
    if (gemini.ok) return res.status(200).json({ reply: gemini.reply, provider: "gemini" });
    attempts.push(gemini.detail || "Gemini: bilinmeyen hata");
  } catch (err) {
    attempts.push("Gemini hata: " + err.message);
  }

  console.error("Ahır sohbeti: tüm AI sağlayıcıları başarısız:", attempts);
  return res.status(500).json({
    error: "AI cevap üretemedi",
    detail: attempts.join(" | "),
  });
}
