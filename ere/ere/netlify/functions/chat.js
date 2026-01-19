/**
 * Netlify Function: /api/chat
 *
 * Requires env var: OPENAI_API_KEY
 * Optional: OPENAI_MODEL (defaults to gpt-4o-mini)
 */

const fs = require('fs');
const path = require('path');

function readDeckFacts() {
  const candidates = [
    path.join(process.cwd(), 'data', 'deck_facts.json'),
    path.join(__dirname, '..', '..', 'data', 'deck_facts.json'),
    path.join(__dirname, 'data', 'deck_facts.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const obj = JSON.parse(raw);
        return Array.isArray(obj.slides) ? obj.slides : [];
      }
    } catch (_) {}
  }
  return [];
}

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u017F]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 3 && t.length <= 32);
}

function topSlides(slides, question, n = 4) {
  const q = tokenize(question);
  const qset = new Set(q);
  const scored = slides.map(sl => {
    const text = `${sl.name || ''} ${sl.key || ''} ${sl.script || ''} ${sl.text || ''}`;
    const t = tokenize(text);
    let score = 0;
    for (const tok of t) if (qset.has(tok)) score += 1;
    // small boost if key is mentioned
    if ((question || '').toLowerCase().includes((sl.key || '').toLowerCase())) score += 5;
    return { sl, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map(x => x.sl);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return json(200, { ok: false, error: 'OPENAI_API_KEY not set' });
    }

    const payload = JSON.parse(event.body || '{}');
    const message = String(payload.message || '').trim();
    const currentSlideKey = String(payload.currentSlideKey || '').trim();
    const currentSlideName = String(payload.currentSlideName || '').trim();

    if (!message) return json(200, { ok: false, error: 'Missing message' });

    const slides = readDeckFacts();
    const picked = topSlides(slides, message, 5);

    const contextBlock = picked
      .map(s => {
        const excerpt = (s.text || '').slice(0, 2200);
        const script = (s.script || '').slice(0, 800);
        return `SLIDE ${s.key} — ${s.name}\nKey script: ${script}\nContent excerpt: ${excerpt}`;
      })
      .join('\n\n---\n\n');

    const instructions = [
      'You are the LIVE strategy guide for “GBFoods Nordics — Path to 100 M€” (Jan 2026 deck).',
      'Answer as a confident, pragmatic business presenter.',
      'Hard rule: use ONLY the information in the provided slide context. If a detail is not in context, say so and suggest where it should be added in the deck.',
      'When quoting numbers or ranges, keep exactly as in the deck.',
      'When relevant, end with: “Source slides: <comma-separated slide keys>”.',
      '',
      `Current slide on screen: ${currentSlideKey || '—'} ${currentSlideName ? '(' + currentSlideName + ')' : ''}`,
      '',
      'DECK CONTEXT (selected relevant slides):',
      contextBlock || '(No context available)',
    ].join('\n');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input: message,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json(resp.status, { ok: false, error: data?.error?.message || 'OpenAI request failed', raw: data });
    }

    const answer = data.output_text || '';
    return json(200, { ok: true, answer });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
};
