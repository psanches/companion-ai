// Shared navigation for standalone development features, including embedded demos.
export const RETURN_CSS=`.lumi-return-nav{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;gap:12px;padding:10px 12px;margin:0 0 16px;background:#101827;border-bottom:1px solid #7dd3fc;box-sizing:border-box;width:100%}.lumi-return-nav a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;max-width:100%;box-sizing:border-box;padding:10px 16px;border:2px solid #7dd3fc;border-radius:12px;background:#20354b;color:#fff;font:600 17px/1.4 system-ui,sans-serif;text-decoration:none;overflow-wrap:anywhere}.lumi-return-nav a:focus-visible{outline:3px solid #facc15;outline-offset:3px}.lumi-return-nav a:hover{background:#284b66}@media print{.lumi-return-nav{display:none}}`;
export function addReturnNavigation(html,cssPath){
 if(html.includes('id="lumiReturnNav"'))return html;
 const english=/<html[^>]*lang="en(?:-|\")/i.test(html);
 const label=english?'Back to Lumi':'Voltar à Lumi';
 return html.replace('</head>',`<link rel="stylesheet" href="${cssPath}"></head>`).replace(/<body\b[^>]*>/i,body=>body+`<nav id="lumiReturnNav" class="lumi-return-nav" aria-label="${english?'Return navigation':'Navegação de retorno'}"><a href="/" target="_top">← ${label}</a></nav>`);
}
