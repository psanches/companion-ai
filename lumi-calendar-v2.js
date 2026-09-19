
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
