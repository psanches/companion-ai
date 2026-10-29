const SUPABASE_URL =
  "https://hjdrnxqvmpwfztlrqknp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_qfhZHhgXfRq7Z3np65rF2w_WMqFWtfv";

// Only the authentication session follows Remember me; Lumi's existing
// conversation preferences and other local data are managed separately.
const REMEMBER_KEY = "lumi-remember-signin";
const AUTH_STORAGE_KEY = "sb-" + new URL(SUPABASE_URL).hostname.split(".")[0] + "-auth-token";
const rememberSignIn = () => localStorage.getItem(REMEMBER_KEY) === "true";
const lumiAuthStorage = {
  getItem(key) {
    return (rememberSignIn() ? localStorage : sessionStorage).getItem(key);
  },
  setItem(key, value) {
    (rememberSignIn() ? localStorage : sessionStorage).setItem(key, value);
    (rememberSignIn() ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};
const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    { auth: { storage: lumiAuthStorage, persistSession: true,
              autoRefreshToken: true, detectSessionInUrl: true } }
  );

const WORKER_URL =
  "https://lumi-develop.psanchesnle.workers.dev/";

const $ = selector =>
  document.querySelector(selector);
const loadEarlierBtn = $("#loadEarlierBtn");
const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#messageInput");
const memoryDialog = $("#memoryDialog");

const STORAGE = "companion-ai-v2";
const CLIENT_ID_KEY = "companion-ai-client-id";
const SYNC_KEY = "companion-ai-sync-key";

const defaults = {
  name: "",
  model: "gpt-5-mini",
  messages: []
};

function readLocalState() {
  try { const value=JSON.parse(localStorage.getItem(STORAGE)||"{}"); return value && typeof value==="object" && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
let state = {...defaults,...readLocalState(),messages:[]};
let fullHistory = [];
let historyEpoch = 0;
let chatBusy = false;
let sidebarEpoch = 0;
let conversationArchives = [];
const pendingArchives = new Map();
let lumiSessionOwner;
let lumiSessionEpoch = 0;
const lumiPendingRequests = new Set();
function lumiSessionSnapshot() { return {owner:lumiSessionOwner,epoch:lumiSessionEpoch}; }
function lumiSessionMatches(scope) { return scope.owner===lumiSessionOwner && scope.epoch===lumiSessionEpoch; }
function lumiSessionChangedError() { return Object.assign(new Error("Session changed."),{name:"AbortError",code:"LUMI_SESSION_CHANGED"}); }
function lumiSetSessionOwner(owner,force=false) {
  owner=owner||null;
  if(lumiSessionOwner===undefined){lumiSessionOwner=owner;return;}
  if(!force && owner===lumiSessionOwner)return;
  lumiSessionOwner=owner;
  lumiSessionEpoch++;
  for(const controller of lumiPendingRequests)controller.abort();
  lumiPendingRequests.clear();
  state.messages=[];
  fullHistory=[];historyEpoch++;sidebarEpoch++;
  conversationArchives=[];pendingArchives.clear();chatBusy=false;
  document.getElementById("conversationList")?.replaceChildren();
  const sidebarNote=document.getElementById("sidebarStatus");if(sidebarNote)sidebarNote.textContent="";
  if(loadEarlierBtn)loadEarlierBtn.hidden=true;
  for(const id of ["newChatBtn","sidebarNewChatBtn"]) {const node=document.getElementById(id);if(node)node.disabled=false;}
  const stored=readLocalState();delete stored.messages;
  try{localStorage.setItem(STORAGE,JSON.stringify(stored));}catch{}
  messagesEl?.replaceChildren();
  if(input)input.value="";
  if(form)delete form.dataset.sending;
  window.speechSynthesis?.cancel();
  for(const id of ['memoryDialog','profileDialog']){
    const dialog=document.getElementById(id);
    if(dialog?.open)dialog.close();
  }
  for(const id of ['memoryText','memoryStatus']){
    const node=document.getElementById(id);if(node){if('value' in node)node.value='';else node.textContent='';}
  }
  for(const key of ['lumiCalendarSignInDraft','lumiCalendarResume','lumiCalendarReadIntent'])sessionStorage.removeItem(key);
  for(const id of ['lumiCalendarDay','lumiCalendarWeek','lumiCalendarResume','lumiCalendarLoginResume'])document.getElementById(id)?.remove();
  window.dispatchEvent(new Event('lumi-session-change'));
}


/* =========================================================
   SUPABASE AUTHENTICATION
   ========================================================= */

async function getAccessToken() {
  const epoch=lumiSessionEpoch;
  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if(epoch!==lumiSessionEpoch)throw lumiSessionChangedError();
  lumiSetSessionOwner(error?null:session?.user?.id);
  if (error) {
    console.error(
      "Error getting Supabase session:",
      error
    );
    return null;
  }

  return session?.access_token || null;
}


async function authFetch(url, options = {}) {
  const epoch=lumiSessionEpoch;
  const token = await getAccessToken();
  if(epoch!==lumiSessionEpoch)throw lumiSessionChangedError();

  if (!token) {
    throw new Error(
      "Please sign in to continue."
    );
  }

  const headers =
    new Headers(options.headers || {});

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );
  if(window.LumiI18n){headers.set('x-lumi-language',window.LumiI18n.language);headers.set('accept-language',window.LumiI18n.language);}

  const scope=lumiSessionSnapshot(),controller=new AbortController();
  const relay=()=>controller.abort(options.signal?.reason);
  if(options.signal?.aborted)relay();
  else options.signal?.addEventListener('abort',relay,{once:true});
  lumiPendingRequests.add(controller);
  const cleanup=()=>{lumiPendingRequests.delete(controller);options.signal?.removeEventListener('abort',relay);};
  const check=()=>{if(!lumiSessionMatches(scope))throw lumiSessionChangedError();};
  try {
    const response=await fetch(url,{...options,headers,signal:controller.signal});
    check();
    // Body decoding can finish after logout even when the transport ignores abort.
    for(const method of ['json','text','arrayBuffer','blob']){
      const read=response[method].bind(response);
      response[method]=async(...args)=>{try{check();const value=await read(...args);check();return value;}finally{cleanup();}};
    }
    return response;
  } catch(error){cleanup();throw error;}
}
const signInBtn = document.querySelector("#signInBtn");
const signOutBtn = document.querySelector("#signOutBtn");

function ensureAuthDialog() {
  let dialog = document.getElementById("lumiAuthDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "lumiAuthDialog";
  dialog.setAttribute("aria-label", "Entrar na Lumi");
  dialog.style.cssText =
    "width:min(440px,92vw);box-sizing:border-box;padding:24px;" +
    "border:1px solid #475569;border-radius:16px;background:#111827;" +
    "color:#f8fafc;box-shadow:0 20px 70px #0008;";
  const heading = document.createElement("h2");
  heading.textContent = "Entrar na Lumi";
  heading.tabIndex = -1;
  heading.style.marginTop = "0";
  const help = document.createElement("p");
  help.textContent = "Entre com sua conta Google ou receba um link por e-mail.";
  const form = document.createElement("form");
  form.noValidate = true;
  const label = document.createElement("label");
  label.textContent = "Seu e-mail";
  label.htmlFor = "lumiSignInEmail";
  const email = document.createElement("input");
  email.id = "lumiSignInEmail";
  email.type = "email";
  email.autocomplete = "email";
  email.required = true;
  email.placeholder = "voce@exemplo.com";
  email.style.cssText = "box-sizing:border-box;width:100%;margin:8px 0 12px;" +
    "padding:12px;border:1px solid #64748b;border-radius:8px;" +
    "background:#1e293b;color:white;font-size:16px;";
  const rememberLabel = document.createElement("label");
  rememberLabel.style.cssText =
    "display:flex;align-items:center;gap:9px;margin:4px 0 14px;cursor:pointer;";
  const remember = document.createElement("input");
  remember.type = "checkbox";
  remember.id = "lumiRememberSignIn";
  remember.checked = rememberSignIn();
  const rememberHelp = document.createElement("p");
  rememberHelp.textContent = "Use apenas em um dispositivo pessoal. Informações médicas exigirão nova confirmação de identidade.";
  rememberHelp.style.cssText = "font-size:13px;line-height:1.45;color:#cbd5e1;margin:0 0 14px;";
  rememberLabel.append(remember,document.createTextNode("Lembrar de mim neste dispositivo"));
  const googleButton = document.createElement("button");
  googleButton.type = "button";
  googleButton.id = "lumiGoogleSignIn";
  googleButton.textContent = "Continuar com Google";
  googleButton.style.cssText =
    "width:100%;margin:0 0 12px;padding:12px;border-radius:8px;" +
    "border:1px solid #64748b;background:#fff;color:#111827;cursor:pointer;";
  const divider = document.createElement("p");
  divider.textContent = "Ou receba um link por e-mail";
  divider.style.cssText = "text-align:center;margin:10px 0;color:#cbd5e1;";
  remember.addEventListener("change", () => {
    // A signed-out user may choose session-only or persistent storage.
    // Remove stale credentials from the opposite storage before sign-in.
    localStorage.setItem(REMEMBER_KEY, String(remember.checked));
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  });
  googleButton.addEventListener("click", async () => {
    googleButton.disabled = true;
    const status = dialog.querySelector("#lumiAuthStatus");
    status.textContent = "Abrindo login do Google...";
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname }
      });
      if (error) throw error;
    } catch (error) {
      status.textContent = error?.message || "Não foi possível entrar com Google.";
      googleButton.disabled = false;
    }
  });
  const status = document.createElement("p");
  status.id = "lumiAuthStatus";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Enviar link";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Cancelar";
  for (const btn of [submit,close]) {
    btn.style.cssText = "padding:10px 14px;border-radius:8px;cursor:pointer;" +
      "border:1px solid #64748b;background:#243449;color:white;";
  }
  close.onclick = () => dialog.close();
  actions.append(submit,close);
  form.append(googleButton,divider,label,email,rememberLabel,rememberHelp,status,actions);
  dialog.append(heading,help,form);
  document.body.appendChild(dialog);
  form.addEventListener("submit",async event => {
    event.preventDefault();
    if (!email.checkValidity()) {
      status.textContent = "Digite um endereço de e-mail válido.";
      email.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = "Enviando seu link de acesso...";
    try {
      // Keep users on the exact development host that initiated sign-in.
      const redirectTo = location.origin + location.pathname;
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: email.value.trim(),
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      status.textContent =
        "Link solicitado. Verifique sua caixa de entrada e spam. " +
        "Abra o link neste navegador para voltar à Lumi.";
      submit.textContent = "Reenviar link";
    } catch (error) {
      status.textContent = error?.message ||
        "Não foi possível enviar o link. Tente novamente.";
    } finally {
      submit.disabled = false;
    }
  });
  return dialog;
}

