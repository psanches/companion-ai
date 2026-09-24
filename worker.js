
import { authenticateUser } from "./auth.js";
import { createGoogleAuthUrl } from "./google-calendar.js";
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

// Lumi: API autenticada. O frontend envia requisicoes para /api/*.
function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
  });
}

function normalizeHistory(history, limit = 30) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map(item => ({ role: item.role, content: item.content.slice(0, 6000) }))
    .slice(-limit);
}

function extractText(data) {
  let text = "";
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") text += content.text;
    }
  }
  return text.trim() || data.output_text || "";
}

export default {
async fetch(request, env, ctx) {
  
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    // A configuracao de assets encaminha /api/* para este Worker.
    // Aceitar tambem as rotas antigas, sem modificar a rota publica /.
    const route = url.pathname.startsWith("/api/")
      ? url.pathname.slice(4)
      : url.pathname;

    if (request.method === "GET" && url.pathname === "/") {
      return json({ status: "ok", message: "Lumi API funcionando" }, 200, cors);
    }

    if (!env.Memory) {
      return json({ error: "Binding KV Memory não configurado" }, 503, cors);
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
      return json({ error: "Configuração do Supabase incompleta" }, 503, cors);
    }

    let user;
    try {
      user = await authenticateUser(request, env);
    } catch (error) {
      console.error("Erro de autenticação:", error);
      return json({ error: "Serviço de autenticação indisponível" }, 503, cors);
    }
    if (!user?.id) return json({ error: "Faça login para continuar" }, 401, cors);

    const memoryKey = `memory:user:${user.id}`;
    const historyKey = `history:user:${user.id}`;

    if (
      route === "/auth/google/start" &&
      request.method === "POST"
    ) {
      try {
        const authUrl = await createGoogleAuthUrl(
          env,
          user.id
        );

        return json({ authUrl }, 200, cors);
      } catch (error) {
        console.error(
          "Erro ao iniciar Google Calendar:",
          error
        );

        return json(
          { error: "Não foi possível iniciar a conexão com o Google Calendar." },
          503,
          cors
        );
      }
    }
    try {
      if (route === "/memory" && request.method === "GET") {
        return json({ memory: (await env.Memory.get(memoryKey)) || "" }, 200, cors);
      }

      if (route === "/memory" && request.method === "PUT") {
        const body = await request.json();
        if (typeof body.memory !== "string") {
          return json({ error: "Memória inválida" }, 400, cors);
        }
        const memory = body.memory.trim().slice(0, 12000);
        if (memory) await env.Memory.put(memoryKey, memory);
        else await env.Memory.delete(memoryKey);
        return json({ ok: true }, 200, cors);
      }

      if (route === "/memory" && request.method === "DELETE") {
        await env.Memory.delete(memoryKey);
        return json({ ok: true }, 200, cors);
      }

      if (route === "/history" && request.method === "GET") {
        const stored = await env.Memory.get(historyKey, "json");
        return json({ history: normalizeHistory(stored) }, 200, cors);
      }

      if (route === "/history" && request.method === "DELETE") {
        await env.Memory.delete(historyKey);
        return json({ ok: true }, 200, cors);
      }

      if (route === "/" && request.method === "POST") {
        if (!env.OPENAI_API_KEY) {
          return json({ error: "OPENAI_API_KEY não configurada" }, 503, cors);
        }
        const body = await request.json();
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message) return json({ error: "Mensagem não informada" }, 400, cors);

        const memory = (await env.Memory.get(memoryKey)) || "";
        const storedHistory = await env.Memory.get(historyKey, "json");
        const history = normalizeHistory(storedHistory, 20);
        history.push({ role: "user", content: message.slice(0, 6000) });

        const instructions = `

Você é Lumi, a assistente pessoal do Companion AI.

IDIOMA:
Responda em português brasileiro ou inglês, conforme o idioma utilizado pelo usuário ou sua preferência.

COMPORTAMENTO:
Responda de forma natural, sem anunciar que está seguindo instruções.
Não repita o pedido do usuário nem acrescente frases como "Fim do resumo", "Conforme solicitado" ou "Sem alterar sua memória".
Termine a resposta após entregar a informação solicitada, sem comentários de encerramento desnecessários.
Responda diretamente ao pedido do usuário.
Não ofereça menus de opções quando o pedido já estiver claro.

Não termine cada resposta com perguntas como "Quer que eu detalhe?", "Posso resumir?" ou "Qual opção prefere?".
Encerre a resposta assim que concluir o pedido.
Não acrescente sugestões de novas tarefas, menus de opções ou convites para continuar a conversa, a menos que o usuário solicite.
Se o usuário pedir uma pesquisa, entregue os resultados na mesma resposta.
Se pedir um resumo, apresente o resumo imediatamente.
Se pedir uma comparação, apresente a comparação diretamente.
Faça perguntas somente quando faltar uma informação indispensável.

PESQUISA NA INTERNET:
Para conversas simples, cumprimentos e perguntas que não exigem informações atualizadas, responda diretamente, sem pesquisar na internet.
Utilize web_search quando o usuário solicitar uma pesquisa ou quando a resposta depender de informações atuais.
Quando o usuário solicitar informações recentes, utilize a ferramenta web_search disponível.
Para pesquisas sobre Parkinson, priorize fontes médicas confiáveis, como Parkinson's Foundation, Associação Brasil Parkinson, Michael J. Fox Foundation, PubMed e instituições de saúde.
Apresente os resultados encontrados, incluindo título, data, fonte, link direto e um breve resumo.
Não invente fontes, links, datas ou resultados de pesquisas.
Nunca afirme ter pesquisado na internet se a ferramenta não tiver sido realmente utilizada.
Se a pesquisa falhar, explique brevemente o problema, sem apresentar informações antigas como se fossem atuais.

MEMÓRIA E PRIVACIDADE:
Use a memória persistente somente quando relevante.
Não invente lembranças ou informações pessoais.
Não exponha dados pessoais de outros usuários.
Não afirme ter executado ações externas sem que uma integração real tenha executado essas ações.

MEMÓRIA PERSISTENTE DO USUÁRIO:
${memory.slice(0, 8000) || "(nenhuma memória registrada)"}
`;

        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
       
body: JSON.stringify({
  model: "gpt-5-mini",
  instructions,
  input: history,
  store: false,
   tools: [
    { type: "web_search" }
  ],
  tool_choice: "auto"
})
});
        const data = await response.json();
        if (!response.ok) {
          console.error("Erro da OpenAI:", response.status);
          return json({ error: "Não foi possível obter a resposta da Lumi" }, 502, cors);
        }
        const reply = extractText(data);
        if (!reply) return json({ error: "A Lumi não retornou uma resposta" }, 502, cors);

        const newHistory = normalizeHistory([...history, { role: "assistant", content: reply }], 30);
        await env.Memory.put(historyKey, JSON.stringify(newHistory));


        // Atualizacao da memoria em segundo plano.
        ctx.waitUntil((async () => {
          try {
            const memoryResponse = await fetch("https://api.openai.com/v1/responses", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: "gpt-5-mini",
                store: false,
                instructions: `Você atualiza a memória persistente de um usuário.

Preserve informações pessoais importantes e preferências explícitas.
Não invente fatos. Não registre instruções temporárias como memórias.
Retorne somente a memória atualizada em texto simples.`,
                input: `MEMÓRIA ANTERIOR:\n${memory.slice(0, 8000)}\n\nNOVA MENSAGEM:\n${message.slice(0, 6000)}\n\nRESPOSTA:\n${reply.slice(0, 6000)}`
              })
            });

            if (memoryResponse.ok) {
              const memoryData = await memoryResponse.json();
              const updatedMemory = extractText(memoryData).trim();

              if (updatedMemory) {
                await env.Memory.put(
                  memoryKey,
                  updatedMemory.slice(0, 12000)
                );
              }
            }
         
          } catch (error) {
            console.error("Erro ao atualizar memória:", error);
          }
        })());

        return json({ reply, history: newHistory }, 200, cors);
      }

      return json({ error: "Rota ou método não permitido" }, 405, cors);
    } catch (error) {
      console.error("Erro interno da Lumi:", error);
      return json({ error: "Erro interno no servidor" }, 500, cors);
    }
  }
};
