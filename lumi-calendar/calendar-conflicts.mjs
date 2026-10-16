// Read only the authenticated primary calendar, including recurring instances.
export function calendarMidnight(date,timeZone){
 const base=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(base))throw Error('Invalid all-day date');let value=base;
 const format=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<4;i++){const parts=format.formatToParts(new Date(value)),v=k=>Number(parts.find(x=>x.type===k).value),local=Date.UTC(v('year'),v('month')-1,v('day'),v('hour'),v('minute'),v('second')),next=value+base-local;if(next===value)return value;value=next;}
 return value;
}
export function overlaps(existing,event,timeZone='America/Sao_Paulo',ownId=''){
 if(existing.status==='cancelled'||existing.transparency==='transparent'||existing.attendees?.some(a=>a.self&&a.responseStatus==='declined')||(ownId&&existing.id===ownId&&existing.extendedProperties?.private?.lumiRequest===ownId))return false;
 const point=x=>x?.dateTime?Date.parse(x.dateTime):x?.date?calendarMidnight(x.date,timeZone):NaN;
 const start=point(existing.start),end=point(existing.end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Invalid calendar interval');return start<Date.parse(event.end)&&end>Date.parse(event.start);
}
export async function findConflicts(event,{google,accessToken,ownId}){
 const conflicts=new Map();let pageToken;
 for(let page=0;page<5;page++){
  const params=new URLSearchParams({timeMin:event.start,timeMax:event.end,singleEvents:'true',showDeleted:'false',maxResults:'2500',fields:'items(id,summary,start,end,status,transparency,attendees(self,responseStatus),extendedProperties(private)),nextPageToken,timeZone'});if(pageToken)params.set('pageToken',pageToken);
  const r=await google('https://www.googleapis.com/calendar/v3/calendars/primary/events?'+params,{headers:{authorization:'Bearer '+accessToken}});
  if(!r.ok)throw Object.assign(Error('Calendar conflict lookup failed'),{permission:[401,403].includes(r.status)});
  const data=await r.json();if(!Array.isArray(data.items))throw Error('Incomplete calendar response');
  for(const item of data.items){if(overlaps(item,event,data.timeZone||'America/Sao_Paulo',ownId)){if(typeof item.id!=='string')throw Error('Missing calendar event ID');conflicts.set(item.id,{id:item.id,title:String(item.summary||'').slice(0,200),start:item.start.dateTime||item.start.date,end:item.end.dateTime||item.end.date,allDay:!!item.start.date,timeZone:data.timeZone||'America/Sao_Paulo'});}}
  pageToken=data.nextPageToken;if(!pageToken)return [...conflicts.values()].sort((a,b)=>a.id.localeCompare(b.id));
 }
 throw Error('Calendar pagination limit reached');
}
