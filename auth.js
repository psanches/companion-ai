
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

  const response = await fetch(
    `${env.SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        Authorization: `Bearer ${match[1]}`,
        apikey: env.SUPABASE_PUBLISHABLE_KEY
      }
    }
  );

  if (!response.ok) {
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
