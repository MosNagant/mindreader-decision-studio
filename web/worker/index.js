// Filled by scripts/build.mjs from the same static sources used by the local preview.
const assets = /* EMBED_STATIC_ASSETS */ {};
const secretName = 'MAKE_ENTRY_WEBHOOK';
const topics = new Set(['workplace', 'daily', 'social']);
const verbs = {start_game: 'start', submit_choice: 'choice', generate_profile: 'profile'};
const userIdPattern = /^web_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const options = values => Array.isArray(values) && values.length === 4 && values.every(v => string(v, 4000));
const choice = value => typeof value === 'string' && /^[A-D]$/.test(value);
const makeHost = /^hook(?:\.[a-z0-9-]+)?\.(?:make|integromat)\.com$/i;
const baseKeys = ['intent', 'user_id', 'request_id'];
const allowedKeys = {
  start_game: new Set([...baseKeys, 'round_no', 'scenario_topic', 'difficulty_level']),
  submit_choice: new Set([...baseKeys, 'round_no', 'scenario_id', 'question', 'options', 'choice', 'decision_ms', 'difficulty_level']),
  generate_profile: new Set([...baseKeys, 'force_refresh'])
};

function traceRound(body) {
  if (!object(body) || typeof body.intent !== 'string' || !Object.hasOwn(verbs, body.intent) ||
      !string(body.user_id, 40) || !userIdPattern.test(body.user_id) ||
      !string(body.request_id, 144)) return null;
  const prefix = body.user_id + '_' + verbs[body.intent] + '_';
  if (!body.request_id.startsWith(prefix)) return null;
  const suffix = /^(0|[1-9][0-9]{0,3})_[a-zA-Z0-9-]{1,80}$/.exec(body.request_id.slice(prefix.length));
  return suffix && Number(suffix[1]) <= 1000 ? Number(suffix[1]) : null;
}

function validRequest(body, round) {
  if (!Object.keys(body).every(k => allowedKeys[body.intent].has(k))) return false;
  if (body.intent === 'generate_profile') {
    return body.force_refresh === undefined || typeof body.force_refresh === 'boolean';
  }
  if (!integer(body.round_no, 1, 1000) || body.round_no !== round ||
      (body.difficulty_level !== undefined && !integer(body.difficulty_level, 1, 5))) return false;
  if (body.intent === 'start_game') return body.scenario_topic === undefined || topics.has(body.scenario_topic);
  return string(body.scenario_id, 256) && string(body.question, 8000) && options(body.options) &&
    choice(body.choice) && integer(body.decision_ms, 0, Number.MAX_SAFE_INTEGER);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }});
}

function failure(status, code, message, uncertain, request) {
  const body = {ok: false, data: null, error: {code, message, uncertain}};
  if (request) { body.intent = request.intent; body.request_id = request.request_id; }
  return json(body, status);
}

async function readJson(message, maxBytes) {
  if (Number(message.headers.get('content-length')) > maxBytes || !message.body) throw new Error('size');
  const reader = message.body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let text = '';
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('size'); }
      text += decoder.decode(part.value, {stream: true});
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

function configuredWebhook(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && makeHost.test(url.hostname) && !url.port &&
        !url.username && !url.password && !url.search && !url.hash && /^\/[\w-]+$/.test(url.pathname)) return url;
  } catch { /* Treat a missing or invalid binding as a configuration error. */ }
  return null;
}

function validData(intent, data) {
  if (!object(data)) return false;
  switch (intent) {
    case 'start_game':
      return string(data.scenario_id, 256) && string(data.question, 8000) && options(data.options) &&
        integer(data.difficulty, 1, 5);
    case 'submit_choice':
      return Number.isFinite(data.ai_score) && Number.isFinite(data.user_score) &&
        typeof data.is_correct === 'boolean' && choice(data.predicted_choice) && Number.isFinite(data.confidence);
    case 'generate_profile':
      return string(data.summary, 16000) && string(data.personality_type, 1000) &&
        string(data.confidence_level, 256) && integer(data.evidence_rounds, 0, Number.MAX_SAFE_INTEGER) &&
        Array.isArray(data.traits) && data.traits.length <= 100 && data.traits.every(trait =>
          object(trait) && string(trait.name, 1000) && Number.isFinite(trait.score));
    default: return false;
  }
}

