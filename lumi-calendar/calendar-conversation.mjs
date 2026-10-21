// Recover only complete proposals with an explicit title, date and time range.
export function calendarProposal(text){
 if(typeof text!=='string'||!/evento|google calendar/i.test(text)||!/confirm|preparad|dados prontos/i.test(text))return null;
 const clean=text.replace(/\*\*/g,'').replace(/\\_/g,'_');
 const labels=[...clean.matchAll(/(?:^|[\s])(?:[-•]\s*)?(Título|Titulo|Data\/hora|Data|Horário|Horario|Local\/Descrição|Local|Descrição|Início|Inicio|Fim|Modalidade):\s*/gi)],fields={};
 for(let i=0;i<labels.length;i++){const match=labels[i],key=match[1].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();fields[key]=clean.slice(match.index+match[0].length,labels[i+1]?.index??clean.length).split(/\n|\s+Se (?:quiser|estiver)|\s+Para (?:criar|preparar|confirmar)/i)[0].trim().replace(/\s+[-•]$/,'').trim();}
 const title=fields.titulo||clean.match(/Evento preparado[^\n]*\n([^\n]+)/i)?.[1]?.trim();
 const date=(fields.data||fields['data/hora']||'').match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/),times=(fields.horario||fields['data/hora']||'').match(/\b([01]\d|2[0-3]):([0-5]\d)\s*(?:a|às|[-–—])\s*([01]\d|2[0-3]):([0-5]\d)\b/i);
 const iso=value=>value?.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})\b/)?.[0];
 const day=date&&date[3]+'-'+date[2]+'-'+date[1],start=iso(fields.inicio)||(day&&times&&day+'T'+times[1]+':'+times[2]+':00-03:00'),end=iso(fields.fim)||(day&&times&&day+'T'+times[3]+':'+times[4]+':00-03:00');
 if(!title||!start||!end||!Number.isFinite(Date.parse(start))||Date.parse(end)<=Date.parse(start))return null;
 const description=fields['local/descricao']||fields.descricao||'',location=fields.local||fields['local/descricao']||'';
 return {title:title.slice(0,200),start,end,description:description.slice(0,2000),location:location.slice(0,500)};
}
