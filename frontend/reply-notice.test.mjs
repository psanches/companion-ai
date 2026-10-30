import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import {installReplyNotice} from './reply-notice.mjs';
const tick=()=>new Promise(r=>setTimeout(r,0));
test('new and restored replies show one notice, preserve content and follow language without touching user text',async()=>{
 const dom=new JSDOM('<div id="messages"><div class="msg user">My question</div><div class="msg assistant">Saved answer <a href="https://example.com">source</a></div><div class="msg assistant" id="lumiCalendarWeek">Calendar</div></div>',{runScripts:'outside-only'});
 const w=dom.window,d=w.document;w.LumiI18n={language:'pt-BR'};w.eval('('+installReplyNotice.toString()+')()');await tick();
 assert.equal(d.querySelectorAll('.lumi-reply-notice').length,1);assert.equal(d.querySelector('.msg.user').textContent,'My question');assert.equal(d.getElementById('lumiCalendarWeek').textContent,'Calendar');assert.match(d.querySelector('small').textContent,/Consulte sempre seu neurologista/);
 const response=d.createElement('div');response.className='msg assistant';response.textContent='New answer';d.getElementById('messages').append(response);await tick();
 assert.equal(response.querySelectorAll('small').length,1);assert.equal(response.firstChild.textContent,'New answer');
 w.LumiI18n.language='en';w.dispatchEvent(new w.Event('lumi-language-change'));await tick();
 assert.equal(response.querySelector('small').textContent,'Lumi is an AI platform for emotional support and daily routine organization. Lumi does not diagnose, prescribe, replace medical care, personal interaction or provide emergency medical services. Always consult your neurologist or physician');
 assert.equal(d.querySelectorAll('.lumi-reply-notice').length,2);assert.equal(d.querySelector('a').textContent,'source');
 response.textContent='Re-rendered answer';await tick();assert.equal(response.querySelectorAll('small').length,1);
 dom.window.close();
});
