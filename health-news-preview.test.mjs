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
  }events.push('editor');const inputs=JSON.parse(body.input[1].content);return Response.json(payload(Object.fromEntries(inputs.map((s,id)=>[s.url,review(id,{scope:'global',evidenceId:0})]))));
 }if(!urls.includes(url))return new Response('<h1>News index</h1>',{headers:{'content-type':'text/html'}});events.push(url.includes('michaeljfox')?'verify-pd':'verify-general');return new Response(`<meta property="article:published_time" content="${day}"><h1>${url.includes('michaeljfox')?'Parkinson research':'National prevention guidance'}</h1><p>${evidence.repeat(5)}</p>`,{headers:{'content-type':'text/html'}});};
 return {events,calls,transport};}
test('complete preview searches and verifies official Parkinson BEFORE general health, reuses existing key, never writes storage',async()=>{
 const f=fixture(),env={LUMI_RESEARCH_OPENAI_API_KEY:'synthetic-test-key',HEALTH_NEWS_KV:new Proxy({},{get(){throw Error('No preview storage permitted');}})};
 const result=await generateHealthNewsPreview(env,new Date('2026-10-24T12:00:00Z'),f.transport);
 assert.deepEqual(f.events,['search-1','verify-pd','search-2','verify-general','editor']);assert.deepEqual(result.verification.stages,['official-parkinsons','general-health']);assert.equal(result.items.length,2);assert.equal(result.shortfall,8);assert.equal(result.items[0].priority,0);assert.equal(result.published,false);assert.equal(result.automaticUpdates,false);assert.equal(result.verification.apiRequests,3);assert.doesNotMatch(JSON.stringify(result),/synthetic-test-key/);
});
test('no candidates returns an honest empty preview after both search stages; no translation call or storage',async()=>{
 let calls=0;const result=await generateHealthNewsPreview({OPENAI_API_KEY:'test'},new Date('2026-10-24T12:00:00Z'),async(url)=>{if(url!=='https://api.openai.com/v1/responses')return new Response('<h1>Empty</h1>',{headers:{'content-type':'text/html'}});calls++;return Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:[]}},{content:[{type:'output_text',text:'{"items":[]}'}]}]});});
 assert.equal(calls,2);assert.equal(result.items.length,0);assert.equal(result.shortfall,10);assert.equal(NEWS_PREVIEW_POLICY.maxItems,10);
});

test('international catalogue contains verified sources from fifteen countries plus transnational organisations',async()=>{
 const {PARKINSON_SOURCE_CATALOG,PARKINSON_SOURCES}=await import('./health-news-preview.mjs');const {publicSourceUrl,isoDay,publicationFromHtml}=await import('./health-news-verification.mjs');
 assert.equal(PARKINSON_SOURCES.length,23);assert.equal(new Set(PARKINSON_SOURCES).size,23);
 const countries=new Set(PARKINSON_SOURCE_CATALOG.map(s=>s.country));for(const c of ['Canadá','Austrália','França','Alemanha','Suíça','Itália','Espanha','Portugal','Países Baixos','Nova Zelândia','Índia','Japão'])assert.ok(countries.has(c));
 for(const source of PARKINSON_SOURCE_CATALOG)assert.equal(publicSourceUrl(source.url).hostname.replace(/^www\./,''),source.domain);
 for(const date of ['22 octobre 2026','22. Oktober 2026','22 ottobre 2026','22 de octubre de 2026','22 oktober 2026','22.10.2026','2026年10月22日']){assert.equal(isoDay(date),'2026-10-22');assert.equal(publicationFromHtml('<h1>News</h1><p>'+date+'</p>').date,'2026-10-22');}
 assert.equal(isoDay('31.02.2026'),null);assert.throws(()=>publicationFromHtml('<h1>Event</h1><p>Come on 22 octobre 2026 for our local meeting.</p>'));
 assert.throws(()=>publicSourceUrl('https://franceparkinson.fr.evil.example/news'));
});
test('international official sources retain Parkinson priority, Portuguese summaries and the regional exclusion',()=>{
 const source=story('fr','www.franceparkinson.fr','Recherche Parkinson. '+evidence);
 const approved=selectEditorialStories([source],[review(0,{scope:'global'})],day);assert.equal(approved.length,1);assert.equal(approved[0].priority,0);assert.equal(approved[0].language,'pt-BR');
 assert.equal(selectEditorialStories([source],[review(0,{localFocus:true})],day).length,0);
 const japan=story('jp','www.jpda-net.org','パーキンソン病の研究。 '+evidence);assert.equal(selectEditorialStories([japan],[review(0,{scope:'global'})],day)[0].priority,0);
});



