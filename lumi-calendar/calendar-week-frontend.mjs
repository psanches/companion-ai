// Read-only weekly agenda. Event creation remains in its explicit review flow.
export const WEEK_FRONTEND = String.raw`
async function lumiShowCalendarWeek(request,base,english=false){
 const say=(pt,en)=>english?en:pt;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const addDays=(day,count)=>new Date(Date.parse(day+'T12:00:00Z')+count*86400000).toISOString().slice(0,10);
 const dayKey=value=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const p=type=>parts.find(x=>x.type===type).value;return p('year')+'-'+p('month')+'-'+p('day');};
 const monday=day=>addDays(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
 const today=dayKey(Date.now()),first=monday(today),short=day=>day.slice(8,10)+'/'+day.slice(5,7);
 const time=value=>new Date(value).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const endTime=value=>new Date(value).toLocaleTimeString('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 document.getElementById('lumiCalendarWeek')?.remove();document.getElementById('lumiCalendarDay')?.remove();
 const panel=make('section');panel.id='lumiCalendarWeek';panel.className='msg assistant';panel.setAttribute('aria-label',say('Agenda semanal da Lumi','Lumi weekly calendar'));
 panel.style.cssText='padding:20px;margin:16px 0;border:1px solid #9bd6f5;border-radius:14px;background:#162235;color:#fff;font:17px system-ui';
 const heading=make('h2'),note=make('p',say('Agenda principal · segunda a domingo · horário de Brasília','Primary calendar · Monday to Sunday · Brasilia time'));
 const controls=make('div'),date=make('input'),previous=make('button',say('← Semana anterior','← Previous week')),next=make('button',say('Próxima semana →','Next week →')),current=make('button',say('Semana atual','Current week')),reload=make('button',say('Atualizar agenda','Refresh calendar')),close=make('button',say('Fechar agenda','Close calendar')),list=make('div'),status=make('p');
 date.type='date';date.lang='pt-BR';date.value=first;date.setAttribute('aria-label',say('Semana da agenda','Calendar week'));
 controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px';
 for(const button of [previous,next,current,reload,close]){button.type='button';button.style.cssText='padding:10px;font:inherit;min-height:44px';}
 date.style.cssText='padding:10px;font:inherit;min-height:44px;max-width:100%';
 controls.append(previous,current,next,date,reload,close);status.setAttribute('role','status');list.setAttribute('aria-live','polite');
 panel.append(heading,note,controls,list,status);(document.getElementById('messages')||document.querySelector('.app')||document.body).append(panel);
 close.onclick=()=>{panel.remove();const target=innerWidth<=900?document.getElementById('chatHistoryBtn'):document.getElementById('lumiAgendaBtn');target?.focus();};
 let loading=false;
 function contains(item,day){if(item.allDay)return item.start<=day&&item.end>day;const start=dayKey(item.start),end=dayKey(item.end);return start<=day&&(end>day||(end===day&&endTime(item.end)!=='00:00:00'));}
 function eventTime(item){if(item.allDay)return say('Dia inteiro','All day');if(dayKey(item.start)===dayKey(item.end))return time(item.start)+' – '+time(item.end);const options={timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'};return new Date(item.start).toLocaleString('pt-BR',options)+' – '+new Date(item.end).toLocaleString('pt-BR',options);}
 function render(events){list.replaceChildren();for(let i=0;i<7;i++){
  const day=addDays(date.value,i),section=make('section');section.dataset.agendaDay=day;section.style.cssText='border-top:1px solid #30445d;padding:12px 0';
  const label=new Intl.DateTimeFormat(english?'en':'pt-BR',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit'}).format(new Date(day+'T12:00:00Z'));
  section.append(make('h3',label+(day===today?say(' · hoje',' · today'):'')));
  if(day===today){section.style.borderLeft='3px solid #a8dcf2';section.style.paddingLeft='10px';}
  const items=events.filter(item=>contains(item,day)).sort((a,b)=>a.allDay===b.allDay?String(a.start).localeCompare(String(b.start)):a.allDay?-1:1);
  for(const item of items){const row=make('article',eventTime(item)+' · '+(item.title||say('Compromisso','Event')));row.style.cssText='padding:8px 0;overflow-wrap:anywhere';section.append(row);}
  if(!items.length)section.append(make('p',say('Nenhum compromisso neste dia.','No events on this day.')));
  list.append(section);
 }}
 function connect(message){status.replaceChildren(document.createTextNode(message+' '));const button=make('button',say('Conectar Google Calendar','Connect Google Calendar'));button.type='button';button.style.cssText='padding:10px;font:inherit;min-height:44px';status.append(button);
  button.onclick=async()=>{button.disabled=true;try{const r=await request(base.replace(/\/?$/,'/')+'auth/google/start',{method:'POST',headers:{'content-type':'application/json','accept-language':english?'en':'pt-BR'},body:'{}',signal:AbortSignal.timeout(20000)}),data=await r.json();if(r.status===401){lumiCalendarSignIn(status,data.error||say('Entre na Lumi para continuar','Sign in to Lumi to continue'));return;}if(!r.ok||!data.url)throw Error(data.error||'Calendar unavailable');const target=new URL(data.url);if(target.origin!=='https://accounts.google.com')throw Error('Invalid OAuth URL');location.assign(target.href);}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
 }
 async function load(){if(loading||!date.value)return;date.value=monday(date.value);loading=true;for(const item of [previous,next,current,date,reload])item.disabled=true;
  heading.textContent=say('🗓 Sua semana · ','🗓 Your week · ')+short(date.value)+' – '+short(addDays(date.value,6));status.textContent=say('Carregando agenda…','Loading calendar…');list.replaceChildren();
  try{const response=await request(base.replace(/\/?$/,'/')+'calendar/events/week',{method:'POST',headers:{'content-type':'application/json','accept-language':english?'en':'pt-BR'},body:JSON.stringify({date:date.value}),signal:AbortSignal.timeout(20000)}),data=await response.json();
   if(response.status===401){lumiCalendarSignIn(status,data.error||say('Entre na Lumi para continuar','Sign in to Lumi to continue'));return;}
   if(data.code==='CONNECT'||data.code==='PERMISSION'){connect(data.error||say('Conecte seu Google Calendar.','Connect your Google Calendar.'));return;}
   if(!response.ok||!Array.isArray(data.events))throw Error(data.error||say('Não foi possível consultar a agenda.','Could not load the calendar.'));
   render(data.events);status.textContent=data.truncated?say('Mostrando os primeiros 100 compromissos da semana.','Showing the first 100 events of this week.'):say('Agenda semanal atualizada.','Weekly calendar updated.');
  }catch(error){if(/sign.?in|login|entre na lumi/i.test(error.message||''))lumiCalendarSignIn(status,say('Entre na Lumi para continuar','Sign in to Lumi to continue'));else status.textContent=say('Não consegui carregar a agenda. Use Atualizar agenda para tentar novamente. ','Could not load the calendar. Use Refresh calendar to retry. ')+error.message;}
  finally{loading=false;for(const item of [previous,next,current,date,reload])item.disabled=false;panel.scrollIntoView?.({block:'start'});}
 }
 previous.onclick=()=>{date.value=addDays(date.value,-7);void load();};next.onclick=()=>{date.value=addDays(date.value,7);void load();};current.onclick=()=>{date.value=monday(dayKey(Date.now()));void load();};reload.onclick=load;date.onchange=load;
 await load();
}
`;
