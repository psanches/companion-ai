// Packaged only into the authorized development frontend. No server/API calls.
export function normalizeEmergencyPhone(value) {
 const raw=String(value||'').trim();
 if(!raw||/[^\d+\s().-]/.test(raw)||/\+/.test(raw.slice(1)))return null;
 let digits=raw.replace(/\D/g,'');
 if(!raw.startsWith('+')){
  if(!/^[1-9]\d[2-9]\d{7,8}$/.test(digits))return null;
  digits='55'+digits;
 }
 return /^[1-9]\d{7,14}$/.test(digits)?digits:null;
}

export function emergencyDestinations(phone) {
 if(!/^[1-9]\d{7,14}$/.test(phone))throw Error('Invalid emergency phone');
 const message='Preciso de ajuda. Por favor, entre em contato comigo.';
 return {message,whatsapp:'https://wa.me/'+phone+'?text='+encodeURIComponent(message),call:'tel:+'+phone};
}

export function installLumiEmergencyContact(auth) {
 const sidebar=document.getElementById('conversationSidebar');
 if(!sidebar||document.getElementById('lumiSosBtn'))return;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const button=make('button','SOS · Contato de emergência');button.type='button';button.id='lumiSosBtn';
 button.style.cssText='margin:0 14px 12px;padding:14px;min-height:48px;border:2px solid #fda4af;border-radius:12px;background:#762538;color:#fff;font:600 17px system-ui;cursor:pointer;text-align:left;flex-shrink:0';
 const anchor=document.getElementById('sidebarNewChatBtn');if(anchor)anchor.after(button);else sidebar.prepend(button);
 let owner=null,dialog=null,opening=false;
 const sessionOwner=session=>typeof session?.user?.id==='string'?session.user.id:null;
 const key=id=>'lumi-emergency-contact-v1:'+id;
 const close=()=>{if(dialog){const previous=dialog;dialog=null;previous.close();previous.remove();}};
 const sync=session=>{const next=sessionOwner(session);if(next!==owner)close();owner=next;button.hidden=!owner;};
 button.hidden=true;
 auth.onAuthStateChange((_event,session)=>sync(session));
 void auth.getSession().then(({data,error})=>{if(!error)sync(data?.session);}).catch(()=>{});

 button.onclick=async()=>{
  if(opening||dialog)return;
  opening=true;
  try{
   const {data,error}=await auth.getSession();if(error)return;sync(data?.session);if(!owner)return;
   const currentOwner=owner;
   if(typeof setSidebarOpen==='function')setSidebarOpen(false);
   let contact=null,loadFailed=false;
   try{const saved=JSON.parse(localStorage.getItem(key(currentOwner))||'null');if(saved&&typeof saved.name==='string'&&saved.name.trim()&&saved.name.length<=80&&typeof saved.phone==='string'&&/^[1-9]\d{7,14}$/.test(saved.phone))contact={name:saved.name,phone:saved.phone};}catch{loadFailed=true;}
   const d=make('dialog');dialog=d;d.id='lumiSosDialog';d.setAttribute('aria-labelledby','lumiSosHeading');
   d.style.cssText='width:min(500px,calc(100vw - 24px));max-height:90dvh;overflow:auto;box-sizing:border-box;background:#162235;color:#fff;border:2px solid #fda4af;border-radius:16px;padding:20px;font:17px/1.5 system-ui;overflow-wrap:anywhere';
   const back=make('button','Voltar à Lumi');back.type='button';back.onclick=()=>d.close();
   const heading=make('h2','SOS · Contato de emergência');heading.id='lumiSosHeading';heading.tabIndex=-1;
   const status=make('p');status.id='lumiSosStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   const editor=make('form'),actions=make('section');actions.id='lumiSosActions';editor.id='lumiSosForm';
   const name=make('input'),phone=make('input');name.id='lumiSosName';name.required=true;name.maxLength=80;name.autocomplete='off';
   phone.id='lumiSosPhone';phone.type='tel';phone.inputMode='tel';phone.required=true;phone.maxLength=30;phone.autocomplete='off';
   for(const [label,field]of [['Nome do cuidador ou contato',name],['Telefone com DDD',phone]]){const l=make('label',label);l.htmlFor=field.id;l.style.display='block';field.style.cssText='display:block;width:100%;box-sizing:border-box;margin:6px 0 16px;padding:12px;border-radius:8px;background:white;color:#162235;font:inherit';editor.append(l,field);}
   const hint=make('p','Brasil: informe DDD e número. Para outro país, comece com + e o código do país.');hint.id='lumiSosPhoneHint';phone.setAttribute('aria-describedby',hint.id);editor.append(hint);
   const save=make('button','Salvar contato');save.type='submit';editor.append(save);
   const cancel=make('button','Cancelar edição');cancel.type='button';cancel.onclick=()=>{status.textContent='';render();};editor.append(cancel);
   const style=make('style','#lumiSosDialog [hidden]{display:none!important}');
   d.append(style,back,heading,make('p','Cadastre quem você quer contatar quando precisar de ajuda.'),make('p','O contato fica salvo somente neste navegador, para sua conta. Não é sincronizado com outros aparelhos.'),editor,actions,status);
   const styleAction=node=>{node.style.cssText='display:block;box-sizing:border-box;width:100%;margin:10px 0;padding:12px;min-height:48px;border:1px solid #a6cce3;border-radius:8px;background:#25344a;color:#fff;font:inherit;text-align:center;text-decoration:none;cursor:pointer';};
   for(const b of [back,save,cancel])styleAction(b);
   function edit(){editor.hidden=false;actions.hidden=true;name.value=contact?.name||'';phone.value=contact?'+'+contact.phone:'';cancel.hidden=!contact;name.focus();}
   function render(){
    editor.hidden=!!contact;actions.hidden=!contact;cancel.hidden=!contact;actions.replaceChildren();if(!contact)return;
    const destinations=emergencyDestinations(contact.phone);
    actions.append(make('h3',contact.name),make('p','+'+contact.phone),make('p',destinations.message),make('p','No WhatsApp, confira a conversa e toque em Enviar. Abrir o aplicativo não confirma envio, leitura ou atendimento.'));
    const wa=make('a','Pedir ajuda pelo WhatsApp');wa.id='lumiSosWhatsApp';wa.href=destinations.whatsapp;wa.target='_blank';wa.rel='noopener noreferrer';styleAction(wa);
    const call=make('a','Ligar para o cuidador');call.id='lumiSosCall';call.href=destinations.call;styleAction(call);
    const share=make('button','Outros aplicativos');share.type='button';share.hidden=typeof navigator.share!=='function';styleAction(share);
    share.onclick=async()=>{try{await navigator.share({text:destinations.message});if(dialog===d)status.textContent='Confira o destinatário no aplicativo escolhido. A Lumi não confirma envio ou atendimento.';}catch(e){if(e?.name!=='AbortError'&&dialog===d)status.textContent='Não foi possível compartilhar. Use o WhatsApp ou ligue para o contato.';}};
    const editButton=make('button','Editar contato');editButton.type='button';styleAction(editButton);editButton.onclick=edit;
    actions.append(wa,call,share,editButton,make('p','Se o aplicativo não abrir, use o telefone acima para ligar manualmente.'));
   }
   editor.onsubmit=e=>{
    e.preventDefault();if(owner!==currentOwner){close();return;}
    const digits=normalizeEmergencyPhone(phone.value),cleanName=name.value.trim();
    if(!cleanName){status.textContent='Informe o nome do contato.';name.focus();return;}
    if(!digits){status.textContent='Confira o telefone: use DDD e número ou + e código do país.';phone.focus();return;}
    const next={name:cleanName,phone:digits};
    try{localStorage.setItem(key(currentOwner),JSON.stringify(next));contact=next;render();status.textContent='Contato salvo. Escolha como pedir ajuda.';heading.focus();}catch{status.textContent='Não foi possível salvar neste navegador. Confira as permissões de armazenamento e tente novamente.';}
   };
   d.addEventListener('close',()=>{d.remove();if(dialog===d)dialog=null;button.focus();},{once:true});
   document.body.append(d);render();d.showModal();heading.focus();
   if(loadFailed)status.textContent='Não foi possível recuperar o contato. Cadastre-o novamente.';
  }finally{opening=false;}
 };
}

export const EMERGENCY_CONTACT_FRONTEND='\n'+normalizeEmergencyPhone.toString()+'\n'+emergencyDestinations.toString()+'\n'+installLumiEmergencyContact.toString()+'\ninstallLumiEmergencyContact(supabaseClient.auth);\n';
