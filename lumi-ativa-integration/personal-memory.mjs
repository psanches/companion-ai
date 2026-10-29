import {rememberedCity} from '../lumi-research/weather-location.mjs';
// Persist user-declared facts deterministically; never infer personal facts from model prose.
export function personalMemoryRequest(text){
 const value=String(text||'').trim();
 const explicit=value.match(/^(?:(?:lembre(?:-se)?|remember|save)\s+(?:que|that)\s+|(?:memorize|guarde)\s+(?:que\s+)?)([\s\S]+)$/iu);
 const fact=(explicit?.[1]||value).replace(/[.!]+$/,'').trim();
 const name=fact.match(/^(?:meu nome [ée]|my name is)\s+([\p{L} .'-]{2,100})$/iu);
 const residence=fact.replace(/^i live in\s+/i,'moro em ');
 const city=/^(?:eu\s+)?(?:moro|resido|vivo)\s+em\s+/iu.test(residence)?rememberedCity(residence):null;
 if(!explicit&&!name&&!city)return null;
 if(fact.length>1200)return {error:'A informação para a memória deve ter até 1.200 caracteres.'};
 if(/\b(?:senha|password|api[- ]?key|chave (?:de )?api|access[- ]?token|sk-proj-)\b/iu.test(fact))return {error:'Não guarde senhas, tokens ou chaves de acesso na memória da Lumi.'};
 if(name)return {fact,key:'Nome',value:name[1].trim()};
 if(city)return {fact,key:'Local de residência',value:city};
 if(!fact)return null;
 return {fact,key:null,value:fact};
}
export function updatePersonalMemory(memory,request){
 if(typeof memory!=='string')memory='';
 let lines=memory.split('\n');
 if(request.key){const label=request.key==='Nome'?/^(?:[-*]\s*)?(?:nome|name)\s*:/iu:/^(?:[-*]\s*)?(?:local de resid[eê]ncia|local de moradia|resid[eê]ncia|cidade|city|location|localizaç[aã]o)\s*:/iu;lines=lines.filter(line=>!label.test(line));}
 const nextLine=request.key?request.key+': '+request.value:'- '+request.value;
 lines=lines.filter(line=>line.trim()&&line.trim()!==nextLine);
 return [nextLine,...lines].join('\n');
}
