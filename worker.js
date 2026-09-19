export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods":
        "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/memory") {
      return handleMemory(
        request,
        env,
        cors,
        url
      );
    }

    if (url.pathname === "/history") {
      return handleHistory(
        request,
        env,
        cors,
        url
      );
    }

    if (request.method === "GET") {
      return new Response(
        "Companion AI funcionando",
        {
          status: 200,
          headers: cors,
        }
      );
    }

    if (request.method !== "POST") {
      return new Response(
        "Método não permitido",
        {
          status: 405,
          headers: cors,
        }
      );
    }

    try {
      if (!env.OPENAI_API_KEY) {
        return jsonResponse(
          {
            error:
              "OPENAI_API_KEY não configurada",
          },
          500,
          cors
        );
      }

      if (!env.Memory) {
        return jsonResponse(
          {
            error:
              "Binding KV Memory não configurado",
          },
          500,
          cors
        );
      }

      const body =
        await request.json();

      const message =
        typeof body?.message === "string"
          ? body.message.trim()
          : "";

      const clientId =
        typeof body?.clientId === "string"
          ? body.clientId.trim()
          : "";

      const localHistory =
        Array.isArray(body?.history)
          ? body.history
          : [];

      if (!message) {
        return jsonResponse(
          {
            error:
              "Mensagem não informada",
          },
          400,
          cors
        );
      }

      if (!clientId) {
        return jsonResponse(
          {
            error:
              "Identificador do Companion não informado",
          },
          400,
          cors
        );
      }

      const identity =
        await getIdentity(
          env,
          clientId
        );

      if (!identity) {
        return jsonResponse(
          {
            error:
              "Identificador inválido",
          },
          400,
          cors
        );
      }

      const memoryKey =
        `memory:v2:${identity}`;

      const historyKey =
        `history:v2:${identity}`;

      let memory =
        (
          await env.Memory.get(
            memoryKey
          )
        ) || "";

      memory =
        memory.slice(0, 8000);

      let storedHistory = [];

      try {
        const saved =
          await env.Memory.get(
            historyKey,
            "json"
          );

        if (Array.isArray(saved)) {
          storedHistory = saved;
        }
      } catch (error) {
        console.error(
          "Erro ao ler histórico:",
          error
        );
      }

      let conversation =
        storedHistory.length
          ? storedHistory
          : localHistory;

      conversation =
        normalizeHistory(
          conversation,
          20
        );

      const last =
        conversation[
          conversation.length - 1
        ];

      if (
        !last ||
        last.role !== "user" ||
        last.content !== message
      ) {
        conversation.push({
          role: "user",
          content: message,
        });
      }

 const instructions = `Você é Lumi, a assistente pessoal do aplicativo Companion AI.

Ao falar sobre si mesma com o usuário, use sempre a primeira pessoa.

Se precisar se apresentar, diga: "Eu sou a Lumi, sua assistente no Companion AI."

Converse de forma natural, clara, acolhedora, objetiva e pouco repetitiva.

REGRA PRINCIPAL DE RESPOSTA:

Quando o pedido do usuário estiver suficientemente claro, responda imediatamente.

Não faça perguntas adicionais apenas para oferecer opções, confirmar preferências opcionais ou prolongar a conversa.

Não transforme uma solicitação simples em um questionário ou menu de opções.

Use padrões razoáveis quando detalhes opcionais não forem informados.

Faça uma pergunta de esclarecimento somente quando faltar uma informação realmente necessária para responder corretamente.

Quando uma pergunta for necessária, faça apenas a pergunta essencial.

Evite terminar rotineiramente com frases como:
"Quer que eu...?"
"Posso...?"
"Qual prefere?"
"Quer que eu siga?"
"Quer que eu faça isso agora?"

Não repita informações pessoais apenas para demonstrar que possui memória.

CAPACIDADES E AÇÕES EXTERNAS:
IMPORTANTE: mensagens anteriores do usuário dizendo "autorizo", "dou acesso", "sim" ou semelhantes NÃO significam que uma integração técnica foi criada.

Nunca presuma que existem tokens, credenciais, permissões ou contas conectadas apenas porque o usuário disse que autorizou.

Somente considere um serviço externo conectado quando o próprio sistema fornecer explicitamente essa capacidade ou os dados reais dessa integração.

Se essa capacidade não estiver disponível, diga isso diretamente. Não peça nova confirmação para executar uma ação impossível.

Nunca diga que acessou, conectou, verificou, pesquisou, enviou, criou, alterou, excluiu ou autorizou algo em um serviço externo se essa ação não foi realmente executada pelo aplicativo.

Nunca invente integrações, permissões, conexões ou resultados.

Não prometa abrir telas de autorização ou conectar contas se o Companion AI não possuir essa integração.

Se o usuário pedir algo que exige uma integração que não está disponível, explique isso imediatamente e de forma breve.

Por exemplo, se não houver integração de calendário disponível, diga diretamente que você ainda não consegue consultar o calendário automaticamente.

Não peça ao usuário para escolher Google, Outlook, permissões de leitura/escrita ou outras configurações de uma integração que não existe.

Você recebe duas fontes de contexto:

1. MEMÓRIA PERSISTENTE:
informações pessoais importantes aprendidas anteriormente.

2. HISTÓRICO RECENTE:
as mensagens recentes da conversa.

Use a memória apenas quando for relevante.
Não invente lembranças.

Se houver conflito entre uma informação antiga e uma nova informação explícita do usuário, considere a informação nova como mais atual.

A memória é atualizada automaticamente.

Não pergunte ao usuário se ele quer que uma informação seja salva, a menos que ele esteja falando explicitamente sobre controle ou privacidade da memória.

MEMÓRIA PERSISTENTE ATUAL:
${memory || "(nenhuma memória persistente ainda)"}

Em temas médicos:
- seja prudente;
- considere informações pessoais relevantes;
- não recomende medicamentos automaticamente sem considerar contraindicações conhecidas;
- indique quando avaliação médica é necessária.

Responda primeiro ao que o usuário realmente perguntou.
Se puder responder ou executar diretamente, faça isso sem pedir confirmação desnecessária.
`;

      const response =
        await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",

            headers: {
              "Authorization":
                `Bearer ${env.OPENAI_API_KEY}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              model: "gpt-5-mini",
              instructions,
              input: conversation,
              store: false,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            error:
              data?.error?.message ||
              `Erro na OpenAI (${response.status})`,
          },
          response.status,
          cors
        );
      }

      const reply =
        extractText(data);

      if (!reply) {
        return jsonResponse(
          {
            error:
              "A OpenAI respondeu, mas não retornou texto.",
          },
          502,
          cors
        );
      }

      const newHistory = [
        ...conversation,
        {
          role: "assistant",
          content: reply,
        },
      ].slice(-30);

      await env.Memory.put(
        historyKey,
        JSON.stringify(newHistory)
      );

      try {
        const memoryUpdatePrompt = `
MEMÓRIA ANTERIOR:
${memory || "(vazia)"}

NOVA MENSAGEM DO USUÁRIO:
${message}

RESPOSTA DO ASSISTENTE:
${reply}

Atualize a memória persistente desse usuário.

Guarde somente informações úteis para conversas futuras,
como:
- nome e forma preferida de tratamento;
- família, animais e pessoas importantes;
- preferências;
- projetos e objetivos;
- rotina;
- informações pessoais explicitamente fornecidas.

Regras:
- Não invente informações.
- Não transforme suposições em fatos.
- Se um fato novo corrigir um antigo, use o mais novo.
- Não guarde saudações ou conversa casual irrelevante.
- Não pergunte se deve salvar.
- Seja conciso.
- Limite a memória a aproximadamente 1200 palavras.
- Retorne SOMENTE a memória atualizada em texto simples.
`;

        const memoryResponse =
          await fetch(
            "https://api.openai.com/v1/responses",
            {
              method: "POST",

              headers: {
                "Authorization":
                  `Bearer ${env.OPENAI_API_KEY}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                model:
                  "gpt-5-mini",
                input:
                  memoryUpdatePrompt,
                store: false,
              }),
            }
          );

        const memoryData =
          await memoryResponse.json();

        if (memoryResponse.ok) {
          const updatedMemory =
            extractText(
              memoryData
            ).trim();

          if (updatedMemory) {
            await env.Memory.put(
              memoryKey,
              updatedMemory.slice(
                0,
                12000
              )
            );
          }
        } else {
          console.error(
            "Erro ao atualizar memória:",
            memoryData
          );
        }

      } catch (memoryError) {
        console.error(
          "Erro na memória:",
          memoryError
        );
      }

      return jsonResponse(
        {
          reply,
          history: newHistory,
        },
        200,
        cors
      );

    } catch (error) {
      console.error(error);

      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Erro inesperado no Worker",
        },
        500,
        cors
      );
    }
  },
};


