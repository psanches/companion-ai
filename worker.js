export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    // =====================================================
    // RELEVANT TOPICS - MANUAL DEV SCAN
    // =====================================================

    if (
      request.method === "GET" &&
      url.pathname === "/relevant-topics/scan"
    ) {
      try {
        if (!env.OPENAI_API_KEY) {
          throw new Error(
            "OPENAI_API_KEY não configurada"
          );
        }

        const result =
          await scanRelevantTopics(env);

        return Response.json(
          {
            success: true,
            result
          },
          {
            headers: corsHeaders
          }
        );

      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          {
            status: 500,
            headers: corsHeaders
          }
        );
      }
    }

    // =====================================================
    // HEALTH CHECK
    // =====================================================

    if (request.method !== "POST") {
      return new Response(
        "Companion AI funcionando",
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // =====================================================
    // NORMAL LUMI CHAT
    // =====================================================

    try {
      const body = await request.json();
      const message = body.message;

      if (!message) {
        return Response.json(
          {
            error:
              "Mensagem não informada"
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      if (!env.OPENAI_API_KEY) {
        return Response.json(
          {
            error:
              "OPENAI_API_KEY não configurada"
          },
          {
            status: 500,
            headers: corsHeaders
          }
        );
      }

      const response = await fetch(
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
            input: message
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        return Response.json(
          {
            error:
              data.error?.message ||
              "Erro na OpenAI"
          },
          {
            status: response.status,
            headers: corsHeaders
          }
        );
      }

      return Response.json(
        {
          reply:
            data.output_text ||
            "Sem resposta."
        },
        {
          headers: corsHeaders
        }
      );

    } catch (error) {
      return Response.json(
        {
          error: error.message
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }
  },
};


// =========================================================
// RELEVANT TOPICS SCANNER
// =========================================================

async function scanRelevantTopics(env) {

  const prompt = `
Search the web for important recent information that could make
Lumi, an AI companion, safer, more useful, preventive, or supportive.

Focus especially on:

- Parkinson's disease and neurological conditions
- healthy aging
- fall prevention and mobility
- mental health, loneliness and grief
- medication and public-health safety
- technology and accessibility for older adults
- scams and digital safety affecting older adults
- AI companions, AI safety and regulation

Include relevant information from Brazil and international sources.

Prioritize:

- government health agencies
- universities
- peer-reviewed medical/scientific sources
- respected health organizations
- reputable Brazilian and international journalism

Avoid sensationalism, advertising, weak health claims and duplicate stories.

Return only the most important findings.

For each finding include:

TITLE:
SOURCE:
DATE:
URL:
CATEGORY:
SUMMARY:
WHY_RELEVANT_TO_LUMI:
RELEVANCE_SCORE:

Use a relevance score from 1 to 10.

Only include findings scoring 7 or higher.
`;

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

        tools: [
          {
            type: "web_search"
          }
        ],

        input: prompt
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Relevant topics scan failed"
    );
  }

  const result =
    data.output_text ||
    "No relevant topics found.";

  // Save latest scan if KV is available
  if (env.Memory) {
    await env.Memory.put(
      "relevant-topics:latest",
      JSON.stringify({
        scannedAt:
          new Date().toISOString(),

        content: result
      })
    );
  }

  return result;
}
