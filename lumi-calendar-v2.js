
/*
  LUMI - GOOGLE CALENDAR
  Módulo de autenticação OAuth 2.0

  Este arquivo prepara a conexão com o Google.
  Ainda não deve ser publicado como Worker independente.
*/

const GOOGLE_CALLBACK =
  "https://round-lab-f54f.psanchesnle.workers.dev/auth/google/callback";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

const GOOGLE_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

/*
  Gera um identificador aleatório para
  proteger o processo de autorização.
*/

export function generateOAuthState() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

/*
  Cria o endereço de autorização do Google.
*/

export function getGoogleAuthorizationUrl(
  clientId,
  state
) {
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set(
    "client_id",
    clientId
  );

  url.searchParams.set(
    "redirect_uri",
    GOOGLE_CALLBACK
  );

  url.searchParams.set(
    "response_type",
    "code"
  );

  url.searchParams.set(
    "scope",
    GOOGLE_SCOPE
  );

  url.searchParams.set(
    "access_type",
    "offline"
  );

  url.searchParams.set(
    "prompt",
    "consent"
  );

  url.searchParams.set(
    "state",
    state
  );

  return url.toString();
}

/*
  Troca o código de autorização
  pelos tokens fornecidos pelo Google.
*/

export async function exchangeGoogleCode(
  code,
  env
) {
  const response = await fetch(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },

      body: new URLSearchParams({
        code,
        client_id:
          env.GOOGLE_CLIENT_ID,
        client_secret:
          env.GOOGLE_CLIENT_SECRET,
        redirect_uri:
          GOOGLE_CALLBACK,
        grant_type:
          "authorization_code"
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      "Falha na autorização do Google."
    );
  }

  return data;
}

/*
  Renova o token de acesso.
*/

export async function refreshGoogleToken(
  refreshToken,
  env
) {
  const response = await fetch(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },

      body: new URLSearchParams({
        client_id:
          env.GOOGLE_CLIENT_ID,
        client_secret:
          env.GOOGLE_CLIENT_SECRET,
        refresh_token:
          refreshToken,
        grant_type:
          "refresh_token"
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      "Não foi possível renovar o acesso ao Google."
    );
  }

  

  return data;
}

/*
  LUMI - SESSÃO GOOGLE
  Funções auxiliares de segurança.

  A sessão é independente da chave
  de sincronização do Companion AI.
*/

export function createCalendarSessionToken() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

/*
  Cria um identificador seguro para
  armazenar a sessão no Cloudflare KV.
*/

export async function hashCalendarSession(token) {
  const bytes = new TextEncoder().encode(token);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );

  return Array.from(new Uint8Array(digest))
    .map(byte =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

/*
  Armazena uma sessão temporária.

  Não armazena o token de sessão em
  texto simples como chave do KV.
*/

export async function saveCalendarSession(
  env,
  sessionToken,
  sessionData
) {
  const sessionId =
    await hashCalendarSession(sessionToken);

  await env.GoogleCalendar.put(
    `session:${sessionId}`,
    JSON.stringify(sessionData),
    {
      expirationTtl: 3600
    }
  );
}

/*
  Recupera uma sessão existente.
*/

export async function getCalendarSession(
  env,
  sessionToken
) {
  if (!sessionToken) {
    return null;
  }

  const sessionId =
    await hashCalendarSession(sessionToken);

  return await env.GoogleCalendar.get(
    `session:${sessionId}`,
    "json"
  );
}

/*
  Encerra a sessão.
*/

export async function deleteCalendarSession(
  env,
  sessionToken
) {
  if (!sessionToken) {
    return;
  }

  const sessionId =
    await hashCalendarSession(sessionToken);

  await env.GoogleCalendar.delete(
    `session:${sessionId}`
  );
}

/*
  LUMI - CONSULTA AO GOOGLE AGENDA

  Consulta os compromissos de um dia.
  Acesso somente de leitura.
*/

export async function getGoogleCalendarEvents(
  accessToken,
  date,
  timeZone = "America/Sao_Paulo"
) {
  if (!accessToken) {
    throw new Error(
      "Google Agenda não está conectado."
    );
  }

   // Define o início e o fim do dia
  // no fuso horário de São Paulo.

  const startDate = new Date(
    `${date}T00:00:00-03:00`
  );

  const nextDate = new Date(
    `${date}T12:00:00Z`
  );

  nextDate.setUTCDate(
    nextDate.getUTCDate() + 1
  );

  const nextDay =
    nextDate.toISOString().slice(0, 10);

  const endDate = new Date(
    `${nextDay}T00:00:00-03:00`
  );
