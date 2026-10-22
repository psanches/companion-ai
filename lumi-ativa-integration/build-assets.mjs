import {createHash} from 'node:crypto';
import {RETURN_CSS,addReturnNavigation} from '../frontend/subpage-navigation.mjs';
import fs from 'node:fs';import path from 'node:path';
const dir=new URL('./public/',import.meta.url);const assets={};for(const name of fs.readdirSync(dir)){const bytes=fs.readFileSync(new URL(name,dir));const ext=path.extname(name);const type=({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png'})[ext];if(!type)throw Error('Unexpected public file extension');assets['/ativa-ui/'+name]={type,encoding:ext==='.png'?'base64':'utf8',content:ext==='.png'?bytes.toString('base64'):bytes.toString('utf8')};}
assets['/ativa-ui/data.js']={type:'application/javascript; charset=utf-8',encoding:'utf8',content:fs.readFileSync(new URL('../ativa-demo/public/data.js',import.meta.url),'utf8')};
for(const name of fs.readdirSync(new URL('../ativa-demo/public/',import.meta.url))){const ext=path.extname(name);const type=({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'})[ext];if(!type)throw Error('Unexpected medical public asset');let content=fs.readFileSync(new URL('../ativa-demo/public/'+name,import.meta.url),'utf8');if(name==='index.html')content=content.replace(/(src|href)="\/(app\.js|style\.css|data\.js|favicon\.svg)"/g,'$1="/ativa-medical/$2"').replace('</head>','<link rel="stylesheet" href="/ativa-ui/medical-theme.css"></head>');assets['/ativa-medical/'+name]={type,encoding:'utf8',content};}

// Inline approved WEBP images into the development-only HTML asset. Fail the build
// if any image is missing, so a green deployment never shows broken illustrations.
let mindBodyHtml=fs.readFileSync(new URL('../lumi-mind-body/index.html',import.meta.url),'utf8');
for(let i=1;i<=4;i++){
 const file=new URL('../lumi-mind-body/exercicio-'+i+'.webp',import.meta.url);
 const bytes=fs.readFileSync(file);
 if(bytes.length<1000)throw Error('Invalid Mind & Body illustration: '+file.pathname);
 mindBodyHtml=mindBodyHtml.replace('exercicio-'+i+'.webp','data:image/webp;base64,'+bytes.toString('base64'));
}
assets['/lumi-original/lumi-mind-body.html']={type:'text/html; charset=utf-8',encoding:'utf8',content:mindBodyHtml};

 // Preserve the original Lumi conversation UI as the development home.
 // Assets are copied from the existing develop app; no production deployment.
const root=new URL('../',import.meta.url);
for(const name of ['index.html','app.js','style.css','manifest.json','sw.js','icon-192.png','icon-512.png','lumi-calendar-v2.js']){
 const bytes=fs.readFileSync(new URL(name,root));
 const ext=path.extname(name);
 const type=({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'})[ext];
 let content=ext==='.png'?bytes.toString('base64'):bytes.toString('utf8');
 // Identidade exclusiva do aplicativo de desenvolvimento no Android.
if(name==='manifest.json'){
  const manifest=JSON.parse(content);
  manifest.id='/lumi-develop-app';
  manifest.name='Lumi Develop — testes';
  manifest.short_name='Lumi Dev';
  manifest.start_url='/?source=lumi-develop';
  manifest.scope='/';
  content=JSON.stringify(manifest);
}

// Cache separado para o ambiente de desenvolvimento.
if(name==='sw.js'){
  content=content.replace(
    /const CACHE_NAME = "lumi-v[^"]+";/,
    'const CACHE_NAME = "lumi-develop-v1";'
  );
}
 if(name==='index.html'){
  const authCss=`<style>
/* Development-only fail-closed visibility until Supabase session verification. */
html:not(.lumi-authenticated) #conversationSidebar,
html:not(.lumi-authenticated) #sidebarBackdrop,
html:not(.lumi-authenticated) #chatHistoryBtn,
html:not(.lumi-authenticated) #inviteBtn,
html:not(.lumi-authenticated) #profileBtn,
html:not(.lumi-authenticated) #healthDemoBtn,
html:not(.lumi-authenticated) #memoryBtn,
html:not(.lumi-authenticated) #soundButton,
html:not(.lumi-authenticated) #settingsBtn,
html:not(.lumi-authenticated) #newChatBtn,
html:not(.lumi-authenticated) #loadEarlierBtn,
html:not(.lumi-authenticated) #messages,
html:not(.lumi-authenticated) #chatForm,
html:not(.lumi-authenticated) #lumiExerciseBtn,
html:not(.lumi-authenticated) .companion-status {display:none!important}
html:not(.lumi-authenticated) .app:after {content:"Please sign in to continue.";display:block;text-align:center;margin:15vh auto 0;padding:1rem;color:#e5e7eb;font:500 1.1rem system-ui}
html:not(.lumi-authenticated) #signInBtn {display:inline-flex!important;visibility:visible!important}
/* Explicitly restore all personal actions after verified sign-in. */
html.lumi-authenticated #profileBtn,
html.lumi-authenticated #healthDemoBtn,
html.lumi-authenticated #memoryBtn,
html.lumi-authenticated #inviteBtn,
html.lumi-authenticated #soundButton,
html.lumi-authenticated #settingsBtn,
html.lumi-authenticated #chatHistoryBtn {display:grid!important;visibility:visible!important}
/* Restore the development module entry on narrow Android viewports after login. */
html.lumi-authenticated #lumiExerciseBtn {display:block!important;visibility:visible!important;opacity:1!important;width:calc(100% - 28px)!important;box-sizing:border-box!important}
html.lumi-authenticated #signInBtn {display:none!important}
html:not(.lumi-authenticated) #signInBtn {animation:lumiSignInPulse 3s ease-in-out infinite}
@keyframes lumiSignInPulse {0%,65%,100%{box-shadow:0 0 0 0 rgba(125,211,252,0)} 80%{box-shadow:0 0 0 7px rgba(125,211,252,.28)}}
@media(prefers-reduced-motion:reduce){html:not(.lumi-authenticated) #signInBtn{animation:none;outline:2px solid #7dd3fc;outline-offset:2px}}
</style>`;
  content=content.replace('</head>',authCss+'</head>');
  const authObserver=`<script>
/* Development-only presentation guard. Original auth script is preserved byte-for-byte. */
(function(){
  const root=document.documentElement;
  function sync(){
    const out=document.getElementById('signOutBtn');
    const signedIn=!!out && !out.hidden;
    root.classList.toggle('lumi-authenticated',signedIn);
    if(!signedIn){
      for(const dialog of document.querySelectorAll('dialog[open]')){
        if(dialog.id!=='lumiAuthDialog')dialog.close();
      }
    }
  }
  const ready=()=>{
    const box=document.getElementById('authBox');
    if(!box)return;
    new MutationObserver(sync).observe(box,{subtree:true,attributes:true,attributeFilter:['hidden']});
    sync();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
</script>`;
  content=content.replace('</body>',authObserver+'</body>');

  content=content.replace('<div class="sidebar-label">ÚLTIMAS', '<a id="lumiInstitutionalLink" href="/sobre/pt/">✦ Sobre a Lumi</a><div class="sidebar-label">ÚLTIMAS');
  // Shared sidebar is the sole navigation on desktop and mobile.
  // Keep profile and fictional health actions visible when signed in.
  const headerEnd='<div class="header-actions">';
  if(!content.includes(headerEnd))throw Error('Lumi header missing');
  content=content.replace(headerEnd,headerEnd+`<style>
html.lumi-authenticated .header-actions{flex-wrap:wrap;justify-content:flex-end}
html.lumi-authenticated #profileBtn,html.lumi-authenticated #healthDemoBtn{display:grid!important;opacity:1!important;visibility:visible!important;flex:0 0 42px!important}
</style>`);
  // The original beta dashboard listener expects a trigger that is absent from the
  // original HTML. Add it only to this development copy, avoiding a null listener.
  const betaAnchor='<button id="lumiExerciseBtn"';
  if(!content.includes(betaAnchor))throw Error('Lumi beta button insertion anchor missing');
  // Replace the generic legacy exercise entry with the new specialized module.
  // Keep the original dialog and event handlers intact to avoid breaking legacy app.js.
  content=content.replace('>🏠 Exercícios em Casa</button>', '>🧠🚶 Mente e Corpo</button>');
  content=content.replace('id="lumiExerciseBtn" type="button"', 'id="lumiExerciseBtn" type="button" data-mind-body="true"');
  content=content.replace('document.getElementById("lumiExerciseBtn").addEventListener("click",()=>document.getElementById("lumiExerciseDialog").showModal());', 'document.getElementById("lumiExerciseBtn").addEventListener("click",()=>{ window.location.href="/lumi-mind-body.html"; });');
  // The generic modal is removed from the development UI, but its markup remains for compatibility.
  content=content.replace('<dialog id="lumiExerciseDialog"', '<dialog hidden id="lumiExerciseDialog"');
  content=content.replace(betaAnchor,
    '<button id="lumiBetaBtn" type="button" style="margin:0 14px 12px;padding:12px;border-radius:12px;background:#25344a;color:#fff;border:1px solid #9bd6f5;font-size:16px;cursor:pointer;text-align:left">📊 Painel beta fictício</button>\n  '+betaAnchor);
  // Sandbox-only: keep Lumi's original chat, personality, memory and auth unchanged.
  // The existing health button opens a strictly fictional document viewer in-place.
  content=content.replace('aria-label="Saúde (demonstração fictícia)" title="Saúde (demonstração fictícia)"','aria-label="Meu Cuidado (somente dados fictícios)" title="Meu Cuidado (somente dados fictícios)"');
  const healthHeading=content.indexOf('  <h3>🩺 Saúde — demonstração fictícia</h3>');
  const healthEnd=content.indexOf('</dialog>',healthHeading);
  if(healthHeading<0||healthEnd<0)throw Error('Original health section markers changed');
  const healthFields=content.slice(healthHeading,healthEnd).replace("document.getElementById('profileDialog').close()","document.getElementById('healthDialog').close()");
  content=content.slice(0,healthHeading)+content.slice(healthEnd);
  content=content.replace('<dialog id="lumiDemoDialog"',`<dialog id="healthDialog" aria-label="Saúde fictícia" style="width:min(520px,94vw);max-height:85dvh;overflow-y:auto;border:1px solid #374151;border-radius:16px;padding:24px;background:#111827;color:#f9fafb"><h2>🩺 Meu Cuidado — dados fictícios</h2>${healthFields}</dialog><dialog id="lumiDemoDialog"`);
  // Scope the visual polish to the fictional Health dialog only.
  content=content.replace('>Close</button>','>Fechar</button>');
  content=content.replace('<dialog id="healthDialog"',`<style>
#healthDialog {box-sizing:border-box;max-width:94vw;font:16px/1.5 system-ui}
#healthDialog label {display:block!important;width:100%!important;margin:14px 0 6px!important}
#healthDialog textarea {display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box;padding:10px!important;margin:6px 0!important;border-radius:8px;color:#111827;background:#fff}
#healthDialog input[type=file] {display:block;max-width:100%;margin:10px 0;color:#fff}
#healthDialog button {padding:10px 18px;border-radius:8px;margin-top:12px}
</style><dialog id="healthDialog"'`);
  // In-browser fictional report only: no fetch, storage, or AI transmission.
  content=content.replace('  <h3>🩺 Saúde — demonstração fictícia</h3>','  <h3>🩺 Saúde — demonstração fictícia</h3>');
  content=content.replace('>Medical conditions','>Condições médicas').replace('>Medications and dosages','>Medicamentos e dosagens').replace('>Allergies','>Alergias').replace('>Doctors and notes','>Médicos e observações');
  content=content.replace('</dialog><dialog id="lumiDemoDialog"',`<div id="fictionalReportActions" style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0"><button id="fictionalReportBtn" type="button">Gerar relatório fictício</button><button id="fictionalClearBtn" type="button">Limpar dados</button></div><section id="fictionalReport" hidden aria-live="polite" style="padding:16px;border:1px solid #64748b;border-radius:10px;background:#fff;color:#111827;white-space:pre-wrap"></section><button id="fictionalPrintBtn" type="button" hidden>Imprimir / Salvar em PDF</button></dialog><dialog id="lumiDemoDialog"`);
  content=content.replace('</body>',`<style>@media print {body>*:not(#healthDialog){display:none!important}#healthDialog{position:static!important;display:block!important;max-height:none!important;overflow:visible!important;border:0!important;width:100%!important;color:#111!important;background:white!important}#healthDialog>*:not(#fictionalReport){display:none!important}#fictionalReport{display:block!important;border:0!important;white-space:pre-wrap!important}#fictionalReportActions,#fictionalPrintBtn{display:none!important}}</style></body>`);
  const medicalButtonStart=content.indexOf('document.getElementById("healthDemoBtn").addEventListener("click", () => {');
  const medicalButtonEnd=content.indexOf('/* File picker is a UI-only demo.',medicalButtonStart);
  if(medicalButtonStart<0||medicalButtonEnd<0)throw Error('Original Lumi health button changed: abort injection');
  content=content.slice(0,medicalButtonStart)+`document.getElementById("healthDemoBtn").addEventListener("click", () => {
  // Start each demo with empty fields. Never populate medical information automatically.
  ["profileConditions","profileMedications","profileAllergies","profileDoctors"].forEach(id => {
    document.getElementById(id).value = "";
  });
  const report = document.getElementById("fictionalReport");
  if (report) { report.textContent = ""; report.hidden = true; }
  const printButton = document.getElementById("fictionalPrintBtn");
  if (printButton) printButton.hidden = true;
  document.getElementById("healthDialog").showModal();
});
`+content.slice(medicalButtonEnd);
  // Correct the double-escaped extension regex in generated browser JavaScript.
  content=content.replace('/\\\\.(pdf|jpe?g|png)$/i', '/\\.(pdf|jpe?g|png)$/i');
  // Development-only: display selected fictional filenames without reading or uploading files.
  content=content.replace('files.length + " arquivo(s) selecionado(s) para demonstração (não enviados nem salvos)."',
    'files.map(file => file.name + " (" + (file.size / 1024).toFixed(1) + " KB)").join(" | ") + " — somente demonstração; não enviados nem salvos."');
  content=content.replace('document.getElementById("profileDialog").addEventListener("close", () => {\n  document.getElementById("medicalDemoFile").value = "";',
    'document.getElementById("healthDialog").addEventListener("close", () => {\n  document.getElementById("medicalDemoFile").value = "";');
  const reportScript=`(function(){
  const ids=['profileConditions','profileMedications','profileAllergies','profileDoctors'];
  const labels=['Condições médicas','Medicamentos e dosagens','Alergias','Médicos e observações'];
  const byId=id=>document.getElementById(id);
  byId('fictionalReportBtn').addEventListener('click',()=>{
    const values=ids.map(id=>byId(id).value.trim()||'Não informado');
    const report=['RELATÓRIO DEMONSTRATIVO — DADOS FICTÍCIOS','SEM VALIDADE CLÍNICA','',...labels.flatMap((label,i)=>[label+':',values[i],'']),'Gerado localmente no navegador. Não enviado ou armazenado.'].join('\\n');
    byId('fictionalReport').textContent=report;
    byId('fictionalReport').hidden=false;
    byId('fictionalPrintBtn').hidden=false;
  });
  byId('fictionalPrintBtn').addEventListener('click',()=>window.print());
  byId('fictionalClearBtn').addEventListener('click',()=>{
    ids.forEach(id=>byId(id).value='');
    byId('fictionalReport').textContent='';
    byId('fictionalReport').hidden=true;
    byId('fictionalPrintBtn').hidden=true;
  });
})();`;
  content=content.replace('</body>','<script>'+reportScript+'</script></body>');
  if(content.includes('id="lumiCareDialog"'))throw Error('Unexpected extra care dialog in original UI');
 }
 assets['/lumi-original/'+name]={type,encoding:ext==='.png'?'base64':'utf8',content};
}
// Standalone features need a deterministic way home even on a first/direct visit.
const returnCssPath='/ativa-ui/return.'+createHash('sha256').update(RETURN_CSS).digest('hex').slice(0,20)+'.css';
assets[returnCssPath]={type:'text/css; charset=utf-8',encoding:'utf8',content:RETURN_CSS};
for(const path of ['/lumi-original/lumi-mind-body.html','/ativa-ui/index.html','/ativa-medical/index.html']){
 if(!assets[path]?.content.includes('<body'))throw Error('Missing standalone feature: '+path);
 assets[path].content=addReturnNavigation(assets[path].content,returnCssPath);
}
fs.writeFileSync(new URL('./assets.generated.mjs',import.meta.url),'export default '+JSON.stringify(assets)+';\n');console.log('Synthetic Lumi public assets packaged; no credentials or runtime source included.');
const {buildRelease}=await import('../frontend/build-release.mjs');
const release=buildRelease(assets);
console.log(JSON.stringify({release:release.release,commit:release.commit,immutableAssets:Object.keys(release.immutable).length}));

process.env.LUMI_INSTITUTIONAL_PREFIX='/sobre';
await import('../lumi-website/build.mjs');
