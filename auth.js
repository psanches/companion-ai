
/*
 * Lumi — Autenticação Supabase
 * Verificação da identidade do usuário no servidor.
 */

export async function authenticateUser(request, env) {
  const authorization =
    request.headers.get("Authorization") || "";

  const match =
    /^Bearer\s+(.+)$/i.exec(authorization);

  if (!match) {
    return null;
  }

  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error(
      "Configuração do Supabase ausente no servidor."
    );
  }

 
  
  
  let response;

  try {
    response = await fetch(
      `${env.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${match[1]}`,
          apikey: env.SUPABASE_PUBLISHABLE_KEY
        }
      }
    );
  } catch (error) {
    console.error(
      "Lumi auth: Supabase fetch failed",
      {
        errorType: error?.name || "UnknownError"
      }
    );

    throw error;
  }

  if (!response.ok) {
    console.error(
      "Lumi auth: Supabase rejected user request",
      {
        status: response.status
      }
    );

    return null;
  }

  
  const user = await response.json();

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    email: user.email
  };
}