async function handleMemory(
  request,
  env,
  cors,
  url
) {
  if (!env.Memory) {
    return jsonResponse(
      {
        error:
          "Binding KV Memory não configurado",
      },
      500,
      cors
    );
  }

  let clientId = "";

  if (request.method === "GET") {
    clientId =
      url.searchParams.get(
        "clientId"
      ) || "";
  } else {
    const body =
      await request.json();

    clientId =
      typeof body?.clientId === "string"
        ? body.clientId
        : "";

    if (request.method === "PUT") {
      const identity =
        await getIdentity(
          env,
          clientId
        );

      if (!identity) {
        return jsonResponse(
          {
            error:
              "Identificador inválido",
          },
          400,
          cors
        );
      }

      const memory =
        typeof body?.memory === "string"
          ? body.memory.trim()
          : "";

      const key =
        `memory:v2:${identity}`;

      if (memory) {
        await env.Memory.put(
          key,
          memory.slice(0, 12000)
        );
      } else {
        await env.Memory.delete(key);
      }

      return jsonResponse(
        { ok: true },
        200,
        cors
      );
    }

    if (
      request.method === "DELETE"
    ) {
      const identity =
        await getIdentity(
          env,
          clientId
        );

      if (!identity) {
        return jsonResponse(
          {
            error:
              "Identificador inválido",
          },
          400,
          cors
        );
      }

      await env.Memory.delete(
        `memory:v2:${identity}`
      );

      return jsonResponse(
        { ok: true },
        200,
        cors
      );
    }
  }

  if (request.method === "GET") {
    const identity =
      await getIdentity(
        env,
        clientId
      );

    if (!identity) {
      return jsonResponse(
        {
          error:
            "Identificador inválido",
        },
        400,
        cors
      );
    }

    const memory =
      (
        await env.Memory.get(
          `memory:v2:${identity}`
        )
      ) || "";

    return jsonResponse(
      { memory },
      200,
      cors
    );
  }

  return jsonResponse(
    {
      error:
        "Método não permitido",
    },
    405,
    cors
  );
}


