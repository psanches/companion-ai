
export default {
  async fetch(request, env) {
    // CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Companion AI funcionando", {
        status: 200,
        headers: corsHeaders,
      });
    }

    try {
      const body = await request.json();
      const message = body.message;

      if (!message) {
        return Response.json(
          { error: "Mensagem não informada" },
          { status: 400, headers: corsHeaders }
        );
      }

      if (!env.OPENAI_API_KEY) {
        return Response.json(
          { error: "OPENAI_API_KEY não configurada" },
          { status: 500, headers: corsHeaders }
        );
      }

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            input: message
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return Response.json(
          { error: data.error?.message || "Erro na OpenAI" },
          { status: response.status, headers: corsHeaders }
        );
      }

      return Response.json(
        {
          reply: data.output_text || "Sem resposta."
        },
        { headers: corsHeaders }
      );

    } catch (error) {
      return Response.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