// Keep generated business fields, including a provider's optional fields, but
// withhold any receipt containing provider internals or the configured hook.
function containsPrivateData(value, hookToken, depth = 0) {
  if (depth > 12) return true;
  if (typeof value === 'string') {
    return value.includes(hookToken) || /https?:\/\/hook(?:\.[\w-]+)?\.(?:make|integromat)\.com\b|\bBearer\s+[\w.=-]+/i.test(value);
  }
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) =>
    /(?:authorization|password|credential|webhook|api[_-]?key|access[_-]?token|secret|stacktrace)/i.test(key) ||
    containsPrivateData(entry, hookToken, depth + 1));
}

function receiptResponse(upstream, receipt, body, hook) {
  const uncertain = () => failure(502, 'E_UNCONFIRMED', 'Make 没有返回与本次请求匹配的业务回执，执行结果待核实。', true, body);
  if (!object(receipt) || receipt.intent !== body.intent || receipt.request_id !== body.request_id ||
      typeof receipt.ok !== 'boolean' || !string(receipt.server_ts, 64) ||
      !Number.isFinite(Date.parse(receipt.server_ts))) return uncertain();
  const fail = receipt.ok === false;
  if (upstream.status >= 300 && upstream.status < 400) return uncertain();
  if (fail) {
    if (!object(receipt.error) || typeof receipt.error.code !== 'string' ||
        !/^E_[A-Z0-9_]{1,60}$/.test(receipt.error.code)) return uncertain();
  } else if (!upstream.ok || receipt.error !== null || !validData(body.intent, receipt.data)) {
    return uncertain();
  }
  const error = fail ? {
    code: receipt.error.code,
    message: receipt.error.code === 'E_DUPLICATE_ROUND' ? 'Make 报告该轮已有记录。' :
      receipt.error.code === 'E_NO_ROUTE' ? 'Make 未匹配到请求的业务操作。' : 'Make 返回了业务错误。',
    uncertain: upstream.status >= 500
  } : null;
  const result = {ok: receipt.ok, intent: body.intent, request_id: body.request_id,
    server_ts: receipt.server_ts, data: fail ? null : receipt.data, error};
  const token = hook.pathname.slice(1);
  if (containsPrivateData(result.data, token) || result.server_ts.includes(token) || error?.code.includes(token)) return uncertain();
  return json(result, upstream.status);
}

function executionIdFrom(headers, hook) {
  const token = hook.pathname.slice(1);
  const scenario = headers.get('X-Make-Scenario-Execution-Id');
  if (scenario && /^[a-f0-9]{32}$/i.test(scenario) && !scenario.includes(token)) return scenario;
  const legacy = headers.get('X-Make-Execution-Id');
  if (legacy && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(legacy) && !legacy.includes(token)) return legacy;
  return null;
}

async function makeRequest(request, env) {
  if (request.method !== 'POST') return failure(405, 'E_METHOD', '此接口仅接受 POST。', false);
  const origin = new URL(request.url).origin;
  const site = request.headers.get('Sec-Fetch-Site');
  if (request.headers.get('Origin') !== origin || (site && site !== 'same-origin')) {
    return failure(403, 'E_ORIGIN', '请在此站点内发起请求。', false);
  }
  if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return failure(415, 'E_CONTENT_TYPE', '请求需要使用 JSON。', false);
  }
  let body;
  try { body = await readJson(request, 96 * 1024); }
  catch { return failure(400, 'E_INPUT', '请求过长或不是有效的 JSON。', false); }
  const round = traceRound(body);
  if (round === null) return failure(400, 'E_INPUT', '请求追踪编号或业务操作无效。', false);
  if (!validRequest(body, round)) return failure(400, 'E_INPUT', '业务请求字段无效。', false, body);
  const hook = configuredWebhook(env?.[secretName]);
  if (!hook) return failure(503, 'E_CONFIGURATION', '站点尚未配置有效的 Make 连接。', false, body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  let executionId;
  let response;
  try {
    const upstream = await fetch(hook.href, {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body), redirect: 'manual', signal: controller.signal});
    executionId = executionIdFrom(upstream.headers, hook);
    const receipt = await readJson(upstream, 192 * 1024);
    response = receiptResponse(upstream, receipt, body, hook);
  } catch {
    response = failure(502, 'E_UNCONFIRMED', '没有收到可核验的 Make 业务回执，执行结果待核实。', true, body);
  } finally { clearTimeout(timeout); }
  if (executionId) response.headers.set('X-Make-Execution-Id', executionId);
  return response;
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/make') return makeRequest(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, {status: 405, headers: {Allow: 'GET, HEAD'}});
    const key = path === '/' ? '/index.html' : path;
    if (!Object.hasOwn(assets, key)) return new Response(null, {status: 404});
    const [type, encoded] = assets[key];
    const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    return new Response(body, {headers: {'Content-Type': type, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff'}});
  }
};
