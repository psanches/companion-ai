const $ = s => document.querySelector(s);

const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#messageInput");

const settingsDialog = $("#settingsDialog");
const memoryDialog = $("#memoryDialog");

const STORAGE = "companion-ai-v2";
const CLIENT_ID_KEY = "companion-ai-client-id";

const WORKER_URL =
  "https://round-lab-f54f.psanchesnle.workers.dev/";

function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }

  return id;
}

const clientId = getClientId();

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

state.provider = "worker";
state.apiKey = "";

function save() {
  localStorage.setItem(
    STORAGE,
    JSON.stringify(state)
  );
}

function add(role, content, persist = true) {
  const el = document.createElement("div");

  el.className = `msg ${role}`;
  el.textContent = content;

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
      `Olá${
        state.name
          ? ", " + state.name
          : ""
      }! Eu sou o Companion AI. Posso conversar com você e lembrar de informações importantes.`
    );
  }
}

render();


// CONFIGURAÇÕES

$("#settingsBtn").onclick = () => {
  $("#userName").value =
    state.name;

  if ($("#provider")) {
    $("#provider").value =
      "worker";
  }

  if ($("#apiKey")) {
    $("#apiKey").value = "";
  }

  if ($("#model")) {
    $("#model").value =
      state.model;
  }

  settingsDialog.showModal();
};

$("#saveBtn").onclick = () => {
  state.name =
    $("#userName").value.trim();

  state.provider = "worker";
  state.apiKey = "";

  if ($("#model")) {
    state.model =
      $("#model").value.trim() ||
      "gpt-5-mini";
  }

  save();
};

$("#clearBtn").onclick = () => {
  if (
    confirm(
      "Apagar todo o histórico salvo neste aparelho?"
    )
  ) {
    state.messages = [];
    save();
    render();
    settingsDialog.close();
  }
};


// CHAT

async function getReply(text) {
  const response =
    await fetch(
      WORKER_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          clientId,
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
      "O servidor não retornou uma resposta válida."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Erro ao conectar com a IA."
    );
  }

  return (
    data?.reply ||
    "Sem resposta."
  );
}

form.onsubmit = async e => {
  e.preventDefault();

  const text =
    input.value.trim();

  if (!text) {
    return;
  }

  input.value = "";

  add(
    "user",
    text
  );

  const wait =
    document.createElement("div");

  wait.className =
    "msg assistant";

  wait.textContent =
    "Pensando…";

  messagesEl.appendChild(wait);

  try {
    const reply =
      await getReply(text);

    wait.remove();

    add(
      "assistant",
      reply
    );

  } catch (err) {
    wait.remove();

    add(
      "system",
      err.message
    );
  }
};


// MINHA MEMÓRIA

$("#memoryBtn").onclick =
  async () => {

    memoryDialog.showModal();

    $("#memoryStatus").textContent =
      "Carregando memória...";

    $("#memoryText").value = "";

    try {
      const response =
        await fetch(
          `${WORKER_URL}memory?clientId=${encodeURIComponent(
            clientId
          )}`
        );

      const data =
        await response.json();

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

    const memory =
      $("#memoryText").value.trim();

    $("#memoryStatus").textContent =
      "Salvando...";

    try {
      const response =
        await fetch(
          `${WORKER_URL}memory`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              clientId,
              memory
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Erro ao salvar memória."
        );
      }

      $("#memoryStatus").textContent =
        "Memória salva.";

    } catch (error) {
      $("#memoryStatus").textContent =
        error.message;
    }
  };


$("#deleteMemoryBtn").onclick =
  async () => {

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
        await fetch(
          `${WORKER_URL}memory`,
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              clientId
            })
          }
        );

      const data =
        await response.json();

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
      $("#memoryStatus").textContent =
        error.message;
    }
  };


// SERVICE WORKER

if (
  "serviceWorker" in navigator
) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() => {});
}
