// Verify public primary-source pages before a story can enter the daily edition.
const DOMAINS=['gov.br','usp.br','who.int','paho.org','nih.gov','nia.nih.gov','ninds.nih.gov','fda.gov','cdc.gov','parkinson.org','michaeljfox.org','parkinsons.org.uk','parkinson.ca','parkinsons.org.au','nature.com','science.org','thelancet.com','nejm.org','bmj.com','jamanetwork.com','eurekalert.org','alzheimers.org.uk','nhs.uk','europa.eu'];
export function publicSourceUrl(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Source URL is not allowed');
 const host=u.hostname.toLowerCase();
 if(!DOMAINS.some(d=>host===d||host.endsWith('.'+d))&&!host.endsWith('.edu')&&!host.endsWith('.ac.uk'))throw Error('Source domain is not approved');
 u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_'))u.searchParams.delete(k);
 return u;
}
function attributes(tag){const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs))out[m[1].toLowerCase()]=m[3];return out;}
export function isoDay(value){
 if(typeof value!=='string')return null;
 const m=value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/);
 if(m){const d=new Date(m[1]+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===m[1]?m[1]:null;}
 const br=value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);return br?isoDay(`${br[3]}-${br[2]}-${br[1]}`):null;
}
export function publicationFromHtml(html){
 const found=[];
 for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const a=attributes(m[0]);if(['article:published_time','datepublished','date','dc.date.issued','dcterms.issued','citation_publication_date','citation_date','parsely-pub-date'].includes((a.property||a.name||a.itemprop||'').toLowerCase())){const day=isoDay(a.content);if(day)found.push({date:day,evidence:a.property||a.name||a.itemprop});}}
 function visit(obj){if(!obj||typeof obj!=='object')return;if(Array.isArray(obj)){obj.forEach(visit);return;}const type=[obj['@type']].flat().join(' ');if(/Article|BlogPosting|NewsPosting/i.test(type)&&obj.datePublished){const day=isoDay(obj.datePublished);if(day)found.push({date:day,evidence:'JSON-LD datePublished'});}if(obj['@graph'])visit(obj['@graph']);}
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]));}catch{}}
 // Gov.br exposes original publication separately from its last-modified field.
 const gov=html.match(/<span\b[^>]*class=["'][^"']*documentPublished[^"']*["'][^>]*>([\s\S]{0,900})/i);
 if(gov){const day=isoDay(gov[1].replace(/<[^>]*>/g,' '));if(day)found.push({date:day,evidence:'documentPublished'});}
 if(!found.length)throw Error('Publication date could not be verified');
 if(new Set(found.map(x=>x.date)).size!==1)throw Error('Source publication dates conflict');
 return found[0];
}
export function checkPublication(date,today){
 if(!isoDay(date)||date!==isoDay(date))throw Error('Invalid publication date');
 const age=(Date.parse(today+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000;
 if(age<0)throw Error('Future publication date');if(age>7)throw Error('Publication older than seven days');return age;
}
async function readHtml(response){
 const reader=response.body.getReader();const chunks=[];let bytes=0;
 for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1500000){await reader.cancel();throw Error('Source page too large');}chunks.push(value);}
 const all=new Uint8Array(bytes);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(all);
}
export async function verifyStory(candidate,today,citedUrls,fetcher=fetch){
 let url=publicSourceUrl(candidate.url);
 if(!citedUrls.has(url.href))throw Error('URL was not returned by web search');
 let response;
 for(let n=0;n<4;n++){
  response=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{accept:'text/html'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();url=publicSourceUrl(new URL(location,url).href);response=null;continue;}break;
 }
 if(!response?.ok)throw Error('Source page unavailable');
 if(!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();throw Error('Source is not an article page');}
 const html=await readHtml(response);const publication=publicationFromHtml(html);const ageDays=checkPublication(publication.date,today);
 if(candidate.publishedAt&&candidate.publishedAt!==publication.date)throw Error('Search date disagrees with original publication date');
 let body=html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
 body=body.slice(Math.max(0,body.search(/<h1\b/i))).replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|lt|gt);/g,' ').replace(/\s+/g,' ').trim().slice(0,14000);
 if(body.length<250)throw Error('Insufficient source text');
 return {url:url.href,publishedAt:publication.date,dateEvidence:publication.evidence,ageDays,region:url.hostname.endsWith('.br')?'Brasil':'Internacional',source:url.hostname,sourceText:body};
}
export function citedSourceUrls(data){
 const values=[];
 for(const item of data.output||[]){for(const source of item.action?.sources||[])if(source.url)values.push(source.url);for(const part of item.content||[])for(const a of part.annotations||[])if(a.type==='url_citation'&&a.url)values.push(a.url);}
 const result=new Set();for(const value of values){try{result.add(publicSourceUrl(value).href);}catch{}}return result;
}
