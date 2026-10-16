export const NEWS_CSS = String.raw`
:root{color-scheme:dark;--news-bg:#0d1422;--news-panel:#162235;--news-line:#30445d;--news-text:#f1f5f9;--news-muted:#b8c9dc;--news-accent:#a8dcf2}
html:not(.lumi-authenticated) #lumiHealthNewsBtn{display:none!important}
#lumiHealthNewsBtn{display:block;width:calc(100% - 28px);box-sizing:border-box;margin:0 14px 12px;padding:12px 16px;border:1px solid #7cc5d9;border-radius:12px;background:#203b4b;color:#f3fbff;font:600 16px/1.4 system-ui;text-align:left;text-decoration:none;cursor:pointer}
#lumiHealthNewsBtn:hover{background:#2b4e61}#lumiHealthNewsBtn:focus-visible,.news-page a:focus-visible,.news-page button:focus-visible{outline:3px solid #a8dcf2;outline-offset:4px}
.news-page{margin:0;background:var(--news-bg);color:var(--news-text);font:17px/1.65 system-ui,-apple-system,sans-serif;min-height:100vh}.news-page *{box-sizing:border-box}.news-page a{color:var(--news-accent)}
.news-shell{max-width:880px;margin:auto;padding:28px 24px 64px}.news-nav{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:26px;border-bottom:1px solid var(--news-line)}.news-brand{font-weight:750;letter-spacing:.03em;color:var(--news-text)}.news-back{text-decoration:none;border:1px solid var(--news-line);padding:8px 14px;border-radius:12px;font-size:15px;min-height:44px}
.news-hero{padding:36px 0 26px}.news-kicker{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--news-accent);font-weight:700}.news-hero h1{font-size:clamp(30px,6vw,44px);line-height:1.15;letter-spacing:-.035em;margin:12px 0 16px}.news-hero p{color:var(--news-muted);max-width:620px;margin:0}.news-edition{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;color:var(--news-muted);font-size:14px;margin-bottom:24px}.news-edition strong{color:var(--news-text)}.news-reload{margin-left:auto;background:transparent;border:1px solid var(--news-line);border-radius:10px;color:var(--news-accent);padding:9px 14px;min-height:44px;font:inherit;cursor:pointer}.news-reload:disabled{opacity:.6}
.news-card{padding:26px;margin:0 0 18px;background:var(--news-panel);border:1px solid var(--news-line);border-radius:20px}.news-meta{display:flex;flex-wrap:wrap;gap:8px 14px;color:var(--news-muted);font-size:13px}.news-region{color:var(--news-accent);font-weight:650}.news-card h2{font-size:clamp(21px,3.8vw,26px);line-height:1.35;margin:14px 0}.news-summary{margin:0 0 22px;color:#dde6f1;overflow-wrap:anywhere}.news-source{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;border-top:1px solid var(--news-line);padding-top:16px;font-size:14px}.news-source span{color:var(--news-muted);overflow-wrap:anywhere}.news-source a{margin-left:auto;font-weight:650;text-underline-offset:4px;padding:5px 0;min-height:36px}.news-state{padding:28px;border:1px solid var(--news-line);border-radius:18px;background:var(--news-panel);color:var(--news-muted)}.news-note{font-size:14px;color:var(--news-muted);border-left:2px solid #537d91;padding-left:16px;margin:28px 0 0}.news-stale{color:#f6d395}
@media(max-width:520px){.news-shell{padding:20px 16px 44px}.news-nav{padding-bottom:20px}.news-hero{padding-top:28px}.news-card{padding:20px;border-radius:16px}.news-source{display:block}.news-source a{display:block;margin-top:8px}.news-reload{margin-left:0}.news-back{font-size:14px}}
`;
export const NEWS_HTML = String.raw`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d1422"><title>Notícias de Saúde · Lumi</title><link rel="icon" href="/icon-192.png"><link rel="stylesheet" href="/health-news-ui.css?v=1"><script src="/health-news-ui.js?v=1" defer></script></head><body class="news-page"><main class="news-shell"><nav class="news-nav" aria-label="Navegação"><span class="news-brand">Lumi <span aria-hidden="true">💙</span></span><a class="news-back" href="/">← Voltar à Lumi</a></nav><header class="news-hero"><span class="news-kicker">Informação para cuidar melhor</span><h1>Notícias de Saúde</h1><p>Parkinson e envelhecimento saudável, com fontes brasileiras e internacionais e resumos em português.</p></header><div class="news-edition"><span id="newsEdition">Consultando o boletim…</span><button id="newsReload" class="news-reload" type="button">Recarregar boletim</button></div><section id="newsItems" aria-label="Notícias do boletim" aria-live="polite" aria-busy="true"><p class="news-state" role="status">Carregando notícias verificadas…</p></section><p class="news-note">A data exibida em cada notícia é a publicação original. Publicamos apenas os itens que passaram pela verificação; por isso, a quantidade pode variar. Este conteúdo é informativo e não substitui uma consulta.</p><noscript><p class="news-state">Ative o JavaScript para ler o boletim.</p></noscript></main></body></html>`;
export const NEWS_SCRIPT = String.raw`(()=>{
'use strict';
if(location.hostname!=='lumi-develop.psanchesnle.workers.dev')return;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
if(!document.querySelector('.news-page')){
 if(document.getElementById('lumiHealthNewsBtn'))return;
 const button=el('a','','📰 Notícias de Saúde');button.id='lumiHealthNewsBtn';button.href='/noticias';
 const anchor=document.getElementById('lumiMindBodyMobile')||document.getElementById('lumiExerciseBtn');
 if(anchor)anchor.before(button);else{const host=document.querySelector('.app');if(host)host.append(button);}
 return;
}
const box=document.getElementById('newsItems'),edition=document.getElementById('newsEdition'),reload=document.getElementById('newsReload');
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return 'Data indisponível';return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));}
function state(message){box.replaceChildren(el('p','news-state',message));}
function card(item){
 let url;try{url=new URL(item.url);if(url.protocol!=='https:'||url.username||url.password)return null;}catch{return null;}
 if(item.dateVerified!==true||!item.publishedAt||!item.title||!item.summary)return null;
 const article=el('article','news-card'),meta=el('div','news-meta');
 meta.append(el('span','news-region',item.region==='Brasil'?'Brasil':'Internacional'));
 const published=el('time','','Publicado em '+date(item.publishedAt));published.dateTime=item.publishedAt;meta.append(published);
 article.append(meta,el('h2','',item.title),el('p','news-summary',item.summary));
 const footer=el('div','news-source');footer.append(el('span','','Fonte: '+(item.source||url.hostname)));
 const link=el('a','','Ler na fonte original ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';footer.append(link);article.append(footer);return article;
}
let running=false;
async function load(){if(running)return;running=true;reload.disabled=true;box.setAttribute('aria-busy','true');
 try{
  const response=await fetch('/health-news',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('unavailable');const data=await response.json();
  if(data.policyVersion!==2||!Array.isArray(data.items))throw Error('unverified');
  const cards=data.items.map(card).filter(Boolean);box.replaceChildren(...cards);
  if(!cards.length)state('Ainda não há notícias verificadas disponíveis. Consulte novamente mais tarde.');
  edition.replaceChildren(el('strong','','Boletim de '+date(data.date)),document.createTextNode(' · '+cards.length+(cards.length===1?' notícia verificada':' notícias verificadas')));
  if(data.stale){edition.classList.add('news-stale');edition.append(document.createTextNode(' · Última edição disponível'));}else edition.classList.remove('news-stale');
 }catch{edition.textContent='Boletim indisponível no momento';state('Não consegui carregar as notícias agora. Use “Recarregar boletim” para tentar novamente.');}
 finally{running=false;reload.disabled=false;box.setAttribute('aria-busy','false');}
}
reload.addEventListener('click',load);load();
})();`;
