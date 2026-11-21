(function () {
  'use strict';

  const topics = new Set(['workplace', 'daily', 'social']);
  const actions = {start_game: 'start', submit_choice: 'choice', generate_profile: 'profile'};
  const letters = ['A', 'B', 'C', 'D'];
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const proportion = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const difficulty = value => Number.isInteger(value) && value >= 1 && value <= 5;
  const active = store => store.sessions.find(s => s.id === store.activeId);
  const confirmed = (session, current) => current && session.history.some(row => row.id === current.id);

  function create(store, topic, limit = 8) {
    if (active(store)) throw new Error('请先结束或归档当前测试。');
    if (!topics.has(topic) || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('测试主题或题数无效。');
    }
    const session = {
      id: 'web_' + crypto.randomUUID(), mode: 'make', ruleVersion: 4,
      topic, limit, startedAt: Date.now(), finishedAt: null,
      current: null, history: [], profile: null, requests: [], seenIds: []
    };
    store.sessions.push(session);
    store.activeId = session.id;
    return session;
  }

  // Call only with the same exclusive store lock used for dispatch. A pending
  // receipt can survive a tab closing even after Make has committed its write.
  function recover(store) {
    let changed = false;
    for (const session of store.sessions) {
      if (session.mode !== 'make') continue;
      for (const request of session.requests) {
        if (request.status !== 'pending') continue;
        request.status = 'uncertain';
        request.settledAt = Date.now();
        request.code = 'INTERRUPTED';
        request.message = '页面中断，未收到可核对的回执。可按请求编号核查 Make 执行记录。';
        changed = true;
      }
    }
    return changed;
  }

  function ready(store) {
    const session = active(store);
    if (session?.mode !== 'make' || session.finishedAt !== null || session.interruptedAt != null) {
      throw new Error('此测试当前无法发送请求。');
    }
    if (session.requests.some(r => r.status === 'pending')) {
      throw new Error('上一条请求仍在等待 Make 回执。');
    }
    if (session.requests.some(r => r.status === 'uncertain' && r.intent !== 'start_game')) {
      throw new Error('提交或画像的写入状态待核实。请按请求编号检查 Make 执行记录。');
    }
    return session;
  }

  function closeFailed(store) {
    const session = active(store);
    if (session?.mode !== 'make' || session.finishedAt !== null ||
        session.requests.some(r => r.status === 'pending') ||
        !['uncertain', 'error'].includes(session.requests.at(-1)?.status)) return false;
    session.interruptedAt = Date.now();
    store.activeId = null;
    return true;
  }

  function verifyQuestion(data) {
    return data && text(data.scenario_id) && text(data.question) && difficulty(data.difficulty) &&
      Array.isArray(data.options) && data.options.length === 4 && data.options.every(text);
  }

  function verifyScore(data, choice) {
    if (!data || !letters.includes(data.predicted_choice) || !proportion(data.confidence)) return false;
    const correct = data.predicted_choice === choice;
    return data.is_correct === correct && data.ai_score === (correct ? 5 : 0) &&
      data.user_score === (correct ? 0 : 5);
  }

  function verifyProfile(data, rounds) {
    return data && text(data.personality_type) && text(data.summary) && Array.isArray(data.traits) &&
      data.traits.length === 3 && data.traits.every(t => t && text(t.name) && proportion(t.score)) &&
      Number.isInteger(data.evidence_rounds) && data.evidence_rounds > 0 && data.evidence_rounds <= rounds &&
      ['low', 'medium', 'high'].includes(data.confidence_level);
  }

  function failure(code, message, certain = false) {
    const error = new Error(message);
    error.code = code;
    error.status = certain ? 'error' : 'uncertain';
    return error;
  }

  // persist must throw on storage failure. The caller holds its store lock
  // through this promise so a second tab cannot declare an in-flight request lost.
  async function dispatch(store, session, intent, round, fields, persist, verify, accept, recoveryOf) {
    if (typeof persist !== 'function') throw new Error('请求需要可持久保存的测试记录。');
    const id = [session.id, actions[intent], round, crypto.randomUUID()].join('_');
    const body = {intent, user_id: session.id, request_id: id, ...fields};
    const attempt = {id, intent, round, at: Date.now(), status: 'pending'};
    if (intent === 'generate_profile') attempt.force_refresh = fields.force_refresh;
    if (recoveryOf) attempt.recoveryOf = recoveryOf;
    if (fields.choice) {
      attempt.choice = fields.choice;
      attempt.scenario_id = fields.scenario_id;
      attempt.decision_ms = fields.decision_ms;
    }
    session.requests.push(attempt);
    try {
      await persist(store);
    } catch {
      session.requests.pop();
      throw new Error('无法保存请求记录，本次请求尚未发出。');
    }

    let result;
    let problem;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 195000);
    try {
      const response = await fetch('/api/make', {
        method: 'POST', mode: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: controller.signal
      });
      attempt.httpStatus = response.status;
      const executionId = response.headers.get('X-Make-Execution-Id');
      if (executionId) attempt.executionId = executionId;
      const receipt = await response.json();
      if (!receipt || receipt.intent !== intent || receipt.request_id !== id) {
        throw failure('RECEIPT_MISMATCH', '回执中的动作或请求编号不符，请核查 Make 执行记录。');
      }
      if (text(receipt.server_ts)) attempt.serverTs = receipt.server_ts;
      if (receipt.ok === false && text(receipt.error?.code)) {
        const {code, message, uncertain} = receipt.error;
        if (code === 'E_DUPLICATE_ROUND') {
          throw failure(code, 'Make 提示本轮已有提交。请核对原提交和计分记录。');
        }
        throw failure(code, text(message) ? message : 'Make 返回了错误回执。', uncertain === false);
      }
      if (response.status !== 200 || receipt.ok !== true || !verify(receipt.data)) {
        throw failure('INVALID_RECEIPT', '回执数据不完整或计分不一致，请核查 Make 执行记录。');
      }
      result = accept(receipt.data, attempt);
      attempt.status = 'success';
    } catch (error) {
      problem = error.status === 'error' || error.status === 'uncertain' ? error :
        failure('RECEIPT_UNAVAILABLE', '未收到有效回执。请按请求编号核查 Make 执行记录。');
      attempt.status = problem.status;
      attempt.code = problem.code;
      attempt.message = problem.message;
    } finally {
      clearTimeout(timer);
    }
    attempt.settledAt = Date.now();
    try {
      await persist(store);
    } catch {
      throw new Error('请求已发出，但回执无法保存到本机。请保留页面，按请求编号核实后再继续。');
    }
    if (problem) throw problem;
    return result;
  }

  async function begin(store, persist) {
    const session = ready(store);
    const round = session.history.length + 1;
    if (round > session.limit) throw new Error('已完成计划题数，可以生成画像。');
    if (session.current && !confirmed(session, session.current)) throw new Error('请先完成当前题目。');
    const fields = {round_no: round, scenario_topic: session.topic, difficulty_level: 2};
    return dispatch(store, session, 'start_game', round, fields, persist, verifyQuestion, (data, attempt) => {
      const question = {
        scenario_id: data.scenario_id, topic: session.topic, difficulty: data.difficulty,
        question: data.question, options: data.options.slice()
      };
      session.current = {id: attempt.id, round, question, choice: null, started: Date.now()};
      session.seenIds.push(question.scenario_id);
      attempt.scenario_id = question.scenario_id;
      return session.current;
    });
  }

  async function submit(store, choice, persist) {
    const session = ready(store);
    const current = session.current;
    if (!current || confirmed(session, current) || current.round !== session.history.length + 1 ||
        current.round > session.limit || !letters.includes(choice)) throw new Error('本轮当前无法提交此选项。');
    const q = current.question;
    const decisionMs = Math.max(0, Date.now() - current.started);
    const fields = {
      round_no: current.round, scenario_id: q.scenario_id, question: q.question,
      options: q.options.slice(), choice, decision_ms: decisionMs, difficulty_level: q.difficulty
    };
    return dispatch(store, session, 'submit_choice', current.round, fields, persist,
      data => verifyScore(data, choice), (data, attempt) => {
        current.choice = choice;
        const row = {
          id: current.id, requestId: attempt.id, round: current.round, question: q, choice,
          result: data, finished: Date.now(), decision_ms: decisionMs
        };
        session.history.push(row);
        return row;
      });
  }

  function requestProfile(store, session, persist, recoveryOf) {
    const round = session.history.length;
    if (!round) throw new Error('请先成功提交至少一题。');
    return dispatch(store, session, 'generate_profile', round, {force_refresh: false}, persist,
      data => verifyProfile(data, round), data => {
        session.profile = data;
        session.finishedAt = Date.now();
        if (session.current && !confirmed(session, session.current)) session.unanswered = session.current;
        session.current = null;
        return data;
      }, recoveryOf);
  }

  async function finish(store, persist) {
    return requestProfile(store, ready(store), persist);
  }

  function canRecoverProfile(session) {
    if (session?.mode !== 'make' || session.finishedAt !== null || session.interruptedAt != null ||
        session.profile || !session.history?.length || !Array.isArray(session.requests)) return false;
    const last = session.requests.at(-1);
    if (last?.intent !== 'generate_profile' || !text(last.id) || last.round !== session.history.length ||
        !(last.status === 'uncertain' || (last.status === 'error' && text(last.recoveryOf)))) return false;
    return !session.requests.some(r => r.status === 'pending' ||
      (r.status === 'uncertain' && r.intent === 'submit_choice'));
  }

  async function recoverProfile(store, confirmation, persist) {
    const session = active(store);
    if (!canRecoverProfile(session) || confirmation?.executionEnded !== true ||
        confirmation.verifiedRequestId !== session.requests.at(-1).id) {
      throw new Error('请先到 Make 核实本局上一笔画像执行已结束，再按该请求编号重取画像。');
    }
    return requestProfile(store, session, persist, confirmation.verifiedRequestId);
  }

  window.MindMake = Object.freeze({create, begin, submit, finish, recover, closeFailed,
    canRecoverProfile, recoverProfile});
})();
