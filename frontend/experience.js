/* No personal data is persisted by the viewport/update controller. */
(() => {
 // Add future public sites here; non-Portuguese entries get a translation link.
 const importantLinks=[
  {title:"The Parkinson’s Institute — KeySense",url:"https://www.parkinsons-research.org/index.htm",language:"en"},
  {title:"Organização Mundial da Saúde — Doença de Parkinson",url:"https://www.who.int/news-room/fact-sheets/detail/parkinson-disease",language:"en"},
  {title:"Movimento Parkinson",url:"https://www.movimentoparkinson.com.br/",language:"pt"},
  {title:"AbbVie Pro — Doença de Parkinson",url:"https://www.abbviepro.com/br/pt/conteudo-cientifico/neurociencia/doenca-parkinson.html",language:"pt"},
  {title:"Parkinson Hoje",url:"https://www.parkinsonhoje.com.br/",language:"pt"},
  {title:"Associação Brasil Parkinson — Sobre Parkinson",url:"https://www.parkinson.org.br/sobre-parkinson",language:"pt"},
  {title:"Movement Disorder Society",url:"https://www.movementdisorders.org/MDS/About.htm",language:"en"},
  {title:"ProSense — A jornada da doença de Parkinson",url:"https://prosense.com.br/a-jornada-da-doenca-de-parkinson-compreendendo-sua-progressao-e-enfrentando-desafios/",language:"pt"},
  {title:"Ativa Parkinson — Instagram",url:"https://www.instagram.com/ativaparkinson/",language:"pt"},
  {title:"Viver com Parkinson — Quiz",url:"https://vivercomparkinson.com.br/quiz",language:"pt"},
  {title:"The Michael J. Fox Foundation",url:"https://www.michaeljfox.org/",language:"en",translation:"https://www-michaeljfox-org.translate.goog/?_x_tr_sl=en&_x_tr_tl=pt&_x_tr_hl=pt&_x_tr_pto=tc"}
 ];
 const linksDialog=document.getElementById('lumiImportantLinksDialog');
 const linksList=document.getElementById('lumiImportantLinksList');
 if(linksDialog&&linksList){
  for(const site of importantLinks){
   const article=document.createElement('article'),heading=document.createElement('h3');heading.textContent=site.title;article.append(heading);
   const link=(label,url)=>{const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    // Only public outbound pages: distinct navigation URL on each visit.
    a.addEventListener('click',()=>{
     const fresh=new URL(url),visit=Date.now()+'-'+Math.random().toString(36).slice(2);
     if(fresh.hostname==='translate.google.com'&&fresh.searchParams.has('u')){
      const source=new URL(fresh.searchParams.get('u'));source.searchParams.set('_lumi_visit',visit);fresh.searchParams.set('u',source.href);
     }else fresh.searchParams.set('_lumi_visit',visit);
     a.href=fresh.href;
    });
    article.append(a);};
   link('Abrir site original',site.url);
   if(site.language!=='pt')link('Ler em português',site.translation||'https://translate.google.com/translate?sl=auto&tl=pt&u='+encodeURIComponent(site.url));
   linksList.append(article);
  }
  document.getElementById('lumiImportantLinksBtn')?.addEventListener('click',()=>linksDialog.showModal());
 }
 const root=document.documentElement,viewport=window.visualViewport;
 function fit(){
  // Chrome Android resizes the visual viewport when the keyboard opens.
  // Keep pinch zoom available; do not relayout against a zoomed viewport.
  if(viewport && viewport.scale===1)root.style.setProperty('--lumi-viewport-height',Math.round(viewport.height)+'px');
  else root.style.removeProperty('--lumi-viewport-height');
 }
 viewport?.addEventListener('resize',fit);window.addEventListener('resize',fit);fit();
 const current=document.querySelector('meta[name=lumi-release]')?.content;
 let checking=false,pending=false,lastActivity=Date.now();
 for(const type of ['input','pointerdown','keydown'])document.addEventListener(type,()=>{lastActivity=Date.now();},{passive:true});
 function safe(){return !document.querySelector('dialog[open], #chatForm[data-sending=true], #lumiResearchBtn:disabled')&&!document.querySelector('#messageInput')?.value.trim()&&!document.querySelector('#messageInput:focus')&&!(typeof chatBusy!=='undefined'&&chatBusy);}
 function apply(){if(safe())location.reload();}
 function notice(){
  if(document.getElementById('lumiUpdateNotice'))return;
  const box=document.createElement('aside'),text=document.createElement('span'),button=document.createElement('button');
  box.id='lumiUpdateNotice';box.setAttribute('role','status');text.textContent='Nova versão disponível. Atualize após concluir sua mensagem ou janela.';
  button.textContent='Atualizar';button.type='button';button.onclick=apply;box.append(text,button);const header=document.querySelector('.app-header');if(header)header.after(box);else document.body.prepend(box);
 }
 async function check(){
  if(!current||checking||document.hidden||!navigator.onLine)return;
  checking=true;
  try{const r=await fetch('/frontend-version',{cache:'no-store',credentials:'omit'});if(r.ok){const data=await r.json();if(data.release!==current){pending=true;notice();}}}catch{}finally{checking=false;}
  if(pending&&safe()&&Date.now()-lastActivity>60000)apply();
 }
 window.addEventListener('online',check);document.addEventListener('visibilitychange',check);setInterval(check,60000);void check();
 if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const r=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await r.update();}catch{}});
 // Keep hidden mobile sidebar controls out of keyboard navigation; restore focus on close.
 const sidebar=document.getElementById('conversationSidebar');
 if(sidebar){const sync=()=>{const closed=matchMedia('(max-width:900px)').matches&&!sidebar.classList.contains('open');sidebar.inert=closed;sidebar.setAttribute('aria-hidden',String(closed));};new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});window.addEventListener('resize',sync);sync();}
})();

