// Presentation only: never enters saved messages, model context or speech output.
export function installReplyNotice(){
 const ready=()=>{
  const messages=document.getElementById('messages');if(!messages)return;
  let completed=0,lastWelcome=null;
  const texts={
   en:'Lumi is an AI platform for emotional support and daily routine organization, and a repository of specialized articles and educational resources about Parkinson’s disease. Lumi does not diagnose, prescribe, replace medical care, personal interaction or provide emergency medical services. Always consult your neurologist or physician.',
   pt:'A Lumi é uma plataforma de IA para apoio emocional e organização da rotina diária, além de um repositório de matérias especializadas e recursos educativos sobre a doença de Parkinson. A Lumi não faz diagnósticos, não prescreve, não substitui cuidados médicos nem a interação pessoal e não oferece serviços médicos de emergência. Consulte sempre seu neurologista ou médico.'
  };
  function update(){
   const language=window.LumiI18n?.language==='en'?'en':'pt';
   const welcome=messages.querySelector('[data-lumi-welcome]');
   if(welcome&&welcome!==lastWelcome)completed=0;
   lastWelcome=welcome;
   const replies=[...messages.querySelectorAll('.msg.assistant:not(#lumiCalendarWeek):not(#lumiCalendarDay)')];
   const guides=['lumiGuideDialog','lumiDemoDialog'].map(id=>document.getElementById(id)).filter(Boolean);replies.push(...guides);
   for(const message of replies){
    const eligible=guides.includes(message)||message.hasAttribute('data-lumi-welcome')||message.dataset.lumiNoticeDue==='true';
    let notice=message.querySelector(':scope > .lumi-reply-notice');
    if(!eligible){notice?.remove();continue;}
    if(!notice){notice=document.createElement('small');notice.className='lumi-reply-notice';notice.dataset.lumiOriginal='true';const intro=guides.includes(message)?message.querySelector('p'):null;if(intro)intro.after(notice);else message.append(notice);}
    if(notice.textContent!==texts[language])notice.textContent=texts[language];
    notice.lang=language==='en'?'en':'pt-BR';
   }
  }
  function replyCompleted(){
   const reply=[...messages.querySelectorAll('.msg.assistant:not([data-lumi-welcome]):not([data-lumi-ui])')].at(-1);
   if(!reply)return;
   completed++;
   if(completed%10===0)reply.dataset.lumiNoticeDue='true';
   update();
  }
  const observer=new MutationObserver(update);observer.observe(messages,{childList:true,subtree:true,characterData:true});
  window.addEventListener('lumi-chat-reply',replyCompleted);
  window.addEventListener('lumi-session-change',()=>{completed=0;lastWelcome=null;});
  window.addEventListener('lumi-language-change',update);
  window.addEventListener('pagehide',event=>{if(!event.persisted)observer.disconnect();},{once:true});
  update();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
}
// One event per successful user-message/reply exchange, after any history render.
// Loading older messages, language changes and failed requests do not count.
export function patchReplyNoticeChat(source){
 const marker='  } catch (err) {';
 if(source.split(marker).length!==2)throw Error('Unrecognized reply completion boundary');
 return source.replace(marker,'    window.dispatchEvent(new Event("lumi-chat-reply"));\n'+marker);
}
