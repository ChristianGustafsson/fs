/**
 * Netlify Function: /api/tts
 *
 * Requires env var: OPENAI_API_KEY
 * Optional: OPENAI_TTS_VOICE (defaults to marin)
 *
 * Uses OpenAI Audio API (text-to-speech) to generate MP3 audio.
 */

function headers(extra = {}) {
  return {
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    ...extra,
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: headers({ 'content-type': 'application/json; charset=utf-8' }),
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers(), body: '' };
  }

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return json(200, { ok: false, error: 'OPENAI_API_KEY not set' });

    const payload = JSON.parse(event.body || '{}');
    const text = String(payload.text || '').trim();
    const voice = String(payload.voice || process.env.OPENAI_TTS_VOICE || 'marin').trim();
    const instructions = String(payload.instructions || 'Speak like a confident Nordic business presenter.').trim();

    if (!text) return json(200, { ok: false, error: 'Missing text' });

    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: (process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'),
        voice,
        input: text,
        instructions,
      }),
    });

    if (!resp.ok) {
      let err;
      try { err = await resp.json(); } catch (_) { err = { error: { message: 'TTS failed' } }; }
      return json(resp.status, { ok: false, error: err?.error?.message || 'TTS failed' });
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers: headers({
        'content-type': 'audio/mpeg',
      }),
      isBase64Encoded: true,
      body: buffer.toString('base64'),
    };
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
};