async function updateAuthUI() {
  const epoch=lumiSessionEpoch;
  const { data, error } = await supabaseClient.auth.getSession();
  if(epoch!==lumiSessionEpoch)return;
  lumiSetSessionOwner(error?null:data?.session?.user?.id);
  if (error) console.error("Erro de sessão:",error);
  const signedIn = !!data?.session && !error;
  if (signInBtn) signInBtn.hidden = signedIn;
  if (signOutBtn) signOutBtn.hidden = !signedIn;
  // Never display locally cached conversation content while signed out.
  if (!signedIn) {
    state.messages = [];
    fullHistory = [];
    const stored = readLocalState();
    delete stored.messages;
    localStorage.setItem(STORAGE, JSON.stringify(stored));
    if (messagesEl) messagesEl.replaceChildren();
    if (loadEarlierBtn) loadEarlierBtn.hidden = true;
  }
  const dialog = document.getElementById("lumiAuthDialog");
  if (signedIn && dialog?.open) dialog.close();
}

signInBtn?.addEventListener("click", () => {
  const dialog = ensureAuthDialog();
  dialog.querySelector("#lumiAuthStatus").textContent = "";
  dialog.showModal();
  // Show both sign-in choices before a mobile keyboard can obscure them.
  dialog.scrollTop = 0;
  dialog.querySelector("h2").focus({ preventScroll: true });
});

