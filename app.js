const $ = s => document.querySelector(s);

const SUPABASE_URL =
  "https://hjdrnxqvmpwfztlrqknp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_qfhZHhgXfRq7Z3np65rF2w_WMqFWtfv";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

const WORKER_URL =
  "https://round-lab-f54f.psanchesnle.workers.dev/";

const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#messageInput");

const settingsDialog = $("#settingsDialog");
const memoryDialog = $("#memoryDialog");

const STORAGE = "companion-ai-v2";
const CLIENT_ID_KEY = "companion-ai-client-id";
const SYNC_KEY = "companion-ai-sync-key";

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


/* =========================================================
   SUPABASE AUTHENTICATION
   ========================================================= */

async function getAccessToken() {
  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

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
  const token = await getAccessToken();

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

  return fetch(url, {
    ...options,
    headers
  });
}
const signInBtn = document.querySelector("#signInBtn");
const signOutBtn = document.querySelector("#signOutBtn");

async function updateAuthUI() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (signInBtn) signInBtn.hidden = !!session;
  if (signOutBtn) signOutBtn.hidden = !session;
}

signInBtn?.addEventListener("click", async () => {
  const email = prompt("Enter your email:");

  if (!email) return;

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
  emailRedirectTo: 
    "https://psanches.github.io/companion-ai/"
    }
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Check your email for the Lumi sign-in link.");
});

signOutBtn?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await updateAuthUI();
});

supabaseClient.auth.onAuthStateChange(() => {
  updateAuthUI();
});

updateAuthUI();

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


function add(role, content, persist = true) {
  const el =
    document.createElement("div");

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
      }! Eu sou a Lumi, sua assistente no Companion AI. Posso conversar com você e lembrar de informações importantes.`,
      false
    );
  }
}


/* =========================================================
   SHARED HISTORY
   ========================================================= */

async function loadSharedHistory() {
  const token =
    await getAccessToken();

  /*
   Do not repeatedly call the Worker before
   the user has an authenticated Supabase session.
  */
  if (!token) {
    render();
    return;
  }

  try {
    const response =
      await authFetch(
        `${WORKER_URL}history`
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Error loading conversation history."
      );
    }

    if (
      Array.isArray(data?.history)
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
      "Could not load shared history:",
      error
    );
  }

  render();
}


/*
  Load once.
  The previous 5-second polling has been removed.
  It was repeatedly generating 401 requests.
*/
loadSharedHistory();


/* =========================================================
   SETTINGS
   ========================================================= */

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
    await navigator.clipboard.writeText(
      key
    );

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
    localStorage.removeItem(
      SYNC_KEY
    );
  }

  save();

  if (oldKey !== newKey) {
    $("#syncStatus").textContent =
      "Chave salva. Carregando dados...";

    await loadSharedHistory();

    $("#syncStatus").textContent =
      "Configurações salvas.";

  } else {
    $("#syncStatus").textContent =
      "Configurações salvas.";
  }
};


/* =========================================================
   CLEAR HISTORY
   ========================================================= */

$("#clearBtn").onclick = async () => {
  if (
    !confirm(
      "Apagar o histórico compartilhado da conversa?"
    )
  ) {
    return;
  }

  try {
    const response =
      await authFetch(
        `${WORKER_URL}history`,
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


/* =========================================================
   CHAT
   ========================================================= */

async function getReply(text) {
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
    data =
      await response.json();

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
    const data =
      await getReply(text);

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
    wait.remove();

    add(
      "system",
      err.message
    );
  }
};


/* =========================================================
   MEMORY
   ========================================================= */

$("#memoryBtn").onclick =
  async () => {

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


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() => {});
}


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
    /[áàâãéêíóôõúç]|\b(o|a|os|as|de|do|da|que|para|com|não|uma|você|seu|sua|é)\b/i
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
