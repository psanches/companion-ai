export function installLumiVoiceInput(){
 const button=document.getElementById('voiceButton'),input=document.getElementById('messageInput');if(!button||!input||document.getElementById('lumiVoiceStatus'))return;
 const status=document.createElement('div');status.id='lumiVoiceStatus';status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='margin:6px 0;max-height:20dvh;overflow:auto;overflow-wrap:anywhere;font:15px/1.4 system-ui;color:inherit';button.closest('.composer-box')?.after(status);
 const Constructor=window.SpeechRecognition||window.webkitSpeechRecognition;
 let current=null,phase='idle',timer=null,sessionTimer=null,restartTimer=null,sessionActive=false,lastActivity=0,restarts=0,hasText=false,original='',heard='',failed=false;
 button.disabled=false;button.setAttribute('aria-pressed','false');button.setAttribute('aria-describedby',status.id);
 const reset=()=>{clearTimeout(timer);phase='idle';button.textContent='🎙️';button.title='Falar com a Lumi';button.setAttribute('aria-label','Falar com a Lumi');button.setAttribute('aria-pressed','false');};
 function show(text){status.hidden=false;status.replaceChildren(document.createTextNode(text));}
 function error(code){const messages={unsupported:['VOZ-01','Este navegador não oferece ditado por voz. Abra a Lumi no Chrome ou use o microfone do teclado.'],permission:['VOZ-02','O acesso ao microfone foi bloqueado. Permita o microfone nas configurações do site e do aparelho e tente novamente.'],capture:['VOZ-03','Não consegui acessar o microfone. Confira se ele está conectado e se outro aplicativo está usando o áudio.'],network:['VOZ-04','O serviço de ditado do navegador não conseguiu se conectar. Confira a internet e tente novamente.'],silence:['VOZ-05','Não ouvi sua voz. Toque no microfone e fale novamente.'],start:['VOZ-06','Não consegui iniciar o ditado. Toque no microfone para tentar novamente.'],timeout:['VOZ-07','O navegador não iniciou a escuta. Confira a permissão do microfone ou tente abrir a Lumi no Chrome.']};const [id,message]=messages[code]||messages.start;show(message+' Código: '+id);const keyboard=document.createElement('button');keyboard.type='button';keyboard.textContent='Usar teclado';keyboard.style.cssText='padding:8px;margin:6px;font:inherit;min-height:44px';keyboard.onclick=()=>input.focus();status.append(keyboard);}
 function release(abort=false){sessionActive=false;clearTimeout(sessionTimer);clearTimeout(restartTimer);const previous=current;current=null;reset();if(previous){previous.onstart=previous.onresult=previous.onerror=previous.onend=null;if(abort)try{previous.abort();}catch{}}}
 function finish(){release();if(hasText){show('Texto pronto. Revise e toque em Enviar.');input.focus();}else error('silence');}
 function stop(){sessionActive=false;clearTimeout(sessionTimer);clearTimeout(restartTimer);if(!current){finish();return;}phase='stopping';button.title='Finalizando ditado';try{current.stop();}catch{release(true);}clearTimeout(timer);if(current)timer=setTimeout(()=>{release(true);if(hasText)show('Texto pronto. Revise e toque em Enviar.');else error('silence');},3000);}
 function armSilence(){clearTimeout(timer);timer=setTimeout(stop,Math.max(0,30000-(Date.now()-lastActivity)));}
 function begin(resuming=false){
  if(resuming&&!sessionActive)return;
  if(!Constructor){release();error('unsupported');return;}if(window.isSecureContext===false){release();error('permission');return;}
  let recognition;try{recognition=new Constructor();}catch{release();error('start');return;}
  current=recognition;original=input.value.trimEnd();heard='';failed=false;phase='starting';show(resuming?'Continuando a escuta…':'Aguardando o microfone… Se solicitado, toque em Permitir.');button.textContent='⏳';button.setAttribute('aria-label','Cancelar ditado');button.setAttribute('aria-pressed','true');recognition.lang=document.documentElement.lang?.startsWith('en')?'en-US':'pt-BR';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
  recognition.onstart=()=>{if(current!==recognition)return;clearTimeout(timer);phase='listening';button.textContent='🔴';button.title='Parar de ouvir';button.setAttribute('aria-label','Parar de ouvir');show('Ouvindo… Você pode pausar até 30 segundos. Toque para parar (máximo 2 minutos).');armSilence();};
  recognition.onresult=event=>{if(current!==recognition)return;heard=Array.from(event.results||[],r=>r[0]?.transcript||'').filter(Boolean).join(' ').trim();if(!heard)return;hasText=true;lastActivity=Date.now();restarts=0;if(sessionActive)armSilence();input.value=(original?original+' ':'')+heard;input.dispatchEvent(new Event('input',{bubbles:true}));show('Ouvindo… Pode continuar ou tocar no microfone para parar.');};
  recognition.onerror=event=>{if(current!==recognition)return;if(event.error==='no-speech'&&sessionActive)return;failed=true;const code={'not-allowed':'permission','service-not-allowed':'permission','audio-capture':'capture',network:'network','no-speech':'silence','language-not-supported':'unsupported'}[event.error]||'start';release(true);if(event.error!=='aborted')error(code);else show('Ditado interrompido. Toque no microfone para tentar novamente.');};
  recognition.onend=()=>{if(current!==recognition)return;
   if(sessionActive&&!failed&&Date.now()-lastActivity<30000&&restarts<6){
    clearTimeout(timer);recognition.onstart=recognition.onresult=recognition.onerror=recognition.onend=null;current=null;phase='listening';restarts++;restartTimer=setTimeout(()=>begin(true),300);return;
   }
   if(!failed)finish();else release();
  };
  timer=setTimeout(()=>{if(current!==recognition)return;release(true);error('timeout');},12000);
  try{if(!resuming)window.speechSynthesis?.cancel();recognition.start();}catch(e){release(true);error(e.name==='NotAllowedError'||e.name==='SecurityError'?'permission':'start');}
 }
 button.onclick=()=>{
  if(phase==='starting'){release(true);show('Ditado cancelado.');return;}if(phase==='listening'){stop();return;}if(phase==='stopping')return;
  sessionActive=true;hasText=false;restarts=0;lastActivity=Date.now();sessionTimer=setTimeout(stop,120000);begin();
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(current||sessionActive)){release(true);show('Ditado pausado. Toque no microfone para continuar.');}});
 document.getElementById('signOutBtn')?.addEventListener('click',()=>{release(true);status.hidden=true;});
 window.addEventListener('pagehide',()=>release(true));
 input.form?.addEventListener('submit',()=>{if(current||sessionActive)release(true);});
}
export function patchVoiceInput(source){
 const start=source.indexOf('const voiceButton ='),end=source.indexOf('let lumiSoundEnabled = false;',start);
 if(start<0||end<start)throw Error('Voice input section missing; refusing an unverified patch');
 return source.slice(0,start)+'('+installLumiVoiceInput.toString()+')();\n\n'+source.slice(end);
}