signOutBtn?.addEventListener("click", async () => {
  signOutBtn.disabled = true;
  lumiSetSessionOwner(null,true);
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    await updateAuthUI();
  } catch (error) {
    alert("Não foi possível sair da Lumi. Tente novamente.");
    console.error("Erro ao sair:",error);
  } finally {
    signOutBtn.disabled = false;
  }
});

supabaseClient.auth.onAuthStateChange((event,session) => {
  if(event==="SIGNED_OUT")lumiSetSessionOwner(null,true);
  else lumiSetSessionOwner(session?.user?.id);
  // Run session reads outside Supabase's auth callback lock.
  setTimeout(async () => {
    await updateAuthUI();
  }, 0);
});

updateAuthUI();

/* Lumi-wide inactivity sign-out: 10 minutes, development frontend only.
   Persist last activity so reloading the page cannot bypass the timeout.
   This is a browser UX control; server-side session enforcement is a separate gate. */
const LUMI_IDLE_LIMIT_MS = 10 * 60 * 1000;
const LUMI_LAST_ACTIVITY_KEY = "lumi-last-activity";
let lumiIdleSigningOut = false;
let lumiLastRecordedActivity = 0;

async function lumiCheckIdle() {
  if (lumiIdleSigningOut) return;
  const last = Number(localStorage.getItem(LUMI_LAST_ACTIVITY_KEY));
  if (!Number.isFinite(last) || last <= 0) return;
  if (Date.now() - last < LUMI_IDLE_LIMIT_MS) return;
  lumiIdleSigningOut = true;
  lumiSetSessionOwner(null,true);
  try {
    // Local sign-out avoids unexpectedly revoking sessions on other devices.
    await supabaseClient.auth.signOut({ scope: "local" });
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LUMI_LAST_ACTIVITY_KEY);
    await updateAuthUI();
    // Remove potentially private content still visible in the old DOM.
    // A reload also clears unsaved UI state and returns to the sign-in screen.
    location.reload();
  } catch (error) {
    console.error("Lumi idle sign-out failed", error);
    // Fail closed for UI access, even if the network is temporarily unavailable.
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LUMI_LAST_ACTIVITY_KEY);
    location.reload();
  }
}

function lumiRecordActivity() {
  if (lumiIdleSigningOut) return;
  const now = Date.now();
  const previous = Number(localStorage.getItem(LUMI_LAST_ACTIVITY_KEY));
  if (previous > 0 && now - previous >= LUMI_IDLE_LIMIT_MS) {
    void lumiCheckIdle();
    return;
  }
  // Throttle storage writes, but keep interaction responsive.
  if (now - lumiLastRecordedActivity < 3000) return;
  lumiLastRecordedActivity = now;
  if (signOutBtn && !signOutBtn.hidden) {
    localStorage.setItem(LUMI_LAST_ACTIVITY_KEY, String(now));
  }
}
for (const type of ["pointerdown", "keydown", "touchstart", "wheel"]) {
  document.addEventListener(type, lumiRecordActivity, { passive: true });
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void lumiCheckIdle();
});
window.addEventListener("focus", () => { void lumiCheckIdle(); });
window.addEventListener("storage", event => {
  if (event.key === LUMI_LAST_ACTIVITY_KEY) void lumiCheckIdle();
});
setInterval(() => { void lumiCheckIdle(); }, 15000);
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    localStorage.removeItem(LUMI_LAST_ACTIVITY_KEY);
    state.messages = [];
    fullHistory = [];
    if (messagesEl) messagesEl.replaceChildren();
  } else if (event === "SIGNED_IN" && session) {
    const last = Number(localStorage.getItem(LUMI_LAST_ACTIVITY_KEY));
    if (last > 0 && Date.now() - last >= LUMI_IDLE_LIMIT_MS) {
      setTimeout(() => { void lumiCheckIdle(); }, 0);
    } else if (!last) {
      localStorage.setItem(LUMI_LAST_ACTIVITY_KEY, String(Date.now()));
    }
  }
});
void lumiCheckIdle();

/* =========================================================
   LEGACY LOCAL ID
   Kept temporarily for compatibility with the current UI.
   The Worker now identifies the user from Supabase.
   ========================================================= */

