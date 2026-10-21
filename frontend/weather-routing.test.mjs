import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {patchCalendarApp} from '../lumi-calendar/calendar-frontend.mjs';
test('weather and its follow-up use authenticated chat so the server retains research context',async()=>{
 const source=patchCalendarApp(readFileSync(new URL('../app.js',import.meta.url),'utf8'));
 const start=source.indexOf('async function getReply(text) {'),end=source.indexOf('\n  return data;\n}',start)+'\n  return data;\n}'.length;
 const calls=[];const request=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({reply:'Previsão com fontes.',history:[]});};
 const getReply=new Function('authFetch','WORKER_URL','state',source.slice(start,end)+';return getReply;')(request,'https://lumi.test/',{messages:[]});
 for(const text of ['Qual é a previsão do tempo para Bauru hoje e amanhã?','Se eu quiser lembrete eu peço. essa informação é de hoje']){await getReply(text);assert.equal(calls.at(-1).url,'https://lumi.test/chat');assert.equal(calls.at(-1).body.message,text);}
});
