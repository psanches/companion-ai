import fixtures from './runtime-fixtures.mjs';
import {verifyStory,publicationFromHtml} from './health-news-verification.mjs';
import {generateHealthDigest} from './health-news-daily.mjs';
import {withHealthNews} from './health-news-worker.mjs';
function check(value,message){if(!value)throw Error(message);}
export default {async test(){
 const {pages,snapshot}=fixtures,cited=new Set(pages.map(x=>x.item.url));
 for(const {item,html} of pages){const verified=await verifyStory({url:item.url},'2026-10-18',cited,async()=>new Response(html,{headers:{'content-type':'text/html'}}));check(verified.publishedAt===item.publishedAt,'Real source date changed');}
 check(publicationFromHtml('<meta '+'x'.repeat(1400000)+'><meta name="date" content="2026-10-18">').date==='2026-10-18','Malformed metadata regression');
 let calls=0,writes=0;
 const message=items=>({type:'message',content:[{type:'output_text',text:JSON.stringify({items})}]});
 const transport=async(url,opts)=>{
  const page=pages.find(p=>p.item.url===url);if(page)return new Response(page.html,{headers:{'content-type':'text/html'}});
  if(url!=='https://api.openai.com/v1/responses')return new Response(null,{status:503});
  calls++;
  if(calls===1)return Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:pages.map(p=>({url:p.item.url}))}},message(pages.map(p=>({url:p.item.url})))]});
  return Response.json({status:'completed',output:[message(snapshot.items.map((x,id)=>({id,title:x.title,summary:x.summary})))]});
 };
 const digest=await generateHealthDigest({LUMI_RESEARCH_OPENAI_API_KEY:'synthetic-test-only',HEALTH_NEWS_KV:{get:async()=>null,put:async()=>writes++}},new Date('2026-10-18T09:00:00Z'),transport);
 check(digest.items.length===5&&writes===3&&calls===2,'Full pipeline failed');
 let generation=0;const worker=withHealthNews({scheduled(){return 'unrelated';}},()=>generation++);
 const env=new Proxy({},{get(){throw Error('Static mode accessed storage or credentials');}});
 const r=await worker.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev/health-news'),env,{});const d=await r.json();
 check(d.demo&&d.items.length===5&&d.date==='2026-10-17','Static edition failed');
 check(worker.scheduled({cron:'0 9 * * *'},env,{}).status==='demo-static'&&generation===0,'News cron generated content');
 check(worker.scheduled({cron:'other'})==='unrelated','Unrelated schedule altered');
 console.log(JSON.stringify({runtime:'workerd',realPages:5,malformedHtmlBytes:1400000,verifiedItems:digest.items.length,mockedAPIResponses:calls,realAIRequests:0,staticEdition:true,deployed:false}));
}};
