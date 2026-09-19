
const GOOGLE_CALLBACK =
  "https://round-lab-f54f.psanchesnle.workers.dev/auth/google/callback";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

export function getGoogleAuthorizationUrl(
  clientId,
  state
) {
  const url = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth"
  );

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

export async function exchangeGoogleCode(
  code,
  env
) {
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
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK,
        grant_type: "authorization_code"
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      "Não foi possível concluir a autorização do Google."
    );
  }

  return await response.json();
}