/* Move existing controls on narrow screens; keep their handlers, values and desktop positions. */
(() => {
 function ready(){
  const root=document.documentElement,app=document.querySelector('.app'),sidebar=document.getElementById('conversationSidebar'),header=document.querySelector('.app-header');
  if(!app||!sidebar||!header||document.getElementById('lumiMobileNav'))return;
  const media=matchMedia('(max-width:900px)'),placements=new Map(),t=value=>window.LumiI18n?.t(value)||value;
  const make=(tag,id,text)=>{const node=document.createElement(tag);if(id)node.id=id;if(text)node.textContent=text;return node;};
  const nav=make('nav','lumiMobileNav');nav.setAttribute('aria-label',t('Navegação principal'));
  const chat=make('button','lumiMobileChatBtn','Conversa');chat.type='button';nav.append(chat);app.append(nav);
  const context=make('span','lumiMobileContext','Conversa');header.append(context);
  const playback=make('div','lumiVoicePlaybackControls');document.getElementById('chatForm')?.prepend(playback);
  const groups=make('div','lumiMobileMore');sidebar.append(groups);
  const features=make('div','lumiMobileFeatures');groups.append(features);
  function group(id,label){const details=make('details',id),summary=make('summary',null,label),body=make('div');details.append(summary,body);groups.append(details);return body;}
  const conversations=group('lumiMobileConversations','Conversas anteriores'),account=group('lumiMobileAccount','Minha conta'),help=group('lumiMobileHelp','Ajuda e testes');
  const labels=new Map(),title=sidebar.querySelector('.sidebar-top h2');let active=false;
  const more=document.getElementById('chatHistoryBtn'),agenda=document.getElementById('lumiAgendaBtn');
  const originalMore={text:more?.textContent,label:more?.getAttribute('aria-label'),title:more?.getAttribute('title')},originalAgenda=agenda?.textContent;
  function move(id,target,label){const node=document.getElementById(id);if(!node)return;
   if(!placements.has(node)){const marker=document.createComment('mobile position: '+id);node.before(marker);placements.set(node,marker);}
   if(node.parentNode!==target)target.append(node);
   if(label){labels.set(node,label);node.dataset.mobileLabel=t(label);}
  }
  function closeMenu(){if(sidebar.classList.contains('open'))document.getElementById('closeSidebarBtn')?.click();}
  function update(){
   if(!active)return;const open=sidebar.classList.contains('open'),calendar=!!document.getElementById('lumiCalendarWeek');
   app.classList.toggle('lumi-mobile-agenda',calendar);chat.setAttribute('aria-current',!open&&!calendar?'page':'false');
   agenda?.setAttribute('aria-current',!open&&calendar?'page':'false');more?.setAttribute('aria-current',open?'page':'false');more?.setAttribute('aria-expanded',String(open));
   const text=t(open?'Mais':calendar?'Agenda':'Conversa');if(context.textContent!==text)context.textContent=text;
  }
  function language(){
   chat.textContent=t('Conversa');nav.setAttribute('aria-label',t('Navegação principal'));
   for(const [node,label]of labels)node.dataset.mobileLabel=t(label);
   for(const [id,label]of [['lumiMobileConversations','Conversas anteriores'],['lumiMobileAccount','Minha conta'],['lumiMobileHelp','Ajuda e testes']])document.querySelector('#'+id+' > summary').textContent=t(label);
   if(active){if(more){more.textContent=t('Mais');more.setAttribute('aria-label',t('Mais'));more.title=t('Mais');}if(agenda)agenda.textContent=t('Agenda');if(title)title.textContent=t('Mais');update();}
  }
  function sync(){
   const next=media.matches&&root.classList.contains('lumi-authenticated');if(next===active)return;
   active=next;root.classList.toggle('lumi-mobile-light',active);
   if(active){
    account.parentElement.open=true;groups.prepend(account.parentElement);
    move('lumiAgendaBtn',nav);move('chatHistoryBtn',nav);more?.setAttribute('aria-controls','conversationSidebar');
    for(const id of ['lumiHealthNewsBtn','lumiExerciseBtn','lumiImportantLinksBtn'])move(id,features);
    for(const id of ['sidebarNewChatBtn','conversationList','sidebarStatus'])move(id,conversations);
    const label=sidebar.querySelector('.sidebar-label');if(label){if(!placements.has(label)){const marker=document.createComment('mobile history label');label.before(marker);placements.set(label,marker);}conversations.insertBefore(label,document.getElementById('conversationList'));}
    for(const [id,label]of [['inviteBtn','Convidar para a Lumi'],['profileBtn','Perfil'],['memoryBtn','Minha memória']])move(id,account,label);
    move('soundButton',playback);
    move('lumiLanguageControl',account);move('authBox',account);
    for(const id of ['lumiGuideBtn','lumiDemoBtn','lumiBetaFeedbackBtn','lumiBetaBtn','healthDemoBtn','lumiInstitutionalLink'])move(id,help,id==='healthDemoBtn'?'Meu Cuidado — demonstração':null);
    language();
   }else{
    closeMenu();for(const [node,marker]of placements)if(marker.parentNode)marker.after(node);
    app.classList.remove('lumi-mobile-agenda');
    if(more){more.textContent=t(originalMore.text);for(const [name,value]of [['aria-label',originalMore.label],['title',originalMore.title]])if(value!==null)more.setAttribute(name,t(value));more.removeAttribute('aria-current');more.removeAttribute('aria-expanded');}
    if(agenda){agenda.textContent=t(originalAgenda);agenda.removeAttribute('aria-current');}if(title)title.textContent=t('Conversas');
    for(const details of groups.querySelectorAll('details'))details.open=false;
   }
  }
  chat.addEventListener('click',()=>{closeMenu();document.getElementById('lumiCalendarWeek')?.remove();document.getElementById('lumiCalendarDay')?.remove();update();});
  agenda?.addEventListener('click',()=>{if(active)agenda.focus();});
  // Close the drawer before the original action opens a dialog or navigates.
  sidebar.addEventListener('click',event=>{const action=event.target.closest('button,a');if(active&&action&&action.id!=='closeSidebarBtn')closeMenu();},true);
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});
  new MutationObserver(update).observe(sidebar,{attributes:true,attributeFilter:['class']});
  new MutationObserver(update).observe(document.getElementById('messages'),{childList:true});
  media.addEventListener('change',sync);window.addEventListener('lumi-language-change',language);sync();
 }
 if(document.readyState==='complete')ready();else document.addEventListener('DOMContentLoaded',ready,{once:true});
})();
