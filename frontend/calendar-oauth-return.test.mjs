import test from 'node:test';
import assert from 'node:assert/strict';
import {createCalendarHandler,ORIGIN} from '../lumi-calendar/calendar.mjs';
import {CALENDAR_FRONTEND} from '../lumi-calendar/calendar-frontend.mjs';

test('OAuth callback persists owner grant and immediate week/day reads verify Google without reconnecting',async()=>{
 const map=new Map(),calls=[],env={GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',CALENDAR_SESSION_SECRET:'x'.repeat(40),Memory:{get:async k=>map.get(k)||null,put:async(k,v)=>map.set(k,v),delete:async k=>map.delete(k)}};
 const handle=createCalendarHandler({verify:async token=>token==='verified-session'?{id:'alice'}:null,fetcher:async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/tokeninfo'))return Response.json({aud:'test-client',scope:'https://www.googleapis.com/auth/calendar.events'});
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'private-access',refresh_token:'private-refresh',scope:'https://www.googleapis.com/auth/calendar.events',expires_in:3600});
  assert.equal(options.headers.authorization,'Bearer private-access');
  return Response.json({items:[{id:'existing',summary:'Consulta',start:{dateTime:'2026-10-24T10:00:00-03:00'},end:{dateTime:'2026-10-24T10:30:00-03:00'}}]});
 }});
 const request=(path,body,extra={})=>new Request(ORIGIN+path,{method:body?'POST':'GET',headers:{origin:ORIGIN,authorization:'Bearer verified-session','content-type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
 const start=await handle(request('/auth/google/start',{}),env),cookie=start.headers.get('set-cookie').split(';')[0],oauth=new URL((await start.json()).url);
 const returned=await handle(request('/api/auth/google/callback?state='+oauth.searchParams.get('state')+'&code=code',null,{cookie}),env);
 assert.equal(returned.status,303);assert.match(returned.headers.get('location'),/calendar_connected=1/);
 for(const kind of ['week','day']){const result=await handle(request('/calendar/events/'+kind,{date:'2026-10-24'}),env);assert.equal(result.status,200);const data=await result.json();assert.equal(data.events[0].title,'Consulta');assert.doesNotMatch(JSON.stringify(data),/private-access|private-refresh/);}
 assert.equal(calls.filter(c=>c.url.includes('tokeninfo')).length,2);
 const denied=await handle(request('/calendar/events/week',{date:'2026-10-24'},{authorization:'Bearer rejected'}),env);assert.equal(denied.status,401);
});

test('connect command requests a real OAuth URL and rejects redirects outside Google',async()=>{
 const start=CALENDAR_FRONTEND.indexOf('async function lumiConnectGoogleCalendar'),end=CALENDAR_FRONTEND.indexOf('function lumiRememberTodayAgenda',start),navigations=[];
 const connect=new Function('location',CALENDAR_FRONTEND.slice(start,end)+';return lumiConnectGoogleCalendar;')({assign:url=>navigations.push(url)});
 let options;
 await connect(async(url,o)=>{assert.equal(url,'https://lumi.test/auth/google/start');options=o;return Response.json({url:'https://accounts.google.com/o/oauth2/v2/auth?state=test'});},'https://lumi.test/');
 assert.equal(options.method,'POST');assert.equal(options.body,'{}');assert.equal(navigations.length,1);
 await assert.rejects(connect(async()=>Response.json({url:'https://evil.test/'}),'https://lumi.test/'),/inválido/);assert.equal(navigations.length,1);
 await assert.rejects(connect(async()=>Response.json({error:'Serviço indisponível'},{status:503}),'https://lumi.test/'),/indisponível/);assert.equal(navigations.length,1);
});
