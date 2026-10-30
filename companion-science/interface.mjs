// Public educational lookup only: no model calls, personal storage or remote queries.
export function installScience({topics,sources,version,checked,research=[]},search){
 const ready=()=>{
  const app=document.querySelector('main.app'),messages=document.getElementById('messages');
  if(!app||!messages||document.getElementById('companionScience'))return;
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const english=()=>window.LumiI18n?.language==='en';
  const label=(pt,en)=>english()?en:pt;
  const tabs=make('nav');tabs.id='companionTabs';tabs.setAttribute('aria-label','Lumi / Companion');
  const lumi=make('button'),science=make('button');lumi.type=science.type='button';tabs.append(lumi,science);messages.before(tabs);
  const panel=make('section');panel.id='companionScience';panel.hidden=true;panel.setAttribute('aria-labelledby','companionScienceHeading');messages.before(panel);
  let selected=false,category='',query='';
  function switchTo(value){
   selected=value;app.classList.toggle('companion-science-active',value);panel.hidden=!value;
   lumi.setAttribute('aria-pressed',String(!value));science.setAttribute('aria-pressed',String(value));
   if(value)panel.querySelector('input')?.focus();
  }
  lumi.onclick=()=>switchTo(false);science.onclick=()=>switchTo(true);
  function render(){
   lumi.textContent=label('Lumi · Conversar','Lumi · Chat');science.textContent=label('Companion · Ciência','Companion · Science');
   const focus=panel.contains(document.activeElement)?document.activeElement?.id:null;
   panel.replaceChildren();
   const heading=make('h2',label('Companion = Ciência','Companion = Science'));heading.id='companionScienceHeading';panel.append(heading);
   panel.append(make('p',label('Memória geral da Lumi: conhecimento científico compartilhado. Consulte medicamentos, exercícios, fonoaudiologia e psicologia.','Lumi shared knowledge: scientific content for everyone. Browse medicines, exercise, speech therapy and psychology.')));
   const note=make('p',label('Consulta direta à base, sem chamada de IA. Conteúdo científico em português; fontes originais disponíveis.','Direct knowledge lookup, without an AI call. Scientific content is in Portuguese; original sources are available.'));note.className='science-note';panel.append(note);
   if(research.length){
    const register=make('details');register.id='companionDoctoralResearch';
    register.append(make('summary',label('Pesquisa brasileira: teses e doutorados','Brazilian research: doctoral theses and groups')));
    const introduction=make('p',label('Registros acadêmicos com autor, instituição e fonte original. Uma tese defendida ou uma bolsa de pesquisa não equivale, sozinha, a uma recomendação clínica.','Academic records with authors, institutions and original sources. A defended thesis or research grant alone is not a clinical recommendation.'));introduction.className='science-record';register.append(introduction);
    for(const r of research){
     const detail=make('details');detail.dataset.research=r.id;detail.append(make('summary',r.title));
     const body=make('div');body.className='science-record';body.append(make('p',r.kind),make('p',r.author),make('p',r.institution),make('p',label('Orientação / equipe: ','Supervisor / team: ')+r.supervisor),make('small',r.date),make('p',r.summary),make('p',r.limits));
     const source=make('a',label('Abrir registro institucional','Open institutional record'));source.href=r.url;source.target='_blank';source.rel='noopener noreferrer';body.append(source);if(r.doi)body.append(make('small','DOI: '+r.doi));detail.append(body);register.append(detail);
    }
    panel.append(register);
   }
   const controls=make('div');controls.className='science-controls';
   const searchLabel=make('label',label('Pesquisar na base','Search the knowledge base')),input=make('input');input.id='companionScienceSearch';input.type='search';input.placeholder=label('Ex.: proteínas, ON/OFF, equilíbrio','E.g. proteínas, ON/OFF, equilíbrio');input.value=query;searchLabel.append(input);
   const categoryLabel=make('label',label('Área','Category')),filter=make('select');filter.id='companionScienceCategory';
   const any=make('option',label('Todas as áreas','All categories'));any.value='';filter.append(any);
   for(const c of new Set(topics.map(t=>t.category))){const o=make('option',c);o.value=c;filter.append(o);}filter.value=category;categoryLabel.append(filter);controls.append(searchLabel,categoryLabel);panel.append(controls);
   const count=make('p');count.id='companionScienceCount';count.setAttribute('role','status');panel.append(count);
   const results=make('div');results.id='companionScienceResults';panel.append(results);
   function update(){
    query=input.value;category=filter.value;const found=search(topics,query,category);
    count.textContent=label(found.length+' de '+topics.length+' assuntos nesta edição',found.length+' of '+topics.length+' topics in this edition');results.replaceChildren();
    if(!found.length){results.append(make('p',label('Nenhum assunto corresponde à pesquisa. Tente termos mais curtos ou consulte a Lumi; a base não cria uma resposta sem fonte.','No topic matches this search. Try shorter terms or ask Lumi; the knowledge base does not invent an unsourced answer.')));return;}
    for(const t of found){
     const details=make('details');details.dataset.topic=t.id;const summary=make('summary',t.title);details.append(summary);
     const content=make('div');content.className='science-record';details.append(content);
     const badge=make('p',t.evidence);badge.className='science-evidence';content.append(badge);if(t.evidenceDescription)content.append(make('small',t.evidenceDescription));content.append(make('p',t.text));
     if(t.terms?.length){const glossary=make('details');glossary.className='science-terms';glossary.append(make('summary',label('Entenda os termos','Understand the terms')));const list=make('ul');for(const term of t.terms)list.append(make('li',term.name+': '+term.meaning));glossary.append(list);content.append(glossary);}
     for(const [title,text]of [[label('Na prática','In practice'),t.practice],[label('Limites e cuidados','Limits and precautions'),t.limits]]){content.append(make('h3',title),make('p',text));}
     content.append(make('h3',label('Fontes e evidência','Sources and evidence')));
     const refs=make('ul');for(const id of t.sources){const s=sources[id],li=make('li'),link=make('a',s.name);link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';li.append(link,make('small',s.kind+' · '+s.year+(s.doi?' · DOI '+s.doi:'')));if(s.country)li.append(make('small',label('Origem: ','Origin: ')+s.country));if(s.about)li.append(make('p',s.about));refs.append(li);}content.append(refs);
     content.append(make('small',label('Fontes consultadas em 30/10/2026.','Sources consulted on 30 October 2026.')));
     const direct=make('button',label('Levar resposta ao chat · sem IA','Take answer to chat · no AI'));direct.type='button';direct.className='science-direct';direct.onclick=()=>{
      const draft=document.getElementById('messageInput');
      if(draft?.value.trim()){direct.textContent=label('Conclua sua mensagem na Lumi antes de continuar.','Finish your draft in Lumi before continuing.');return;}
      if(draft){draft.value='Companion: '+t.title;draft.dispatchEvent(new Event('input',{bubbles:true}));switchTo(false);draft.focus();}
     };content.append(direct,make('small',label('Prepara a consulta à memória geral; toque em enviar para receber a resposta com fontes.','Prepares a shared-knowledge lookup; press Send to receive the sourced answer.')));
     const use=make('button',label('Conversar com a Lumi sobre este assunto','Discuss this topic with Lumi'));use.type='button';use.onclick=()=>{
      const draft=document.getElementById('messageInput');
      // A filled draft must remain intact. Context is inserted only into an empty composer.
      if(draft?.value.trim()){use.textContent=label('Sua mensagem está preservada. Volte à Lumi para concluí-la.','Your draft is preserved. Return to Lumi to finish it.');return;}
      if(draft){draft.value=label('Quero conversar sobre ','I want to discuss ')+t.title+'.\n\nCompanion: '+t.text+'\n'+t.limits+'\n'+t.sources.map(id=>sources[id].url).join('\n');draft.dispatchEvent(new Event('input',{bubbles:true}));switchTo(false);draft.focus();}
     };content.append(use,make('small',label('Prepara a mensagem; só será enviada quando você tocar em enviar. A conversa com a Lumi usa IA.','Prepares a message; it is only sent when you press Send. Chatting with Lumi uses AI.')));results.append(details);
    }
   }
   input.oninput=update;filter.onchange=update;update();
   const methodology=make('details');methodology.className='science-methodology';methodology.append(make('summary',label('Como esta base foi organizada','How this knowledge base was organized')));
   methodology.append(make('p',label('Priorizamos diretrizes, revisões sistemáticas e artigos revisados por pares, complementados por orientações de instituições especializadas. Prática comum, sozinha, não comprova eficácia. Cada assunto identifica o tipo de evidência e seus limites.','We prioritize guidelines, systematic reviews and peer-reviewed papers, complemented by specialist institutions. Common practice alone does not establish effectiveness. Each topic identifies its evidence and limits.')));
   methodology.append(make('p',label('As classificações alta/baixa e forte/condicional são da diretriz citada; não são uma avaliação GRADE própria. Uma fonte institucional não recebe automaticamente a mesma classificação.','High/low and strong/conditional ratings come from the cited guideline; they are not our own GRADE assessment. Institutional advice does not automatically receive the same rating.')));
   methodology.append(make('p',label('Esta é uma edição inicial com cobertura delimitada, não uma busca completa da literatura nem revisão clínica independente. Novos achados exigem reavaliação. Informações gerais não definem diagnóstico, doses ou exercícios individuais.','This is an initial, bounded edition, not an exhaustive literature search or an independent clinical review. New findings require reassessment. General information does not determine individual diagnoses, doses or exercise prescriptions.')));
   methodology.append(make('small','Versão '+version+' · '+checked));panel.append(methodology);
   if(focus)document.getElementById(focus)?.focus();
  }
  render();switchTo(false);
  // Reset transient search and close science on sign-out; do not disturb chat drafts.
  new MutationObserver(()=>{if(!document.documentElement.classList.contains('lumi-authenticated')){switchTo(false);query='';category='';render();}}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  window.addEventListener('lumi-language-change',render);
  for(const id of ['sidebarNewChatBtn','newChatBtn','lumiAgendaBtn'])document.getElementById(id)?.addEventListener('click',()=>switchTo(false));
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
}
