
const $ = s => document.querySelector(s);

const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#messageInput");
const dialog = $("#settingsDialog");

const STORAGE = "companion-ai-v2";

const defaults = {
  name: "",
  provider: "worker",
  apiKey: "",
  model: "gpt-5-mini",
  messages: []
};

let state = {
  ...defaults,
  ...JSON.parse(localStorage.getItem(STORAGE) || "{}")
};

// Usa somente o Worker.
// A chave da OpenAI NÃO fica no navegador.
state.provider = "worker";
state.apiKey = "";

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(state));
}

function add(role, content, persist = true) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = content;

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (persist) {
    state.messages.push({ role, content });
    state.messages = state.messages.slice(-40);
    save();
  }
}

function render() {
  messagesEl.innerHTML = "";

  state.messages.forEach(m => {
    add(m.role, m.content, false);
  });

  if (!state.messages.length) {
    add(
      "assistant",
      `Olá${state.name ? ", " + state.name : ""}! Eu sou o Companion AI. Posso conversar com você e guardar esta conversa localmente neste aparelho.`
    );
  }
}

render();

$("#settingsBtn").onclick = () => {
  $("#userName").value = state.name;

  if ($("#provider")) {
    $("#provider").value = "worker";
  }

  if ($("#apiKey")) {
    $("#apiKey").value = "";
  }

  if ($("#model")) {
    $("#model").value = state.model;
  }

  dialog.showModal();
};

$("#saveBtn").onclick = () => {
  state.name = $("#userName").value.trim();
  state.provider = "worker";
  state.apiKey = "";

  if ($("#model")) {
    state.model =
      $("#model").value.trim() || "gpt-5-mini";
  }

  save();
};

$("#clearBtn").onclick = () => {
  if (confirm("Apagar todo o histórico salvo neste aparelho?")) {
    state.messages = [];
    save();
    render();
    dialog.close();
  }
};

async function getReply(text) {
  const response = await fetch("/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: text
    })
  });

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      "O servidor não retornou uma resposta válida."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error || "Erro ao conectar com a IA."
    );
  }

  return data?.reply || "Sem resposta.";
}

form.onsubmit = async e => {
  e.preventDefault();

  const text = input.value.trim();

  if (!text) return;

  input.value = "";

  add("user", text);

  const wait = document.createElement("div");
  wait.className = "msg assistant";
  wait.textContent = "Pensando…";

  messagesEl.appendChild(wait);

  try {
    const reply = await getReply(text);

    wait.remove();
    add("assistant", reply);

  } catch (err) {
    wait.remove();
    add("system", err.message);
  }
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() => {});
}
