(() => {
  'use strict';
  const paths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    history:'<path d="M3 11a9 9 0 1 1 2.4 7M3 4v7h7M12 7v5l3 2"/>',
    finger:'<path d="M4 12a8 8 0 0 1 16 0c0 2.5-.2 4.8-1.1 7M2 11a10 10 0 0 1 19-3M6.2 19c1.2-2.3 1-4.3 1-7a4.8 4.8 0 0 1 9.6 0c0 4.5-.2 6.6-1.6 10M4 15c0 1.2-.1 2.2-.5 3.4M9 21c1-2.7 1.3-5.4 1.3-9a1.7 1.7 0 0 1 3.4 0c0 3.6-.1 6.8-1.3 10"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.3 9a2.8 2.8 0 0 1 5.4.8c0 2-2.7 2.1-2.7 4M12 17h.01"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    trophy:'<path d="M8 4h8v5c0 4-2 6-4 6s-4-2-4-6V4ZM8 6H4v2c0 2 2 4 4 4m8-6h4v2c0 2-2 4-4 4m-4 3v4m-4 1h8"/>',
    user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>',
    bot:'<rect x="3.5" y="7.5" width="17" height="13" rx="3"/><path d="M12 4v3.5M8 13h.01m8 0h.01M9.5 17h5M1 12v4m22-4v4"/><circle cx="12" cy="3.5" r="1"/>',
    brief:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5c0-1 1-2 2-2h4c1 0 2 1 2 2v2M3 12c5 3 13 3 18 0m-9 0v3"/>',
    home:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',social:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>', spark:'<path d="m12 3 1.9 5.6L19 11l-5.1 2.2L12 19l-2-5.8L5 11l5-2.4L12 3Zm7 12 .7 2 2 .8-2 .8-.7 2-.7-2-2-.8 2-.8.7-2Z"/>',
    device:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>', orbit:'<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(45 12 12)"/>',
    key:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 10h.1m3 0h.1m3 0h.1m3 0h.1m3 0h.1M7 14h10"/>',
    reveal:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.6"/>',
    refresh:'<path d="M20 9A8 8 0 0 0 6 6L3 9m0-5v5h5m-4 6a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
  };
  const icon = n => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[n]||'')+'</svg>';
  document.querySelectorAll('[data-icon]').forEach(el=>el.outerHTML=icon(el.dataset.icon));
  const topics = {
    workplace: ['职场协作', 'brief', '项目、分工与团队沟通'],
    daily: ['日常生活', 'home', '计划、取舍与临时变化'],
    social: ['人际社交', 'social', '朋友、关系与分歧']
  };
  const titles = {
    play: ['DECISION LAB', '决策实验台', '选择一个情境，查看 Make 返回的预测、比分和决策画像。'],
    history: ['TEST HISTORY', '对局记录', '按测试回看答案、比分和决策画像。'],
    profile: ['DECISION PROFILE', '决策画像', '查看本次选择呈现出的决策倾向。']
  };
  const main = document.querySelector('main');
  const help = document.querySelector('#help');
  const notice = document.querySelector('#notice');
  const sessions = window.MindSessions;
  const make = window.MindMake;
  const configuredHistory = document.querySelector('meta[name="make-history-url"]')?.content.trim() || '';
  const makeHistory = /^https:\/\/(?:[a-z0-9-]+\.)*make\.com\/\d+\/scenarios\/\d+\/logs\/?$/i.test(configuredHistory)
    ? configuredHistory.replace(/\/$/, '') : '';
  const live = s => s?.mode === 'make';
  const source = s => live(s) ? 'Make 工作流' : '旧版本地模拟';
  const requests = s => s?.requests || [];
  const pending = s => requests(s).some(r => r.status === 'pending');
  const unresolved = s => requests(s).some(r => r.status === 'uncertain' && r.intent !== 'start_game');
  const blocked = s => live(s) && (pending(s) || unresolved(s));
  const intents = {start_game:'获取题目', submit_choice:'提交并计分', generate_profile:'生成画像'};
  const statuses = {pending:'等待响应', success:'已确认', error:'已拒绝', uncertain:'结果待核实'};
  const key = 'mindreader.lab.v2';
  const letters = 'ABCD';
  function optionText(value, letter) {
    const text = String(value ?? '').trim();
    const prefix = /^\s*(?:\(([A-D])\)|（([A-D])）|([A-D])[.．:：、)）])\s*/i.exec(text);
    return prefix && (prefix[1] || prefix[2] || prefix[3]).toUpperCase() === letter
      ? text.slice(prefix[0].length) || text : text;
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = n => String(n).padStart(2, '0');
  const pct = n => Math.round(n * 100) + '%';
  const date = n => new Date(n).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
  const optionName = q => topics[q.topic]?.[0] || '综合情境';
  const currentRow = s => s?.current && s.history.find(r => r.id === s.current.id);
  const reportLink = s => '#profile/' + encodeURIComponent(s.id);
  const done = s => s?.finishedAt != null;
  const lengths = new Map([[5, '快速'], [8, '标准'], [12, '深入']]);
  let storageFailed = false, selectedTopic = 'workplace', selectedLimit = 8, actionMessage = '';
  let state = sessions.newStore();
  function readJSON(k) {
    try {return JSON.parse(localStorage.getItem(k));} catch {return null;}
  }
  function save() {
    try {localStorage.setItem(key, JSON.stringify(state)); storageFailed = false;}
    catch {storageFailed = true;}
  }
  const existing = readJSON(key), legacy = existing ? null : readJSON('mindreader.lab.v1');
  state = sessions.loadFrom(existing, legacy);
  if (!existing && legacy) save();
  function route() {
    const [name, id] = location.hash.slice(1).split('/');
    return {tab: Object.hasOwn(titles, name) ? name : 'play', id};
  }
  function go(hash, focus='') {
    if (location.hash !== hash) location.hash = hash;
    render();
    const target = focus && main.querySelector(focus);
    if (target) target.focus({preventScroll:true});
  }
  function totals(s) {
    const summary = {user:0, ai:0, hits:0, calls:0, observed:0, skipped:0};
    for (const {result} of s.history) {
      summary.user += result.user_score;
      summary.ai += result.ai_score;
      if (result.kind === 'observation') summary.observed++;
      else if (result.kind === 'abstain') summary.skipped++;
      else {
        summary.calls++;
        if (result.is_correct) summary.hits++;
      }
    }
    return summary;
  }
  function hero(tab, completed, viewed) {
    const [label,title,sub] = titles[tab];
    const subtitle = completed ? '查看本次画像和比分，也可以重新开始一次独立测试。' :
      tab==='play' && viewed && !live(viewed) ? '本次测试沿用开始时的本地模拟规则。' : sub;
    return '<section class="hero"><div class="art"></div><i class="cross one"></i><i class="cross two"></i><div class="hero-content"><div class="eyebrow">'+label+'</div><h1>'+(completed?'本次测试已完成':title)+'</h1><p>'+subtitle+'</p></div></section>';
  }
  const heading = (ico,str) => '<div class="heading-group"><span class="tile">'+icon(ico)+'</span><h2>'+str+'</h2></div>';
  const button = (id, text, ico, secondary=false, disabled=false) => '<button type="button" id="'+id+'" class="btn'+(secondary?' secondary':'')+'"'+(disabled?' disabled':'')+'>'+(ico?icon(ico):'')+text+'</button>';
  const back = text => '<a class="btn secondary" href="#play">'+text+'</a>';
  function journey(stage, legacy=false) {
    const steps = legacy
      ? [['开始测试','本局沿用开始时的题数和计分规则。'],['答题计分','按旧版规则揭晓本地模拟结果。'],['结束并查看画像','保留旧局后可开始 Make 测试。']]
      : [['获取情境题','选择主题和题数，由 Make 调用 AI 出题。'],['提交并查看比分','Make 保存答案，返回本题的预测和得分。'],['生成画像','用本次已提交的答案生成决策画像。']];
    return '<section class="card challenge journey-card">'+heading('orbit','测试流程')+'<ol class="journey-strip">'+steps.map(([name,desc],i)=>'<li'+(i===stage?' aria-current="step"':'')+(i<stage?' data-done="true"':'')+'><strong>'+name+'</strong><small>'+desc+'</small></li>').join('')+'</ol></section>';
  }
  function scorecard(s, title = '本次比分') {
    const t=totals(s), n=s.history.length;
    const audit=live(s) ? '<div class="score-audit">Make 已确认 '+n+' 题 · 预测命中 '+t.hits+' / '+t.calls+'</div>' : s.ruleVersion===3
      ? '<div class="score-audit">'+(t.calls?'实际猜中 '+t.hits+' / '+t.calls+' 次预测':'尚无计分预测')+' · 观察 '+t.observed+' 题 · 跳过 '+t.skipped+' 题</div>'
      : '<div class="score-audit">旧版测试 · 按当时的规则计分</div>';
    return '<section class="card stats"><div class="stats-head"><div class="heading-group">'+icon('trophy')+'<h2>'+title+'</h2></div><span class="quiet">'+(done(s)?'最终比分':'当前比分')+'</span></div><div class="versus"><div class="player"><span>'+icon('user')+'你</span><strong>'+num(t.user)+'</strong></div><span class="vs">VS</span><div class="player ai"><span>'+icon('bot')+(live(s)?'AI':'模拟 AI')+'</span><strong>'+num(t.ai)+'</strong></div></div><div class="stats-foot"><span>已答 <strong>'+n+' 题</strong></span><span>AI 命中率 <strong>'+(t.calls?pct(t.hits/t.calls):'—')+'</strong></span></div>'+audit+'</section>';
  }
  function layout(content,sidebar) {
    return '<div class="layout"><section class="card challenge">'+content+'</section><aside class="side">'+sidebar+'</aside></div>';
  }
  function welcome() {
    const choices = Object.entries(topics).map(([id,[text,ico,desc]]) => '<button type="button" class="topic-pick" data-topic="'+id+'" aria-pressed="'+(selectedTopic===id)+'"><span class="tile">'+icon(ico)+'</span><strong>'+text+'</strong><small>'+desc+'</small></button>').join('');
    const inputs = [...lengths].map(([n,name])=>'<label><input type="radio" name="limit" value="'+n+'"'+(n===selectedLimit?' checked':'')+'><span>'+name+' · '+n+' 题</span></label>').join('');
    const start = '<div class="setup-intro"><h2>开始一次决策测试</h2><p>向 Make 请求一道情境题。每次提交后，工作流会将答案和比分保存到 Google Sheets。</p></div><div class="setup-topics" role="group" aria-label="选择测试主题">'+choices+'</div><fieldset class="test-length"><legend>测试长度</legend>'+inputs+'</fieldset><div class="setup-footer"><span class="action-hint">'+icon('clock')+'至少答完 1 题即可提前生成画像</span>'+button('start-test','开始测试','layers')+'</div>';
    return layout(start, journey(0));
  }
  function phaseNote(forecast) {
    if (!forecast) return '';
    const text = {
      observation: ['观察题 · 不计分','先了解你的选择，目前双方都不得分。'],
      abstain: ['本题跳过预测','现有线索不足以选出一个答案；本题仍会纳入画像。'],
      prediction: ['预测已锁定','模拟 AI 已参考前 '+forecast.evidence_rounds+' 道回答选定答案，提交后揭晓。']
    }[forecast.kind];
    return '<div class="forecast-state"><strong>'+text[0]+'</strong><small>'+text[1]+'</small></div>';
  }
  function prediction(row, isLive=false) {
    const r=row.result;
    if (r.kind==='observation' || r.kind==='abstain') {
      const observing=r.kind==='observation';
      return '<div class="result">'+icon('layers')+'<div><strong>'+(observing?'已记录这道观察题':'本题没有出手预测')+'</strong><p>你选 '+esc(row.choice)+' · 双方均不计分</p><p>'+esc(r.basis)+'</p></div></div>';
    }
    const evidence=r.basis ? '<p>'+esc(r.basis)+'</p>' : '';
    const outcome=isLive ? (r.is_correct?'AI 猜中了':'AI 没猜中') : (r.is_correct?'模拟 AI 猜中了':'你的选择出乎 AI 的预料');
    return '<div class="result">'+icon(r.is_correct?'bot':'spark')+'<div><strong>'+outcome+'</strong><p>你选 '+esc(row.choice)+' · AI 猜 '+esc(r.predicted_choice)+'</p>'+evidence+'</div><span class="score-pill">'+(r.is_correct?'AI +'+esc(r.ai_score):'你 +'+esc(r.user_score))+'</span></div>';
  }
  const historyLink = makeHistory ? '<a class="make-history-link" href="'+makeHistory+'" target="_blank" rel="noopener noreferrer">打开 Make 执行历史</a>' : '';
  const logTime = value => esc(new Date(value).toLocaleString('zh-CN',{hour12:false}));
  function runLog(s) {
    if (!live(s)) return '';
    const rows = requests(s).map(r => {
      const status = esc(statuses[r.status] || r.status);
      const time = logTime(r.at) + (r.settledAt?' → '+logTime(r.settledAt):'');
      const id=esc(r.executionId);
      const execution=makeHistory && /^[a-f\d]{32}$/i.test(r.executionId) ?
        '<a class="make-history-link" href="'+makeHistory+'/'+id+'" target="_blank" rel="noopener noreferrer">'+id+'</a>' : id;
      const ids = '<div>请求 ID <code>'+esc(r.id)+'</code></div>' +
        (r.executionId?'<div>Make 执行 ID <code>'+execution+'</code></div>':'')+
        (r.recoveryOf?'<div>上次画像请求 ID <code>'+esc(r.recoveryOf)+'</code></div>':'');
      const detail = [r.httpStatus && 'HTTP '+r.httpStatus,r.code,r.message].filter(Boolean).map(esc).join(' · ');
      return '<li><strong>'+esc(intents[r.intent] || r.intent)+'</strong> · '+(r.round?'第 '+esc(r.round)+' 题 · ':'')+status+
        '<small>'+time+'</small>'+ids+(detail?'<div>'+detail+'</div>':'')+'</li>';
    }).join('');
    return '<details class="make-log" data-log="'+esc(s.id)+'"><summary>运行记录 · '+requests(s).length+' 次请求</summary><div class="log-content"><p>本次用户 ID <code>'+esc(s.id)+'</code></p>'+
      (rows?'<ol>'+rows+'</ol>':'<p>尚无请求记录。</p>')+historyLink+
      '<small>在 Make 中按时间查找执行，再用请求 ID 核对 Webhook 输入。执行 ID 由 Make 提供。</small></div></details>';
  }
  function liveNotice(s) {
    const r=requests(s).at(-1);
    if (!r || r.status==='success') return '';
    const action=esc(intents[r.intent]||r.intent);
    if (r.status==='pending') return '<p class="make-status" role="status">正在'+action+'，等待 Make 响应…</p>';
    if (s.id===state.activeId && make?.canRecoverProfile?.(s)) {
      const url=makeHistory && /^[a-f\d]{32}$/i.test(r.executionId)?makeHistory+'/'+r.executionId:makeHistory;
      const historyLabel=url?'<a class="make-history-link" href="'+url+'" target="_blank" rel="noopener noreferrer">Make 执行历史</a>':'Make 执行历史';
      const title=r.status==='error'?'上次重新获取画像未成功':'上次画像请求结果待核实';
      return '<div class="make-status warning"><strong>'+title+'</strong><p>请先在 '+historyLabel+' 核对上次画像请求。确认执行已结束后，可重新获取画像，系统会优先读取已有结果。</p>'+
        '<button type="button" class="btn secondary" data-profile-request="'+esc(r.id)+'" data-session="'+esc(s.id)+'">已核实执行结束，重新获取画像</button></div>';
    }
    let next='可重新请求一道题。';
    if (unresolved(s)) next='请在运行记录中打开 Make 执行历史核实。本次测试已暂停，避免重复写入。';
    else if (r.status==='error') next='可查看运行记录并重试。';
    return '<div class="make-status warning" role="status"><strong>'+action+' · '+esc(statuses[r.status]||r.status)+'</strong>'+
      (r.message?'<p>'+esc(r.message)+'</p>':'')+'<p>'+next+'</p></div>';
  }
  function livePlaying(s) {
    const row=currentRow(s), c=s.current, q=c?.question;
    const n=s.history.length, last=n>=s.limit, locked=blocked(s);
    const numShown=c?(row?n:n+1):n+1;
    const header='<div class="card-header">'+heading('layers','情境挑战')+'<span class="round-tag">第 '+numShown+' / '+s.limit+' 题</span></div><progress class="session-progress" aria-label="已确认答题数" value="'+n+'" max="'+s.limit+'"></progress>';
    const answers=q ? q.options.map((o,i)=>'<button type="button" class="option'+(row?' answered':'')+'" data-choice="'+letters[i]+'" aria-pressed="'+(c.choice===letters[i])+'"'+(row||locked?' disabled':'')+'><span class="letter">'+letters[i]+'</span><span>'+esc(optionText(o,letters[i]))+'</span></button>').join('') : '';
    const body=q?'<div class="question-block"><div class="scene-meta">'+icon(topics[s.topic]?.[1]||'layers')+'请求主题 · '+esc(optionName(s))+'<span class="meta-sep"></span>难度 '+esc(q.difficulty)+'</div><h3 class="remote-question">'+esc(q.question)+'</h3></div><div class="options" role="group" aria-label="四个选项">'+answers+'</div>':'';
    const early=n && !last && !locked ? button('finish','提前结束并生成画像',null,true) : '';
    let action='';
    if (!locked) {
      if (!q) action=button('next','获取题目','layers');
      else if (!row) action=button('submit',numShown===s.limit?'提交并生成画像':'提交本题','reveal',false,!c.choice);
      else if (last) action=button('finish','完成并生成画像','finger');
      else action=button('next','下一题','layers');
    }
    const failed=['error','uncertain'].includes(requests(s).at(-1)?.status);
    const leave = !pending(s) && (failed || !q) ? button('new-test','归档本次，另开测试',null,true) : '';
    const actions=early||leave||action?'<div class="actionbar session-actions">'+early+leave+action+'</div>':'';
    return layout(header+liveNotice(s)+body+(row?prediction(row,true):'')+actions+runLog(s),scorecard(s)+journey(1));
  }
  function playing(s) {
    if (live(s)) return livePlaying(s);
    if (!s.current) return layout(heading('layers','旧版本地模拟')+blank('本局没有待答题目','已提交的答案可在对局记录中查看。',button('new-test','保留记录，开始 Make 测试',null,true)),scorecard(s));
    const c=s.current, q=c.question, row=currentRow(s), number=s.history.length+(row?0:1);
    const answers=q.options.map((o,i)=>'<button type="button" class="option'+(row?' answered':'')+'" data-choice="'+letters[i]+'" aria-pressed="'+(c.choice===letters[i])+'"'+(row?' disabled':'')+'><span class="letter">'+letters[i]+'</span><span>'+esc(optionText(o,letters[i]))+'</span></button>').join('');
    const last=number>=s.limit;
    const forecast = c.forecast, observing=forecast?.kind==='observation', skipped=forecast?.kind==='abstain';
    const submitLabel = last?'提交并生成画像':observing?'提交观察题':skipped?'提交本题选择':'揭晓预测';
    const submit=button('submit',submitLabel,last?'finger':'reveal',false,!c.choice);
    const advance=last?button('finish','完成并生成画像','finger'):button('next','下一题','layers');
    const early=s.history.length>0 && !(row&&last) ? button('finish','提前结束并生成画像',null,true):'';
    const header='<div class="card-header">'+heading('layers','情境挑战')+'<span class="round-tag">第 '+number+' / '+s.limit+' 题</span></div><progress class="session-progress" aria-label="本次已答题数" value="'+s.history.length+'" max="'+s.limit+'"></progress>';
    const body='<div class="question-block"><div class="scene-meta">'+icon(topics[q.topic]?.[1]||'layers')+'<span>'+esc(optionName(q))+'</span><span class="meta-sep"></span>'+esc(q.visualCaption)+'<span class="meta-sep"></span>难度 '+q.difficulty+'</div><h3>'+esc(q.visualTitle)+'</h3><p class="question">'+esc(q.question)+'</p></div><div class="options" role="group" aria-label="四个选项">'+answers+'</div>';
    const footer='<div class="actionbar session-actions">'+(early||'<span class="action-hint">'+icon('key')+'选择一项后提交</span>')+(row?advance:submit)+'</div>';
    const legacyNote='<div class="forecast-state"><strong>旧版本地模拟</strong><small>可以继续本局，也可以先保存进度。</small>'+button('new-test','保留本局，开始 Make 测试',null,true)+'</div>';
    return layout(header+legacyNote+(!row?phaseNote(forecast):'')+body+(row?prediction(row):'')+footer, scorecard(s)+journey(1,true));
  }
  function blank(title,desc,action,ico='history') {
    return '<div class="empty"><span class="tile">'+icon(ico)+'</span><strong>'+title+'</strong><p>'+desc+'</p>'+action+'</div>';
  }
  function roundDetail(r, index) {
    const q=r.question, result=r.result;
    const scored=typeof result.is_correct==='boolean', tag=scored?(result.is_correct?'AI +'+esc(result.ai_score):'你 +'+esc(result.user_score)):result.kind==='observation'?'观察题':'跳过预测';
    const canShowPrediction=scored && letters.includes(result.predicted_choice);
    const picked=canShowPrediction ? esc(result.predicted_choice)+' · '+esc(optionText(q.options[letters.indexOf(result.predicted_choice)],result.predicted_choice)) : '本题未预测';
    const timestamp=Number.isFinite(result.locked_at)?'<dt>出题记录时间</dt><dd>'+esc(new Date(result.locked_at).toLocaleTimeString('zh-CN'))+'</dd>':'';
    const evidence=result.basis?'<dt>依据</dt><dd>'+esc(result.basis)+'</dd>':'';
    return '<details><summary><span class="round-tag">R'+num(index+1)+'</span><span><span class="hist-title">'+esc(q.visualTitle||q.question)+'</span><span class="hist-sub">'+esc(optionName(q))+'</span></span><span class="hist-score">'+tag+'</span>'+icon('chevron')+'</summary><div class="detail"><p>'+esc(q.question)+'</p><dl><dt>你的选择</dt><dd>'+esc(r.choice)+' · '+esc(optionText(q.options[letters.indexOf(r.choice)],r.choice))+'</dd><dt>AI 预测</dt><dd>'+picked+'</dd>'+evidence+timestamp+'</dl></div></details>';
  }
  function report(s) {
    const p=s.profile, n=s.history.length, active=sessions.active(state), last=s.history[n-1];
    if (!p || !Array.isArray(p.traits)) return layout(heading('finger','本次测试')+blank('本次记录没有画像','可以在对局记录中查看已有的答题结果。','<a class="btn secondary" href="#history">查看对局记录</a>')+runLog(s),scorecard(s));
    const title='<div class="card-header">'+heading('finger','本次决策画像')+'<span class="round-tag">'+source(s)+' · '+n+' 题</span></div>';
    const lead='<div class="report-intro"><h3>'+esc(p.personality_type)+'</h3><p>'+esc(p.summary)+'</p></div>';
    const traits='<div class="traits">'+p.traits.map(t=>'<div class="trait"><div><span>'+esc(t.name)+'</span><strong>'+(Number.isInteger(t.chosen_count)?t.chosen_count+' / '+p.evidence_rounds+' · ':'')+pct(t.score)+'</strong></div><div class="trait-line"><span style="width:'+pct(t.score)+'"></span></div></div>').join('')+'</div>';
    const action=active&&!done(active)?back('继续进行中的测试'):button('restart','再测一次','refresh');
    const footer='<div class="actionbar session-actions"><a class="btn secondary" href="#history">查看对局记录</a>'+exportButton(s)+action+'</div>';
    const lastResult=last?'<section class="card challenge">'+heading('reveal','最后一题')+prediction(last,live(s))+'</section>':'';
    return layout(title+lead+traits+footer+runLog(s),scorecard(s)+lastResult);
  }
  function profilePage(s) {
    if (done(s)) return report(s);
    if (s) {
      const n=s.history.length;
      const active=s.id===state.activeId;
      const resume=active?back('返回实验台'):'<button class="btn secondary" data-resume="'+esc(s.id)+'">继续本次测试</button>';
      const actions='<div class="session-actions">'+resume+(n&&active&&!blocked(s)?button('finish','结束并生成画像','finger'):'')+'</div>';
      return layout(heading('finger','我的决策画像')+blank('本次测试进行中',n?'已回答 '+n+' 题，画像将依据本次提交的答案生成。':'答完至少 1 题后即可生成画像。',actions,'finger')+(live(s)?liveNotice(s)+runLog(s):''),scorecard(s)+journey(1,!live(s)));
    }
    return layout(heading('finger','我的决策画像')+blank('还没有测试画像','完成一次测试后，画像会保存在这里。',back('前往开始测试'),'finger'),journey(0));
  }
  function sessionStatus(s) {
    return done(s)?'已结束':s.interruptedAt?'已归档':unresolved(s)?'待核实':s.id===state.activeId?'进行中':'已暂停';
  }
  function historyPage() {
    const all=state.sessions.slice().reverse();
    if(!all.length)return layout(heading('history','测试记录')+blank('还没有测试记录','开始一次测试，这里会按次保存你的答题和画像。',back('前往开始测试')),journey(0));
    const items=all.map((s,i)=>{
      const {user:u,ai:a}=totals(s), name=topics[s.topic]?.[0]||'综合情境';
      const open=done(s)?'<a class="btn secondary" href="'+esc(reportLink(s))+'">查看本次画像</a>':s.interruptedAt?'':'<button class="btn secondary" data-resume="'+esc(s.id)+'">打开本次测试</button>';
      const actions=open+exportButton(s);
      const details=s.history.length?'<details><summary>查看 '+s.history.length+' 道答题记录</summary><div class="history-list">'+s.history.map(roundDetail).join('')+'</div></details>':'';
      const previous=s.legacyProfile;
      const legacy=previous?'<details><summary>查看升级前保存的画像</summary><div class="detail"><strong>'+esc(previous.personality_type)+'</strong><p>'+esc(previous.summary)+'</p><small>依据 '+esc(previous.evidence_rounds)+' 道题</small></div></details>':'';
      const stage=sessionStatus(s);
      return '<article class="archive-item"><div class="archive-meta"><h3>第 '+(all.length-i)+' 次测试 · '+esc(name)+'</h3><small>'+source(s)+' · '+esc(date(s.finishedAt||s.startedAt))+' · '+stage+' · 已答 '+s.history.length+' 题 · 你 '+u+' 分 / AI '+a+' 分</small></div><div class="session-actions">'+actions+'</div>'+details+legacy+runLog(s)+'</article>';
    }).join('');
    const latest=all[0];
    return layout(heading('history','按次保存的测试')+'<div class="archive-list">'+items+'</div>',scorecard(latest, '最近一次比分'));
  }
  function getReport(id) {
    const current=sessions.active(state);
    if(id) return state.sessions.find(s=>encodeURIComponent(s.id)===id);
    return current || state.sessions.filter(done).at(-1);
  }
  function render() {
    const {tab,id}=route(), active=sessions.active(state), viewed=tab==='profile'?getReport(id):active;
    document.querySelectorAll('[data-tab]').forEach(a=>{if(a.dataset.tab===tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const completed=tab!=='history' && done(viewed);
    const view=tab==='history'?historyPage():tab==='profile'?profilePage(viewed):!active?welcome():done(active)?report(active):playing(active);
    document.title=(completed?'测试已完成':titles[tab][1])+' · MindReader';
    const openLogs=new Set(Array.from(main.querySelectorAll('details[data-log][open]'),el=>el.dataset.log));
    document.querySelector('#mode-name').textContent=tab==='history'?'对局记录':viewed?source(viewed):'Make 工作流';
    main.innerHTML=hero(tab,completed,viewed)+(storageFailed?'<div class="storage-alert">浏览器暂时无法保存记录，可在对局记录里导出本次结果。</div>':'')+
      (actionMessage?'<div class="storage-alert" role="alert">'+esc(actionMessage)+'</div>':'')+view;
    main.querySelectorAll('details[data-log]').forEach(el=>{if(openLogs.has(el.dataset.log))el.open=true;});
  }
  function readLatest() {
    if(storageFailed) return;
    const latest=readJSON(key);
    if(latest) state=sessions.loadFrom(latest,null);
  }
  function persist() {
    save();
    if(storageFailed) throw new Error('无法将本次请求保存到浏览器。');
    render();
  }
  let changing=false, recovering=false, holding=false;
  // Recovery uses the dispatch lock, so an active request in another tab can settle first.
  function recoverInterrupted() {
    if(!make || !navigator.locks || recovering || !state.sessions.some(pending)) return;
    recovering=true;
    navigator.locks.request(key,()=>{
      readLatest();
      if(make.recover(state)) save();
      render();
    }).finally(()=>{recovering=false;});
  }
  function change(update, after, remote=false) {
    if(changing) return;
    if(remote && (!make || !navigator.locks)) {
      actionMessage=!make?'Make 客户端未加载，请刷新后重试。':'无法锁定本次提交。请使用支持 Web Locks 的浏览器，通过 HTTPS 打开测试。';
      render(); return;
    }
    const before=sessions.active(state), sid=before?.id, qid=before?.current?.id;
    const roundCount=before?.history.length, attemptCount=requests(before).length;
    const initialHash=location.hash;
    changing=true; actionMessage='';
    const run=async()=>{
      readLatest();
      const active=sessions.active(state);
      if(active?.id!==sid || active?.current?.id!==qid || active?.history.length!==roundCount || requests(active).length!==attemptCount){render();return;}
      holding=true;
      try {
        const result=await update(active);
        if(!result){render();return;}
        save(); render();
        if(after && initialHash===location.hash) after(result);
      } finally {holding=false;}
    };
    const completion=navigator.locks ? navigator.locks.request(key,run) : run();
    completion.catch(error=>{
      const last=requests(sessions.active(state)).at(-1);
      if (!last?.message || last.message!==error.message) actionMessage=error.message || '本次操作未完成。';
      render(); notice.textContent=error.message || '本次操作未完成。';
    }).finally(()=>{changing=false;});
  }
  function focusOn(selector){main.querySelector(selector)?.focus({preventScroll:true});}
  function choose(letter) {
    const displayed=sessions.active(state);
    if(route().tab!=='play'||!displayed?.current||done(displayed)||blocked(displayed)||currentRow(displayed))return;
    change(s=>{if(!s?.current||done(s)||blocked(s)||currentRow(s))return false;s.current.choice=letter;return true;},()=>{
      focusOn('[data-choice="'+letter+'"]');notice.textContent='已选择 '+letter;
    });
  }
  function openReport(s) {
    go(reportLink(s));window.scrollTo(0,0);main.focus({preventScroll:true});
    notice.textContent='本次测试已结束，画像已生成。';
  }
  function exportButton(s) {
    return '<button type="button" class="btn secondary export" data-export="'+esc(s.id)+'">导出报告</button>';
  }

  const exportDialog = document.getElementById('export-dialog');
  const exportTitle = document.getElementById('export-title');
  const exportContent = document.getElementById('export-content');
  const confidenceNames = {low:'低', medium:'中', high:'高', descriptive:'描述性观察'};
  const fullDate = timestamp => new Date(timestamp).toLocaleString('zh-CN', {hour12:false});
  let exportDocument;

  function profileLines(profile) {
    if (!profile) return ['本次尚未生成画像。'];
    const lines = [profile.personality_type, profile.summary];
    for (const trait of profile.traits || []) {
      const count = Number.isInteger(trait.chosen_count) ? '（选中 '+trait.chosen_count+' 次）' : '';
      lines.push(trait.name+'　'+pct(trait.score)+count);
    }
    if (Number.isInteger(profile.evidence_rounds)) lines.push('画像依据　'+profile.evidence_rounds+' 道题');
    const confidence = confidenceNames[profile.confidence_level];
    if (confidence) lines.push('可信程度　'+confidence);
    return lines.filter(Boolean);
  }

  function roundLines(question, row) {
    const lines = [question.question];
    for (const [i, option] of question.options.entries()) {
      lines.push(letters[i]+' · '+optionText(option,letters[i]));
    }
    if (!row) return lines;
    const result = row.result;
    lines.push('你的选择　'+row.choice);
    if (result.kind === 'observation' || result.kind === 'abstain') {
      lines.push(result.kind === 'observation' ? '本题用于观察，双方均不计分。' : 'AI 跳过了本题预测，双方均不计分。');
    } else {
      lines.push('AI 预测　'+result.predicted_choice+'（'+(result.is_correct?'猜中':'未猜中')+'）');
      lines.push('本题得分　你 '+result.user_score+' 分 / AI '+result.ai_score+' 分');
      if (Number.isFinite(result.confidence)) lines.push('预测信心　'+pct(result.confidence));
    }
    if (result.basis) lines.push('预测依据　'+result.basis);
    if (Number.isFinite(row.decision_ms)) lines.push('答题用时　'+(row.decision_ms/1000).toFixed(1)+' 秒');
    return lines;
  }

  function makeExport(s) {
    const number = state.sessions.indexOf(s)+1;
    const title = '第 '+number+' 次测试 · '+optionName(s);
    const scores = totals(s);
    const status = sessionStatus(s);
    const overview = [source(s)+' · '+status, '已答 '+s.history.length+' 题 / 计划 '+s.limit+' 题',
      '你的得分　'+scores.user+' 分','AI 得分　'+scores.ai+' 分',
      scores.calls?'AI 命中　'+scores.hits+' / '+scores.calls+' 次预测':'本次尚无计分预测'];
    if (s.startedAt) overview.push('开始时间　'+fullDate(s.startedAt));
    if (s.finishedAt) overview.push('结束时间　'+fullDate(s.finishedAt));
    if (s.interruptedAt) overview.push('归档时间　'+fullDate(s.interruptedAt));
    const sections = [{title:'对局概览',lines:overview},
      {title:'决策画像',lines:profileLines(done(s)?s.profile:null)}];
    if (s.legacyProfile) sections.push({title:'升级前保存的画像',lines:profileLines(s.legacyProfile)});
    for (const [i,row] of s.history.entries()) {
      sections.push({title:'第 '+(i+1)+' 题',lines:roundLines(row.question,row)});
    }
    const pendingQuestion = s.unanswered || (!currentRow(s) && s.current);
    if (pendingQuestion?.question) {
      const lines = roundLines(pendingQuestion.question);
      if (pendingQuestion.choice) lines.push('已选 '+pendingQuestion.choice+'，尚无已确认的答题结果。');
      sections.push({title:'尚未确认的题目',lines});
    }
    if (live(s)) {
      const lines = ['本局编号　'+s.id];
      for (const r of requests(s)) {
        lines.push(fullDate(r.at)+'　'+(intents[r.intent] || '请求')+' · '+(statuses[r.status] || '未知状态'));
        if (r.message) lines.push(r.message);
        if (makeHistory && /^[a-f\d]{32}$/i.test(r.executionId)) lines.push(makeHistory+'/'+r.executionId);
        else if (r.executionId) lines.push('Make 执行编号　'+r.executionId);
        else lines.push('请求编号　'+r.id);
      }
      sections.push({title:'Make 运行记录',lines,folded:true});
    }
    return {title,sections,filename:'MindReader-第'+number+'次测试-'+optionName(s)+'.txt'};
  }

  function exportTest(id) {
    const session = state.sessions.find(test=>test.id===id);
    if (!session) return;
    exportDocument = makeExport(session);
    exportTitle.textContent = exportDocument.title+' · 测试报告';
    exportContent.replaceChildren();
    for (const section of exportDocument.sections) {
      const group = document.createElement(section.folded?'details':'section');
      const heading = document.createElement(section.folded?'summary':'h3');
      heading.textContent = section.title;
      group.append(heading);
      for (const line of section.lines) {
        const paragraph = document.createElement('p');
        if (section.folded && makeHistory && line.startsWith(makeHistory+'/') && /^[a-f\d]{32}$/i.test(line.slice(makeHistory.length+1))) {
          const link = document.createElement('a');
          link.href = line;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = '打开这次 Make 执行';
          paragraph.append(link);
        } else {
          paragraph.textContent = line;
        }
        group.append(paragraph);
      }
      exportContent.append(group);
    }
    exportContent.scrollTop = 0;
    exportDialog.showModal();
    exportTitle.focus({preventScroll:true});
  }

  document.getElementById('download-report').addEventListener('click',()=>{
    if (!exportDocument) return;
    const {title,sections,filename} = exportDocument;
    const paragraphs = sections.map(section=>[section.title,...section.lines].join('\n'));
    const text = ['MindReader 测试报告',title,...paragraphs].join('\n\n')+'\n';
    const url = URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  main.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.topic){selectedTopic=b.dataset.topic;render();focusOn('[data-topic="'+selectedTopic+'"]');return;}
    if(b.dataset.choice){choose(b.dataset.choice);return;}
    if(b.dataset.export){exportTest(b.dataset.export);return;}
    if(b.dataset.profileRequest){
      const verifiedRequestId=b.dataset.profileRequest, sessionId=b.dataset.session;
      change(async s=>{
        if(s?.id!==sessionId || !make.canRecoverProfile(s) || requests(s).at(-1)?.id!==verifiedRequestId) return null;
        await make.recoverProfile(state,{verifiedRequestId,executionEnded:true},persist);
        return s;
      },openReport,true);
      return;
    }
    if(b.dataset.resume){
      change(()=>{
        const target=state.sessions.find(s=>s.id===b.dataset.resume);
        if(!target || done(target) || target.interruptedAt) return false;
        state.activeId=target.id; return true;
      },()=>go('#play','[data-choice]')); return;
    }
    const active=sessions.active(state);
    switch(b.id){
      case 'new-test':
        change(s=>{
          if(!s || pending(s)) return false;
          if(live(s) && requests(s).length) return make.closeFailed(state);
          state.activeId=null; return true;
        },()=>{go('#play','#start-test');notice.textContent='本次记录已保留。';});
        break;
      case 'start-test':
        change(async()=>{
          const s=make.create(state,selectedTopic,selectedLimit);
          await make.begin(state,persist); return s;
        },s=>{focusOn('[data-choice]');notice.textContent='Make 已返回第 1 题，共 '+s.limit+' 题。';},true);
        break;
      case 'submit': {
        const selected=active?.current?.choice;
        change(async s=>{
          if(blocked(s)) return null;
          if(!s?.current?.choice||done(s))return null;
          if(s.current.choice!==selected) throw new Error('另一个标签页已更改本题选择。请核对选项后再提交。');
          if(live(s)){
            await make.submit(state,s.current.choice,persist);
            if(s.history.length===s.limit) await make.finish(state,persist);
            return s;
          }
          const row=sessions.submit(state,s.current.choice);if(!row)return null;
          if(s.history.length>=s.limit)sessions.finish(state);
          return s;
        },s=>{if(done(s))openReport(s);else{focusOn('#next');notice.textContent=live(s)?'Make 已确认本题结果。':s.current?.forecast?.kind==='observation'?'观察题已记录。':'本题结果已揭晓。';}},live(active));
        break;
      }
      case 'next':
        change(s=>live(s)?make.begin(state,persist):sessions.next(state),()=>{focusOn('[data-choice]');notice.textContent='已进入下一道题。';},live(active));
        break;
      case 'finish':
        change(async s=>{
          if(!live(s)) return sessions.finish(state);
          await make.finish(state,persist);
          return s;
        },openReport,live(active));
        break;
      case 'restart': {
        const {id}=route(), viewed=getReport(id);
        if(viewed && topics[viewed.topic])selectedTopic=viewed.topic;
        change(s=>s?sessions.prepareRestart(state):true,()=>{go('#play','#start-test');window.scrollTo(0,0);notice.textContent='请选择新测试的主题。';});
        break;
      }
    }
  });
  main.addEventListener('change',e=>{
    if(e.target.name==='limit' && lengths.has(Number(e.target.value))) selectedLimit=Number(e.target.value);
  });
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);main.focus({preventScroll:true});});
  window.addEventListener('storage',e=>{if(e.key===key && e.newValue && !storageFailed && !holding){readLatest();render();recoverInterrupted();}});
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||help.open||exportDialog.open||e.target.closest('select,input,textarea,dialog'))return;
    const s=sessions.active(state);
    if(route().tab!=='play'||!s?.current||done(s)||currentRow(s))return;
    const n=Number(e.key),letter=n>=1&&n<=4?letters[n-1]:e.key.toUpperCase();
    if(/^[ABCD]$/.test(letter)){e.preventDefault();choose(letter);}
  });
  document.querySelector('#help-button').addEventListener('click',()=>help.showModal());
  help.addEventListener('click',e=>{if(e.target===help){const r=help.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)help.close();}});
  render();
  recoverInterrupted();
})();
