import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {patchCalendarApp} from '../lumi-calendar/calendar-frontend.mjs';

test('assembled real chat routes agenda reads, event creation and confirmation without missing variables', async () => {
  const source = patchCalendarApp(readFileSync(new URL('../app.js', import.meta.url), 'utf8'));
  const start = source.indexOf('async function getReply(text) {');
  const end = source.indexOf('\n  return data;\n}', start) + '\n  return data;\n}'.length;
  const calls = [];
  const authFetch = async (url, options) => {
    calls.push({url, options});
    return Response.json(url.endsWith('/chat') ? {reply: 'Chat response'} : {events: []});
  };
  const create = async text => { calls.push({create: text}); return {reply: 'Review event'}; };
  const getReply = new Function('authFetch', 'WORKER_URL', 'state', 'lumiCreateCalendarEvent', 'lumiReviewPendingCalendarEvent',
    source.slice(start, end) + '; return getReply;')(authFetch, 'https://lumi.test/', {messages: []}, create, async () => ({reply:'Pending review'}));
  for (const text of ['agenda', 'eventos de hoje', 'calendar']) {
    calls.length = 0;
    await getReply(text);
    assert.deepEqual(calls, [{url: 'https://lumi.test/calendar/events', options: undefined}]);
  }
  calls.length = 0;
  assert.equal((await getReply('criar evento amanhã às 14:30')).reply, 'Review event');
  assert.deepEqual(calls, [{create: 'criar evento amanhã às 14:30'}]);
  calls.length=0;
  assert.equal((await getReply('Oi Luane me marca uma consulta de neurologista')).reply,'Review event');
  assert.deepEqual(calls,[{create:'Oi Luane me marca uma consulta de neurologista'}]);
  assert.equal((await getReply('CONFIRMAR EVENTO')).reply, 'Pending review');
  for (const text of ['Olá Lumi', 'Qual marca de medicamento devo levar à consulta?', 'Quero que você me diga qual o melhor exame para detectar riscos de eventos cerebrais?', 'O que são eventos adversos de medicamentos?', 'Como prevenir eventos cardiovasculares?']) {
    calls.length = 0;
    assert.equal((await getReply(text)).reply, 'Chat response');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://lumi.test/chat');
  }
});


test('today requests and Calendar connection followups use real integration instead of generic chat', async () => {
  const source=patchCalendarApp(readFileSync(new URL('../app.js',import.meta.url),'utf8'));
  const start=source.indexOf('async function getReply(text) {'),end=source.indexOf('\n  return data;\n}',start)+'\n  return data;\n}'.length;
  const state={messages:[]},calls=[];
  const getReply=new Function('authFetch','WORKER_URL','state','lumiCreateCalendarEvent','lumiReviewPendingCalendarEvent','lumiRememberTodayAgenda','lumiShowCalendarDay','lumiConnectGoogleCalendar',source.slice(start,end)+';return getReply;')(
    async()=>{calls.push('chat');return Response.json({reply:'chat'});},'https://lumi.test/',state,async()=>({reply:'create'}),async()=>({reply:'review'}),()=>calls.push('remember'),async(created)=>{assert.equal(created,null);calls.push('day');},async()=>{calls.push('connect');return {reply:'opening'};});
  for(const text of ['O que temos para hoje','O que tenho pra hoje?','Qual é a minha agenda de hoje?']){calls.length=0;await getReply(text);assert.deepEqual(calls,['remember','day']);}
  state.messages=[{role:'assistant',content:'Você quer ver sua agenda/compromissos de hoje?'},{role:'user',content:'Sim'}];calls.length=0;await getReply('Sim');assert.deepEqual(calls,['remember','day']);
  calls.length=0;await getReply('Conectar');assert.deepEqual(calls,['remember','connect']);
  state.messages=[{role:'assistant',content:'Como está seu sono hoje?'}];calls.length=0;await getReply('Sim');assert.deepEqual(calls,['chat']);
  state.messages=[{role:'assistant',content:'Criar e confirmar evento hoje?'}];calls.length=0;await getReply('Sim');assert.deepEqual(calls,['chat']);
});

test('book recommendations remain ordinary chat while book an appointment opens event review',async()=>{
 const source=patchCalendarApp(readFileSync(new URL('../app.js',import.meta.url),'utf8')),start=source.indexOf('async function getReply(text) {'),end=source.indexOf('\n  return data;\n}',start)+'\n  return data;\n}'.length,calls=[];
 const getReply=new Function('authFetch','WORKER_URL','state','lumiCreateCalendarEvent',source.slice(start,end)+';return getReply;')(
  async()=>{calls.push('chat');return Response.json({reply:'Chat'});},'https://lumi.test/',{messages:[]},async()=>{calls.push('create');return {reply:'Review'};});
 for(const text of ['Can you recommend a book about Parkinson?','A book about hospital appointments','What is my schedule like?']){calls.length=0;await getReply(text);assert.deepEqual(calls,['chat'],text);}
 for(const text of ['Book an appointment tomorrow','Schedule a meeting tomorrow','Agende uma consulta amanhã']){calls.length=0;await getReply(text);assert.deepEqual(calls,['create'],text);}
});
test('tomorrow and explicit dates use the exact day reader including year boundaries',async()=>{
 const source=patchCalendarApp(readFileSync(new URL('../app.js',import.meta.url),'utf8')),start=source.indexOf('async function getReply(text) {'),end=source.indexOf('\n  return data;\n}',start)+'\n  return data;\n}'.length,calls=[];
 class FixedDate extends Date{constructor(value){super(arguments.length?value:'2026-12-31T23:30:00-03:00');}}
 const getReply=new Function('Date','authFetch','WORKER_URL','state','lumiShowCalendarDay',source.slice(start,end)+';return getReply;')(
  FixedDate,async()=>{throw Error('Must not query unfiltered upcoming events');},'https://lumi.test/',{messages:[]},async(...args)=>calls.push(args));
 for(const [text,day]of [['Minha agenda de amanhã','2027-01-01'],['My calendar tomorrow','2027-01-01'],['Minha agenda de 05/01/2027','2027-01-05']]){await getReply(text);assert.equal(calls.at(-1)[0],null);assert.equal(calls.at(-1)[4],day);}
 const count=calls.length;assert.match((await getReply('Minha agenda de 31/02/2027')).reply,/Data inválida/);assert.equal(calls.length,count);
});
