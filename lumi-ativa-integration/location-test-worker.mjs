export const locationPage = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumi — Teste de localização</title><style>[hidden]{display:none!important}body{font:20px system-ui;max-width:600px;margin:24px auto;padding:16px;background:#f5f7fb;color:#18233b}button,a{display:block;padding:16px;margin:16px 0;font:inherit;border-radius:12px}button{background:#2855a6;color:white;border:0;width:100%}button:disabled{opacity:.5}a{color:#194a98}#status{padding:16px;background:white;border-radius:12px}small{display:block;line-height:1.6}</style><h1>Teste de localização</h1><p>Ao iniciar, permita o acesso à localização no seu celular. As coordenadas ficam apenas nesta página. O teste não envia SOS.</p><button id="start">Iniciar localização</button><button id="stop" disabled>Parar localização</button><p id="status" role="status" aria-live="polite">Localização desligada.</p><p id="details"></p><a id="map" hidden target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Conferir posição no mapa</a><small>O mapa abre o Google Maps com a posição exibida. Este link mostra um ponto fixo, não acompanhamento ao vivo. O teste pausa quando esta página deixa de ficar visível. Ao voltar, toque em Iniciar.</small><a href="/">Voltar à Lumi</a><script src="/location-test.js" defer></script></html>`;

export const locationScript = `(() => {
const start=document.getElementById('start'),stop=document.getElementById('stop'),status=document.getElementById('status'),details=document.getElementById('details'),map=document.getElementById('map');
let watch=null,session=0;
function end(message){session++;if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;start.disabled=false;stop.disabled=true;map.hidden=true;map.removeAttribute('href');details.textContent='';status.textContent=message;}
start.onclick=()=>{
 if(!window.isSecureContext||!navigator.geolocation){status.textContent='Localização indisponível neste navegador. Abra este link no Chrome usando HTTPS.';return;}
 end('Aguardando permissão e sinal de localização…');const active=session;start.disabled=true;stop.disabled=false;
 watch=navigator.geolocation.watchPosition(position=>{
  if(active!==session)return;
  const {latitude,longitude,accuracy}=position.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy))return;
  status.textContent='Localização recebida. Atualiza enquanto esta página estiver visível.';
  details.textContent='Atualizada às '+new Date(position.timestamp).toLocaleTimeString('pt-BR')+' · Precisão aproximada: '+Math.round(accuracy)+' metros.';
  map.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(latitude+','+longitude);map.hidden=false;
 },error=>{if(active!==session)return;end(error.code===1?'Permissão negada. Libere a localização nas permissões do site e tente novamente.':error.code===3?'O sinal demorou a chegar. Confira se a localização do celular está ligada e tente novamente.':'Não foi possível obter a posição. Confira a localização do celular e tente novamente.');},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
};
stop.onclick=()=>end('Localização desligada.');
document.addEventListener('visibilitychange',()=>{if(document.hidden)end('Teste pausado. Toque em Iniciar para retomar.');});
window.addEventListener('pagehide',()=>end('Localização desligada.'));
})();`;

export function withLocalLocationTest(application) {
  return {...application, async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const script = url.pathname === '/location-test.js';
    if (url.hostname === 'lumi-develop.psanchesnle.workers.dev' && (script || url.pathname === '/location-test')) {
      if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      return new Response(request.method === 'HEAD' ? null : script ? locationScript : locationPage,{headers:{
        'Content-Type':script?'text/javascript; charset=utf-8':'text/html; charset=utf-8',
        'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
        'Permissions-Policy':'geolocation=(self)',
        'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        'X-Content-Type-Options':'nosniff'
      }});
    }
    return application.fetch(request,env,ctx);
  }};
}
