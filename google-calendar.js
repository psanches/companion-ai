
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

const GOOGLE_REDIRECT_URI =
  "https://round-lab-f54f.psanchesnle.workers.dev/api/auth/google/callback";

// Verifica as configuracoes necessarias.
function googleCalendarConfigured(env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.CALENDAR_SESSION_SECRET &&
    env.Memory
  );
}

// Gera um identificador aleatorio seguro.
function randomToken() {
  const bytes = crypto.getRandomValues(
    new Uint8Array(32)
  );

  return Array.from(bytes, b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

// Codificacao dos dados criptografados.
function encode(bytes) {
  return btoa(
    String.fromCharCode(...bytes)
  );
}

function decode(value) {
  return Uint8Array.from(
    atob(value),
    c => c.charCodeAt(0)
  );
}

// Cria uma chave de criptografia AES-GCM.
async function encryptionKey(env) {
  if (
    !env.CALENDAR_SESSION_SECRET ||
    env.CALENDAR_SESSION_SECRET.length < 32
  ) {
    throw new Error(
      "CALENDAR_SESSION_SECRET deve ter pelo menos 32 caracteres"
    );
  }

  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      env.CALENDAR_SESSION_SECRET
    )
  );

  return crypto.subtle.importKey(
    "raw",
    raw,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

// Criptografa os tokens antes de armazenar.
async function encryptTokens(env, tokens) {
  const iv = crypto.getRandomValues(
    new Uint8Array(12)
  );

  const key = await encryptionKey(env);

  const plaintext = new TextEncoder().encode(
    JSON.stringify(tokens)
  );

  const ciphertext =
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext
    );

  return JSON.stringify({
    v: 1,
    iv: encode(iv),
    data: encode(
      new Uint8Array(ciphertext)
    )
  });
}

// Recupera os tokens criptografados.
async function decryptTokens(env, stored) {
  const payload = JSON.parse(stored);

  if (payload.v !== 1) {
    throw new Error(
      "Formato de token desconhecido"
    );
  }

  const plaintext =
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(payload.iv)
      },
      await encryptionKey(env),
      decode(payload.data)
    );

  return JSON.parse(
    new TextDecoder().decode(plaintext)
  );
}

// Inicia a autorizacao individual do usuario.
async function createGoogleAuthUrl(env, userId) {
  if (!googleCalendarConfigured(env)) {
    throw new Error(
      "Google Calendar nao configurado"
    );
  }

  if (!userId) {
    throw new Error(
      "Usuario nao autenticado"
    );
  }

  const state = randomToken();

  await env.Memory.put(
    `google:oauth:${state}`,
    JSON.stringify({
      userId,
      createdAt: Date.now()
    }),
    {
      expirationTtl: 600
    }
  );

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state
  });

  return (
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    params.toString()
  );
}

// Processa o retorno da autorizacao do Google.
async function finishGoogleAuth(env, url) {
  if (!googleCalendarConfigured(env)) {
    throw new Error(
      "Google Calendar nao configurado"
    );
  }

  const state = url.searchParams.get("state");

  if (
    !state ||
    !/^[0-9a-f]{64}$/.test(state)
  ) {
    throw new Error("State invalido");
  }

  const key = `google:oauth:${state}`;

  const pending = await env.Memory.get(
    key,
    "json"
  );

  if (
    !pending?.userId ||
    !Number.isFinite(pending.createdAt) ||
    Date.now() - pending.createdAt > 600000 ||
    pending.createdAt > Date.now()
  ) {
    throw new Error(
      "Autorizacao expirada ou invalida"
    );
  }

  // Invalida a tentativa de autorizacao.
  await env.Memory.delete(key);

  if (url.searchParams.has("error")) {
    throw new Error(
      "Autorizacao recusada pelo Google"
    );
  }

  const code = url.searchParams.get("code");

  if (!code) {
    throw new Error(
      "Codigo de autorizacao ausente"
    );
  }

  // Troca o codigo recebido pelos tokens do Google.
  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret:
          env.GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      "Falha na troca do codigo de autorizacao"
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(
      "Google nao retornou access token"
    );
  }

  // Cada usuario possui seu proprio registro.
  const tokenKey =
    `google:tokens:user:${pending.userId}`;

  const previous =
    await env.Memory.get(tokenKey);

  const oldTokens = previous
    ? await decryptTokens(env, previous)
    : {};

  const tokens = {
    access_token: data.access_token,
    refresh_token:
      data.refresh_token ||
      oldTokens.refresh_token ||
      null,
    expires_at:
      Date.now() +
      Math.max(0, data.expires_in || 3600) *
      1000,
    scope:
      data.scope || GOOGLE_CALENDAR_SCOPE
  };

  // Salva somente os dados criptografados.
  await env.Memory.put(
    tokenKey,
    await encryptTokens(env, tokens)
  );

  return {
    connected: true
  };
}

export {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_REDIRECT_URI,
  googleCalendarConfigured,
  createGoogleAuthUrl,
  finishGoogleAuth
};
