// Recover only a complete, explicit proposal. Never infer a date or create an event.
export function calendarProposal(text){
 if(typeof text!=='string'||!/evento|google calendar/i.test(text)||!/confirm|preparad|dados prontos/i.test(text))return null;
 const clean=text.replace(/\*\*/g,''),title=clean.match(/(?:^|\n)\s*(?:-\s*)?T[íi]tulo:\s*([^\n]+)/i)?.[1]?.trim()||clean.match(/Evento preparado[^\n]*\n([^\n]+)/i)?.[1]?.trim();
 const date=clean.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/),times=clean.match(/\b([01]\d|2[0-3]):([0-5]\d)\s*(?:a|às|[-–—])\s*([01]\d|2[0-3]):([0-5]\d)\b/i);
 const iso=label=>clean.match(new RegExp(label+':\\s*(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:\\d{2}))','i'))?.[1];
 const day=date&&date[3]+'-'+date[2]+'-'+date[1],start=iso('Início')||(day&&times&&day+'T'+times[1]+':'+times[2]+':00-03:00'),end=iso('Fim')||(day&&times&&day+'T'+times[3]+':'+times[4]+':00-03:00');
 if(!title||!start||!end||!Number.isFinite(Date.parse(start))||Date.parse(end)<=Date.parse(start))return null;
 const link=clean.match(/https?:\/\/[^\s<>]+/)?.[0]||'';
 return {title:title.slice(0,200),start,end,description:link,location:link};
}
