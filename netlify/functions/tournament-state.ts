import type { Handler } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

const tournamentStore = getStore('tournament-state')
const tournamentStateKey = 'current'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const state = await tournamentStore.get(tournamentStateKey, { type: 'json' })

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(state ?? null),
    }
  }

  if (event.httpMethod === 'POST') {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Missing request body' }),
      }
    }

    try {
      const nextState = JSON.parse(event.body)
      await tournamentStore.setJSON(tournamentStateKey, nextState)

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true }),
      }
    } catch {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Invalid JSON payload' }),
      }
    }
  }

  return {
    statusCode: 405,
    headers: jsonHeaders,
    body: JSON.stringify({ error: 'Method not allowed' }),
  }
}
