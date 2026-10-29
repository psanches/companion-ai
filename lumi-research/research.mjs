import {runtimeCompanionInstructions,removeUnsolicitedOffers} from '../lumi-ativa-integration/companion-instructions.mjs';
/**
 * Lumi research adapter, development-only and not wired to the live Worker.
 * No credentials or user data are stored by this module.
 * Inject fetcher, API key, and authorization at the server boundary.
 */
const MAX_QUESTION = 1200;
export function validateResearchQuestion(question) {
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_QUESTION) {
    throw new TypeError('Research question must be 1–1200 characters');
  }
  return question.trim();
}
export function canPromiseFollowUp(job) {
  return Boolean(job && job.persisted === true && typeof job.id === 'string' &&
    job.id.length > 0 && job.deliveryConfigured === true);
}
export async function researchNow({ question, apiKey, fetcher, authorized, maxOutputTokens = 600, now = new Date(), language=null }) {
  const input = validateResearchQuestion(question);
  if (authorized !== true) return { status: 'denied', answer: 'Pesquisa não autorizada.' };
  if (typeof apiKey !== 'string' || !apiKey || typeof fetcher !== 'function') {
    return { status: 'unavailable', answer: 'Não consigo pesquisar ao vivo agora.' };
  }
  const tokenLimit = Number.isFinite(maxOutputTokens)?Math.min(800, Math.max(100, Math.floor(maxOutputTokens))):600;
  const researchedAt=now.toISOString();
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal:AbortSignal.timeout(30000),
    // Cloudflare Workers requires manual; non-2xx responses fail below.
    redirect:'manual',
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      max_output_tokens: tokenLimit,
      input: [
        { role: 'developer', content: runtimeCompanionInstructions(now,language)+'\nAnswer this research question only. Search now, report source update dates when present, and explicitly say when those dates could not be verified. Use specific pages supporting each claim; for weather and alerts include the location and validity period supported by the source. Do not infer an official warning from a general forecast or homepage. Never offer reminders, monitoring or future follow-ups.' },
        { role: 'user', content: input }
      ]
    })
  });
  if (!response.ok) return { status: 'failed', answer: 'A pesquisa não pôde ser concluída agora.' };
  const result = await response.json();
  const output = Array.isArray(result.output) ? result.output : [];
  const searched = output.some(item => item.type === 'web_search_call' && item.status === 'completed');
  if(result.status&&result.status!=='completed')return {status:'unverified',answer:'A pesquisa não foi concluída com uma resposta verificável.',citations:[]};
  const text = output.flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(part => part.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text).join('\n').trim();
  const citations = output.flatMap(item => Array.isArray(item.content) ? item.content : [])
    .flatMap(part => Array.isArray(part.annotations) ? part.annotations : [])
    .filter(a => a.type === 'url_citation' && typeof a.url === 'string')
    .filter(a=>{try{const url=new URL(a.url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}})
    .map(a => ({ url: a.url, title: a.title || a.url }));
  if (!text) return { status: 'failed', answer: 'Não encontrei uma resposta verificável.' };
  if (!searched || !citations.some(c => /^https:\/\//.test(c.url))) {
    return { status: 'unverified', answer: 'A pesquisa não retornou fontes verificáveis.', citations: [] };
  }
  const weather=/\b(?:clima|weather|forecast)\b|previs[aã]o\s+(?:do\s+)?tempo|tempo\s+(?:hoje|amanh[aã]|em|para)\b/i.test(input);
  if(weather&&!citations.some(c=>{const u=new URL(c.url);return u.pathname!=='/'&&u.pathname!=='';}))return {status:'unverified',answer:'Não encontrei uma página específica que confirme a previsão ou o alerta atual.',citations:[]};
  return { status: 'complete', answer: removeUnsolicitedOffers(text), citations:[...new Map(citations.map(c=>[c.url,c])).values()],researchedAt };
}

