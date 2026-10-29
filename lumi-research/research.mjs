import {runtimeCompanionInstructions,removeUnsolicitedOffers} from '../lumi-ativa-integration/companion-instructions.mjs';
/**
 * Lumi research adapter, used only by the development Worker.
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
  const weather=/\b(?:clima|weather|forecast|chover|chovendo|rain|raining)\b|previs[aã]o\s+(?:do\s+)?tempo|(?:como (?:est[aá]|vai estar)|qual[^?]{0,30})\s+o tempo|tempo\s+(?:hoje|amanh[aã]|em|para)\b|(?:temperatura|temperature)\s+(?:hoje|amanh[aã]|em|para|in|today)\b/i.test(input);
  // A weather card can contain text without URL annotations. Never display it
  // as sourced research: make at most one new, page-based search instead.
  const deadline=Date.now()+45000;
  for(let attempt=0;attempt<2;attempt++) {
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal:AbortSignal.timeout(Math.max(1,Math.min(30000,deadline-Date.now()))),
    // Cloudflare Workers requires manual; non-2xx responses fail below.
    redirect:'manual',
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      max_tool_calls: 3,
      max_output_tokens: tokenLimit,
      input: [
        { role: 'developer', content: runtimeCompanionInstructions(now,language)+'\nAnswer this research question only. Search now and cite supporting web pages inline using URL citation annotations. Keep the answer under 150 words. Report source update dates when present, and explicitly say when those dates could not be verified. Use specific pages supporting each claim; for weather and alerts include the location and validity period supported by the source. Do not infer an official warning from a general forecast or homepage. Never offer reminders, monitoring or future follow-ups.'+(weather?' For weather, search public forecast web pages, not weather cards or widgets. Use Celsius, give a brief forecast, and omit hourly tables. Only mention an official alert when its specific cited page supports its location and validity period.':'')+(attempt?' The preceding attempt could not be verified. Run a fresh web search for specific supporting pages and include inline URL citations. Do not repeat an uncited answer, create URLs, or use a weather widget.':'') },
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
    if(attempt===0)continue;
    return { status: 'unverified', answer: 'A pesquisa não retornou fontes verificáveis.', citations: [] };
  }
  if(weather&&!citations.some(c=>{const u=new URL(c.url);return u.pathname!=='/'&&u.pathname!=='';})){
    if(attempt===0)continue;
    return {status:'unverified',answer:'Não encontrei uma página específica que confirme a previsão ou o alerta atual.',citations:[]};
  }
  return { status: 'complete', answer: removeUnsolicitedOffers(text), citations:[...new Map(citations.map(c=>[c.url,c])).values()],researchedAt };
  }
}

