const $ = s => document.querySelector(s);

const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#messageInput");

const settingsDialog = $("#settingsDialog");
const memoryDialog = $("#memoryDialog");

const STORAGE = "companion-ai-v2";
const CLIENT_ID_KEY = "companion-ai-client-id";
const SYNC_KEY = "companion-ai-sync-key";

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

function getMemoryId() {
  const syncKey =
    localStorage.getItem(SYNC_KEY)?.trim();

  return syncKey || clientId;
}

const defaults = {
  name: "",
  model: "gpt-5-mini",
  messages: []
};

let state = {
  ...defaults,
  ...JSON.parse(
    localStorage.getItem(STORAGE) || "{}"
  )
};

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
    add(m.role, m.content, false);
  });

  if (!state.messages.length) {
    add(
      "assistant",
      `Olá${
        state.name
          ? ", " + state.name
          : ""
      }! Eu sou a Lumi, sua assistente no Companion AI. Posso conversar com você e lembrar de informações importantes.`,
      false
    );
  }
}

async function loadSharedHistory() {
  try {
    const response =
      await fetch(
        `${WORKER_URL}history?clientId=${encodeURIComponent(
          getMemoryId()
        )}`
      );

    const data =
      await response.json();

    if (
      response.ok &&
      Array.isArray(data?.history) &&
      data.history.length
    ) {
      state.messages =
        data.history
          .filter(
            item =>
              item &&
              typeof item.content === "string" &&
              (
                item.role === "user" ||
                item.role === "assistant"
              )
          )
          .slice(-30);

      save();
    }

  } catch (error) {
    console.error(
      "Não foi possível carregar o histórico compartilhado:",
      error
    );
  }

  render();
}

loadSharedHistory();

$("#settingsBtn").onclick = () => {
  $("#userName").value =
    state.name || "";

  $("#model").value =
    state.model || "gpt-5-mini";

  $("#syncKey").value =
    localStorage.getItem(SYNC_KEY) || "";

  $("#syncStatus").textContent = "";

  settingsDialog.showModal();
};

$("#generateKeyBtn").onclick = () => {
  const random =
    crypto.randomUUID()
      .replace(/-/g, "")
      .slice(0, 12)
      .toUpperCase();

  const key =
    `COMPANION-${random}`;

  $("#syncKey").value = key;

  $("#syncStatus").textContent =
    "Chave criada. Clique em Salvar.";
};

$("#copyKeyBtn").onclick = async () => {
  const key =
    $("#syncKey").value.trim();

  if (!key) {
    $("#syncStatus").textContent =
      "Crie ou digite uma chave primeiro.";
    return;
  }

  try {
    await navigator.clipboard.writeText(key);

    $("#syncStatus").textContent =
      "Chave copiada.";
  } catch (error) {
    $("#syncStatus").textContent =
      "Não foi possível copiar automaticamente.";
  }
};

$("#saveBtn").onclick = async () => {
  state.name =
    $("#userName").value.trim();

  state.model =
    $("#model").value.trim() ||
    "gpt-5-mini";

  const oldKey =
    localStorage.getItem(SYNC_KEY) || "";

  const newKey =
    $("#syncKey").value.trim();

  if (newKey) {
    localStorage.setItem(
      SYNC_KEY,
      newKey
    );
  } else {
    localStorage.removeItem(SYNC_KEY);
  }

  save();

  if (oldKey !== newKey) {
    $("#syncStatus").textContent =
      "Chave salva. Carregando dados sincronizados...";

    await loadSharedHistory();

    $("#syncStatus").textContent =
      "Sincronização ativada.";
  } else {
    $("#syncStatus").textContent =
      "Configurações salvas.";
  }
};

$("#clearBtn").onclick = async () => {
  if (
    !confirm(
      "Apagar o histórico compartilhado da conversa nos aparelhos sincronizados?"
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `${WORKER_URL}history`,
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            clientId: getMemoryId()
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Erro ao apagar histórico."
      );
    }

    state.messages = [];
    save();
    render();
    settingsDialog.close();

  } catch (error) {
    $("#syncStatus").textContent =
      error.message;
  }
};

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
          clientId: getMemoryId(),
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

  return data;
}

form.onsubmit = async e => {
  e.preventDefault();

  const text =
    input.value.trim();

  if (!text) {
    return;
  }

  input.value = "";

  add("user", text);

  const wait =
    document.createElement("div");

  wait.className =
    "msg assistant";

  wait.textContent =
    "Pensando…";

  messagesEl.appendChild(wait);

  try {
    const data =
      await getReply(text);

    wait.remove();

    const reply =
      data?.reply ||
      "Sem resposta.";

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
    wait.remove();

    add(
      "system",
      err.message
    );
  }
};

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
            getMemoryId()
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
              clientId:
                getMemoryId(),
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
              clientId:
                getMemoryId()
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() => {});
}
