import {createCalendarHandler,HOST} from './calendar.mjs';
import {patchCalendarApp} from './calendar-frontend.mjs';
export function withCalendar(original,handle=createCalendarHandler()){
 return {...original,async fetch(request,env,ctx){
  if(new URL(request.url).hostname!==HOST)return original.fetch.call(original,request,env,ctx);
  const response=await handle(request,env);if(response)return response;
  const upstream=await original.fetch.call(original,request,env,ctx);
  if(new URL(request.url).pathname==='/app.js'&&request.method==='GET'&&upstream.ok){const body=patchCalendarApp(await upstream.text()),headers=new Headers(upstream.headers);for(const k of ['etag','content-length','content-encoding'])headers.delete(k);headers.set('cache-control','no-store');headers.set('x-lumi-calendar','confirmed-events-v7');return new Response(body,{status:200,headers});}
  return upstream;
 }};
}
