
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from "./supabase-config.js";

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export async function getAuthenticatedUser() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  return user;
}

export async function requireLogin() {
  const user = await getAuthenticatedUser();

  if (!user) {
    window.location.replace("./login.html");
    return null;
  }

  return user;
}

export async function authenticatedFetch(
  url,
  options = {}
) {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    window.location.replace("./login.html");

    throw new Error(
      "Sua sessão expirou. Faça login novamente."
    );
  }

  const headers = new Headers(
    options.headers || {}
  );

  headers.set(
    "Authorization",
    `Bearer ${session.access_token}`
  );

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    window.location.replace("./login.html");
  }

  return response;
}

export async function logout() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  window.location.replace("./login.html");
}