async function handleHistory(
  request,
  env,
  cors,
  url
) {
  if (!env.Memory) {
    return jsonResponse(
      {
        error:
          "Binding KV Memory não configurado",
      },
      500,
      cors
    );
  }

  if (request.method === "GET") {
    const clientId =
      url.searchParams.get(
        "clientId"
      ) || "";

    const identity =
      await getIdentity(
        env,
        clientId
      );

    if (!identity) {
      return jsonResponse(
        {
          error:
            "Identificador inválido",
        },
        400,
        cors
      );
    }

    let history = [];

    try {
      const saved =
        await env.Memory.get(
          `history:v2:${identity}`,
          "json"
        );

      if (Array.isArray(saved)) {
        history =
          normalizeHistory(
            saved,
            30
          );
      }
    } catch (error) {
      console.error(
        "Erro ao carregar histórico:",
        error
      );
    }

    return jsonResponse(
      { history },
      200,
      cors
    );
  }

  if (
    request.method === "DELETE"
  ) {
    const body =
      await request.json();

    const clientId =
      typeof body?.clientId === "string"
        ? body.clientId
        : "";

    const identity =
      await getIdentity(
        env,
        clientId
      );

    if (!identity) {
      return jsonResponse(
        {
          error:
            "Identificador inválido",
        },
        400,
        cors
      );
    }

    await env.Memory.delete(
      `history:v2:${identity}`
    );

    return jsonResponse(
      { ok: true },
      200,
      cors
    );
  }

  return jsonResponse(
    {
      error:
        "Método não permitido",
    },
    405,
    cors
  );
}


async function getIdentity(
  env,
  clientId
) {
  const clean =
    sanitizeClientId(clientId);

  if (!clean) {
    return "";
  }

  const identity =
    await sha256(clean);

  await migrateOldData(
    env,
    clean,
    identity
  );

  return identity;
}


async function migrateOldData(
  env,
  oldId,
  identity
) {
  const oldMemoryKey =
    `memory:${oldId}`;

  const oldHistoryKey =
    `history:${oldId}`;

  const newMemoryKey =
    `memory:v2:${identity}`;

  const newHistoryKey =
    `history:v2:${identity}`;

  const newMemory =
    await env.Memory.get(
      newMemoryKey
    );

  if (newMemory === null) {
    const oldMemory =
      await env.Memory.get(
        oldMemoryKey
      );

    if (oldMemory !== null) {
      await env.Memory.put(
        newMemoryKey,
        oldMemory
      );
    }
  }

  const newHistory =
    await env.Memory.get(
      newHistoryKey
    );

  if (newHistory === null) {
    const oldHistory =
      await env.Memory.get(
        oldHistoryKey
      );

    if (oldHistory !== null) {
      await env.Memory.put(
        newHistoryKey,
        oldHistory
      );
    }
  }
}


async function sha256(text) {
  const bytes =
    new TextEncoder().encode(text);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}


function sanitizeClientId(
  clientId
) {
  return String(clientId || "")
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    )
    .slice(0, 100);
}


function normalizeHistory(
  history,
  limit
) {
  return history
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
        item.content.slice(
          0,
          6000
        ),
    }))
    .slice(-limit);
}


function extractText(data) {
  let text = "";

  if (Array.isArray(data?.output)) {
    for (
      const item
      of data.output
    ) {
      if (
        !Array.isArray(
          item?.content
        )
      ) {
        continue;
      }

      for (
        const content
        of item.content
      ) {
        if (
          content?.type ===
            "output_text" &&
          typeof content?.text ===
            "string"
        ) {
          text += content.text;
        }
      }
    }
  }

  if (
    !text &&
    typeof data?.output_text ===
      "string"
  ) {
    text =
      data.output_text;
  }

  return text.trim();
}


function jsonResponse(
  data,
  status,
  cors
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        ...cors,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}
