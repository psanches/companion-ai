import {calendarProposal} from './calendar-conversation.mjs';
import {createCalendarHandler,HOST} from './calendar.mjs';
import {patchCalendarApp} from './calendar-frontend.mjs';
export function withCalendar(original,handle=createCalendarHandler()){
 return {...original,async fetch(request,env,ctx){
  if(new URL(request.url).hostname!==HOST)return original.fetch.call(original,request,env,ctx);
  const response=await handle(request,env);if(response)return response;
  const upstream=await original.fetch.call(original,request,env,ctx);
  if(new URL(request.url).pathname==='/app.js'&&request.method==='GET'&&upstream.ok){const body=patchCalendarApp(await upstream.text()),headers=new Headers(upstream.headers);for(const k of ['etag','content-length','content-encoding'])headers.delete(k);headers.set('cache-control','no-store');headers.set('x-lumi-calendar','confirmed-events-v13');return new Response(body,{status:200,headers});}
  if(['/chat','/api/chat'].includes(new URL(request.url).pathname)&&request.method==='POST'&&upstream.ok&&upstream.headers.get('content-type')?.includes('application/json')){
   const data=await upstream.clone().json();const event=calendarProposal(data.reply);
   if(event){const headers=new Headers(upstream.headers);for(const k of ['etag','content-length','content-encoding'])headers.delete(k);headers.set('cache-control','no-store');return new Response(JSON.stringify({...data,reply:'Revise os dados e toque em Confirmar e criar evento.',calendarEvent:event}),{status:upstream.status,headers});}
  }
  return upstream;
 }};
}
