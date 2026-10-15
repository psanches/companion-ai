// Lumi Develop — boletim diário de saúde (dados públicos, sem dados pessoais).
// Integração pendente: importar generateHealthDigest no Worker e configurar
// cron "0 9 * * *" (06:00 America/Sao_Paulo, UTC-03) e KV HEALTH_NEWS_KV.
// Não habilitar o cron antes de configurar o binding e validar o Worker.
const KEY = "health-news:latest";
const HISTORY_PREFIX = "health-news:date:";
const MODEL = "gpt-5-mini";

function dayInBrazil(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric",
    month: "2-digit", day: "2-digit"
  }).format(date);
}

function extractText(data) {
  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(part => part.type === "output_text" && typeof part.text === "string")
    .map(part => part.text).join("\n").trim();
}

function normalizeDigest(text, date) {
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^\`\`\`(?:json)?\s*|\s*\`\`\`$/g, ""));
  } catch {
    throw new Error("Research returned invalid JSON");
  }
  if (!Array.isArray(parsed.items) || parsed.items.length !== 5)
    throw new Error("Research must contain exactly five stories");
  const items = parsed.items.map(item => {
    if (typeof item.title !== "string" || !item.title.trim() ||
        typeof item.summary !== "string" || !item.summary.trim() ||
        typeof item.source !== "string" || !item.source.trim() ||
        typeof item.url !== "string")
      throw new Error("Incomplete news story");
    let url;
    try { url = new URL(item.url); } catch { throw new Error("Invalid source URL"); }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Source must be a public HTTPS URL");
    return {title:item.title.trim().slice(0,180),
      summary:item.summary.trim().slice(0,900),
      source:item.source.trim().slice(0,120), url:url.toString()};
  });
  return {date, title:"Notícias de Saúde", items,
    generatedAt:new Date().toISOString()};
}

/** Generate once per Brazilian calendar day; retain last good edition on failure. */
export async function generateHealthDigest(env, now = new Date()) {
  if (!env?.HEALTH_NEWS_KV || !env?.OPENAI_API_KEY)
    throw new Error("HEALTH_NEWS_KV and OPENAI_API_KEY are required");
  const date = dayInBrazil(now);
  const existing = await env.HEALTH_NEWS_KV.get(HISTORY_PREFIX + date, "json");
  if (existing) return existing;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{"Authorization": "Bearer " + env.OPENAI_API_KEY,
      "Content-Type":"application/json"},
    body:JSON.stringify({
      model:MODEL, tools:[{type:"web_search"}],
      max_output_tokens:2500,
      input:"Pesquise notícias verificáveis de saúde publicadas preferencialmente nas últimas 24 horas, até " +
        date + " (horário de Brasília). Se não houver cinco notícias recentes relevantes, " +
        "use notícias de até sete dias e deixe a data clara no resumo. " +
        "Priorize Brasil, saúde pública, prevenção, medicina e pesquisa científica. " +
        "Evite sensacionalismo, aconselhamento médico individual e fontes não verificadas. " +
        "Retorne SOMENTE JSON válido: {\"items\":[{\"title\":\"...\",\"summary\":\"...\",\"source\":\"...\",\"url\":\"https://...\"}]} " +
        "com exatamente cinco itens e links diretos para matérias ou fontes originais. " +
        "Nunca invente URLs. Resumos em português do Brasil."
    })
  });
  if (!response.ok) throw new Error("Research API error: " + response.status);
  const data = await response.json();
  const digest = normalizeDigest(extractText(data), date);
  // History first; latest is updated only after a valid complete digest.
  await env.HEALTH_NEWS_KV.put(HISTORY_PREFIX + date, JSON.stringify(digest), {
    expirationTtl:60 * 60 * 24 * 45
  });
  await env.HEALTH_NEWS_KV.put(KEY, JSON.stringify(digest));
  return digest;
}

export async function getLatestHealthDigest(env) {
  if (!env?.HEALTH_NEWS_KV) throw new Error("HEALTH_NEWS_KV is required");
  return env.HEALTH_NEWS_KV.get(KEY, "json");
}

export const HEALTH_NEWS_CRON_UTC = "0 9 * * *";
