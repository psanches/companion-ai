
import {
  authenticateUser
} from "./auth.js";

// ========================================
// LUMI — COMPANION AI
// Backend autenticado com Supabase
// ========================================

function json(data, status = 200, cors = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...cors,
        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
}

// ========================================
// HISTÓRICO
// ========================================

function normalizeHistory(history, limit = 30) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(item =>
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.content === "string"
    )
    .map(item => ({
      role: item.role,
      content: item.content.slice(0, 6000)
    }))
    .slice(-limit);
}

// ========================================
// EXTRAIR RESPOSTA DA OPENAI
// ========================================

function extractText(data) {
  let text = "";

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        text += content.text;
      }
    }
  }

  return text.trim() ||
    data.output_text ||
    "";
}

// ========================================
// WORKER PRINCIPAL
// ========================================

export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Methods":
        "GET, POST, PUT, DELETE, OPTIONS",

      "Access-Control-Allow-Headers":
        "Content-Type, Authorization",

      "Cache-Control": "no-store"
    };

    // Responder ao preflight CORS

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    const url = new URL(request.url);

    // Verificação pública de funcionamento

    if (
      request.method === "GET" &&
      url.pathname === "/"
    ) {
      return json(
        {
          status: "ok",
          message: "Lumi API funcionando"
        },
        200,
        cors
      );
    }

    // ====================================
    // CONFIGURAÇÃO DO SERVIDOR
    // ====================================

    if (!env.Memory) {
      return json(
        {
          error:
            "Binding KV Memory não configurado"
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
            "Configuração do Supabase incompleta"
        },
        503,
        cors
      );
    }

    // ====================================
    // AUTENTICAÇÃO
    // ====================================

    let user;

    try {
      user = await authenticateUser(
        request,
        env
      );

    } catch (error) {
      console.error(
        "Erro de autenticação:",
        error
      );

      return json(
        {
          error:
            "Serviço de autenticação indisponível"
        },
        503,
        cors
      );
    }

    if (!user?.id) {
      return json(
        {
          error:
            "Faça login para continuar"
        },
        401,
        cors
      );
    }

    // ====================================
    // IDENTIDADE INDIVIDUAL
    // ====================================

    // A identidade vem do Supabase.
    // Nunca usar clientId enviado pelo navegador.

    const memoryKey =
      `memory:user:${user.id}`;

    const historyKey =
      `history:user:${user.id}`;

    try {

      // ==================================
      // MEMÓRIA — CONSULTAR
      // ==================================

      if (
        url.pathname === "/memory" &&
        request.method === "GET"
      ) {
        const memory =
          await env.Memory.get(memoryKey) || "";

        return json(
          { memory },
          200,
          cors
        );
      }

      // ==================================
      // MEMÓRIA — SALVAR
      // ==================================

      if (
        url.pathname === "/memory" &&
        request.method === "PUT"
      ) {
        const body = await request.json();

        if (typeof body.memory !== "string") {
          return json(
            {
              error: "Memória inválida"
            },
            400,
            cors
          );
        }

        const memory =
          body.memory.trim().slice(0, 12000);

        if (memory) {
          await env.Memory.put(
            memoryKey,
            memory
          );
        } else {
          await env.Memory.delete(memoryKey);
        }

        return json(
          { ok: true },
          200,
          cors
        );
      }

      // ==================================
      // MEMÓRIA — APAGAR
      // ==================================

      if (
        url.pathname === "/memory" &&
        request.method === "DELETE"
      ) {
        await env.Memory.delete(memoryKey);

        return json(
          { ok: true },
          200,
          cors
        );
      }

      // ==================================
      // HISTÓRICO — CONSULTAR
      // ==================================

      if (
        url.pathname === "/history" &&
        request.method === "GET"
      ) {
        const stored =
          await env.Memory.get(
            historyKey,
            "json"
          );

        return json(
          {
            history: normalizeHistory(stored)
          },
          200,
          cors
        );
      }

      // ==================================
      // HISTÓRICO — APAGAR
      // ==================================

      if (
        url.pathname === "/history" &&
        request.method === "DELETE"
      ) {
        await env.Memory.delete(historyKey);

        return json(
          { ok: true },
          200,
          cors
        );
      }

      // ==================================
      // CHAT DA LUMI
      // ==================================

      if (
        url.pathname === "/" &&
        request.method === "POST"
      ) {

        if (!env.OPENAI_API_KEY) {
          return json(
            {
              error:
                "OPENAI_API_KEY não configurada"
            },
            503,
            cors
          );
        }

        const body = await request.json();

        const message =
          typeof body.message === "string"
            ? body.message.trim()
            : "";

        if (!message) {
          return json(
            {
              error:
                "Mensagem não informada"
            },
            400,
            cors
          );
        }

        // Carregar memória individual

        const memory =
          (
            await env.Memory.get(memoryKey)
          ) || "";

        // Carregar histórico individual

        const storedHistory =
          await env.Memory.get(
            historyKey,
            "json"
          );

        const history =
          normalizeHistory(
            storedHistory,
            20
          );

        history.push({
          role: "user",
          content: message.slice(0, 6000)
        });

        // ==================================
        // INSTRUÇÕES DA LUMI
        // ==================================

        const instructions = `
Você é Lumi, a assistente pessoal do Companion AI.

Converse em português brasileiro de maneira natural,
acolhedora, objetiva e pouco repetitiva.

Quando o pedido estiver claro, responda diretamente.

Não faça perguntas desnecessárias.

Não invente lembranças ou informações pessoais.

Use a memória persistente somente quando relevante.

Nunca afirme ter executado ações externas sem que
uma integração real tenha executado essas ações.

Se não houver integração disponível para uma tarefa,
explique a limitação de maneira breve.

Não exponha dados pessoais de outros usuários.

MEMÓRIA PERSISTENTE DO USUÁRIO:

${memory.slice(0, 8000) || "(nenhuma memória registrada)"}
`;

        // ==================================
        // CONSULTAR OPENAI
        // ==================================

        const response = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",

            headers: {
              "Authorization":
                `Bearer ${env.OPENAI_API_KEY}`,

              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              model: "gpt-5-mini",
              instructions,
              input: history,
              store: false
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(
            "Erro da OpenAI:",
            response.status
          );

          return json(
            {
              error:
                "Não foi possível obter a resposta da Lumi"
            },
            502,
            cors
          );
        }

        const reply = extractText(data);

        if (!reply) {
          return json(
            {
              error:
                "A Lumi não retornou uma resposta"
            },
            502,
            cors
          );
        }

        // ==================================
        // SALVAR HISTÓRICO
        // ==================================

        const newHistory =
          normalizeHistory(
            [
              ...history,
              {
                role: "assistant",
                content: reply
              }
            ],
            30
          );

        await env.Memory.put(
          historyKey,
          JSON.stringify(newHistory)
        );

        // ==================================
        // ATUALIZAR MEMÓRIA
        // ==================================

        try {

          const memoryResponse = await fetch(
            "https://api.openai.com/v1/responses",
            {
              method: "POST",

              headers: {
                "Authorization":
                  `Bearer ${env.OPENAI_API_KEY}`,

                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                model: "gpt-5-mini",
                store: false,

                instructions: `
Você atualiza a memória persistente de um usuário.

Preserve informações pessoais importantes e
preferências explícitas.

Não invente fatos.

Não registre instruções temporárias como memórias.

Retorne somente a memória atualizada em texto simples.
`,

                input: `
MEMÓRIA ANTERIOR:
${memory.slice(0, 8000)}

NOVA MENSAGEM:
${message.slice(0, 6000)}

RESPOSTA:
${reply.slice(0, 6000)}
`
              })
            }
          );

          if (memoryResponse.ok) {

            const memoryData =
              await memoryResponse.json();

            const updatedMemory =
              extractText(memoryData).trim();

            if (updatedMemory) {
              await env.Memory.put(
                memoryKey,
                updatedMemory.slice(0, 12000)
              );
            }
          }

        } catch (error) {
          console.error(
            "Erro ao atualizar memória:",
            error
          );
        }

        // ==================================
        // RESPOSTA AO APLICATIVO
        // ==================================

        return json(
          {
            reply,
            history: newHistory
          },
          200,
          cors
        );
      }

      return json(
        {
          error:
            "Rota ou método não permitido"
        },
        405,
        cors
      );

    } catch (error) {

      console.error(
        "Erro interno da Lumi:",
        error
      );

      return json(
        {
          error:
            "Erro interno no servidor"
        },
        500,
        cors
      );
    }
  }
};
