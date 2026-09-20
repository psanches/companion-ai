
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from "./supabase-config.js";

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = selector =>
  document.querySelector(selector);

const status = $("#status");

function showStatus(message) {
  status.textContent = message;
}

function showError(error) {
  showStatus(
    error?.message ||
    "Não foi possível realizar a operação."
  );
}

function openChat() {
  window.location.replace("./index.html");
}

// ENTRAR COM E-MAIL E SENHA

$("#loginForm").addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const email = $("#email").value.trim();
    const password = $("#password").value;

    showStatus("Entrando...");

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      showError(error);
      return;
    }

    if (data.session) {
      openChat();
    }
  }
);

// CRIAR UMA CONTA

$("#signup").addEventListener(
  "click",
  async () => {
    const email = $("#email").value.trim();
    const password = $("#password").value;

    if (!email || !password) {
      showStatus(
        "Informe seu e-mail e uma senha."
      );
      return;
    }

    showStatus("Criando sua conta...");

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password
      });

    if (error) {
      showError(error);
      return;
    }

    if (!data.session) {
      showStatus(
        "Verifique seu e-mail para confirmar a conta."
      );
      return;
    }

    openChat();
  }
);

// ENTRAR COM GOOGLE

$("#google").addEventListener(
  "click",
  async () => {
    showStatus("Conectando ao Google...");

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: new URL(
            "./login.html",
            window.location.href
          ).href
        }
      });

    if (error) {
      showError(error);
    }
  }
);

// VERIFICAR SESSÃO EXISTENTE

async function checkSession() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    showError(error);
    return;
  }

  if (data.session) {
    openChat();
  }
}

checkSession();
