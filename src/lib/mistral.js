const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'

/**
 * Thin wrapper around the Mistral chat completions endpoint.
 * Always returns the raw text content of the first choice.
 * Set json: true to request JSON mode (response_format: json_object).
 */
export async function callMistral({
  messages,
  model = 'mistral-large-latest',
  temperature = 0.4,
  json = true,
  retries = 2,
}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1500))
    try {
      const res = await fetch(MISTRAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
          messages,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Mistral ${res.status}: ${body}`)
      }

      const data = await res.json()
      return data.choices[0].message.content
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}
