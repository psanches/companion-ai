const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export const normalizedPlace=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function cleanCity(value){
 if(typeof value!=='string')return null;
 let city=value.trim().replace(/^["'*-]+\s*/, '').replace(/\s+(?:hoje|amanh[aã]|agora|today|tomorrow|esta semana|nesta semana)(?=\s|[?!.,]|$).*$/iu,'').replace(/[, ]+(?:Brasil|Brazil)\s*$/i,'').replace(/[.!?]+$/,'').trim();
 if(!/^[\p{L}][\p{L} '-]{1,60}(?:\s*[,/-]\s*[A-Z]{2}|\s*\([A-Z]{2}\))?$/iu.test(city))return null;
 if(/^(?:hoje|amanh[aã]|agora|today|tomorrow|casa|mim|voc[eê]|vez|chuva|tempo|cidade)\b/iu.test(city))return null;
 return city.replace(/\s*\(([A-Z]{2})\)$/iu,', $1').replace(/\s*[,/-]\s*([A-Z]{2})$/iu,', $1');
}
export function rememberedCity(memory){
 if(typeof memory!=='string')return null;
 const patterns=[
  /\b(?:cidade|city|localizaç[aã]o|location)(?:\s+(?:atual|registrada|de resid[eê]ncia))?\s*(?::|=|[ée]|como)\s*([^\n;.]{2,100})/giu,
  /\b(?:moro|mora|resido|reside|vivo|vive)\s+em\s+([^\n;.]{2,100})/giu
 ];
 for(const pattern of patterns)for(const match of memory.slice(0,20000).matchAll(pattern)){const city=cleanCity(match[1]);if(city)return city;}
 return null;
}
export function requestedWeatherCity(text){
 const target=String(text||'').match(/^Cidade da previsão:\s*([^\n]+)/mi);
 if(target)return cleanCity(target[1]);
 const current=String(text||'').split('Pergunta atual:').at(-1);
 const candidates=[...current.matchAll(/(?=(?:^|\s)(?:em|para|de|in|for)\s+([^\n?!;:]{2,100}))/giu)].map(m=>m[1]);
 for(const candidate of candidates.reverse()){const city=cleanCity(candidate);if(city)return city;}
 const direct=current.match(/^(?:weather|forecast)(?:\s+(?:today|tomorrow|forecast))*\s+([^\n?!;:]{2,100})/iu);
 return direct?cleanCity(direct[1]):null;
}
export const asksWeatherCity=text=>/qual cidade voc[eê] quer consultar|which city should I check/i.test(String(text||''));
export const isBareCityReply=text=>Boolean(cleanCity(text))&&!/^(?:hello|hi|hey|ol[aá](?: lumi)?|oi(?: lumi)?|obrigad[oa]|thanks|thank you|bom dia|boa tarde|boa noite|sim|n[aã]o|yes|no)[.!?]*$/iu.test(text.trim());
export function resolveWeatherCity(text,history,memory){
 const explicit=requestedWeatherCity(text);if(explicit)return explicit;
 if(asksWeatherCity(history.at(-1)?.content)){const city=cleanCity(text);if(city)return city;}
 for(let index=history.length-1;index>=0;index--){
  const item=history[index];
  if(item?.role!=='user'||typeof item.content!=='string')continue;
  if(asksWeatherCity(history[index-1]?.content)){const city=cleanCity(item.content);if(city)return city;}
  const declared=rememberedCity(item.content);if(declared)return declared;
  if(/\b(?:clima|tempo|weather|forecast|chover|chovendo|temperatura|rain)\b/iu.test(item.content)){
   const city=requestedWeatherCity(item.content);if(city)return city;
  }
 }
 return rememberedCity(memory);
}
export function weatherSearchLocation(target){
 const match=target.match(/^(.*?),\s*([A-Z]{2})$/i);
 return {type:'approximate',city:match?match[1]:target,...(match&&states.has(match[2].toUpperCase())?{region:match[2].toUpperCase(),country:'BR'}:{})};
}
export function mentionsCity(value,target){
 const city=normalizedPlace(target.split(',')[0]);
 return (' '+normalizedPlace(value)+' ').includes(' '+city+' ');
}
export function hasCitySource(citations,target){
 return citations.some(c=>{let path;try{path=decodeURIComponent(new URL(c.url).pathname);}catch{return false;}return path!=='/'&&mentionsCity((c.title||'')+' '+path,target);});
}
