import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {patchCalendarApp,CALENDAR_FRONTEND} from '../lumi-calendar/calendar-frontend.mjs';
test('weather switches away from pending calendar and carries verified research sources',async()=>{
 const source=patchCalendarApp(readFileSync(new URL('../app.js',import.meta.url),'utf8'));
 const start=source.indexOf('async function getReply(text) {'),end=source.indexOf('\n  return data;\n}',start)+'\n  return data;\n}'.length;
 const helper=CALENDAR_FRONTEND.slice(CALENDAR_FRONTEND.indexOf('async function lumiResearchWeather('),CALENDAR_FRONTEND.indexOf('async function lumiReviewPendingCalendarEvent('));
 let called;
 const request=async(url,opts)=>{called={url,body:JSON.parse(opts.body)};return Response.json({status:'complete',answer:'Previsão verificada.',citations:[{url:'https://inmet.gov.br/'}]});};
 const getReply=new Function('authFetch','WORKER_URL','state',helper+source.slice(start,end)+';return getReply;')(request,'https://lumi.test/',{messages:[{role:'assistant',content:'CONFIRMAR EVENTO'}]});
 const reply=await getReply('Oi Luane qual é a previsão do tempo para Bauru hoje e amanhã?');
 assert.equal(called.url,'https://lumi.test/research');assert.match(called.body.question,/Bauru/);assert.match(reply.reply,/https:\/\/inmet.gov.br/);assert.doesNotMatch(reply.reply,/consulta|confirmar/i);
 const unverified=new Function('request','base','text',helper+';return lumiResearchWeather(text,request,base);')(async()=>Response.json({status:'complete',answer:'31 graus',citations:[]}), 'https://lumi.test/','clima Bauru');
 assert.doesNotMatch((await unverified).reply,/31 graus/);
});
