/* No personal data is persisted by the viewport/update controller. */
(() => {
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
  box.id='lumiUpdateNotice';box.setAttribute('role','status');text.textContent='Uma nova versão da Lumi está disponível. Conclua sua mensagem ou janela antes de atualizar.';
  button.textContent='Atualizar';button.type='button';button.onclick=apply;box.append(text,button);document.body.append(box);
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
