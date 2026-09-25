import {
  requireLogin,
  authenticatedFetch,
  supabase
} from "./lumi-auth.js";

const $ = selector =>
  document.querySelector(selector);

// ========================================
// LUMI — COMPANION AI
// Aplicativo com autenticação Supabase
// ========================================

const WORKER_URL =
  "https://round-lab-f54f.psanchesnle.workers.dev/api/";

const STORAGE = "companion-ai-v3";

const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#messageInput");

const settingsDialog = $("#settingsDialog");
const memoryDialog = $("#memoryDialog");

const defaults = {
  name: "",
  model: "gpt-5-mini",
  messages: []
};


let state = { ...defaults };

let currentUser = null;
let lumiSoundEnabled = false;
let ready = false;

// ========================================
// IDENTIDADE E ARMAZENAMENTO
// ========================================

function storageKey() {
  if (!currentUser) {
    throw new Error("Usuário não autenticado.");
  }

  return `${STORAGE}:${currentUser.id}`;
}

function save() {
  if (!currentUser) return;

  localStorage.setItem(
    storageKey(),
    JSON.stringify(state)
  );
}

function loadLocalState() {
  const saved = localStorage.getItem(
    storageKey()
  );

  if (!saved) {
    state = { ...defaults, messages: [] };
    return;
  }

  try {
    const data = JSON.parse(saved);

    state = {
      ...defaults,
      ...data,
      messages: Array.isArray(data.messages)
        ? data.messages
        : []
    };
  } catch {
    state = { ...defaults, messages: [] };
  }
}

// ========================================
// INTERFACE DO CHAT
// ========================================

function add(role, content, persist = true) {
  const el = document.createElement("div");

  el.className = `msg ${role}`;
  
const urlRegex = /https?:\/\/[^\s<>"']+/g;
let lastIndex = 0;

for (const match of content.matchAll(urlRegex)) {
  const start = match.index;
  const rawUrl = match[0];
  const url = rawUrl.replace(/[.,;:!?)\]]+$/, "");

  el.appendChild(
    document.createTextNode(
      content.slice(lastIndex, start)
    )
  );

  const link = document.createElement("a");
  link.href = url;
  link.textContent = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  el.appendChild(link);
  lastIndex = start + rawUrl.length;
}

el.appendChild(
  document.createTextNode(content.slice(lastIndex))
);

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

function render() {
  messagesEl.innerHTML = "";

  state.messages.forEach(message => {
    add(
      message.role,
      message.content,
      false
    );
  });

  if (!state.messages.length) {
    add(
      "assistant",
      `Olá${state.name
        ? ", " + state.name
        : ""}! Eu sou a Lumi, sua assistente no Companion AI. Como posso ajudar você hoje?`,
      false
    );
  }
}

// ========================================
// REQUISIÇÕES AUTENTICADAS
// ========================================

async function api(path, options = {}) {
  if (!ready || !currentUser) {
    throw new Error(
      "Faça login para continuar."
    );
  }

  const response =
    await authenticatedFetch(
      new URL(path, WORKER_URL).href,
      options
    );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "O servidor não retornou uma resposta válida."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Erro de comunicação com o servidor."
    );
  }

  return data;
}

// ========================================
// HISTÓRICO
// ========================================

async function loadSharedHistory() {
  try {
    const data = await api("history");

    if (Array.isArray(data.history)) {
      state.messages = data.history
        .filter(item =>
          item &&
          typeof item.content === "string" &&
          ["user", "assistant"].includes(
            item.role
          )
        )
        .slice(-40);

      save();
    }
  } catch (error) {
    console.error(
      "Erro ao carregar histórico:",
      error
    );
  }

  render();
}

// ========================================
// RESPOSTAS DA LUMI
// ========================================

async function getReply(text) {
  return api("", {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      message: text,
      history: state.messages.slice(-12)
    })
  });
}

form.onsubmit = async event => {
  event.preventDefault();

  if (!ready) return;

  const text = input.value.trim();

  if (!text) return;

  input.value = "";

  add("user", text);

  const wait =
    document.createElement("div");

  wait.className = "msg assistant";
  wait.textContent = "Pensando…";

  messagesEl.appendChild(wait);

  try {
    const data = await getReply(text);

    wait.remove();

    const reply =
      data?.reply || "Sem resposta.";

    if (Array.isArray(data?.history)) {
      state.messages =
        data.history.slice(-40);

      save();
      render();
    } else {
      add("assistant", reply);
    }

    speakLumi(reply);

  } catch (error) {
    wait.remove();

    add(
      "system",
      error.message,
      false
    );
  }
};

// ========================================
// CONFIGURAÇÕES
// ========================================

$("#connectGoogleBtn").onclick = async () => {
  const button = $("#connectGoogleBtn");
  const status = $("#googleCalendarStatus");

  button.disabled = true;
  status.textContent = "Preparando conexão...";

  try {
    const data = await api(
      "auth/google/start",
      { method: "POST" }
    );

    if (!data.authUrl) {
      throw new Error(
        "O servidor não retornou o endereço de autorização."
      );
    }

    const url = new URL(data.authUrl);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "accounts.google.com"
    ) {
      throw new Error(
        "Endereço de autorização inválido."
      );
    }

    status.textContent =
      "Autorize o acesso na página do Google.";

    window.location.assign(url.href);

  } catch (error) {
    status.textContent =
      error.message ||
      "Não foi possível conectar o Google Calendar.";

    button.disabled = false;
  }
};
$("#settingsBtn").onclick = () => {
  $("#userName").value =
    state.name || "";

  $("#model").value =
    state.model || "gpt-5-mini";

  $("#syncKey").value = "";

  $("#syncStatus").textContent =
    "A sincronização será feita pela sua conta.";

  settingsDialog.showModal();
};