function getClientId() {
  let id =
    localStorage.getItem(CLIENT_ID_KEY);

  if (!id) {
    id = crypto.randomUUID();

    localStorage.setItem(
      CLIENT_ID_KEY,
      id
    );
  }

  return id;
}

const clientId = getClientId();

function getMemoryId() {
  const syncKey =
    localStorage.getItem(SYNC_KEY)?.trim();

  return syncKey || clientId;
}


/* =========================================================
   LOCAL STATE
   ========================================================= */

function save() {
  localStorage.setItem(
    STORAGE,
    JSON.stringify(state)
  );
}


// Render only text and validated HTTP(S) anchors. Never interpret reply HTML.
function appendLumiLinks(container, content) {
  const text = String(content ?? "");
  const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s<>]+?)\)(?=\s|$|[.,!?;:])|https?:\/\/[^\s<>"\u201c\u201d]+/gi;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    container.appendChild(document.createTextNode(text.slice(position, match.index)));
    let url = match[2] || match[0];
    let suffix = "";
    if (!match[2]) {
      // Keep balanced parentheses, which legitimately occur in URLs.
      while (/[.,!?;:\u2019]$/.test(url) ||
             (url.endsWith(")") && (url.match(/\)/g)||[]).length > (url.match(/\(/g)||[]).length)) {
        suffix = url.slice(-1) + suffix;
        url = url.slice(0, -1);
      }
    }
    let valid = false;
    try {
      const parsed = new URL(url);
      valid = ["https:", "http:"].includes(parsed.protocol) && !!parsed.hostname &&
        !parsed.username && !parsed.password && !/[\u0000-\u0020\u007f\\]/.test(url);
    } catch {}
    if (valid) {
      const link = document.createElement("a");
      link.href = url;
      link.textContent = match[1] || url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      container.appendChild(link);
      if (suffix) container.appendChild(document.createTextNode(suffix));
    } else {
      container.appendChild(document.createTextNode(match[0]));
    }
    position = match.index + match[0].length;
  }
  container.appendChild(document.createTextNode(text.slice(position)));
}

function add(role, content, persist = true) {
  const el =
    document.createElement("div");

  el.className = `msg ${role}`;
  if(role === 'system')el.dataset.lumiUi = 'true';
  if (role === "assistant") {
    appendLumiLinks(el, content);
  } else {
    el.textContent = content;
  }

  messagesEl.appendChild(el);

  messagesEl.scrollTop =
    messagesEl.scrollHeight;

  if (persist) {
    state.messages.push({
      role,
      content
    });

    state.messages =
      state.messages.slice(-40);

    save();
  }
}


function lumiWelcomeText(){
 const english=window.LumiI18n?.language==='en';
 return (english?'Hello':'Olá')+(state.name?', '+state.name:'')+(english?'! I am Lumi, your personal companion. I can chat with you and remember important information.':'! Eu sou a Lumi, sua assistente no Companion AI. Posso conversar com você e lembrar de informações importantes.');
}
window.addEventListener('lumi-language-change',()=>{const welcome=document.querySelector('[data-lumi-welcome]');if(welcome)welcome.textContent=lumiWelcomeText();});
function render() {
  messagesEl.innerHTML = "";

  state.messages.forEach(m => {
    add(
      m.role,
      m.content,
      false
    );
  });

  if (!state.messages.length) {
    add(
      "assistant",
      lumiWelcomeText(),
      false
    );
    messagesEl.lastElementChild.dataset.lumiWelcome = 'true';

  }
requestAnimationFrame(() => {
  const lastMessage = messagesEl.lastElementChild;

  if (lastMessage) {
    lastMessage.scrollIntoView({
      block: "end",
      behavior: "instant"
    });
  }
});
}
/* =========================================================
   SHARED HISTORY
   ========================================================= */
async function loadSharedHistory() {
  const generation=lumiSessionEpoch;
  const epoch = historyEpoch;
  let token;
  try{token=await getAccessToken();}catch(error){
    if(error.code!=="LUMI_SESSION_CHANGED")console.error("Could not read history session:",error);
    return;
  }

  if (epoch !== historyEpoch || generation!==lumiSessionEpoch) return;
  const scope=lumiSessionSnapshot();

  /*
   Do not repeatedly call the Worker before
   the user has an authenticated Supabase session.
  */
  if (!token) {
    state.messages = [];
    fullHistory = [];
    if (messagesEl) messagesEl.replaceChildren();
    return;
  }

  try {
    const response =
      await authFetch(
        `${WORKER_URL}history`
      );

    const data =
      await response.json();
    if (epoch !== historyEpoch || !lumiSessionMatches(scope)) return;

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Error loading conversation history."
      );
    }

   if (
  Array.isArray(data?.history)
) {
  fullHistory =
    data.history.filter(
      item =>
        item &&
        typeof item.content === "string" &&
        (
          item.role === "user" ||
          item.role === "assistant"
        )
    );

  state.messages =
    fullHistory.slice(-6);

  loadEarlierBtn.hidden =
    fullHistory.length <= 6;

  save();
}
  } catch (error) {
    console.error(
      "Could not load shared history:",
      error
    );
  }

  if(lumiSessionMatches(scope))render();
}

loadEarlierBtn?.addEventListener("click", () => {
  const currentlyShown =
    state.messages.length;

  const newCount =
    Math.min(
      currentlyShown + 6,
      fullHistory.length
    );

  state.messages =
    fullHistory.slice(-newCount);

  render();

  loadEarlierBtn.hidden =
    newCount >= fullHistory.length;
});
/*
  Load once.
  The previous 5-second polling has been removed.
  It was repeatedly generating 401 requests.
*/
loadSharedHistory();


