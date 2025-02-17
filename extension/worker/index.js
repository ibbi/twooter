import Anthropic from "@anthropic-ai/sdk"

// Deployed API URL: https://twooter.ibm456.workers.dev

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      })
    }

    // Handle CORS and method validation
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders
      })
    }

    try {
      const body = await request.json()
      const { tweets, filters } = body

      const anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY
      })

      const results = tweets.map(() => ({ failedFilters: [] }))

      // Process each filter
      for (const filter of filters) {
        const prompt = `
          You are evaluating tweets against a filter rule.
          Filter rule: "${filter}"
          
          For each tweet below, respond with ONLY "pass" or "fail":
          
          ${tweets
            .map(
              (tweet, i) => `Tweet ${i + 1}:
Author: ${tweet.metadata.author} (@${tweet.metadata.username})
Time: ${tweet.metadata.timestamp}
Engagement: ${tweet.metadata.retweets} retweets, ${tweet.metadata.likes} likes
Content: ${tweet.text}`
            )
            .join("\n\n")}
        `

        const response = await anthropic.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }]
        })

        // Parse response and update results
        const lines = response.content[0].text.split("\n")
        tweets.forEach((tweet, i) => {
          const result = lines[i]?.toLowerCase().includes("fail")
          if (result) {
            results[i].failedFilters.push(filter)
          }
        })
      }

      // Convert results to array of indices that passed all filters
      const passedIndices = results
        .map((result, index) => ({ index, result }))
        .filter(({ result }) => result.failedFilters.length === 0)
        .map(({ index }) => index)

      return new Response(JSON.stringify({ passedIndices }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      })
    } catch (error) {
      console.error("Error:", error)
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      })
    }
  }
}