test('publisher index extraction accepts only live same-publisher article links, removes tracking and ignores local/fundraising navigation',async()=>{
 const {publisherArticleLinks}=await import('./health-news-preview.mjs');
 const source={url:'https://www.michaeljfox.org/research-news',match:/^\/news\/[^/]+\/?$/};
 const html='<a href="/news/navigation">Nav</a><h1>Research</h1><a href="/news/study?utm_source=test">A study</a><a href="https://evil.example/news/fake">Fake</a><a href="https://www.michaeljfox.org.evil.example/news/fake">Fake</a><a href="/news/fundraising">Fundraising</a><a href="/news/study">A study again</a>';
 assert.deepEqual(publisherArticleLinks(html,source),[{url:'https://www.michaeljfox.org/news/study',discoveredVia:source.url}]);
});
test('empty model discovery recovers via fetched official article links; 403 index does not stop other publishers',async()=>{
 let api=0;const day='2026-10-24',article='https://www.michaeljfox.org/news/recovered';
 const payload=items=>Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:[]}},{content:[{type:'output_text',text:JSON.stringify({items})}]}]});
 const transport=async(url,options)=>{
  if(url==='https://api.openai.com/v1/responses'){
   api++;if(api<=2)return payload([]);
   return payload({[article]:review(0,{scope:'global',evidenceId:0})});
  }
  if(url==='https://www.michaeljfox.org/research-news')return new Response('<h1>News</h1><a href="/news/recovered">Research Parkinson</a>',{headers:{'content-type':'text/html'}});
  if(url===article)return new Response(`<meta property="article:published_time" content="${day}"><h1>Parkinson research</h1><p>${evidence.repeat(5)}</p>`,{headers:{'content-type':'text/html'}});
  return new Response(null,{status:403});
 };
 const result=await generateHealthNewsPreview({OPENAI_API_KEY:'fixture-key'},new Date(day+'T12:00:00Z'),transport);
 assert.equal(result.items.length,1);assert.equal(result.status,'ready');assert.equal(result.items[0].url,article);assert.equal(result.verification.discovery[0].publisherCandidates,1);assert.ok(result.verification.rejected.some(x=>/403/.test(x.reason)));assert.equal(api,3);assert.equal(result.published,false);
});


test('literal source evidence tolerates typography and whitespace but rejects changed meaning',async()=>{
 const {literalEvidenceMatches}=await import('./health-news-preview.mjs');
 assert.equal(literalEvidenceMatches('Parkinson’s research across\n the country.',"Parkinson's research across the country."),true);
 assert.equal(literalEvidenceMatches('The study did not improve symptoms.','The study did improve symptoms.'),false);
 const st=story('quote','www.nih.gov',"National guidance for Parkinson’s care throughout the country.");
 assert.equal(selectEditorialStories([st],[review(0,{scopeEvidence:"National guidance for Parkinson's care throughout the country."})],day).length,1);
 assert.equal(selectEditorialStories([st],[review(0,{localFocus:true,scopeEvidence:"National guidance for Parkinson's care throughout the country."})],day).length,0);
});


test('editorial evidence options are literal source spans and remain bounded',async()=>{
 const {sourceEvidenceOptions}=await import('./health-news-preview.mjs');
 const text='Headline. '+('National research findings apply across the country. ').repeat(100)+'A final sentence.';
 const options=sourceEvidenceOptions(text);assert.ok(options.length>0&&options.length<=48);assert.ok(options.every(q=>q.length<=360&&text.includes(q)));assert.equal(new Set(options).size,options.length);
});


test('editorial association follows exact publisher URL despite shuffled output and misleading numeric IDs',async()=>{
 const {bindEditorialReviews}=await import('./health-news-preview.mjs');
 const a=story('pressure'),b=story('sleep');
 const reviews=bindEditorialReviews([a,b],[{id:0,sourceUrl:b.url,evidenceId:0,title:'Sleep'},{id:1,sourceUrl:a.url,evidenceId:0,title:'Pressure'}]);
 assert.equal(reviews.find(r=>r.title==='Sleep').id,1);assert.equal(reviews.find(r=>r.title==='Pressure').id,0);
 assert.throws(()=>bindEditorialReviews([a,b],[{sourceUrl:a.url},{sourceUrl:a.url}]),/source URLs/);
 assert.throws(()=>bindEditorialReviews([a,b],[{sourceUrl:a.url},{sourceUrl:'https://www.nih.gov/news/unverified'}]),/source URLs/);
});


test('structured editor response requires one distinct object key per exact verified source URL',async()=>{
 const {editorialSourceSchema}=await import('./health-news-preview.mjs');
 const urls=['https://www.nih.gov/news/a','https://www.nih.gov/news/b'];
 const schema=editorialSourceSchema(urls.map(url=>({url}))).schema.properties.items;
 assert.equal(schema.type,'object');assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.required,urls);assert.deepEqual(Object.keys(schema.properties),urls);
 for(const u of urls){assert.equal(schema.properties[u].additionalProperties,false);assert.ok(schema.properties[u].required.includes('summary'));}
});
