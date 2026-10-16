import {findConflicts,calendarMidnight} from './calendar-conflicts.mjs';
import {createSupabaseVerifier} from './supabase-auth.mjs';
export const HOST='lumi-develop.psanchesnle.workers.dev',ORIGIN='https://'+HOST;
const SCOPE='https://www.googleapis.com/auth/calendar.events',CALLBACK=ORIGIN+'/api/auth/google/callback';
const encoder=new TextEncoder(),api='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const messages={DAY:[503,'Não consegui carregar a agenda. Clique em Atualizar agenda para tentar novamente.','Could not load the calendar. Click Refresh calendar to retry.'],CHECK:[503,'Não consegui verificar conflitos na agenda. Tente revisar o evento novamente.','Could not check calendar conflicts. Review the event again.'],AUTH:[401,'Entre na Lumi para continuar.','Sign in to Lumi to continue.'],ORIGIN:[403,'Origem não autorizada.','Origin not allowed.'],CONFIG:[503,'A conexão com o Calendar precisa ser configurada no servidor.','Calendar server configuration is incomplete.'],INPUT:[400,'Confira título, início e fim, incluindo o fuso horário.','Check the title, start and end, including the time zone.'],CONNECT:[403,'Reconecte o Google Calendar e autorize a criação de eventos.','Reconnect Google Calendar and allow event creation.'],EXPIRED:[409,'A confirmação expirou ou foi cancelada. Prepare o evento novamente.','Confirmation expired or was cancelled. Prepare the event again.'],CONFIRM:[400,'Revise o evento e confirme explicitamente antes de criar.','Review the event and explicitly confirm before creating.'],GOOGLE:[502,'O Google não confirmou a criação. Tente confirmar novamente; o mesmo pedido usa o mesmo identificador para evitar duplicatas.','Google did not confirm creation. Retry confirmation; the same request uses the same identifier to prevent duplicates.'],PERMISSION:[403,'O Google recusou a permissão de escrita. Reconecte o Calendar com permissão para criar eventos.','Google denied write access. Reconnect Calendar with event creation permission.'],OAUTH:[400,'A conexão expirou ou foi recusada. Inicie novamente pela Lumi.','Connection expired or was denied. Start again from Lumi.']};
class Failure extends Error{constructor(code){super(code);this.code=code;}}
const fail=code=>{throw new Failure(code);};
const en=request=>/^en\b/i.test(request.headers.get('accept-language')||'');
function json(data,status=200){return Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});}
function errorResponse(error,request){const code=error instanceof Failure?error.code:'GOOGLE',m=messages[code];return json({code,error:en(request)?m[2]:m[1],...(code==='CONNECT'||code==='PERMISSION'?{reconnectUrl:'/api/auth/google/start'}:{})},m[0]);}
export const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))),x=>x.toString(16).padStart(2,'0')).join('');}
const b64=bytes=>btoa(String.fromCharCode(...bytes)),un64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function key(env){if(typeof env.CALENDAR_SESSION_SECRET!=='string'||env.CALENDAR_SESSION_SECRET.length<32)fail('CONFIG');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.CALENDAR_SESSION_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
export async function encrypt(env,data){const iv=crypto.getRandomValues(new Uint8Array(12));return JSON.stringify({v:1,iv:b64(iv),data:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(JSON.stringify(data)))))});}
export async function decrypt(env,data){const p=JSON.parse(data);if(p.v!==1)fail('CONNECT');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(p.iv)},await key(env),un64(p.data))));}
export function validateEvent(body,now=Date.now()){
 if(!body||Object.keys(body).some(k=>!['title','start','end','durationMinutes','description','location'].includes(k)))fail('INPUT');
 if(body.durationMinutes!==undefined&&(!Number.isInteger(body.durationMinutes)||body.durationMinutes<1||body.durationMinutes>10080))fail('INPUT');
 if(body.end===undefined||body.end===''){if(typeof body.start!=='string'||!Number.isFinite(Date.parse(body.start)))fail('INPUT');body={...body,end:new Date(Date.parse(body.start)+(body.durationMinutes??30)*60000).toISOString()};}
 if(typeof body.title!=='string'||!body.title.trim()||body.title.length>200)fail('INPUT');
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
 const realDay=v=>{const [y,m,d]=v.slice(0,10).split('-').map(Number);return m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();};
 if(!date(body.start)||!date(body.end)||!realDay(body.start)||!realDay(body.end)||Date.parse(body.end)<=Date.parse(body.start)||Date.parse(body.start)<now-60000||Date.parse(body.end)-Date.parse(body.start)>7*86400000)fail('INPUT');
 for(const [field,max]of [['description',2000],['location',500]])if(body[field]!==undefined&&(typeof body[field]!=='string'||body[field].length>max))fail('INPUT');
 return {title:body.title.trim(),start:new Date(body.start).toISOString(),end:new Date(body.end).toISOString(),description:body.description||'',location:body.location||''};
}
async function bodyJson(request){if(!request.headers.get('content-type')?.includes('application/json'))fail('INPUT');const reader=request.body?.getReader();if(!reader)fail('INPUT');let size=0,text='';const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();fail('INPUT');}text+=decoder.decode(value,{stream:true});}try{return JSON.parse(text+decoder.decode());}catch{fail('INPUT');}}
function configured(env){if(!env.Memory||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.CALENDAR_SESSION_SECRET)fail('CONFIG');}
const writable=scope=>String(scope||'').split(/\s+/).some(s=>[SCOPE,'https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/calendar.events.owned'].includes(s));
export function createCalendarHandler({fetcher=fetch,verify=createSupabaseVerifier({fetcher}),now=()=>Date.now()}={}){
 async function google(url,options={}){try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{fail('GOOGLE');}}
 async function access(env,userId,write=true){
  const stored=await env.Memory.get('google:tokens:user:'+userId);if(!stored)fail('CONNECT');let tokens;try{tokens=await decrypt(env,stored);}catch{fail('CONNECT');}
  if(!tokens.access_token||tokens.expires_at<=now()+60000){
   if(!tokens.refresh_token)fail('CONNECT');const r=await google('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:tokens.refresh_token,grant_type:'refresh_token'})});if(!r.ok)fail(r.status<500?'CONNECT':'GOOGLE');const data=await r.json();if(!data.access_token)fail('CONNECT');tokens={...tokens,...data,refresh_token:data.refresh_token||tokens.refresh_token,expires_at:now()+Number(data.expires_in||3600)*1000};await env.Memory.put('google:tokens:user:'+userId,await encrypt(env,tokens));
  }
  // Check Google's actual grant, including legacy tokens whose stored scope was assumed.
  const info=await google('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(tokens.access_token));if(!info.ok)fail('CONNECT');const grant=await info.json();if(grant.aud!==env.GOOGLE_CLIENT_ID||!(writable(grant.scope)||(!write&&String(grant.scope||'').split(/\s+/).some(s=>['https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/calendar.events.readonly'].includes(s)))))fail('CONNECT');return tokens.access_token;
 }
 async function check(event,accessToken,userId){const id=await digest('lumi-calendar-v3:'+userId+':'+JSON.stringify(event));try{const conflicts=await findConflicts(event,{google,accessToken,ownId:id});return {conflicts,fingerprint:await digest(JSON.stringify(conflicts))};}catch(error){fail(error.permission?'PERMISSION':'CHECK');}}
 function conflictInfo(result,token){return {checked:true,calendar:'primary',hasConflicts:result.conflicts.length>0,count:result.conflicts.length,items:result.conflicts.slice(0,10),...(token?{conflictToken:token}:{})};}
 async function start(request,env,user){let resume=null;if(request.method==='POST'){const body=await bodyJson(request);if(Object.keys(body).some(k=>k!=='resume'))fail('INPUT');if(body.resume)resume=validateEvent(body.resume,now());}const state=random(),verifier=random(),challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');await env.Memory.put('calendar:v3:oauth:'+state,await encrypt(env,{userId:user.id,createdAt:now(),verifier,resume}),{expirationTtl:600});const params=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent select_account',state,code_challenge:challenge,code_challenge_method:'S256'});const response=json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params});response.headers.set('set-cookie','__Host-lumi_calendar_oauth='+state+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600');return response;}
 async function callback(request,env,url){
  const state=url.searchParams.get('state'),cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-lumi_calendar_oauth=([0-9a-f]{64})(?:;|$)/)?.[1];if(!state||!/^[0-9a-f]{64}$/.test(state)||cookie!==state)fail('OAUTH');const k='calendar:v3:oauth:'+state,stored=await env.Memory.get(k);if(!stored)fail('OAUTH');const pending=await decrypt(env,stored);if(!pending.userId||now()-pending.createdAt>600000||pending.createdAt>now())fail('OAUTH');await env.Memory.delete(k);if(url.searchParams.has('error')||!url.searchParams.get('code'))fail('OAUTH');const r=await google('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:url.searchParams.get('code'),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:CALLBACK,grant_type:'authorization_code',code_verifier:pending.verifier})});if(!r.ok)fail('OAUTH');const tokens=await r.json();if(!tokens.access_token||!writable(tokens.scope))fail('PERMISSION');await env.Memory.put('google:tokens:user:'+pending.userId,await encrypt(env,{access_token:tokens.access_token,refresh_token:tokens.refresh_token||null,scope:tokens.scope,expires_at:now()+Number(tokens.expires_in||3600)*1000}));if(pending.resume)await env.Memory.put('calendar:v3:resume:'+pending.userId+':'+state,await encrypt(env,{event:pending.resume,expiresAt:now()+600000}),{expirationTtl:600});return new Response(null,{status:303,headers:{location:ORIGIN+'/?calendar_connected=1'+(pending.resume?'&calendar_resume='+state:''),'cache-control':'no-store','referrer-policy':'no-referrer','set-cookie':'__Host-lumi_calendar_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
 }
 return async function handle(request,env){
  const url=new URL(request.url),path=url.pathname.replace(/^\/api(?=\/)/,'');if(url.hostname!==HOST)return null;
  const eventPath=path==='/calendar/events',draftPath=/^\/calendar\/events\/(prepare|confirm|cancel|resume|day)$/.test(path),oauth=['/auth/google/start','/auth/google/callback'].includes(path);
  // Preserve GET event listing byte-for-byte through the original integration.
  if(!(eventPath&&request.method!=='GET'&&request.method!=='HEAD')&&!draftPath&&!oauth){
   // Do not let legacy chat confirmations write through the older helper.
   if(['/chat','/'].includes(path)&&request.method==='POST'){let b;try{b=await bodyJson(request.clone());}catch{}if(/^(CONFIRMAR EVENTO|CONFIRM EVENT|CANCELAR EVENTO|CANCEL EVENT)$/i.test(b?.message?.trim()||''))return json({reply:en(request)?'Use the event review dialog to confirm or cancel.':'Use a janela de revisão do evento para confirmar ou cancelar.'});}
   return null;
  }
  try{
   configured(env);
   if(path==='/auth/google/callback'){if(request.method!=='GET')return json({error:'Method not allowed'},405);return await callback(request,env,url);}
   if(request.headers.get('origin')!==ORIGIN&&!(request.method==='GET'&&!request.headers.has('origin')&&request.headers.get('sec-fetch-site')==='same-origin'))fail('ORIGIN');
   const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1],user=token&&await verify(token,env);if(!user?.id)fail('AUTH');
   if(path==='/auth/google/start'){if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);return await start(request,env,user);}
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   const body=await bodyJson(request);
   if(path.endsWith('/day')){try{
    if(Object.keys(body).some(k=>k!=='date')||typeof body.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date+'T00:00:00Z'))||new Date(body.date+'T00:00:00Z').toISOString().slice(0,10)!==body.date)fail('INPUT');
    const next=new Date(Date.parse(body.date+'T12:00:00Z')+86400000).toISOString().slice(0,10),accessToken=await access(env,user.id,false),items=new Map();let pageToken;
    for(let page=0;page<5;page++){
     const params=new URLSearchParams({timeMin:new Date(calendarMidnight(body.date,'America/Sao_Paulo')).toISOString(),timeMax:new Date(calendarMidnight(next,'America/Sao_Paulo')).toISOString(),singleEvents:'true',showDeleted:'false',orderBy:'startTime',maxResults:'1000',fields:'items(id,summary,start,end,status),nextPageToken'});if(pageToken)params.set('pageToken',pageToken);
     const r=await google(api+'?'+params,{headers:{authorization:'Bearer '+accessToken}});if([401,403].includes(r.status))fail('CONNECT');if(!r.ok)fail('CHECK');const data=await r.json();if(!Array.isArray(data.items))fail('CHECK');
     for(const item of data.items){if(item.status==='cancelled')continue;if(typeof item.id!=='string'||!(item.start?.dateTime||item.start?.date)||!(item.end?.dateTime||item.end?.date))fail('CHECK');items.set(item.id,{id:item.id,title:String(item.summary||'').slice(0,200),start:item.start.dateTime||item.start.date,end:item.end.dateTime||item.end.date,allDay:!!item.start.date});}
     pageToken=data.nextPageToken;if(!pageToken)return json({date:body.date,calendar:'primary',timeZone:'America/Sao_Paulo',events:[...items.values()].slice(0,100),count:items.size,truncated:items.size>100});
    }
    fail('DAY');
   }catch(error){if(error instanceof Failure&&['INPUT','CONNECT','CONFIG'].includes(error.code))throw error;fail('DAY');}}
   if(path.endsWith('/resume')){if(Object.keys(body).some(k=>k!=='resumeId')||!/^[a-f0-9]{64}$/.test(body.resumeId||''))fail('INPUT');const stored=await env.Memory.get('calendar:v3:resume:'+user.id+':'+body.resumeId);if(!stored)fail('EXPIRED');const pending=await decrypt(env,stored);if(pending.expiresAt<now())fail('EXPIRED');return json({event:pending.event});}
   if(path.endsWith('/confirm')||path.endsWith('/cancel')){
    if(Object.keys(body).some(k=>!['confirmationId','confirmed','allowConflicts','conflictToken'].includes(k))||!/^[a-f0-9]{64}$/.test(body.confirmationId||''))fail('CONFIRM');
    const k='calendar:v3:draft:'+user.id+':'+body.confirmationId,stored=await env.Memory.get(k);if(!stored)fail('EXPIRED');const draft=await decrypt(env,stored);if(draft.userId!==user.id||now()>draft.expiresAt)fail('EXPIRED');
    if(path.endsWith('/cancel')){await env.Memory.delete(k);return json({cancelled:true,created:false});}
    if(body.confirmed!==true)fail('CONFIRM');const event=validateEvent(draft.event,now()),accessToken=await access(env,user.id),id=await digest('lumi-calendar-v3:'+user.id+':'+JSON.stringify(event));
    const checked=await check(event,accessToken,user.id);
    if(checked.conflicts.length&&!(body.allowConflicts===true&&typeof body.conflictToken==='string'&&body.conflictToken===draft.conflictToken&&draft.conflictFingerprint===checked.fingerprint)){
     const conflictToken=random();await env.Memory.put(k,await encrypt(env,{...draft,conflictToken,conflictFingerprint:checked.fingerprint}),{expirationTtl:Math.max(60,Math.ceil((draft.expiresAt-now())/1000))});
     return json({code:'CALENDAR_CONFLICT',created:false,requiresConfirmation:true,confirmationId:body.confirmationId,event,conflicts:conflictInfo(checked,conflictToken),error:en(request)?'A conflicting event was found. Review before creating anyway.':'Há conflito de horário. Revise antes de criar mesmo assim.'},409);
    }
    const payload={id,summary:event.title,description:event.description,location:event.location,start:{dateTime:event.start,timeZone:'America/Sao_Paulo'},end:{dateTime:event.end,timeZone:'America/Sao_Paulo'},extendedProperties:{private:{lumiRequest:id}}};
    let r=await google(api+'?sendUpdates=none',{method:'POST',headers:{authorization:'Bearer '+accessToken,'content-type':'application/json'},body:JSON.stringify(payload)}),duplicate=false;
    if(r.status===409){duplicate=true;r=await google(api+'/'+id,{headers:{authorization:'Bearer '+accessToken}});}
    if([401,403].includes(r.status))fail('PERMISSION');if(!r.ok)fail('GOOGLE');const created=await r.json();if(created.id!==id||created.extendedProperties?.private?.lumiRequest!==id||created.status==='cancelled')fail('GOOGLE');
    return json({created:true,duplicate,event:{id,title:created.summary||event.title,start:created.start?.dateTime||event.start,end:created.end?.dateTime||event.end,htmlLink:typeof created.htmlLink==='string'&&created.htmlLink.startsWith('https://www.google.com/calendar/')?created.htmlLink:''}});
   }
   // Legacy POST now prepares only. It never creates an event without a second request.
   const event=validateEvent(body,now()),accessToken=await access(env,user.id),checked=await check(event,accessToken,user.id),conflictToken=checked.conflicts.length?random():null;const confirmationId=random();await env.Memory.put('calendar:v3:draft:'+user.id+':'+confirmationId,await encrypt(env,{userId:user.id,event,expiresAt:now()+600000,conflictToken,conflictFingerprint:checked.fingerprint}),{expirationTtl:600});return json({created:false,requiresConfirmation:true,confirmationId,event,expiresIn:600,conflicts:conflictInfo(checked,conflictToken)},202);
  }catch(error){return errorResponse(error,request);}
 };
}
