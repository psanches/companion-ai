/* No personal data is persisted by the viewport/update controller. */
(() => {
 // Add future public sites here; non-Portuguese entries get a translation link.
 const importantLinks=[
  {title:"The Parkinson’s Institute — KeySense",url:"https://www.parkinsons-research.org/index.htm",language:"en"},
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
