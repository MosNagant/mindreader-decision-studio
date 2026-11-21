(function () {
  'use strict';

  const topics = new Set(['workplace', 'daily', 'social']);
  const newStore = () => ({version: 2, sessions: [], activeId: null});
  const uid = () => globalThis.crypto?.randomUUID?.() ||
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const validChoice = value => typeof value === 'string' && /^[A-D]$/.test(value);
  const validQuestion = q => q && typeof q.scenario_id === 'string' &&
    typeof q.question === 'string' && topics.has(q.topic) &&
    Array.isArray(q.options) && q.options.length === 4;
  const validRow = row => row && validQuestion(row.question) && validChoice(row.choice) &&
    row.result && Number.isFinite(row.result.ai_score) && Number.isFinite(row.result.user_score);

  function decode(data) {
    if (typeof data !== 'string') return data;
    try { return JSON.parse(data); } catch { return null; }
  }

  function active(store) {
    return store.sessions.find(s => s.id === store.activeId) || null;
  }

  function shownQuestions(s) {
    if (Array.isArray(s.seenIds)) return s.seenIds;
    const ids = s.history.map(r => r.question.scenario_id);
    if (s.current && !s.history.some(r => r.id === s.current.id)) ids.push(s.current.question.scenario_id);
    return ids;
  }

  function loadFrom(dataV2, legacyV1) {
    const saved = decode(dataV2);
    if (saved?.version === 2 && Array.isArray(saved.sessions) &&
        saved.sessions.every(s => s && typeof s.id === 'string' && topics.has(s.topic) &&
          Number.isInteger(s.limit) && s.limit > 0 && Array.isArray(s.history) &&
          s.history.every(validRow) && (!s.current || validQuestion(s.current.question)))) {
      for (const s of saved.sessions) s.seenIds = shownQuestions(s);
      if (!active(saved)) saved.activeId = null;
      return saved;
    }

    const old = decode(legacyV1);
    const store = newStore();
    if (!old || !Array.isArray(old.history) || !topics.has(old.topic)) return store;
    const history = old.history.filter(validRow);
    const current = validQuestion(old.current?.question) ? old.current : null;
    const pending = current && !history.some(row => row.id === current.id);
    const hasChoice = pending && validChoice(current.choice);
    if (!history.length && !hasChoice) return store;

    const matchedProfile = old.profile && Array.isArray(old.profile.traits) &&
      old.profile.evidence_rounds === history.length && history.length > 0;
    const complete = Boolean(matchedProfile && !pending);
    const last = history[history.length - 1];
    const first = history[0];
    const started = Number.isFinite(first?.finished) ? first.finished - (first.decision_ms || 0) :
      current?.started || 0;
    const id = 'legacy-' + (first?.id || current?.id || 'v1');
    const session = {
      id, topic: old.topic,
      limit: Math.max(3, history.length + (pending && !complete ? 1 : 0)),
      startedAt: Math.max(0, started),
      finishedAt: complete ? last.finished ?? started : null,
      history, current: complete ? null : current || (last ? {
        id: last.id, question: last.question, choice: last.choice,
        started: last.finished - (last.decision_ms || 0)
      } : null),
      profile: old.profile && Array.isArray(old.profile.traits) ? old.profile : null
    };
    if (!complete && session.profile) session.legacyProfile = session.profile;
    session.seenIds = shownQuestions(session);
    store.sessions.push(session);
    store.activeId = id;
    return store;
  }

  function openQuestion(store, session) {
    const seen = store.sessions.flatMap(shownQuestions);
    const q = window.MindEngine.begin(session.topic, seen, session.seenIds);
    const current = {id: uid(), question: q, choice: null, started: Date.now()};
    if (session.ruleVersion === 3) {
      current.forecast = window.MindEngine.forecast(q, session.history);
    }
    session.seenIds.push(q.scenario_id);
    return current;
  }

  function start(store, topic, limit = 8) {
    if (active(store) || !topics.has(topic) || !Number.isSafeInteger(limit) || limit < 1) return null;
    const session = {
      id: uid(), ruleVersion: 3, topic, limit, startedAt: Date.now(), finishedAt: null,
      history: [], current: null, profile: null, seenIds: []
    };
    session.current = openQuestion(store, session);
    store.sessions.push(session);
    store.activeId = session.id;
    return session;
  }

  function submit(store, choice) {
    const s = active(store);
    if (!s || s.finishedAt !== null || !s.current || !validChoice(choice) || s.history.length >= s.limit ||
        s.history.some(row => row.id === s.current.id)) return null;
    const c = s.current;
    const result = s.ruleVersion === 3
      ? window.MindEngine.gradeForecast(c.forecast, choice)
      : window.MindEngine.score(c.question, choice, s.history);
    const finished = Date.now();
    const row = {id: c.id, question: c.question, choice, result, finished,
      decision_ms: Math.max(0, finished - c.started)};
    if (s.ruleVersion === 3) row.forecast = c.forecast;
    c.choice = choice;
    s.history.push(row);
    return row;
  }

  function next(store) {
    const s = active(store);
    if (!s || s.finishedAt !== null || !s.current || s.history.length >= s.limit ||
        !s.history.some(row => row.id === s.current.id)) return null;
    s.current = openQuestion(store, s);
    return s;
  }

  function finish(store) {
    const s = active(store);
    if (!s || s.finishedAt !== null || !s.history.length) return null;
    s.profile = s.ruleVersion === 3
      ? window.MindEngine.profile(s.history, {ruleVersion: 3})
      : window.MindEngine.profile(s.history);
    s.finishedAt = Date.now();
    s.current = null;
    return s;
  }

  function prepareRestart(store) {
    const s = active(store);
    if (!s || s.finishedAt === null) return false;
    store.activeId = null;
    return true;
  }

  window.MindSessions = Object.freeze({newStore, loadFrom, active, start, submit, next, finish, prepareRestart});
})();
