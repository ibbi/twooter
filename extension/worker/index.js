import Anthropic from "@anthropic-ai/sdk";

export default {
  async fetch(request, env, ctx) {
    // Handle CORS and method validation
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();
      const { tweets, filters } = body;

      const anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      });

      const results = [];

      // Process each filter
      for (const filter of filters) {
        const prompt = `
          You are evaluating tweets against a filter rule.
          Filter rule: "${filter.rule}"
          
          For each tweet below, respond with ONLY "pass" or "fail":
          
          ${tweets
            .map((tweet, i) => `Tweet ${i + 1}: ${tweet.content}`)
            .join("\n\n")}
        `;

        const response = await anthropic.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        // Parse response and update results
        const lines = response.content[0].text.split("\n");
        tweets.forEach((tweet, i) => {
          const result = lines[i]?.toLowerCase().includes("fail");

          const existingResult = results.find((r) => r.tweetId === tweet.id);
          if (existingResult) {
            if (result) {
              existingResult.failedFilters.push(filter.id);
            }
          } else {
            results.push({
              tweetId: tweet.id,
              failedFilters: result ? [filter.id] : [],
            });
          }
        });
      }

      return new Response(JSON.stringify({ results }), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  },
};
