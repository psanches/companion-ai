import test from 'node:test';import assert from 'node:assert/strict';
import {generateHealthNewsPreview,selectEditorialStories,NEWS_PREVIEW_POLICY} from './health-news-preview.mjs';
const day='2026-10-24',evidence='National guidance applies to people throughout the country and supports better public health.';
const story=(id,host='www.nih.gov',text=evidence,date=day)=>({url:`https://${host}/news/${id}`,publishedAt:date,ageDays:(Date.parse(day)-Date.parse(date))/86400000,source:host,region:host.endsWith('.br')?'Brasil':'Internacional',sourceText:text,kind:'noticia'});
const review=(id,extra={})=>({id,scope:'national',localFocus:false,scopeEvidence:evidence,importance:8,reason:'Orientação com alcance nacional',topicKey:'unique-'+id,title:'Notícia verificada '+id,summary:'Resumo fiel da matéria. Explica seu alcance.',...extra});
test('official Parkinson comes first regardless of general-news score, maximum ten, dates visible',()=>{
 const stories=Array.from({length:15},(_,i)=>story(i));stories.push(story('pd','www.michaeljfox.org','Parkinson research. '+evidence));
 const reviews=stories.map((s,i)=>review(i,{importance:i===15?7:10})),items=selectEditorialStories(stories,reviews,day);
 assert.equal(items.length,10);assert.equal(items[0].priority,0);assert.match(items[0].url,/michaeljfox/);assert.ok(items.every(s=>s.dateVerified&&s.publishedAt===day&&!('sourceText'in s)));
});
test('regional/unknown topics rejected even on national official domains; missing evidence and low scores rejected',()=>{
 const stories=[story(0),story(1),story(2),story(3),story(4),story(5,'www.gov.br','Prefeitura inaugura unidade. '+evidence)];
 const reviews=[review(0,{scope:'national',localFocus:true}),review(1,{scope:'unknown'}),review(2,{importance:6}),review(3,{scopeEvidence:'This statement was invented and is absent from the article.'}),review(4,{scopeEvidence:''}),review(5)];
 assert.equal(selectEditorialStories(stories,reviews,day).length,0);
});
test('reject future/older-than-seven-days and duplicate facts/URLs; fewer than ten is valid',()=>{
 const stories=[story(0),story(1,'www.nih.gov',evidence,'2026-10-16'),story(2,'www.nih.gov',evidence,'2026-10-25'),story(3),story(0)],reviews=stories.map((s,i)=>review(i,{topicKey:i===3?'unique-0':'unique-'+i}));
 assert.equal(selectEditorialStories(stories,reviews,day).length,1);
 const research=story('lab','www.nih.gov','A university in Bauru led the study. '+evidence);
 assert.equal(selectEditorialStories([research],[review(0,{scope:'global'})],day).length,1);
});
function fixture(){const calls=[],events=[],urls=['https://www.michaeljfox.org/news/pd-new','https://www.gov.br/saude/news/national'];let api=0;const payload=items=>({status:'completed',output:[{type:'output_text',content:[{type:'output_text',text:JSON.stringify({items})}]}]});
 const transport=async(url,o)=>{calls.push(url);if(url==='https://api.openai.com/v1/responses'){
  const body=JSON.parse(o.body);api++;if(api<3){events.push('search-'+api);if(api===2)assert.ok(events.includes('verify-pd'));
   const d=payload([{url:urls[api-1]}]);d.output.unshift({type:'web_search_call',action:{sources:[{url:urls[api-1]}]}});assert.ok(body.input.includes('máximo 7 dias'));return Response.json(d);
  }events.push('editor');const inputs=JSON.parse(body.input[1].content);return Response.json(payload(inputs.map((s,id)=>review(id,{scope:'global'}))));
 }events.push(url.includes('michaeljfox')?'verify-pd':'verify-general');return new Response(`<meta property="article:published_time" content="${day}"><h1>${url.includes('michaeljfox')?'Parkinson research':'National prevention guidance'}</h1><p>${evidence.repeat(5)}</p>`,{headers:{'content-type':'text/html'}});};
 return {events,calls,transport};}
test('complete preview searches and verifies official Parkinson BEFORE general health, reuses existing key, never writes storage',async()=>{
 const f=fixture(),env={LUMI_RESEARCH_OPENAI_API_KEY:'synthetic-test-key',HEALTH_NEWS_KV:new Proxy({},{get(){throw Error('No preview storage permitted');}})};
 const result=await generateHealthNewsPreview(env,new Date('2026-10-24T12:00:00Z'),f.transport);
 assert.deepEqual(f.events,['search-1','verify-pd','search-2','verify-general','editor']);assert.deepEqual(result.verification.stages,['official-parkinsons','general-health']);assert.equal(result.items.length,2);assert.equal(result.shortfall,8);assert.equal(result.items[0].priority,0);assert.equal(result.published,false);assert.equal(result.automaticUpdates,false);assert.equal(result.verification.apiRequests,3);assert.doesNotMatch(JSON.stringify(result),/synthetic-test-key/);
});
test('no candidates returns an honest empty preview after both search stages; no translation call or storage',async()=>{
 let calls=0;const result=await generateHealthNewsPreview({OPENAI_API_KEY:'test'},new Date('2026-10-24T12:00:00Z'),async()=>{calls++;return Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:[]}},{content:[{type:'output_text',text:'{"items":[]}'}]}]});});
 assert.equal(calls,2);assert.equal(result.items.length,0);assert.equal(result.shortfall,10);assert.equal(NEWS_PREVIEW_POLICY.maxItems,10);
});