/* =========================================================
   CHAT
   ========================================================= */

async function getReply(text) {
  // Creation and preparation requests must go through the Worker, which
  // requires explicit confirmation before creating any calendar event.
  // Never POST directly to /calendar/events from the chat UI.
  const calendarCreationRequest =
    /\b(?:prepare|preparar|prepara|crie|criar|cria|marque|marcar|agende|agendar|adicione|adicionar|inclua|incluir|registre|registrar|schedule|book|create|add)\b/i
      .test(text) &&
    /\b(?:calendar|calendário|agenda|compromisso|compromissos|evento|eventos|appointment|appointments|reunião|consulta)\b/i
      .test(text);

  // Generic words such as "eventos" also occur in health questions.
  // Only explicit calendar references or complete agenda-list requests belong here.
  const calendarRequest =
    /\b(calendar|calendário|agenda)\b/i.test(text) ||
    /^(?:(?:lumi|por favor)[, ]+)?(?:(?:mostre|mostrar|liste|listar|ver|consultar|quais são|show|list)\s+)?(?:(?:os meus|meus|os|my|the)\s+)?(?:compromissos|eventos|appointments|events)(?:\s+(?:(?:de|para|for)\s+)?(?:hoje|amanhã|desta semana|da semana|today|tomorrow|this week))?[?.!\s]*$/i.test(text.trim());

  // Explicit confirmation must reach the Worker, never the listing handler.
  const calendarConfirmation =
    /^CONFIRMAR EVENTO$/i.test(text.trim());

  if (calendarRequest && !calendarCreationRequest && !calendarConfirmation) {

    const response =
      await authFetch(
        `${WORKER_URL}calendar/events`
      );

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error(
        "The calendar did not return a valid response."
      );
    }

    if (!response.ok) {

      const authResponse =
        await authFetch(
          `${WORKER_URL}auth/google/start`
        );

      const authData =
        await authResponse.json();

    if (
  !authResponse.ok ||
  !authData?.url
) {
  throw new Error(
    authData?.error ||
    data?.error ||
    "Não foi possível conectar o Google Calendar."
  );
}

window.location.href =
  authData.url;

return {
  reply:
    "Abrindo o Google para conectar seu Calendar..."
};
}
    const events =
      Array.isArray(data?.events)
        ? data.events
        : [];

        const todayOnly =
      /\b(hoje|today)\b/i.test(text);

    const now = new Date();

    const selectedEvents = events
      .filter(event => {
        if (!event.start) return false;

        const start = new Date(event.start);

        if (Number.isNaN(start.getTime())) {
          return false;
        }

        if (todayOnly) {
          return start.toLocaleDateString(
            "en-CA",
            { timeZone: "America/Sao_Paulo" }
          ) === now.toLocaleDateString(
            "en-CA",
            { timeZone: "America/Sao_Paulo" }
          );
        }

        return start >= now ||
          /^\d{4}-\d{2}-\d{2}$/.test(event.start) &&
          event.start >= now.toLocaleDateString(
            "en-CA",
            { timeZone: "America/Sao_Paulo" }
          );
      })
      .slice(0, 5);

    if (!selectedEvents.length) {
      return {
        reply: todayOnly
          ? "Você não tem compromissos no Google Calendar hoje."
          : "Não encontrei próximos compromissos no Google Calendar."
      };
    }

    const formattedEvents = selectedEvents.map(event => {
      const allDay =
        /^\d{4}-\d{2}-\d{2}$/.test(event.start);

      if (allDay) {
        const [year, month, day] = event.start.split("-");
        return `• ${day}/${month}/${year} — Dia inteiro — ${event.title || "Evento"}`;
      }

      const start = new Date(event.start);

      const dateTime = start.toLocaleString(
        "pt-BR",
        {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      );

      return `• ${dateTime} — ${event.title || "Evento"}`;
    });

    return {
      reply:
        (todayOnly
          ? "Seus compromissos de hoje:\n\n"
          : "Seus próximos compromissos:\n\n") +
        formattedEvents.join("\n")
    };
  }
  const response =
    await authFetch(
      `${WORKER_URL}chat`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          message: text,
          history:
            state.messages.slice(-12)
        })
      }
    );

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      "The server did not return a valid response."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Error connecting to Lumi."
    );
  }

  return data;
}

form.onsubmit = async e => {
  e.preventDefault();
  if (chatBusy || form.dataset.sending === "true") return;

  const text =
    input.value.trim();

  if (!text) {
    return;
  }

  const scope=lumiSessionSnapshot();
  form.dataset.sending = "true";
  setConversationActionsDisabled();
  input.value = "";

  add(
    "user",
    text
  );

  const wait =
    document.createElement("div");

  wait.className =
    "msg assistant";
  wait.dataset.lumiUi = 'true';

  wait.textContent =
    "Pensando…";

  messagesEl.appendChild(wait);

  try {
    const data =
      await getReply(text);

    if(!lumiSessionMatches(scope))return;
    wait.remove();

    const reply =
      data?.reply ||
      "Sem resposta.";

    speakLumi(reply);

    add(
      "assistant",
      reply,
      false
    );

    if (
      Array.isArray(data?.history)
    ) {
      state.messages =
        data.history.slice(-30);

      save();
      render();

    } else {
      state.messages.push({
        role: "assistant",
        content: reply
      });

      state.messages =
        state.messages.slice(-40);

      save();
    }

  } catch (err) {
    if(!lumiSessionMatches(scope))return;
    wait.remove();
    if (!input.value.trim()) {
      input.value = text;
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }

    add(
      "system",
      err.message
    );
  } finally {
    wait.remove();
    if(lumiSessionMatches(scope)){
      delete form.dataset.sending;
      setConversationActionsDisabled();
    }
  }
};


