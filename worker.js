// Cloudflare Worker: forwards chat messages to Claude so your API key stays secret.
// Setup: create a Worker, paste this in, add a secret named ANTHROPIC_API_KEY,
// then set ALLOWED_ORIGIN to your site (e.g. https://yourname.github.io).

const ALLOWED_ORIGIN = "https://yourname.github.io";

const SYSTEM = `You are INEON, a calm, dry-witted AI assistant. Address the user as "sir" unless told otherwise.
Be concise: one to three sentences unless asked for more. Replies may be read aloud, so avoid markdown and lists.`;

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST" || request.headers.get("Origin") !== ALLOWED_ORIGIN)
      return new Response("Forbidden", { status: 403, headers: cors });

    const { messages } = await request.json();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 400,
        system: SYSTEM,
        messages: messages.slice(-20),
      }),
    });
    const data = await res.json();
    const reply = data.content?.map(b => b.text || "").join("") || "";
    return new Response(JSON.stringify({ reply }), {
      status: res.ok ? 200 : 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
