// Presentation only: never enters saved messages, model context or speech output.
export function installReplyNotice(){
 const ready=()=>{
  const messages=document.getElementById('messages');if(!messages)return;
  const texts={
   en:'Lumi is an AI platform for emotional support and daily routine organization. Lumi does not diagnose, prescribe, replace medical care, personal interaction or provide emergency medical services. Always consult your neurologist or physician',
   pt:'A Lumi é uma plataforma de IA para apoio emocional e organização da rotina diária. A Lumi não faz diagnósticos, não prescreve, não substitui cuidados médicos nem a interação pessoal e não oferece serviços médicos de emergência. Consulte sempre seu neurologista ou médico.'
  };
  function update(){
   const language=window.LumiI18n?.language==='en'?'en':'pt';
   for(const message of messages.querySelectorAll('.msg.assistant:not(#lumiCalendarWeek):not(#lumiCalendarDay)')){
    if(message.textContent.trim()==='Pensando…')continue;
    let notice=message.querySelector(':scope > .lumi-reply-notice');
    if(!notice){notice=document.createElement('small');notice.className='lumi-reply-notice';notice.dataset.lumiOriginal='true';message.append(notice);}
    if(notice.textContent!==texts[language])notice.textContent=texts[language];
    notice.lang=language==='en'?'en':'pt-BR';
   }
  }
  const observer=new MutationObserver(update);observer.observe(messages,{childList:true,subtree:true,characterData:true});
  window.addEventListener('lumi-language-change',update);
  window.addEventListener('pagehide',event=>{if(!event.persisted)observer.disconnect();},{once:true});
  update();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
}