/* =========================================================
   MEMORY
   ========================================================= */

$("#memoryBtn").onclick =
  async () => {
    const scope=lumiSessionSnapshot();

    memoryDialog.showModal();

    $("#memoryStatus").textContent =
      "Carregando memória...";

    $("#memoryText").value = "";

    try {
      const response =
        await authFetch(
          `${WORKER_URL}memory`
        );

      const data =
        await response.json();
      if(!lumiSessionMatches(scope))return;

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Erro ao carregar memória."
        );
      }

      $("#memoryText").value =
        data?.memory || "";

      $("#memoryStatus").textContent =
        data?.memory
          ? "Memória carregada."
          : "Nenhuma memória salva ainda.";

    } catch (error) {
      if(!lumiSessionMatches(scope))return;
      $("#memoryStatus").textContent =
        error.message;
    }
  };


$("#closeMemoryBtn").onclick =
  () => {
    memoryDialog.close();
  };


$("#saveMemoryBtn").onclick =
  async () => {
    const scope=lumiSessionSnapshot();

    const memory =
      $("#memoryText").value.trim();

    $("#memoryStatus").textContent =
      "Salvando...";

    try {
      const response =
        await authFetch(
          `${WORKER_URL}memory`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              memory
            })
          }
        );

      const data =
        await response.json();
      if(!lumiSessionMatches(scope))return;

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Erro ao salvar memória."
        );
      }

      $("#memoryStatus").textContent =
        "Memória salva.";

    } catch (error) {
      if(!lumiSessionMatches(scope))return;
      $("#memoryStatus").textContent =
        error.message;
    }
  };


$("#deleteMemoryBtn").onclick =
  async () => {
    const scope=lumiSessionSnapshot();

    const confirmed =
      confirm(
        "Apagar toda a memória persistente do Companion?"
      );

    if (!confirmed) {
      return;
    }

    $("#memoryStatus").textContent =
      "Apagando memória...";

    try {
      const response =
        await authFetch(
          `${WORKER_URL}memory`,
          {
            method: "DELETE",

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

      const data =
        await response.json();
      if(!lumiSessionMatches(scope))return;

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Erro ao apagar memória."
        );
      }

      $("#memoryText").value = "";

      $("#memoryStatus").textContent =
        "Memória apagada.";

    } catch (error) {
      if(!lumiSessionMatches(scope))return;
      $("#memoryStatus").textContent =
        error.message;
    }
  };


/* =========================================================
   SERVICE WORKER
   ========================================================= */

// Service-worker lifecycle and safe update checks live in frontend/experience.js.

/* =========================================================
   VOICE INPUT
   ========================================================= */

const voiceButton =
  $("#voiceButton");

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (
  voiceButton &&
  SpeechRecognition
) {
  const recognition =
    new SpeechRecognition();

  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    voiceButton.textContent = "🔴";
    voiceButton.title = "Ouvindo...";
  };

  recognition.onresult = event => {
    const text =
      event.results[0][0].transcript;

    input.value = text;
    input.focus();
  };

  recognition.onerror = event => {
    console.error(
      "Erro no reconhecimento de voz:",
      event.error
    );
  };

  recognition.onend = () => {
    voiceButton.textContent = "🎙️";
    voiceButton.title =
      "Falar com a Lumi";
  };

  voiceButton.onclick = () => {
    recognition.start();
  };

} else if (voiceButton) {
  voiceButton.disabled = true;

  voiceButton.title =
    "Reconhecimento de voz não disponível neste navegador";
}


/* =========================================================
   LUMI SPEECH
   ========================================================= */
let lumiSoundEnabled = false;

function speakLumi(text) {
  if (
    !lumiSoundEnabled ||
    !text ||
    !("speechSynthesis" in window)
  ) {
    return;
  }

  window.speechSynthesis.cancel();


  const speech =
    new SpeechSynthesisUtterance(text);

  // Detect whether Lumi's response is Portuguese or English.
  const portuguese =
    window.LumiI18n ? window.LumiI18n.language !== 'en' : /[áàâãéêíóôõúç]|\b(o|a|os|as|de|do|da|que|para|com|não|uma|você|seu|sua|é)\b/i
      .test(text);

  speech.lang =
    portuguese ? "pt-BR" : "en-US";

  const voices =
    window.speechSynthesis.getVoices();

  const preferredVoice =
    voices.find(voice =>
      voice.lang
        .toLowerCase()
        .startsWith(
          portuguese ? "pt-br" : "en-us"
        )
    ) ||
    voices.find(voice =>
      voice.lang
        .toLowerCase()
        .startsWith(
          portuguese ? "pt" : "en"
        )
       );

if (preferredVoice) {
  speech.voice = preferredVoice;
}

window.speechSynthesis.speak(speech);
  }

/* =========================================================
   SOUND BUTTON
   ========================================================= */

/* =========================================================
   SOUND BUTTON
   ========================================================= */

const soundButton =
  $("#soundButton");

if (soundButton) {
  soundButton.onclick = () => {
    lumiSoundEnabled =
      !lumiSoundEnabled;

    if (lumiSoundEnabled) {
      soundButton.textContent = "🔊";
      soundButton.title =
        "Desligar voz da Lumi";

      soundButton.setAttribute(
        "aria-label",
        "Desligar voz da Lumi"
      );

    } else {
      window.speechSynthesis?.cancel();

      soundButton.textContent = "🔇";
      soundButton.title =
        "Ligar voz da Lumi";

      soundButton.setAttribute(
        "aria-label",
        "Ligar voz da Lumi"
      );
    }
  };
}
 
