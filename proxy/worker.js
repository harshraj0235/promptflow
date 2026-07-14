/**
 * Cloudflare Worker Proxy for PromptFlow Pro
 * Forwards requests to OpenRouter, hiding the API key.
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight requests (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", // You can restrict this to your extension ID later
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      // Parse the incoming JSON payload from the Chrome Extension
      const body = await request.json();

      if (!env.OPENROUTER_API_KEY) {
        return new Response(JSON.stringify({ error: "The Cloudflare Worker cannot find the OPENROUTER_API_KEY environment variable. It evaluates to undefined." }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      // 3. Forward the request to OpenRouter securely
      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // The API Key is pulled from Cloudflare Environment Variables safely
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      const data = await openRouterResponse.json();

      // 4. Send the OpenRouter response back to the Chrome Extension
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }
  }
};
