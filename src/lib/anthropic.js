import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Thin wrapper around the Anthropic messages endpoint.
 * Always returns the raw text content of the first content block.
 */
export async function callClaude({
  messages,
  model = 'claude-haiku-4-5-20251001',
  temperature = 0,
  maxTokens = 2048,
}) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages,
  })
  return response.content[0].text
}