/* =========================================================
   ENTER SENDS MESSAGE
   ========================================================= */

input.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      form.requestSubmit();
    }
  }
);
/* =========================================================
   INVITE TO LUMI — clear desktop and mobile sharing
   ========================================================= */

const inviteBtn = document.getElementById("inviteBtn");
const LUMI_INVITE_URL = "https://mylumicompanion.com/";
const LUMI_INVITE_TEXT =
  "Conheça a Lumi, sua assistente pessoal com memória.";

function openLumiInviteDialog() {
  const previous = document.getElementById("lumiInviteDialog");
  if (previous) previous.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "lumiInviteDialog";
  dialog.setAttribute("aria-label", "Convidar para a Lumi");
  dialog.style.cssText =
    "max-width:min(440px,92vw);box-sizing:border-box;padding:24px;" +
    "border-radius:16px;border:1px solid #475569;background:#111827;" +
    "color:#f8fafc;box-shadow:0 20px 70px #0008;";
  dialog.innerHTML = `
    <h2 style="margin:0 0 12px">💌 Convidar para a Lumi</h2>
    <p style="line-height:1.5">Envie este link para alguém conhecer a Lumi.</p>
    <input id="lumiInviteLink" type="text" readonly
      aria-label="Link para convidar"
      style="box-sizing:border-box;width:100%;padding:12px;border-radius:8px;
      border:1px solid #64748b;background:#1e293b;color:white;">
    <p id="lumiInviteStatus" role="status" aria-live="polite"></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button type="button" id="lumiCopyInvite">📋 Copiar link</button>
      <button type="button" id="lumiWhatsAppInvite">WhatsApp</button>
      <button type="button" id="lumiEmailInvite">✉️ E-mail</button>
      <button type="button" id="lumiCloseInvite">Fechar</button>
    </div>
  `;
  document.body.appendChild(dialog);
  const link = dialog.querySelector("#lumiInviteLink");
  const status = dialog.querySelector("#lumiInviteStatus");
  link.value = LUMI_INVITE_URL;
  for (const button of dialog.querySelectorAll("button")) {
    button.style.cssText =
      "padding:10px 12px;border-radius:8px;border:1px solid #64748b;" +
      "background:#243449;color:#fff;cursor:pointer;";
  }

  dialog.querySelector("#lumiCopyInvite").onclick = async () => {
    try {
      await navigator.clipboard.writeText(LUMI_INVITE_URL);
      status.textContent = "✓ Link copiado. Cole no WhatsApp, e-mail ou mensagem.";
    } catch {
      link.focus();
      link.select();
      status.textContent = "Selecione e copie o link com Ctrl+C.";
    }
  };
  dialog.querySelector("#lumiWhatsAppInvite").onclick = () => {
    const message = LUMI_INVITE_TEXT + " " + LUMI_INVITE_URL;
    window.open("https://wa.me/?text=" + encodeURIComponent(message),
      "_blank", "noopener,noreferrer");
  };
  dialog.querySelector("#lumiEmailInvite").onclick = () => {
    const subject = encodeURIComponent("Convite para conhecer a Lumi");
    const body = encodeURIComponent(LUMI_INVITE_TEXT + "\n\n" + LUMI_INVITE_URL);
    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
  };
  dialog.querySelector("#lumiCloseInvite").onclick = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
}

