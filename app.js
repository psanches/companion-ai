const $ = s => document.querySelector(s);
const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#messageInput");
const dialog = $("#settingsDialog");
const STORAGE = "companion-ai-v2";

const defaults = {name:"", provider:"demo", apiKey:"", model:"gpt-5-mini", messages:[]};
let state = {...defaults, ...JSON.parse(localStorage.getItem(STORAGE) || "{}")};

function save(){ localStorage.setItem(STORAGE, JSON.stringify(state)); }
function add(role, content, persist=true){
  const el=document.createElement("div");
  el.className=`msg ${role}`;
  el.textContent=content;
  messagesEl.appendChild(el);
  messagesEl.scrollTop=messagesEl.scrollHeight;
  if(persist){state.messages.push({role,content}); state.messages=state.messages.slice(-40); save();}
}
function render(){
  messagesEl.innerHTML="";
  state.messages.forEach(m=>add(m.role,m.content,false));
  if(!state.messages.length) add("assistant",`Olá${state.name ? ", "+state.name : ""}! Eu sou o Companion AI. Posso conversar com você e guardar esta conversa localmente neste aparelho.`);
}
render();

$("#settingsBtn").onclick=()=>{
  $("#userName").value=state.name; $("#provider").value=state.provider;
  $("#apiKey").value=state.apiKey; $("#model").value=state.model; dialog.showModal();
};
$("#saveBtn").onclick=()=>{
  state.name=$("#userName").value.trim(); state.provider=$("#provider").value;
  state.apiKey=$("#apiKey").value.trim(); state.model=$("#model").value.trim()||"gpt-5-mini"; save();
};
$("#clearBtn").onclick=()=>{
  if(confirm("Apagar todo o histórico salvo neste aparelho?")){
    state.messages=[]; save(); render(); dialog.close();
  }
};

async function getReply(text){
  if(state.provider==="demo"){
    return `Entendi${state.name ? ", "+state.name : ""}. Você disse: “${text}”.\n\nEstou no modo local. Abra ⚙️ para configurar a conexão com IA. Sua conversa já fica salva neste aparelho.`;
  }
  if(!state.apiKey) throw new Error("Configure sua chave da API em ⚙️.");
  const history=state.messages.slice(-16).map(m=>({role:m.role,content:m.content}));
  const body={
    model:state.model,
    input:[
      {role:"system",content:[{type:"input_text",text:"Você é Companion AI, um assistente pessoal acolhedor, objetivo e útil. Responda em português do Brasil."}]},
      ...history.map(m=>({role:m.role,content:[{type:"input_text",text:m.content}]}))
    ]
  };
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${state.apiKey}`},
    body:JSON.stringify(body)
  });
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.message || "Erro ao conectar com a IA.");
  return data.output_text || data.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("") || "Sem resposta.";
}

form.onsubmit=async e=>{
  e.preventDefault(); const text=input.value.trim(); if(!text)return;
  input.value=""; add("user",text);
  const wait=document.createElement("div"); wait.className="msg assistant"; wait.textContent="Pensando…"; messagesEl.appendChild(wait);
  try{ const reply=await getReply(text); wait.remove(); add("assistant",reply); }
  catch(err){ wait.remove(); add("system",err.message); }
};

if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