$("#saveBtn").onclick = () => {
  state.name =
    $("#userName").value.trim();

  state.model =
    $("#model").value ||
    "gpt-5-mini";

  save();

  $("#syncStatus").textContent =
    "Configurações salvas.";

  render();
};

// As chaves antigas não serão usadas.
// Cada conta terá sua própria identidade.

$("#generateKeyBtn").onclick = () => {
  $("#syncStatus").textContent =
    "Sua conta substitui a chave de sincronização.";
};

$("#copyKeyBtn").onclick = () => {
  $("#syncStatus").textContent =
    "Não é necessário copiar uma chave.";
};

// ========================================
// APAGAR HISTÓRICO
// ========================================

$("#clearBtn").onclick = async () => {
  const confirmed = confirm(
    "Deseja apagar o histórico da sua conta?"
  );

  if (!confirmed) return;

  try {
    await api("history", {
      method: "DELETE"
    });

    state.messages = [];

    save();
    render();

    settingsDialog.close();

  } catch (error) {
    $("#syncStatus").textContent =
      error.message;
  }
};

// ========================================
// MEMÓRIA PERSISTENTE
// ========================================

$("#memoryBtn").onclick = async () => {
  memoryDialog.showModal();

  $("#memoryStatus").textContent =
    "Carregando memória...";

  $("#memoryText").value = "";

  try {
    const data = await api("memory");

    $("#memoryText").value =
      data?.memory || "";

    $("#memoryStatus").textContent =
      data?.memory
        ? "Memória carregada."
        : "Nenhuma memória salva ainda.";

  } catch (error) {
    $("#memoryStatus").textContent =
      error.message;
  }
};

$("#closeMemoryBtn").onclick = () => {
  memoryDialog.close();
};

$("#saveMemoryBtn").onclick = async () => {
  const memory =
    $("#memoryText").value.trim();

  $("#memoryStatus").textContent =
    "Salvando memória...";

  try {
    await api("memory", {
      method: "PUT",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        memory
      })
    });

    $("#memoryStatus").textContent =
      "Memória salva.";

  } catch (error) {
    $("#memoryStatus").textContent =
      error.message;
  }
};

$("#deleteMemoryBtn").onclick =
  async () => {

    const confirmed = confirm(
      "Deseja apagar toda a memória da sua conta?"
    );

    if (!confirmed) return;

    $("#memoryStatus").textContent =
      "Apagando memória...";

    try {
      await api("memory", {
        method: "DELETE"
      });

      $("#memoryText").value = "";

      $("#memoryStatus").textContent =
        "Memória apagada.";

    } catch (error) {
      $("#memoryStatus").textContent =
        error.message;
    }
  };

// ========================================
// RECONHECIMENTO DE VOZ
// ========================================

const voiceButton = $("#voiceButton");

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (voiceButton && SpeechRecognition) {
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
    voiceButton.title = "Falar com a Lumi";
  };

  voiceButton.onclick = () => {
    recognition.start();
  };

} else if (voiceButton) {
  voiceButton.disabled = true;

  voiceButton.title =
    "Reconhecimento de voz indisponível.";
}

// ========================================
// SÍNTESE DE VOZ
// ========================================

function speakLumi(text) {
  if (
    !("speechSynthesis" in window) ||
    !text ||
    !lumiSoundEnabled
  ) {
    return;
  }

  window.speechSynthesis.cancel();

  const speech =
    new SpeechSynthesisUtterance(text);

  speech.lang = "pt-BR";
  speech.rate = 1;
  speech.pitch = 1;
  speech.volume = 1;

  window.speechSynthesis.speak(speech);
}

const soundButton = $("#soundButton");

if (soundButton) {
    soundButton.textContent = "🔇";
  soundButton.title = "Ligar voz da Lumi";
  soundButton.onclick = () => {
    lumiSoundEnabled =
      !lumiSoundEnabled;

    if (lumiSoundEnabled) {
      soundButton.textContent = "🔊";
      soundButton.title =
        "Desligar voz da Lumi";
    } else {
      window.speechSynthesis?.cancel();

      soundButton.textContent = "🔇";
      soundButton.title =
        "Ligar voz da Lumi";
    }

    soundButton.setAttribute(
      "aria-label",
      soundButton.title
    );
  };
}

// ========================================
// ENTER ENVIA A MENSAGEM
// ========================================

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

// ========================================
// INICIALIZAÇÃO
// ========================================

async function initializeLumi() {
  form.querySelector(
    'button[type="submit"]'
  )?.setAttribute("disabled", "");

  input.disabled = true;

  try {
    currentUser = await requireLogin();

    if (!currentUser) return;

    loadLocalState();

    ready = true;
    input.disabled = false;

    form.querySelector(
      'button[type="submit"]'
    )?.removeAttribute("disabled");

    render();

    await loadSharedHistory();

  } catch (error) {
    console.error(
      "Erro ao iniciar a Lumi:",
      error
    );

    add(
      "system",
      "Não foi possível iniciar a Lumi. Verifique sua conexão.",
      false
    );
  }
}

initializeLumi();
