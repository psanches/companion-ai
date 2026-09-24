
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

const GOOGLE_REDIRECT_URI =
  "https://round-lab-f54f.psanchesnle.workers.dev/api/auth/google/callback";

function googleCalendarConfigured(env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.CALENDAR_SESSION_SECRET &&
    env.Memory
  );
}

// Gera um valor aleatorio seguro.
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Prepara a conexao individual com o Google.
async function createGoogleAuthUrl(env, userId) {
  if (!googleCalendarConfigured(env)) {
    throw new Error(
      "Google Calendar nao configurado."
    );
  }

  if (!userId) {
    throw new Error(
      "Usuario nao autenticado."
    );
  }

  const state = randomToken();

  // A autorizacao fica associada ao usuario
  // e expira automaticamente em 10 minutos.
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

export {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_REDIRECT_URI,
  googleCalendarConfigured,
  createGoogleAuthUrl
};
