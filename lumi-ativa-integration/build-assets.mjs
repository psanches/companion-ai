import fs from 'node:fs';import path from 'node:path';
const dir=new URL('./public/',import.meta.url);const assets={};for(const name of fs.readdirSync(dir)){const bytes=fs.readFileSync(new URL(name,dir));const ext=path.extname(name);const type=({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png'})[ext];if(!type)throw Error('Unexpected public file extension');assets['/ativa-ui/'+name]={type,encoding:ext==='.png'?'base64':'utf8',content:ext==='.png'?bytes.toString('base64'):bytes.toString('utf8')};}
assets['/ativa-ui/data.js']={type:'application/javascript; charset=utf-8',encoding:'utf8',content:fs.readFileSync(new URL('../ativa-demo/public/data.js',import.meta.url),'utf8')};
for(const name of fs.readdirSync(new URL('../ativa-demo/public/',import.meta.url))){const ext=path.extname(name);const type=({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'})[ext];if(!type)throw Error('Unexpected medical public asset');let content=fs.readFileSync(new URL('../ativa-demo/public/'+name,import.meta.url),'utf8');if(name==='index.html')content=content.replace(/(src|href)="\/(app\.js|style\.css|data\.js|favicon\.svg)"/g,'$1="/ativa-medical/$2"').replace('</head>','<link rel="stylesheet" href="/ativa-ui/medical-theme.css"></head>');assets['/ativa-medical/'+name]={type,encoding:'utf8',content};}

 // Preserve the original Lumi conversation UI as the development home.
 // Assets are copied from the existing develop app; no production deployment.
const root=new URL('../',import.meta.url);
for(const name of ['index.html','app.js','style.css','manifest.json','sw.js','icon-192.png','icon-512.png','lumi-calendar-v2.js']){
 const bytes=fs.readFileSync(new URL(name,root));
 const ext=path.extname(name);
 const type=({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'})[ext];
 let content=ext==='.png'?bytes.toString('base64'):bytes.toString('utf8');
 if(name==='index.html'){
  // Sandbox-only: keep Lumi's original chat, personality, memory and auth unchanged.
  // The existing health button opens a strictly fictional document viewer in-place.
  content=content.replace('aria-label="Saúde (demonstração fictícia)" title="Saúde (demonstração fictícia)"','aria-label="Meu Cuidado (demo fictício)" title="Meu Cuidado (demo fictício)"');
  const medicalButtonStart=content.indexOf('document.getElementById("healthDemoBtn").addEventListener("click", () => {');
  const medicalButtonEnd=content.indexOf('/* File picker is a UI-only demo.',medicalButtonStart);
  if(medicalButtonStart<0||medicalButtonEnd<0)throw Error('Original Lumi health button changed: abort injection');
  content=content.slice(0,medicalButtonStart)+`document.getElementById("healthDemoBtn").addEventListener("click", () => {
  document.getElementById("lumiCareDialog").showModal();
});
`+content.slice(medicalButtonEnd);
  content=content.replace('</body>',`<dialog id="lumiCareDialog" aria-label="Meu Cuidado fictício" style="width:min(1100px,96vw);height:min(86dvh,900px);max-width:none;max-height:none;padding:0;border:1px solid #41526c;border-radius:14px;background:#101827;color:white">
<header style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px"><strong>🩺 Meu Cuidado · Ativa (dados 100% fictícios)</strong><button type="button" onclick="document.getElementById('lumiCareDialog').close()" aria-label="Voltar à Lumi" style="padding:8px 14px;border-radius:8px">Voltar à Lumi ✕</button></header>
<iframe src="/ativa-medical/" title="Documentos fictícios da Ativa Parkinson" style="display:block;width:100%;height:calc(100% - 58px);border:0" loading="lazy"></iframe>
</dialog></body>`);
 }
 assets['/lumi-original/'+name]={type,encoding:ext==='.png'?'base64':'utf8',content};
}
fs.writeFileSync(new URL('./assets.generated.mjs',import.meta.url),'export default '+JSON.stringify(assets)+';\n');console.log('Synthetic Lumi public assets packaged; no credentials or runtime source included.');
