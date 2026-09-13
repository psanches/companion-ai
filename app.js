export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    if (request.method === "GET") {
      return new Response("Companion AI funcionando", {
        status: 200,
        headers: cors,
      });
    }

    if (request.method !== "POST") {
      return new Response("Método não permitido", {
        status: 405,
        headers: cors,
      });
    }

    try {
      const body = await request.json();

      const message =
        typeof body?.message === "string"
          ? body.message.trim()
          : "";

      const clientId =
        typeof body?.clientId === "string"
          ? body.clientId.trim()
          : "";

      const history = Array.isArray(body?.history)
        ? body.history
        : [];

      if (!message) {
        return jsonResponse(
          { error: "Mensagem não informada" },
          400,
          cors
        );
      }

      if (!clientId) {
        return jsonResponse(
          { error: "Identificador do Companion não informado" },
          400,
          cors
        );
      }

      if (!env.OPENAI_API_KEY) {
        return jsonResponse(
          { error: "OPENAI_API_KEY não configurada" },
          500,
          cors
        );
      }

      if (!env.Memory) {
        return jsonResponse(
          { error: "Binding KV Memory não configurado" },
          500,
          cors
        );
      }

      const safeClientId = clientId
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 100);

      if (!safeClientId) {
        return jsonResponse(
          { error: "Identificador inválido" },
          400,
          cors
        );
      }

      const memoryKey = `memory:${safeClientId}`;

      // Lê a memória persistente desse navegador.
      let memory = "";

      try {
        memory =
          (await env.Memory.get(memoryKey)) || "";
      } catch (error) {
        console.error("Erro ao ler KV:", error);
      }

      memory = memory.slice(0, 8000);

      // Histórico recente.
      const conversation = history
        .slice(-12)
        .filter(
          item =>
            item &&
            typeof item.content === "string" &&
            (
              item.role === "user" ||
              item.role === "assistant"
            )
        )
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 6000),
        }));

      // Evita duplicar a mensagem atual.
      const last =
        conversation[conversation.length - 1];

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

      const instructions = `
Você é Companion AI, um assistente pessoal.

Converse de forma natural, clara, acolhedora e objetiva.

Você recebe duas fontes de contexto:

1. MEMÓRIA PERSISTENTE:
informações pessoais importantes que foram aprendidas
em conversas anteriores.

2. HISTÓRICO RECENTE:
as últimas mensagens da conversa atual.

Use a memória apenas quando for relevante.
Não invente lembranças.
Se houver conflito entre uma informação antiga e uma
nova informação explícita do usuário, considere a
informação nova como mais atual.

MEMÓRIA PERSISTENTE ATUAL:
${memory || "(nenhuma memória persistente ainda)"}

Em temas médicos:
- seja prudente;
- leve em consideração informações pessoais relevantes
  existentes na memória e na conversa;
- não recomende medicamentos de forma automática sem
  considerar contraindicações conhecidas;
- deixe claro quando avaliação médica é necessária.

Responda diretamente à mensagem do usuário.
`;

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization":
              `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            instructions,
            input: conversation,
            store: false,
          }),
        }
      );

      const data = await response.json();

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

      const reply = extractText(data);

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

      // Atualiza a memória depois de responder.
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
- informações pessoais que o usuário explicitamente
  forneceu e que podem ser úteis no futuro.

Regras:
- Não invente informações.
- Não transforme suposições em fatos.
- Se um fato novo corrigir um antigo, use o mais novo.
- Não guarde saudações ou conversa casual irrelevante.
- Seja conciso.
- Limite a memória a aproximadamente 1200 palavras.
- Retorne SOMENTE a memória atualizada em texto simples.
`;

        const memoryResponse = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              "Authorization":
                `Bearer ${env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-5-mini",
              input: memoryUpdatePrompt,
              store: false,
            }),
          }
        );

        const memoryData =
          await memoryResponse.json();

        if (memoryResponse.ok) {
          const updatedMemory =
            extractText(memoryData).trim();

          if (updatedMemory) {
            await env.Memory.put(
              memoryKey,
              updatedMemory.slice(0, 12000)
            );
          }
        } else {
          console.error(
            "Erro ao atualizar memória:",
            memoryData
          );
        }

      } catch (memoryError) {
        // Uma falha ao salvar memória não deve
        // impedir a resposta normal ao usuário.
        console.error(
          "Erro na memória:",
          memoryError
        );
      }

      return jsonResponse(
        { reply },
        200,
        cors
      );

    } catch (error) {
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

function extractText(data) {
  let text = "";

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) {
        continue;
      }

      for (const content of item.content) {
        if (
          content?.type === "output_text" &&
          typeof content?.text === "string"
        ) {
          text += content.text;
        }
      }
    }
  }

  if (
    !text &&
    typeof data?.output_text === "string"
  ) {
    text = data.output_text;
  }

  return text.trim();
}

function jsonResponse(data, status, cors) {
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
