var __defProp = Object.defineProperty;

var __name = (target, value) =>

  __defProp(target, "name", { value, configurable: true });





// auth.js

async function authenticateUser(request, env) {

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

      "Configura\xE7\xE3o do Supabase ausente no servidor."

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

        errorType:

          error?.name || "UnknownError"

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



__name(authenticateUser, "authenticateUser");





// google-calendar.js

async function getGoogleAccessToken(

  env,

  userId

) {

  if (!userId) {

    throw new Error(

      "Usu\xE1rio n\xE3o autenticado"

    );

  }



  const tokenKey =

    `google:tokens:user:${userId}`;



  const stored =

    await env.Memory.get(tokenKey);



  if (!stored) {

    throw new Error(

      "Google Calendar n\xE3o conectado. Conecte sua agenda nas Configura\xE7\xF5es."

    );

  }



  const tokens =

    await decryptTokens(env, stored);



  if (

    tokens.access_token &&

    tokens.expires_at > Date.now() + 6e4

  ) {

    return tokens.access_token;

  }



  if (!tokens.refresh_token) {

    throw new Error(

      "A autoriza\xE7\xE3o do Google expirou. Conecte sua agenda novamente."

    );

  }



  const response = await fetch(

    "https\://oauth2.googleapis.com/token",

    {

      method: "POST",

      headers: {

        "Content-Type":

          "application/x-www-form-urlencoded"

      },

      body: new URLSearchParams({

        client_id: env.GOOGLE_CLIENT_ID,

        client_secret:

          env.GOOGLE_CLIENT_SECRET,

        refresh_token:

          tokens.refresh_token,

        grant_type: "refresh_token"

      })

    }

  );



  if (!response.ok) {

    throw new Error(

      "N\xE3o foi poss\xEDvel renovar a autoriza\xE7\xE3o do Google Calendar."

    );

  }



  const data = await response.json();



  if (!data.access_token) {

    throw new Error(

      "O Google n\xE3o retornou um token de acesso."

    );

  }



  const updatedTokens = {

    ...tokens,

    access_token: data.access_token,

    refresh_token:

      data.refresh_token ||

      tokens.refresh_token,

    expires_at:

      Date.now() +

      data.expires_in * 1e3

  };



  await env.Memory.put(

    tokenKey,

    await encryptTokens(

      env,

      updatedTokens

    )

  );



  return updatedTokens.access_token;

}



__name(

  getGoogleAccessToken,

  "getGoogleAccessToken"

);





async function listGoogleCalendarEvents(

  env,

  userId,

  maxResults = 10

) {

  const accessToken =

    await getGoogleAccessToken(

      env,

      userId

    );



  const params =

    new URLSearchParams({

      timeMin:

        new Date().toISOString(),

      maxResults: String(

        Math.min(

          Math.max(maxResults, 1),

          50

        )

      ),

      singleEvents: "true",

      orderBy: "startTime"

    });



  const response = await fetch(

    "https\://www.googleapis.com/calendar/v3/calendars/primary/events?" +

      params.toString(),

    {

      headers: {

        Authorization:

          `Bearer ${accessToken}`

      }

    }

  );



  if (!response.ok) {

    throw new Error(

      "N\xE3o foi poss\xEDvel consultar os compromissos do Google Calendar."

    );

  }



  const data = await response.json();



  return (data.items || []).map(

    event => ({

      id: event.id,

      title:

        event.summary ||

        "Sem t\xEDtulo",

      start:

        event.start?.dateTime ||

        event.start?.date,

      end:

        event.end?.dateTime ||

        event.end?.date,

      location:

        event.location || "",

      description:

        event.description || ""

    })

  );

}



__name(

  listGoogleCalendarEvents,

  "listGoogleCalendarEvents"

);





// NEW: create Calendar event

async function createGoogleCalendarEvent(

  env,

  userId,

  event

) {

  const accessToken =

    await getGoogleAccessToken(

      env,

      userId

    );



  const response = await fetch(

    "https\://www.googleapis.com/calendar/v3/calendars/primary/events",

    {

      method: "POST",

      headers: {

        Authorization:

          `Bearer ${accessToken}`,

        "Content-Type":

          "application/json"

      },

      body: JSON.stringify({

        summary: event.title,

        description:

          event.description || "",

        location:

          event.location || "",

        start: {

          dateTime: event.start,

          timeZone:

            "America/Sao_Paulo"

        },

        end: {

          dateTime: event.end,

          timeZone:

            "America/Sao_Paulo"

        }

      })

    }

  );



  if (!response.ok) {

    const errorText =

      await response.text();



    console.error(

      "Google Calendar create error:",

      errorText

    );



    throw new Error(

      "N\xE3o foi poss\xEDvel criar o compromisso no Google Calendar."

    );

  }



  const created =

    await response.json();



  return {

    id: created.id,

    title:

      created.summary ||

      event.title,

    start:

      created.start?.dateTime ||

      created.start?.date,

    end:

      created.end?.dateTime ||

      created.end?.date,

    htmlLink:

      created.htmlLink || ""

  };

}



__name(

  createGoogleCalendarEvent,

  "createGoogleCalendarEvent"

);





var GOOGLE_CALENDAR_SCOPE =

  "https\://www.googleapis.com/auth/calendar.events";



var GOOGLE_REDIRECT_URI =

    "https\://lumi-develop.psanchesnle.workers.dev/api/auth/google/callback";





function googleCalendarConfigured(env) {

  return Boolean(

    env.GOOGLE_CLIENT_ID &&

    env.GOOGLE_CLIENT_SECRET &&

    env.CALENDAR_SESSION_SECRET &&

    env.Memory

  );

}



__name(

  googleCalendarConfigured,

  "googleCalendarConfigured"

);





function randomToken() {

  const bytes =

    crypto.getRandomValues(

      new Uint8Array(32)

    );



  return Array.from(

    bytes,

    b =>

      b

        .toString(16)

        .padStart(2, "0")

  ).join("");

}



__name(randomToken, "randomToken");





function encode(bytes) {

  return btoa(

    String.fromCharCode(...bytes)

  );

}



__name(encode, "encode");





function decode(value) {

  return Uint8Array.from(

    atob(value),

    c => c.charCodeAt(0)

  );

}



__name(decode, "decode");





async function encryptionKey(env) {

  if (

    !env.CALENDAR_SESSION_SECRET ||

    env.CALENDAR_SESSION_SECRET.length <

      32

  ) {

    throw new Error(

      "CALENDAR_SESSION_SECRET deve ter pelo menos 32 caracteres"

    );

  }



  const raw =

    await crypto.subtle.digest(

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



__name(

  encryptionKey,

  "encryptionKey"

);





async function encryptTokens(

  env,

  tokens

) {

  const iv =

    crypto.getRandomValues(

      new Uint8Array(12)

    );



  const key =

    await encryptionKey(env);



  const plaintext =

    new TextEncoder().encode(

      JSON.stringify(tokens)

    );



  const ciphertext =

    await crypto.subtle.encrypt(

      {

        name: "AES-GCM",

        iv

      },

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



__name(

  encryptTokens,

  "encryptTokens"

);





async function decryptTokens(

  env,

  stored

) {

  const payload =

    JSON.parse(stored);



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

    new TextDecoder().decode(

      plaintext

    )

  );

}



__name(

  decryptTokens,

  "decryptTokens"

);





async function createGoogleAuthUrl(

  env,

  userId

) {

  if (

    !googleCalendarConfigured(env)

  ) {

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



  const params =

    new URLSearchParams({

      client_id:

        env.GOOGLE_CLIENT_ID,

      redirect_uri:

        GOOGLE_REDIRECT_URI,

      response_type: "code",

      scope:

        GOOGLE_CALENDAR_SCOPE,

      access_type: "offline",

      prompt: "consent",

      state

    });



  return (

    "https\://accounts.google.com/o/oauth2/v2/auth?" +

    params.toString()

  );

}



__name(

  createGoogleAuthUrl,

  "createGoogleAuthUrl"

);





async function finishGoogleAuth(

  env,

  url

) {

  if (

    !googleCalendarConfigured(env)

  ) {

    throw new Error(

      "Google Calendar nao configurado"

    );

  }



  const state =

    url.searchParams.get("state");



  if (

    !state ||

    !/^[0-9a-f]{64}$/.test(state)

  ) {

    throw new Error(

      "State invalido"

    );

  }



  const key =

    `google:oauth:${state}`;



  const pending =

    await env.Memory.get(

      key,

      "json"

    );



  if (

    !pending?.userId ||

    !Number.isFinite(

      pending.createdAt

    ) ||

    Date.now() -

      pending.createdAt >

      6e5 ||

    pending.createdAt >

      Date.now()

  ) {

    throw new Error(

      "Autorizacao expirada ou invalida"

    );

  }



  await env.Memory.delete(key);



  if (

    url.searchParams.has("error")

  ) {

    throw new Error(

      "Autorizacao recusada pelo Google"

    );

  }



  const code =

    url.searchParams.get("code");



  if (!code) {

    throw new Error(

      "Codigo de autorizacao ausente"

    );

  }



  const response = await fetch(

    "https\://oauth2.googleapis.com/token",

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

          GOOGLE_REDIRECT_URI,

        grant_type:

          "authorization_code"

      })

    }

  );



  if (!response.ok) {

    let googleError = "unknown";



    try {

      const errorData =

        await response.json();



      googleError =

        errorData.error ||

        "unknown";

    } catch {

      googleError =

        "invalid_response";

    }



    console.error(

      "Google OAuth token exchange failed:",

      response.status,

      googleError

    );



    throw new Error(

      "Falha na troca do codigo de autorizacao"

    );

  }



  const data =

    await response.json();



  if (!data.access_token) {

    throw new Error(

      "Google nao retornou access token"

    );

  }



  const tokenKey =

    `google:tokens:user:${pending.userId}`;



  const previous =

    await env.Memory.get(tokenKey);



  let oldTokens = {};



  if (previous) {

    try {

      oldTokens =

        await decryptTokens(

          env,

          previous

        );

    } catch (error) {

      console.warn(

        "Token antigo do Google Calendar não pôde ser descriptografado. Será substituído.",

        error.message

      );

    }

  }



  const tokens = {

    access_token:

      data.access_token,

    refresh_token:

      data.refresh_token ||

      oldTokens.refresh_token ||

      null,

    expires_at:

      Date.now() +

      Math.max(

        0,

        data.expires_in || 3600

      ) *

        1e3,

    scope:

      data.scope ||

      GOOGLE_CALENDAR_SCOPE

  };



  await env.Memory.put(

    tokenKey,

    await encryptTokens(

      env,

      tokens

    )

  );



  return {

    connected: true

  };

}



__name(

  finishGoogleAuth,

  "finishGoogleAuth"

);// worker.js





function json(

  data,

  status = 200,

  cors = {}

) {

  return new Response(

    JSON.stringify(data),

    {

      status,

      headers: {

        "Content-Type":

          "application/json; charset=utf-8",

        ...cors

      }

    }

  );

}



__name(json, "json");





function normalizeOrigin(origin) {

  return String(origin || "")

    .trim()

    .replace(/\/+$/, "");

}



__name(

  normalizeOrigin,

  "normalizeOrigin"

);





function getCors(request) {

  const origin =

    normalizeOrigin(

      request.headers.get("Origin")

    );

  const allowed = new Set([

    "https\://mylumicompanion.com",

    "https\://www.mylumicompanion.com",

    "https\://psanches.github.io",

    "https\://companion-ai-e42.pages.dev",

    "https\://dev.mylumicompanion.com"

  ]);

  const headers = {

    "Access-Control-Allow-Methods":

      "GET, POST, PUT, DELETE, OPTIONS",

    "Access-Control-Allow-Headers":

      "Authorization, Content-Type",

    "Access-Control-Max-Age":

      "86400"

  };



  if (

  allowed.has(origin) ||

  origin === "https\://companion-ai-e42.pages.dev" ||

  origin.endsWith(".companion-ai-e42.pages.dev") ||

  origin.startsWith(

    "http\://localhost:"

  ) ||

  origin.startsWith(

    "http\://127.0.0.1:"

  )

) {

  headers[

    "Access-Control-Allow-Origin"

  ] = origin;

}



  return headers;

}



__name(getCors, "getCors");





async function readJson(request) {

  try {

    return await request.json();

  } catch {

    return {};

  }

}



__name(readJson, "readJson");





function cleanMessages(messages) {

  if (!Array.isArray(messages)) {

    return [];

  }



  return messages

    .filter(

      item =>

        item &&

        typeof item.content ===

          "string" &&

        (

          item.role === "user" ||

          item.role === "assistant"

        )

    )

    .map(item => ({

      role: item.role,

      content:

        item.content.trim()

    }))

    .filter(

      item => item.content

    )

    .slice(-12);

}



__name(

  cleanMessages,

  "cleanMessages"

);





function textFromOpenAI(data) {

  if (

    typeof data?.output_text ===

      "string" &&

    data.output_text.trim()

  ) {

    return data.output_text.trim();

  }



  const output =

    Array.isArray(data?.output)

      ? data.output

      : [];



  for (const item of output) {

    const content =

      Array.isArray(item?.content)

        ? item.content

        : [];



    for (const part of content) {

      if (

        typeof part?.text ===

          "string" &&

        part.text.trim()

      ) {

        return part.text.trim();

      }

    }

  }



  return "";

}



__name(

  textFromOpenAI,

  "textFromOpenAI"

);





async function askOpenAI(

  env,

  messages,

  memory = "",

  userId = null

) {

  if (!env.OPENAI_API_KEY) {

    throw new Error("OPENAI_API_KEY não configurada");

  }

  if (!userId) {

    throw new Error("Usuário não autenticado");

  }



  const pendingKey = `calendar:pending:user:${userId}`;

  const lastMessage = messages[messages.length - 1]?.content?.trim() || "";

  const command = lastMessage.toUpperCase();

  const pending = await env.Memory.get(pendingKey, "json");



// Creation is only allowed after a separate, exact confirmation message.

  if (command === "CANCELAR EVENTO") {

    await env.Memory.delete(pendingKey);

    return "Criação do evento cancelada.";

  }

  if (command === "CONFIRMAR EVENTO") {

    if (!pending || !pending.title || !pending.start || !pending.end) {

      return "Não há evento pendente. Peça novamente para criar o compromisso.";

    }

// Consume confirmation before calling Google to avoid repeated writes.

    await env.Memory.delete(pendingKey);

    try {

      const created = await createGoogleCalendarEvent(env, userId, pending);

      return `Evento criado no Google Calendar: ${created.title}, ${created.start}.` +

        (created.htmlLink ? `\n${created.htmlLink}` : "");

    } catch (error) {

      console.error("Calendar confirmation failed:", error.message);

      return "Não consegui criar o evento no Google Calendar. Nenhuma confirmação de criação foi recebida. Tente novamente mais tarde.";

    }

  }



 const instructions = `

Você é Lumi, uma assistente pessoal calorosa, prática e objetiva.

Responda no idioma do usuário.



PRINCÍPIO FUNDAMENTAL:

Responda diretamente à pergunta do usuário.

Não transforme pedidos claros em questionários.

Não apresente menus de opções quando puder responder.

Não peça autorização para pesquisar informações públicas.

Faça perguntas somente quando faltar uma informação indispensável.

Nunca repita perguntas já respondidas pelo usuário.



PESQUISA WEB:

Quando o usuário pedir notícias, novidades, pesquisas,

descobertas, resultados esportivos, clima, preços ou

qualquer informação atual, utilize web_search automaticamente.

Não pergunte se ele deseja que você pesquise.

Pesquise e apresente imediatamente os resultados relevantes.

Para notícias, apresente preferencialmente 3 a 5 acontecimentos

recentes, com datas e links clicáveis para as fontes originais.

Priorize fontes confiáveis e informações verificáveis.

Se a pesquisa falhar, informe a limitação claramente.

Nunca invente notícias, resultados, datas, fontes ou links.

Nunca afirme que pesquisou sem utilizar a ferramenta.



CONVERSAÇÃO:

Se o usuário disser "notícias sobre Parkinson", pesquise

e apresente notícias recentes sobre Parkinson.

Não pergunte se ele prefere notícias, pesquisas ou orientações.

Se pedir pesquisas, apresente estudos e descobertas relevantes.

Respeite o contexto da conversa e as preferências já informadas.

Evite respostas genéricas, repetições e introduções longas.

Seja breve e direta, sem anunciar que será breve.



MEMÓRIA E SEGURANÇA:

Use as memórias fornecidas apenas quando forem relevantes.

Não invente fatos sobre o usuário.

Não diga que realizou ações que não ocorreram.

Nunca prometa funcionalidades não implementadas.

Em assuntos médicos, forneça informações fundamentadas,

sem substituir avaliação profissional.

Não afirme que pode enviar notificações push ou lembretes

automáticos.



GOOGLE CALENDAR:

Você pode consultar o Google Calendar e preparar novos eventos.

Para criar um evento solicitado pelo usuário, use prepare_calendar_event.

A ferramenta apenas prepara o evento; não o cria.

O usuário deve confirmar com a mensagem exata CONFIRMAR EVENTO.

Nunca diga que criou um evento antes de receber confirmação

do servidor.

Se faltarem horário ou duração, pergunte antes de preparar.

Considere o fuso horário America/Sao_Paulo para datas locais.



MEMÓRIA:

${memory || "Nenhuma memória disponível."}

`.trim();



  const input = cleanMessages(messages).map(item => ({

    role: item.role,

    content: [{

      type: item.role === "assistant" ? "output_text" : "input_text",

      text: item.content

    }]

  }));



  const response = await fetch("https\://api.openai.com/v1/responses", {

    method: "POST",

    headers: {

      Authorization: `Bearer ${env.OPENAI_API_KEY}`,

      "Content-Type": "application/json"

    },

    body: JSON.stringify({

      model: env.OPENAI_MODEL || "gpt-5-mini",

      instructions,

      input,

      tools: [

        { type: "web_search" },

        {

          type: "function",

          name: "prepare_calendar_event",

          description: "Prepare a Google Calendar event for explicit user confirmation; do not create it. Use only when the user requests creation of an event.",

          strict: true,

          parameters: {

            type: "object",

            properties: {

              title: { type: "string" },

              start: { type: "string", description: "ISO 8601 datetime with timezone offset" },

              end: { type: "string", description: "ISO 8601 datetime with timezone offset" },

              description: { type: "string" },

              location: { type: "string" }

            },

            required: ["title", "start", "end", "description", "location"],

            additionalProperties: false

          }

        }

      ]

    })

  });



  if (!response.ok) {

    const errorText = await response.text();

    console.error("OpenAI error:", response.status, errorText);

    throw new Error("Falha ao consultar a IA");

  }

  const data = await response.json();

  const functionCalls = (Array.isArray(data.output) ? data.output : [])

    .filter(item => item.type === "function_call" &&

      item.name === "prepare_calendar_event");



  if (functionCalls.length) {

    let event;

    try {

      event = JSON.parse(functionCalls[0].arguments || "{}");

    } catch {

      return "Não consegui interpretar os dados do evento. Informe título, data e horário novamente.";

    }

    const start = new Date(event.start);

    const end = new Date(event.end);

    const hasOffset = value => typeof value === "string" &&

      /(Z|[+-]\d{2}:\d{2})$/i.test(value);

    if (typeof event.title !== "string" || !event.title.trim() ||

        !hasOffset(event.start) || !hasOffset(event.end) ||

        !Number.isFinite(start.getTime()) ||

        !Number.isFinite(end.getTime()) || end <= start ||

        start.getTime() <= Date.now()) {

      return "Preciso de um título, uma data futura e horários válidos com fuso horário para preparar o evento.";

    }

    const prepared = {

      title: event.title.trim().slice(0, 200),

      start: event.start,

      end: event.end,

      description: String(event.description || "").slice(0, 2000),

      location: String(event.location || "").slice(0, 500)

    };

    await env.Memory.put(pendingKey, JSON.stringify(prepared), {

      expirationTtl: 600

    });

    return `Evento preparado, mas ainda NÃO criado:\n` +

      `${prepared.title}\nInício: ${prepared.start}\nFim: ${prepared.end}\n` +

      `Para criar no Google Calendar, responda exatamente: CONFIRMAR EVENTO\n` +

      `Para desistir: CANCELAR EVENTO`;

  }

  return textFromOpenAI(data) || "Sem resposta.";

}



__name(askOpenAI, "askOpenAI");







// Lumi medical profile: isolated, encrypted, and never supplied to askOpenAI.

// Requires MEDICAL_ENCRYPTION_KEY (secret) and the existing Memory KV binding.

const MEDICAL_PROFILE_VERSION = 1;

const MEDICAL_PROFILE_LIMIT = 16384;



function medicalJson(data, status, cors) {

  return json(data, status, {

    ...cors,

    "Cache-Control": "no-store",

    "X-Content-Type-Options": "nosniff"

  });

}



function medicalKeyName(userId) {

  return `medical:profile:v1:user:${userId}`;

}



async function medicalCryptoKey(env) {

  const secret = env.MEDICAL_ENCRYPTION_KEY;

  if (typeof secret !== "string" || secret.length < 32) {

    throw new Error("MEDICAL_ENCRYPTION_KEY is missing or too short");

  }

  const digest = await crypto.subtle.digest(

    "SHA-256", new TextEncoder().encode(secret)

  );

  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);

}



function medicalBase64(bytes) {

  return btoa(String.fromCharCode(...bytes));

}



function medicalUnbase64(text) {

  return Uint8Array.from(atob(text), c => c.charCodeAt(0));

}



async function encryptMedical(env, userId, value) {

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const bytes = new TextEncoder().encode(JSON.stringify(value));

  const ciphertext = await crypto.subtle.encrypt(

    {

      name: "AES-GCM", iv,

      additionalData: new TextEncoder().encode(`lumi-medical-v1:${userId}`)

    },

    await medicalCryptoKey(env), bytes

  );

  return JSON.stringify({

    v: MEDICAL_PROFILE_VERSION,

    iv: medicalBase64(iv),

    data: medicalBase64(new Uint8Array(ciphertext))

  });

}



async function decryptMedical(env, userId, stored) {

  const envelope = JSON.parse(stored);

  if (envelope?.v !== MEDICAL_PROFILE_VERSION ||

      typeof envelope.iv !== "string" ||

      typeof envelope.data !== "string") {

    throw new Error("Unsupported medical profile format");

  }

  const iv = medicalUnbase64(envelope.iv);

  if (iv.length !== 12) throw new Error("Invalid medical profile IV");

  const plaintext = await crypto.subtle.decrypt(

    {

      name: "AES-GCM", iv,

      additionalData: new TextEncoder().encode(`lumi-medical-v1:${userId}`)

    },

    await medicalCryptoKey(env), medicalUnbase64(envelope.data)

  );

  return JSON.parse(new TextDecoder().decode(plaintext));

}



function medicalString(value, max = 1000) {

  if (typeof value !== "string" || value.length > max) return null;

  return value.trim();

}



function medicalValidate(body) {

  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  if (body.consentToStore !== true) return null;

  if (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)) return null;

  const profile = body.profile;

  const allowed = new Set(["conditions", "medications", "allergies", "doctors", "notes"]);

  if (Object.keys(profile).some(k => !allowed.has(k))) return null;

  const conditions = profile.conditions ?? [];

  const medications = profile.medications ?? [];

  const allergies = profile.allergies ?? [];

  const doctors = profile.doctors ?? [];

  if (![conditions, medications, allergies, doctors].every(Array.isArray)) return null;

  if (conditions.length > 30 || medications.length > 40 || allergies.length > 30 || doctors.length > 20) return null;

  function strings(items) {

    const mapped = items.map(v => medicalString(v, 200));

    return mapped.every(v => v !== null) ? mapped : null;

  }

  const c = strings(conditions), a = strings(allergies), d = strings(doctors);

  if (!c || !a || !d) return null;

  const meds = [];

  for (const item of medications) {

    if (!item || typeof item !== "object" || Array.isArray(item)) return null;

    const allowedMed = new Set(["name", "dose", "frequency", "times", "notes"]);

    if (Object.keys(item).some(k => !allowedMed.has(k))) return null;

    const name = medicalString(item.name, 150);

    const dose = medicalString(item.dose ?? "", 150);

    const frequency = medicalString(item.frequency ?? "", 150);

    const notes = medicalString(item.notes ?? "", 300);

    const times = item.times ?? [];

    if (!name || dose === null || frequency === null || notes === null ||

        !Array.isArray(times) || times.length > 12 ||

        times.some(t => typeof t !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return null;

    meds.push({name, dose, frequency, times, notes});

  }

  const notes = medicalString(profile.notes ?? "", 2000);

  if (notes === null) return null;

  return {conditions:c, medications:meds, allergies:a, doctors:d, notes};

}





async function handleMedicalProfile(request, env, userId, route, cors) {

    return medicalJson(

    {

      error: "Medical access locked until passkey verification is ready",

      code: "MEDICAL_STEP_UP_REQUIRED"

    },

    403,

    cors

  );

  const key = medicalKeyName(userId);

  try {

    if (request.method === "DELETE" && route === "/profile/medical") {

      await env.MedicalStore.delete(key);

      return medicalJson({ok:true, deleted:true}, 200, cors);

    }

    if (request.method === "GET" &&

        (route === "/profile/medical" || route === "/profile/medical/export")) {

      const stored = await env.MedicalStore.get(key);

      if (!stored) {

        if (route.endsWith("/export")) return medicalJson({error:"No medical profile found"},404,cors);

        return medicalJson({exists:false, consentToStore:false, profile:null},200,cors);

      }

      const data = await decryptMedical(env, userId, stored);

      return medicalJson({exists:true, ...data}, 200, cors);

    }

    if (request.method === "PUT" && route === "/profile/medical") {

      const raw = await request.text();

      if (raw.length > MEDICAL_PROFILE_LIMIT) {

        return medicalJson({error:"Profile exceeds size limit"},413,cors);

      }

      let body;

      try { body = JSON.parse(raw); } catch {

        return medicalJson({error:"Invalid JSON"},400,cors);

      }

      const profile = medicalValidate(body);

      if (!profile) {

        return medicalJson({error:"Invalid profile or missing explicit storage consent"},400,cors);

      }

      const data = {

        consentToStore:true,

        consentToAI:false,

        profile,

        updatedAt:new Date().toISOString()

      };

      await env.MedicalStore.put(key, await encryptMedical(env, userId, data));

      return medicalJson({ok:true, updatedAt:data.updatedAt},200,cors);

    }

    return medicalJson({error:"Method not allowed"},405,cors);

  } catch (error) {

    console.error("Medical profile operation failed", {name:error?.name});

    return medicalJson({error:"Medical profile operation unavailable"},503,cors);

  }

}



var worker_default = {

  async fetch(request, env) {

    const url =

      new URL(request.url);



    const cors =

      getCors(request);



    if (

      request.method === "OPTIONS"

    ) {

      return new Response(null, {

        status: 204,

        headers: cors

      });

    }



/*

     * GOOGLE OAUTH CALLBACK

     * This callback comes directly

     * from Google, so it happens

     * before normal Lumi user auth.

     */

    if (

      request.method === "GET" &&

      url.pathname ===

        "/api/auth/google/callback"

    ) {

      try {

        await finishGoogleAuth(

          env,

          url

        );



        return new Response(

          `\<!doctype html>

\<html lang="pt-BR">

\<head>

\<meta charset="utf-8">

\<meta name="viewport" content="width=device-width,initial-scale=1">

\<title>Lumi\</title>

\</head>

\<body style="font-family:sans-serif;padding:32px">

\<h2>Google Calendar conectado à Lumi.\</h2>

\<p>Você pode fechar esta janela e voltar para a Lumi.\</p>

\</body>

\</html>`,

          {

            status: 200,

            headers: {

              "Content-Type":

                "text/html; charset=utf-8",

              "Cache-Control":

                "no-store"

            }

          }

        );

      } catch (error) {

        console.error(

          "Erro na autoriza\xE7\xE3o do Google Calendar:",

          error.message

        );



        return new Response(

          "N\xE3o foi poss\xEDvel conectar o Google Calendar. Volte \xE0 Lumi e tente novamente.",

          {

            status: 400,

            headers: {

              "Content-Type":

                "text/plain; charset=utf-8",

              "Cache-Control":

                "no-store"

            }

          }

        );

      }

    }



    const route =

      url.pathname.startsWith(

        "/api/"

      )

        ? url.pathname.slice(4)

        : url.pathname;



    if (

      request.method === "GET" &&

      url.pathname === "/"

    ) {

      return json(

        {

          status: "ok",

          message:

            "Lumi API funcionando"

        },

        200,

        cors

      );

    }



    if (!env.Memory) {

      return json(

        {

          error:

            "Binding KV Memory n\xE3o configurado"

        },

        503,

        cors

      );

    }



    if (

      !env.SUPABASE_URL ||

      !env.SUPABASE_PUBLISHABLE_KEY

    ) {

      return json(

        {

          error:

            "Configura\xE7\xE3o do Supabase incompleta"

        },

        503,

        cors

      );

    }



    let user;



    try {

      user =

        await authenticateUser(

          request,

          env

        );

    } catch (error) {

      console.error(

        "Erro de autentica\xE7\xE3o:",

        error

      );



      return json(

        {

          error:

            "Servi\xE7o de autentica\xE7\xE3o indispon\xEDvel"

        },

        503,

        cors

      );

    }



    if (!user?.id) {

      return json(

        {

          error:

            "Fa\xE7a login para continuar"

        },

        401,

        cors

      );

    }



    const memoryKey =

      `memory:user:${user.id}`;



    const generalMemoryKey =

      "memory:lumi:general";



    const historyKey =

      `history:user:${user.id}`;



    const archivePrefix =

      `archive:user:${user.id}:`;





// Medical profile is a separate encrypted store. No chat/memory integration.

    if (route === "/profile/medical" || route === "/profile/medical/export") {

      return handleMedicalProfile(request, env, user.id, route, cors);

    }



/*

     * GOOGLE CALENDAR:

     * START AUTHORIZATION

     */

    if (

      route ===

        "/auth/google/start" &&

      request.method === "GET"

    ) {

      try {

        const authUrl =

          await createGoogleAuthUrl(

            env,

            user.id

          );



        return json(

          {

            url: authUrl

          },

          200,

          cors

        );

      } catch (error) {

        console.error(

          "Erro ao iniciar Google Calendar:",

          error.message

        );



        return json(

          {

            error:

              "N\xE3o foi poss\xEDvel iniciar a conex\xE3o com o Google Calendar."

          },

          503,

          cors

        );

      }

    }





/*

     * GOOGLE CALENDAR:

     * READ EVENTS

     */

    if (

      route ===

        "/calendar/events" &&

      request.method === "GET"

    ) {

      try {

        const events =

          await listGoogleCalendarEvents(

            env,

            user.id

          );



        return json(

          { events },

          200,

          cors

        );

      } catch (error) {

        console.error(

          "Erro ao consultar Google Calendar:",

          error.message

        );



        return json(

          {

            error:

              "N\xE3o foi poss\xEDvel consultar sua agenda. Verifique se o Google Calendar est\xE1 conectado."

          },

          503,

          cors

        );

      }

    }





/*

     * GOOGLE CALENDAR:

     * CREATE EVENT

     */

    if (

      route ===

        "/calendar/events" &&

      request.method === "POST"

    ) {

      try {

        const body =

          await readJson(request);



        if (

          !body.title ||

          !body.start ||

          !body.end

        ) {

          return json(

            {

              error:

                "T\xEDtulo, in\xEDcio e fim s\xE3o obrigat\xF3rios."

            },

            400,

            cors

          );

        }



        const start =

          new Date(body.start);



        const end =

          new Date(body.end);



        if (

          Number.isNaN(

            start.getTime()

          ) ||

          Number.isNaN(

            end.getTime()

          ) ||

          end <= start

        ) {

          return json(

            {

              error:

                "Data ou hor\xE1rio do compromisso inv\xE1lido."

            },

            400,

            cors

          );

        }



        const event =

          await createGoogleCalendarEvent(

            env,

            user.id,

            {

              title:

                String(

                  body.title

                ).trim(),

              start:

                body.start,

              end:

                body.end,

              description:

                body.description ||

                "",

              location:

                body.location || ""

            }

          );



        return json(

          {

            ok: true,

            event

          },

          201,

          cors

        );

      } catch (error) {

        console.error(

          "Erro ao criar evento no Google Calendar:",

          error.message

        );



        return json(

          {

            error:

              "N\xE3o foi poss\xEDvel criar o compromisso no Google Calendar."

          },

          503,

          cors

        );

      }

    }





/*

     * MEMORY

     */

    if (

      route === "/memory" &&

      request.method === "GET"

    ) {

      const personal =

        await env.Memory.get(

          memoryKey

        );



      const general =

        await env.Memory.get(

          generalMemoryKey

        );



      return json(

        {

          memory:

            personal || "",

          generalMemory:

            general || ""

        },

        200,

        cors

      );

    }



    if (

      route === "/memory" &&

      request.method === "PUT"

    ) {

      const body =

        await readJson(request);



      const memory =

        typeof body.memory ===

          "string"

          ? body.memory.trim()

          : "";



      await env.Memory.put(

        memoryKey,

        memory

      );



      return json(

        {

          ok: true,

          memory

        },

        200,

        cors

      );

    }    /**

     * HISTORY

     */

    if (

      route === "/history" &&

      request.method === "GET"

    ) {

      const stored =

        await env.Memory.get(

          historyKey,

          "json"

        );



      const history =

        cleanMessages(stored);



      return json(

        {

          history

        },

        200,

        cors

      );

    }



    if (

      route === "/history" &&

      request.method === "DELETE"

    ) {

      await env.Memory.delete(

        historyKey

      );



      return json(

        {

          ok: true

        },

        200,

        cors

      );

    }





/*

     * ARCHIVE HISTORY

     */

    if (

  route === "/history/archives" &&

  request.method === "GET"

) {

  const archives = [];

  let cursor;



  do {

    const result = await env.Memory.list({

      prefix: archivePrefix,

      limit: 100,

      ...(cursor ? { cursor } : {})

    });



    for (const item of result.keys) {

      const stored = await env.Memory.get(

        item.name,

        "json"

      );



      const history = cleanMessages(stored);



      if (!history.length) continue;



      const firstUserMessage = history.find(

        message => message.role === "user"

      );



      const timestamp = Number(

        item.name.slice(archivePrefix.length)

      );



      archives.push({

        id: item.name.slice(archivePrefix.length),

        title: firstUserMessage?.content?.slice(0, 60)

          || "Conversa sem título",

        createdAt: Number.isFinite(timestamp)

          ? new Date(timestamp).toISOString()

          : null,

        messageCount: history.length

      });

    }



    cursor = result.list_complete

      ? undefined

      : result.cursor;



    if (result.list_complete) break;

  } while (cursor);



  archives.sort((a, b) =>

    Number(b.id) - Number(a.id)

  );



  return json(

    { archives },

    200,

    cors

  );

}

if (

  route === "/history/restore" &&

  request.method === "POST"

) {

  const body = await request.json();

  const archiveId = String(body?.id || "");



  if (!/^\d{13}$/.test(archiveId)) {

    return json(

      { error: "ID de conversa inválido." },

      400,

      cors

    );

  }



  const archiveKey =

    `${archivePrefix}${archiveId}`;



  const archived =

    await env.Memory.get(archiveKey, "json");



  if (!archived) {

    return json(

      { error: "Conversa não encontrada." },

      404,

      cors

    );

  }



  const restoredHistory =

    cleanMessages(archived);



  const current =

    cleanMessages(

      await env.Memory.get(historyKey, "json")

    );



  if (current.length) {

    const backupKey =

      `${archivePrefix}${Date.now()}`;



    await env.Memory.put(

      backupKey,

      JSON.stringify(current)

    );

  }



  await env.Memory.put(

    historyKey,

    JSON.stringify(restoredHistory)

  );



  return json(

    {

      ok: true,

      history: restoredHistory

    },

    200,

    cors

  );

}

    if (

      route === "/history/archive" &&

      request.method === "POST"

    ) {

      const stored =

        await env.Memory.get(

          historyKey,

          "json"

        );



      const history =

        cleanMessages(stored);



      if (history.length) {

        const archiveKey =

          `${archivePrefix}${Date.now()}`;



        await env.Memory.put(

          archiveKey,

          JSON.stringify(history)

        );

      }



      await env.Memory.delete(

        historyKey

      );



      return json(

        {

          ok: true

        },

        200,

        cors

      );

    }





/*

     * CHAT

     */

    if (

      route === "/chat" &&

      request.method === "POST"

    ) {

      try {

        const body =

          await readJson(request);



        const message =

          typeof body.message === "string"

            ? body.message.trim()

            : "";



        if (!message) {

          return json(

            {

              error:

                "Mensagem vazia."

            },

            400,

            cors

          );

        }



        const storedHistory =

          await env.Memory.get(

            historyKey,

            "json"

          );



        let history =

          cleanMessages(

            storedHistory

          );



        history.push({

          role: "user",

          content: message

        });



        history =

          cleanMessages(history);



        const personalMemory =

          await env.Memory.get(

            memoryKey

          );



        const generalMemory =

          await env.Memory.get(

            generalMemoryKey

          );



        const combinedMemory = [

          personalMemory

            ? `Memória pessoal:\n${personalMemory}`

            : "",

          generalMemory

            ? `Memória geral da Lumi:\n${generalMemory}`

            : ""

        ]

          .filter(Boolean)

          .join("\n\n");



        const reply =

          await askOpenAI(

            env,

            history,

            combinedMemory,

            user.id

          );



        history.push({

          role: "assistant",

          content: reply

        });



        history =

          cleanMessages(history);



        await env.Memory.put(

          historyKey,

          JSON.stringify(history)

        );



        return json(

          {

            reply,

            history

          },

          200,

          cors

        );



      } catch (error) {

        console.error(

          "Erro no chat:",

          error

        );



        return json(

          {

            error:

              "A Lumi não conseguiu responder agora."

          },

          500,

          cors

        );

      }

    }





/*

     * FALLBACK

     */

    return json(

      {

        error:

          "Rota ou método não permitido"

      },

      405,

      cors

    );

  }

};



export {

  worker_default as default

};
