export function installLumiLanguage(dictionary){
 if(window.LumiI18n)return;
 const KEY='lumi-language-v1',allowed=['pt-BR','en'];
 let language='pt-BR';try{const saved=localStorage.getItem(KEY);if(allowed.includes(saved))language=saved;}catch{}
 const reverse=new Map(Object.entries(dictionary).map(([pt,en])=>[en,pt]));
 const initialTitle=document.title;
 const textRecords=new WeakMap(),attributeRecords=new WeakMap();
 function translate(value){
  const raw=String(value??''),trim=raw.trim(),pt=Object.hasOwn(dictionary,trim)?trim:reverse.get(trim);
  if(pt!==undefined)return raw.replace(trim,language==='en'?dictionary[pt]:pt);
  if(trim.includes(' · '))return raw.replace(trim,trim.split(' · ').map(translate).join(' · '));
  if(language!=='en')return raw.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(.*)$/,(m,a,b)=>(reverse.get(a)||a)+b);
  for(const [pattern,replace]of [
   [/^(.*?)(Código: )(.*)$/,(m,a,b,c)=>translate(a)+'Code: '+c],
   [/^(\d+) de (\d+) — (.*)$/,(m,a,b,c)=>a+' of '+b+' — '+translate(c)],
   [/^Lumi: (.*)$/,(m,a)=>'Lumi: '+translate(a)],
   [/^Rodadas concluídas: (\d+) · Acertos: (\d+)$/,(m,a,b)=>'Rounds completed: '+a+' · Correct: '+b],
   [/^Tudo bem\. A resposta era (.*)\.$/,(m,a)=>'That is OK. The answer was '+translate(a)+'.'],
   [/^Relato recebido\. Código: (.*)$/,(m,a)=>'Report received. Code: '+a],
   [/^(segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|domingo)(.*)$/,(m,a,b)=>translate(a)+b],
   [/^(Publicado em |Fonte: |Boletim de )(.*)$/,(m,a,b)=>translate(a.trim())+' '+b]
  ])if(pattern.test(trim))return raw.replace(trim,trim.replace(pattern,replace));
  return raw;
 }
 function excluded(element){
  if(!element||element.closest('script,style,textarea,[contenteditable],code,pre,[data-lumi-original],#fictionalReport,.conversation-item,#lumiSosActions h3,#lumiBetaFeedbackDialog article,#newsItems h2,#newsItems .news-summary'))return true;
  const message=element.closest('#messages .msg');
  if(message&&!message.matches('#lumiCalendarWeek,#lumiCalendarDay,[data-lumi-ui]'))return true;
  if(element.closest('#lumiCalendarWeek article,#lumiCalendarDay article'))return true;
  if(location.pathname.startsWith('/sobre'))return true;
  return false;
 }
 function apply(root=document.body){
  if(!root||excluded(root.nodeType===1?root:root.parentElement))return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  function visit(node){
   const el=node.nodeType===1?node:node.parentElement;if(excluded(el))return;
   if(node.nodeType===3){
    const old=textRecords.get(node);const original=old&&node.data===old.rendered?old.original:node.data;
    const rendered=translate(original);textRecords.set(node,{original,rendered});if(node.data!==rendered)node.data=rendered;
   }else for(const attr of ['placeholder','aria-label','title','alt'])if(node.hasAttribute(attr)){
    const records=attributeRecords.get(node)||{},value=node.getAttribute(attr),old=records[attr];
    const original=old&&value===old.rendered?old.original:value,rendered=translate(original);
    records[attr]={original,rendered};attributeRecords.set(node,records);if(value!==rendered)node.setAttribute(attr,rendered);
   }
  }
  visit(root);while(walker.nextNode())visit(walker.currentNode);
 }
 let select;
 function setLanguage(next,{persist=true}={}){
  if(!allowed.includes(next))return false;
  language=next;document.documentElement.lang=next==='en'?'en':'pt-BR';document.title=translate(initialTitle);
  if(persist)try{localStorage.setItem(KEY,next);}catch{}
  if(select)select.value=next;apply();
  if('speechSynthesis'in window)window.speechSynthesis.cancel();
  window.dispatchEvent(new CustomEvent('lumi-language-change',{detail:{language:next}}));
  return true;
 }
 window.LumiI18n={get language(){return language;},t:translate,setLanguage,apply};
 for(const name of ['alert','confirm'])if(typeof window[name]==='function'){const original=window[name].bind(window);window[name]=message=>original(translate(message));}
 document.documentElement.lang=language==='en'?'en':'pt-BR';
 function ready(){
  if(location.pathname.startsWith('/sobre'))return;
  const label=document.createElement('label');label.id='lumiLanguageControl';label.className='lumi-language-control';
  const text=document.createElement('span');text.textContent='Idioma / Language';text.className='lumi-language-label';
  select=document.createElement('select');select.id='lumiLanguageSelect';select.setAttribute('aria-label','Idioma / Language');
  for(const [value,name]of [['pt-BR','Português'],['en','English']]){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
  select.value=language;select.onchange=()=>setLanguage(select.value);label.append(text,select);
  const header=document.querySelector('.app-header .header-actions');
  if(header)header.prepend(label);else{const toolbar=document.createElement('div');toolbar.className='lumi-language-toolbar';toolbar.append(label);const back=document.getElementById('lumiReturnNav');if(back)back.after(toolbar);else document.body.prepend(toolbar);}
  let scheduled=false,stopped=false;const observer=new MutationObserver(()=>{if(scheduled||stopped)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(!stopped)apply();});});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title','alt']});
  window.addEventListener('pagehide',event=>{if(!event.persisted){stopped=true;observer.disconnect();}},{once:true});
  apply();
  document.title=translate(initialTitle);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
 window.addEventListener('storage',event=>{if(event.key===KEY&&allowed.includes(event.newValue))setLanguage(event.newValue,{persist:false});});
}
