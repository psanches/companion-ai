import {closeMobileMenu} from './mobile-navigation-browser.mjs';
import assert from 'node:assert/strict';

export async function checkAppLanguages(page,{mobile=false,screenshotPath}={}){
 const previous=await page.locator('#messageInput').inputValue();
 const history=await page.locator('#messages .msg:not(#lumiCalendarWeek):not(#lumiCalendarDay)').evaluateAll(nodes=>nodes.map(n=>{const clone=n.cloneNode(true);clone.querySelectorAll('.lumi-reply-notice').forEach(x=>x.remove());return clone.textContent;}));
 await page.locator('#messageInput').fill('Draft: Salvar · contact name');
 await closeMobileMenu(page);await page.locator('#lumiLanguageSelect').selectOption('en');
 await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.getElementById('lumiAgendaBtn').textContent.includes('Calendar'));
 assert.equal(await page.locator('#messageInput').inputValue(),'Draft: Salvar · contact name');
 await page.locator('#messages .lumi-reply-notice').first().getByText('Lumi is an AI platform for emotional support and daily routine organization.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'English controls must fit the viewport');
 if(mobile)for(const id of ['sidebarNewChatBtn','lumiLanguageSelect'])assert.ok(await page.locator('#'+id).evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),id+' fits in English');
 assert.deepEqual(await page.locator('#messages .msg:not(#lumiCalendarWeek):not(#lumiCalendarDay)').evaluateAll(nodes=>nodes.map(n=>{const clone=n.cloneNode(true);clone.querySelectorAll('.lumi-reply-notice').forEach(x=>x.remove());return clone.textContent;})),history);
 await page.locator('#voiceButton').click();
 assert.equal(await page.evaluate(()=>window.__voiceInstances.at(-1).lang),'en-US');
 await page.locator('#voiceButton').click();await page.evaluate(()=>{document.getElementById('lumiVoiceStatus').hidden=true;});
 const speechLanguage=await page.evaluate(()=>{const synth=window.speechSynthesis,original=synth.speak;let lang;try{synth.speak=utterance=>{lang=utterance.lang;};lumiSoundEnabled=true;speakLumi('Good morning.');return lang;}finally{synth.speak=original;lumiSoundEnabled=false;}});
 assert.equal(speechLanguage,'en-US');
 await page.locator('#lumiSosBtn').click();
 await page.getByRole('heading',{name:'Caregiver / SOS',exact:true}).waitFor();
 assert.equal(new URL(await page.locator('#lumiSosWhatsApp').getAttribute('href')).searchParams.get('text'),'I need help. Please contact me.');
 assert.equal(await page.locator('#lumiSosSamuCall').getAttribute('href'),'tel:911');
 assert.equal(await page.locator('#lumiSosSamuCall').textContent(),'Dial 911');
 await page.getByRole('button',{name:'Back to Lumi',exact:true}).click();

 await page.locator('#lumiAgendaBtn').click();
 await page.getByRole('button',{name:'Close calendar',exact:true}).waitFor();
 await page.locator('#lumiCalendarWeek').getByText('14:00 – 14:30 · Compromisso fictício da agenda',{exact:true}).waitFor();
 await closeMobileMenu(page);await page.locator('#lumiLanguageSelect').selectOption('pt-BR');
 await page.getByRole('button',{name:'Fechar agenda',exact:true}).waitFor();await page.getByRole('button',{name:'Fechar agenda',exact:true}).click();
 await closeMobileMenu(page);await page.locator('#lumiLanguageSelect').selectOption('en');
 assert.equal(await page.locator('#settingsBtn, #settingsDialog').count(),0);
 if(screenshotPath)await page.screenshot({path:screenshotPath,fullPage:true});
 await closeMobileMenu(page);await page.locator('#lumiLanguageSelect').selectOption('pt-BR');
 await page.waitForFunction(()=>document.documentElement.lang==='pt-BR');
 assert.equal(await page.locator('#lumiSosSamuCall').getAttribute('href'),'tel:192');
 assert.equal(await page.locator('#lumiSosSamuCall').textContent(),'SAMU · 192');
 await page.locator('#messageInput').fill(previous);
}

export async function checkMindBodyEnglish(page){
 await closeMobileMenu(page);await page.locator('#lumiLanguageSelect').selectOption('en');
 await page.getByRole('heading',{name:'Memory and attention game',exact:true}).waitFor();
 assert.equal(await page.locator('#words').textContent(),'HOUSE · FLOWER · SUN');
 await page.getByRole('button',{name:'I have memorized them',exact:true}).click();
 await page.getByRole('button',{name:'FLOWER',exact:true}).click();await page.getByText('Well done!',{exact:true}).waitFor();
 await page.locator('#bodyTab').click();await page.getByText('Calm breathing',{exact:false}).first().waitFor();
 assert.ok((await page.locator('#bodyExercise').textContent()).includes('breathe in naturally'));
 await page.locator('#psychTab').click();await page.getByText('Lumi: How are you feeling today?',{exact:true}).waitFor();
 await page.getByRole('button',{name:'I am well',exact:true}).click();await page.getByText('Thank you for sharing. We can continue at your pace.',{exact:true}).waitFor();
 await closeMobileMenu(page);await page.locator('#lumiLanguageSelect').selectOption('pt-BR');
}