inviteBtn?.addEventListener("click", async () => {
  // On desktop, show explicit destinations instead of silently copying.
  // On mobile, use native sharing where supported.
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile && navigator.share) {
    try {
      await navigator.share({
        title: "Lumi", text: LUMI_INVITE_TEXT, url: LUMI_INVITE_URL
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  openLumiInviteDialog();
});

/* =========================================================
   NEW CHAT AND CHAT HISTORY
   ========================================================= */

const newChatBtn = document.getElementById("newChatBtn");
const chatHistoryBtn = document.getElementById("chatHistoryBtn");
const sidebar = document.getElementById("conversationSidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const sidebarList = document.getElementById("conversationList");
const sidebarStatus = document.getElementById("sidebarStatus");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const sidebarNewChatBtn = document.getElementById("sidebarNewChatBtn");
let sidebarLoading = false;
let sidebarRefreshAgain = false;
let sidebarRefreshPromise = null;
let sidebarOwner = null;

function setConversationActionsDisabled() {
  const busy = chatBusy || form.dataset.sending === "true";
  for (const button of [newChatBtn, sidebarNewChatBtn]) if (button) button.disabled = busy;
}
function archiveTimestamp(chat) {
  const numeric = Number(chat?.timestamp);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const iso = Date.parse(chat?.createdAt || "");
  return Number.isFinite(iso) ? iso : Number(chat?.id) || 0;
}
function latestFive(items) {
  const unique = new Map();
  for (const item of items) if (item && typeof item.id === "string" && item.id) unique.set(item.id,item);
  return [...unique.values()].sort((a,b) => archiveTimestamp(b)-archiveTimestamp(a)).slice(0,5);
}
function rememberArchive(archive) {
  if (!archive?.id) return;
  pendingArchives.set(archive.id,archive);
  conversationArchives = latestFive([...conversationArchives,archive]);
  for (const id of pendingArchives.keys()) if (!conversationArchives.some(item => item.id === id)) pendingArchives.delete(id);
  renderConversationList();
}
function renderConversationList() {
  sidebarList.replaceChildren();
  sidebarStatus.textContent = conversationArchives.length ? "" : "Nenhuma conversa arquivada ainda.";
  for (const chat of conversationArchives) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "conversation-item";
    item.dataset.conversationId = chat.id;
    item.textContent = (typeof chat.title === "string" ? chat.title : "Conversa sem título").trim().slice(0,100);
    item.title = item.textContent;
    item.addEventListener("click", () => restoreConversation(chat.id));
    sidebarList.append(item);
  }
}
function setSidebarOpen(open) {
  sidebar?.classList.toggle("open",open);
  sidebarBackdrop?.classList.toggle("open",open);
  sidebar?.setAttribute("aria-hidden",String(!open));
  sidebarBackdrop?.setAttribute("aria-hidden",String(!open));
  if (window.innerWidth <= 900) {
    if (open) closeSidebarBtn?.focus();
    else chatHistoryBtn?.focus();
  }
}
async function refreshConversationList() {
  if (sidebarLoading) { sidebarRefreshAgain = true; return sidebarRefreshPromise; }
  sidebarLoading = true;
  sidebarRefreshPromise = (async () => {
    do {
      sidebarRefreshAgain = false;
      const epoch = sidebarEpoch;
      if (!conversationArchives.length) sidebarStatus.textContent = "Carregando conversas...";
      try {
        const response = await authFetch(`${WORKER_URL}history/archives`);
        if (!response.ok) throw new Error("Não foi possível carregar as conversas.");
        const data = await response.json();
        if (epoch !== sidebarEpoch) continue;
        const archives = Array.isArray(data.archives) ? data.archives : [];
        for (const item of archives) pendingArchives.delete(item.id);
        conversationArchives = latestFive([...archives,...pendingArchives.values()]);
        renderConversationList();
      } catch (error) {
        if (epoch === sidebarEpoch) sidebarStatus.textContent = error.message;
      }
    } while (sidebarRefreshAgain);
  })();
  try { await sidebarRefreshPromise; }
  finally { sidebarLoading = false; sidebarRefreshPromise = null; }
}
async function startNewConversation() {
  if (chatBusy || form.dataset.sending === "true") return;
  chatBusy = true;
  const epoch = sidebarEpoch;
  setConversationActionsDisabled();
  try {
    const response = await authFetch(`${WORKER_URL}history/archive`,{method:"POST"});
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error(data.error || "Não foi possível salvar a conversa.");
    if (epoch !== sidebarEpoch) return;
    historyEpoch++;
    rememberArchive(data.archived);
    fullHistory = [];
    state.messages = [];
    loadEarlierBtn.hidden = true;
    save();
    render();
    input.value = "";
    if (window.innerWidth <= 900) setSidebarOpen(false);
    input.focus();
    await refreshConversationList();
  } catch (error) {
    if(epoch === sidebarEpoch)sidebarStatus.textContent = error.message;
  } finally {
    if(epoch===sidebarEpoch){chatBusy = false;setConversationActionsDisabled();}
  }
}
async function restoreConversation(id) {
  if (chatBusy || form.dataset.sending === "true") return;
  chatBusy = true;
  const epoch = sidebarEpoch;
  setConversationActionsDisabled();
  sidebarStatus.textContent = "Abrindo conversa...";
  try {
    const response = await authFetch(`${WORKER_URL}history/restore`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})});
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error(data.error || "Não foi possível abrir a conversa.");
    if (epoch !== sidebarEpoch) return;
    historyEpoch++;
    rememberArchive(data.archived);
    if (Array.isArray(data.history)) {
      fullHistory = data.history.filter(item => item && typeof item.content === "string" && ["user","assistant"].includes(item.role));
      state.messages = fullHistory.slice(-6);
      loadEarlierBtn.hidden = fullHistory.length <= 6;
      save();
      render();
    } else await loadSharedHistory();
    if (window.innerWidth <= 900) setSidebarOpen(false);
    await refreshConversationList();
  } catch (error) {
    if(epoch === sidebarEpoch)sidebarStatus.textContent = error.message;
  } finally {
    if(epoch===sidebarEpoch){chatBusy = false;setConversationActionsDisabled();}
  }
}
newChatBtn?.addEventListener("click",startNewConversation);
sidebarNewChatBtn?.addEventListener("click",startNewConversation);
chatHistoryBtn?.addEventListener("click",() => {
  const opening = !sidebar?.classList.contains("open");
  setSidebarOpen(opening);
  if (opening) void refreshConversationList();
});
closeSidebarBtn?.addEventListener("click",() => setSidebarOpen(false));
sidebarBackdrop?.addEventListener("click",() => setSidebarOpen(false));
document.addEventListener("keydown",event => { if (event.key === "Escape" && sidebar?.classList.contains("open")) setSidebarOpen(false); });
void refreshConversationList();
supabaseClient.auth.onAuthStateChange((event,session) => {
  const scope=lumiSessionSnapshot();
  setTimeout(() => {
    if(!lumiSessionMatches(scope))return;
    const owner = session?.user?.id || null;
    if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && (!owner || owner !== sidebarOwner))) {
      sidebarEpoch++;
      historyEpoch++;
      conversationArchives = [];
      pendingArchives.clear();
      sidebarList.replaceChildren();
    }
    if (owner) sidebarOwner = owner;
    else if (event === "SIGNED_OUT") sidebarOwner = null;
    if (event === "SIGNED_IN") void loadSharedHistory();
    void refreshConversationList();
  },0);
});

