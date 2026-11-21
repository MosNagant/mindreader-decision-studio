import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
const manifestPath = resolve(projectRoot, "dist/.openai/hosting.json");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
JSON.parse(manifest);

// A data URL forces ESM parsing even though the generated output has no package.json.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const workerModule = await import(moduleUrl);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${pathToFileURL(workerPath)} must export default.fetch`,
);

console.log("Artifact is valid ESM and exports default.fetch");

const worker = workerModule.default;
const origin = 'https://mindreader.example';
const mockBinding = 'worker_test_token_only';
const env = {MAKE_ENTRY_WEBHOOK: 'https://hook.invalid-test.make.com/' + mockBinding};
const user = 'web_51ebb54f-2704-41aa-b729-cee08eb97862';
const nonce = '8947e45c-ec48-4451-beca-eedd4dadea44';
const start = {intent: 'start_game', user_id: user, request_id: user + '_start_1_' + nonce,
  round_no: 1, difficulty_level: 2, scenario_topic: 'daily'};
const question = {scenario_id: 'test_1', question: '测试题', options: ['甲', '乙', '丙', '丁'], difficulty: 2};
const submit = {intent: 'submit_choice', user_id: user, request_id: user + '_choice_1_' + nonce,
  round_no: 1, scenario_id: question.scenario_id, question: question.question, options: question.options,
  choice: 'A', decision_ms: 27, difficulty_level: 2};
const profile = {intent: 'generate_profile', user_id: user, request_id: user + '_profile_1_' + nonce, force_refresh: true};
const score = {ai_score: 5, user_score: 0, confidence: 0.75, predicted_choice: 'A', is_correct: true};
const traits = {traits: [{name: '倾听', score: 0.75}], summary: '测试画像', personality_type: '测试',
  confidence_level: '中', evidence_rounds: 1};
const makeReceipt = (body, data) => ({ok: true, data, intent: body.intent, request_id: body.request_id,
  server_ts: '2026-01-01T10:00:00Z', error: null});
const post = (body, overrides, binding = env) => worker.fetch(new Request(origin + '/api/make', {
  method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'same-origin',
    ...overrides}, body: JSON.stringify(body)
}), binding);
let dispatch = () => { throw Error('Unexpected dispatch'); };
let sent = 0;
globalThis.fetch = (url, init) => {
  sent++;
  assert.equal(url, env.MAKE_ENTRY_WEBHOOK);
  assert.equal(init.method, 'POST');
  assert.deepEqual(init.headers, {'Content-Type': 'application/json'});
  assert.equal(init.redirect, 'manual');
  return dispatch(JSON.parse(init.body));
};

assert.equal((await post(start, {Origin: 'https://elsewhere.example'})).status, 403);
assert.equal((await post(start, {'Sec-Fetch-Site': 'cross-site'})).status, 403);
assert.equal((await post(start, {'Content-Type': 'text/plain'})).status, 415);
assert.equal((await post({...start, intent: {toString: null}})).status, 400);
assert.equal((await post({...start, endpoint: 'https://elsewhere.example'})).status, 400);
assert.equal((await post({...start, request_id: start.request_id.replace('_start_', '_choice_')})).status, 400);
assert.equal((await post({...submit, round_no: 3})).status, 400);
assert.equal((await post({...submit, choice: 'Z'})).status, 400);
assert.equal((await post({...submit, question: 'X'.repeat(99000)})).status, 400);
assert.equal((await post(start, {}, {})).status, 503);
assert.equal(sent, 0, 'Local rejections must not trigger an upstream call');

const scenarioExecutionId = '0123456789abcdef0123456789abcdef';
const scenarioHeaders = {'x-make-scenario-execution-id': scenarioExecutionId};
for (const [request, data] of [[start, question], [submit, score], [profile, traits]]) {
  const receipt = makeReceipt(request, data);
  const headers = {'X-Make-Execution-Id': 'legacy_id_from_mock'};
  if (request !== profile) Object.assign(headers, scenarioHeaders);
  dispatch = outgoing => {
    assert.deepEqual(outgoing, request);
    return Response.json(receipt, {headers});
  };
  const response = await post(request);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Make-Execution-Id'), request === profile ? 'legacy_id_from_mock' : scenarioExecutionId);
  assert.deepEqual(await response.json(), receipt);
}

const duplicate = {...makeReceipt(submit, null), ok: false,
  error: {code: 'E_DUPLICATE_ROUND', message: 'backend detail must stay private'}};
dispatch = () => Response.json(duplicate, {status: 409});
const rejected = await post(submit);
assert.equal(rejected.status, 409);
const received = await rejected.json();
assert.equal(received.error.code, 'E_DUPLICATE_ROUND');
assert.equal(received.error.uncertain, false);
assert.equal(JSON.stringify(received).includes('backend detail'), false);

const badResponses = [
  [() => new Response('Accepted', {status: 200, headers: scenarioHeaders}), scenarioExecutionId],
  [() => new Response('Accepted', {headers: {'x-make-scenario-execution-id': 'invalid id'}}), null],
  [() => new Response('Accepted', {headers: {'X-Make-Execution-Id': 'legacy_id_from_mock'}}), 'legacy_id_from_mock'],
  [() => Response.json({...makeReceipt(submit, score), request_id: 'wrong-request'}, {headers: scenarioHeaders}), scenarioExecutionId],
  [() => Response.json({...makeReceipt(submit, score), intent: 'start_game'}), null],
  [() => Response.json(makeReceipt(submit, {message: 'not business data'})), null],
  [() => Response.json(makeReceipt(submit, {...score, internal: mockBinding})), null],
  [() => new Response(null, {status: 302, headers: {Location: 'https://elsewhere.example'}}), null],
  [() => { throw Error('simulated provider failure'); }, null]
];
for (const [bad, expectedId] of badResponses) {
  dispatch = bad;
  const response = await post(submit);
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.request_id, submit.request_id);
  assert.equal(body.error.uncertain, true);
  assert.equal(response.headers.get('X-Make-Execution-Id'), expectedId);
  assert.ok(!JSON.stringify(body).includes(mockBinding));
}
assert.equal(sent, 3 + 1 + badResponses.length, 'Exactly one upstream call per dispatch');

const homepage = await worker.fetch(new Request(origin), env);
assert.equal(homepage.status, 200);
assert.match(homepage.headers.get('Content-Type'), /^text\/html/);
assert.equal(await homepage.text(), await readFile(resolve(projectRoot, 'dist/index.html'), 'utf8'));
const icon = await worker.fetch(new Request(origin + '/assets/mark.png?v=1'), env);
assert.equal(icon.headers.get('Content-Type'), 'image/png');
assert.deepEqual(Buffer.from(await icon.arrayBuffer()), await readFile(resolve(projectRoot, 'dist/assets/mark.png')));
assert.equal((await worker.fetch(new Request(origin + '/server/index.js'), env)).status, 404);
assert.equal((await worker.fetch(new Request(origin + '/api/make'), env)).status, 405);
console.log('Passed static asset, request validation, receipt matching, error redaction, and single-dispatch checks.');
