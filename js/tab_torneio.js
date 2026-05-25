let tPlayers = [];
let tMatches = [];
let tNextId = 0;
let _tBracket = null;  // ← nome correto da variável

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('torneio-player-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addTPlayer(); });
});

function addTPlayer() {
  const inp = document.getElementById('torneio-player-input');
  const name = inp.value.trim();
  if (!name) return;
  if (tPlayers.find(p => p.toLowerCase() === name.toLowerCase())) {
    inp.style.borderBottomColor = '#ff5252';
    setTimeout(() => { inp.style.borderBottomColor = ''; }, 800);
    return;
  }
  tPlayers.push(name);
  inp.value = '';
  renderSetupList();
}

function removeTPlayer(i) {
  tPlayers.splice(i, 1);
  renderSetupList();
}

async function importInscritosToTorneio() {
  // Tenta usar o cache global; se vazio, força carregamento
  let inscritos = window._inscritosCache || [];
  
  if (inscritos.length === 0) {
    // Se há uma função de carregamento disponível, tenta buscar os dados
    if (typeof window.loadInscritos === 'function') {
      try {
        window.showLoading?.(true);
        await window.loadInscritos();
        inscritos = window._inscritosCache;
      } catch (err) {
        console.error('Erro ao carregar inscritos:', err);
      } finally {
        window.showLoading?.(false);
      }
    }
  }

  // Se ainda não houver dados, avisa e oferece login
  if (!inscritos || inscritos.length === 0) {
    alert('Nenhum inscrito encontrado.\n\nÉ necessário fazer login e acessar a aba "Inscritos" primeiro.');
    // Se quiser, abre o modal de login automaticamente:
    if (typeof openLoginModal === 'function') openLoginModal();
    return;
  }

  let added = 0, skipped = 0;
  inscritos.forEach(i => {
    const name = (i.nome || '').trim();
    if (!name) return;
    if (tPlayers.find(p => p.toLowerCase() === name.toLowerCase())) {
      skipped++;
    } else {
      tPlayers.push(name);
      added++;
    }
  });

  renderSetupList();

  const infoEl = document.getElementById('count-info');
  if (added > 0) {
    infoEl.innerHTML = `✓ <strong>${added}</strong> inscrito${added!==1?'s':''} importado${added!==1?'s':''}${skipped>0?' ('+skipped+' já existia'+(skipped!==1?'m':'')+')':''}. Total: <strong>${tPlayers.length}</strong> combatentes.`;
  } else {
    alert('Todos os inscritos já estão na lista.');
  }
}

function renderSetupList() {
  const ul = document.getElementById('player-list');
  ul.innerHTML = '';
  tPlayers.forEach((p, i) => {
    const li = document.createElement('li');
    const numSp = document.createElement('span'); numSp.className = 'player-num'; numSp.textContent = String(i+1).padStart(2,'0');
    const nameSp = document.createElement('span'); nameSp.className = 'player-name'; nameSp.textContent = p;
    const rmBtn = document.createElement('button'); rmBtn.className = 'remove-btn'; rmBtn.textContent = '✕'; rmBtn.onclick = () => removeTPlayer(i);
    li.appendChild(numSp); li.appendChild(nameSp); li.appendChild(rmBtn);
    ul.appendChild(li);
  });
  const info = document.getElementById('count-info');
  if (tPlayers.length < 4) info.innerHTML = `Adicione pelo menos <strong>4</strong> combatentes. (${tPlayers.length} adicionados)`;
  else info.innerHTML = `<strong style="color:#E8251A">${tPlayers.length}</strong> combatentes prontos. Bora!`;
}

// ══ ENGINE ══
function startTournament() {
  if (tPlayers.length < 4) { alert('Adicione pelo menos 4 lutadores!'); return; }
  let seeds = [...tPlayers].sort(() => Math.random() - 0.5);
  const n = nextPow2(seeds.length);
  while (seeds.length < n) seeds.push(null);
  tMatches = []; tNextId = 0;
  buildBracket(seeds);
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('tournament-view').style.display = 'block';
  renderBracket();
  updateTStats();
}

function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

function makeMatch(p1, p2, type, round) {
  const m = { id: tNextId++, p1, p2, winner: null, loser: null, type, round, resolved: false,
    feedFrom: null, loserFeedFrom: null, lFeedFrom: null, wDropFrom: null, lFeedFrom2: null };
  tMatches.push(m);
  return m;
}

function gm(id) { return tMatches.find(m => m.id === id); }

function buildBracket(seeds) {
  const wRounds = [];
  const r1 = [];
  for (let i = 0; i < seeds.length; i += 2) {
    r1.push(makeMatch(seeds[i], seeds[i+1], 'W', 1));
  }
  wRounds.push(r1);

  let prev = r1;
  let wRN = 1;
  while (prev.length > 1) {
    wRN++;
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      const m = makeMatch(null, null, 'W', wRN);
      m.feedFrom = [prev[i].id, prev[i+1].id];
      next.push(m);
    }
    wRounds.push(next);
    prev = next;
  }

  const lRounds = [];
  let lRN = 0;
  const lR1 = [];
  const wR1 = wRounds[0];
  for (let i = 0; i < wR1.length; i += 2) {
    const m = makeMatch(null, null, 'L', ++lRN);
    m.loserFeedFrom = [wR1[i].id, wR1[i+1] ? wR1[i+1].id : null];
    lR1.push(m);
  }
  lRounds.push(lR1);
  let prevL = lR1;
  let wDrop = 2;

  while (wDrop <= wRounds.length - 1) {
    lRN++;
    const wDropSrc = wRounds[wDrop - 1];
    const mix = [];
    for (let i = 0; i < prevL.length; i++) {
      const m = makeMatch(null, null, 'L', lRN);
      m.lFeedFrom = prevL[i].id;
      m.wDropFrom = wDropSrc[i] ? wDropSrc[i].id : null;
      mix.push(m);
    }
    lRounds.push(mix);
    wDrop++;
    if (mix.length <= 1) { prevL = mix; break; }
    lRN++;
    const pure = [];
    for (let i = 0; i < mix.length; i += 2) {
      if (i + 1 < mix.length) {
        const m = makeMatch(null, null, 'L', lRN);
        m.lFeedFrom2 = [mix[i].id, mix[i+1].id];
        pure.push(m);
      } else { mix[i]._pass = true; pure.push(mix[i]); }
    }
    lRounds.push(pure);
    prevL = pure;
  }

  const lFinal = prevL[prevL.length - 1];
  const wFinal = wRounds[wRounds.length - 1][0];
  const gf = makeMatch(null, null, 'F', 1);
  gf.feedFrom = [wFinal.id, lFinal.id];

  // ← CORRIGIDO: _tBracket (não _bracket)
  _tBracket = { wRounds, lRounds, grandFinal: gf };
  autoResolveByes();
}

function fillSlots(m) {
  if (m.resolved) return;
  if (m.feedFrom) {
    const [a, b] = m.feedFrom;
    const sa = gm(a), sb = b != null ? gm(b) : null;
    m.p1 = sa && sa.resolved ? sa.winner : 'TBD';
    m.p2 = sb ? (sb.resolved ? sb.winner : 'TBD') : 'BYE';
  }
  if (m.loserFeedFrom) {
    const [a, b] = m.loserFeedFrom;
    const sa = gm(a), sb = b != null ? gm(b) : null;
    m.p1 = sa && sa.resolved ? sa.loser : 'TBD';
    m.p2 = sb ? (sb.resolved ? sb.loser : 'TBD') : 'BYE';
  }
  if (m.lFeedFrom) { const src = gm(m.lFeedFrom); m.p1 = src && src.resolved ? src.winner : 'TBD'; }
  if (m.wDropFrom) { const src = gm(m.wDropFrom); m.p2 = src && src.resolved ? src.loser : 'TBD'; }
  if (m.lFeedFrom2) {
    const [a, b] = m.lFeedFrom2;
    const sa = gm(a), sb = gm(b);
    m.p1 = sa && sa.resolved ? sa.winner : 'TBD';
    m.p2 = sb && sb.resolved ? sb.winner : 'TBD';
  }
}

function autoResolveByes() {
  let changed = true;
  while (changed) {
    changed = false;
    tMatches.forEach(m => {
      if (m.resolved) return;
      fillSlots(m);
      const p1ok = m.p1 && m.p1 !== 'TBD';
      const p2ok = m.p2 && m.p2 !== 'TBD';
      if (p1ok && m.p2 === 'BYE') { resolveMatch(m, m.p1, false); changed = true; }
      else if (p2ok && m.p1 === 'BYE') { resolveMatch(m, m.p2, false); changed = true; }
      else if (m.p1 === null && m.p2 === null && m.type === 'W' && m.round === 1) {
        resolveMatch(m, 'BYE', false); changed = true;
      }
    });
  }
}

function resolveMatch(m, winner, rerender = true) {
  m.winner = winner;
  m.loser  = winner === m.p1 ? m.p2 : m.p1;
  if (m.loser === 'BYE') m.loser = null;
  m.resolved = true;
  autoResolveByes();
  if (rerender) { renderBracket(); updateTStats(); checkChampion(); }
}

// ══ RENDER ══ (CORRIGIDO: usa _tBracket e itera o array correto em cada rodada)
function renderBracket() {
  const c = document.getElementById('bracket-container');
  c.innerHTML = '';
  const b = _tBracket; // ← CORRIGIDO: era _bracket

  // Winners
  const ws = mkSection('winners', '⚔ CHAVE DOS VENCEDORES');
  const wr = tEl('div', 'rounds-row');
  b.wRounds.forEach((rnd, ri) => {
    const col = mkRoundCol(ri === b.wRounds.length - 1 ? 'FINAL W' : `RODADA ${ri+1}`, rnd); // ← CORRIGIDO: passa rnd
    wr.appendChild(col);
  });
  ws.appendChild(wr); c.appendChild(ws);

  // Losers
  const ls = mkSection('losers', '🛡 CHAVE DOS DERROTADOS');
  const lr = tEl('div', 'rounds-row');
  b.lRounds.forEach((rnd, ri) => {
    const col = mkRoundCol(`RODADA L${ri+1}`, rnd); // ← CORRIGIDO: passa rnd
    lr.appendChild(col);
  });
  ls.appendChild(lr); c.appendChild(ls);

  // Finals
  const fs = mkSection('finals', '🔥 GRANDE FINAL');
  const fr = tEl('div', 'rounds-row');
  const fc = tEl('div', 'round-col');
  const fl = tEl('div', 'round-label'); fl.textContent = 'GRANDE FINAL';
  fc.appendChild(fl);
  fillSlots(b.grandFinal);
  fc.appendChild(renderMatchCard(b.grandFinal));
  fr.appendChild(fc); fs.appendChild(fr); c.appendChild(fs);
}

function mkSection(cls, title) {
  const d = tEl('div', 'bsection');
  const t = tEl('div', 'bsection-title ' + cls);
  const badge = tEl('span', 'pill');
  badge.textContent = cls === 'winners' ? 'WINNERS' : cls === 'losers' ? 'LOSERS' : 'FINAL';
  t.appendChild(badge);
  t.appendChild(document.createTextNode(' ' + title));
  d.appendChild(t);
  return d;
}

// ← CORRIGIDO: itera o parâmetro "matches" (não o global tMatches)
function mkRoundCol(label, matches) {
  const col = tEl('div', 'round-col');
  const lbl = tEl('div', 'round-label'); lbl.textContent = label;
  col.appendChild(lbl);
  matches.forEach(m => {       // ← CORRIGIDO: era tMatches.forEach
    fillSlots(m);
    col.appendChild(renderMatchCard(m));
  });
  return col;
}

function renderMatchCard(m) {
  const card = tEl('div', 'match-card');
  if (m.resolved) card.classList.add('done');
  else {
    const p1r = m.p1 && m.p1 !== 'TBD' && m.p1 !== 'BYE';
    const p2r = m.p2 && m.p2 !== 'TBD' && m.p2 !== 'BYE';
    if (p1r && p2r) card.classList.add('active');
  }
  const mid = tEl('div', 'match-id'); mid.textContent = m.type + (m.id + 1);
  card.appendChild(mid);

  [m.p1, m.p2].forEach(player => {
    const slot = tEl('div', 'player-slot');
    const isW = m.resolved && player === m.winner;
    const isL = m.resolved && player === m.loser;
    const isTbd = player === 'TBD';
    const isBye = player === 'BYE';
    const isEmpty = !player;

    if (isW) slot.classList.add('winner-slot');
    else if (isL) slot.classList.add('loser-slot');
    else if (isTbd) slot.classList.add('tbd');
    else if (isBye) slot.classList.add('bye');
    else if (isEmpty) slot.classList.add('empty');

    const nm = tEl('span', 'slot-name');
    nm.textContent = isEmpty ? '—' : isTbd ? 'A definir…' : isBye ? 'BYE' : player;
    const ico = tEl('span', 'slot-ico'); ico.textContent = '✓';
    slot.appendChild(nm); slot.appendChild(ico);

    if (!m.resolved && !isEmpty && !isTbd && !isBye) {
      slot.addEventListener('click', () => openTModal(m));
    }
    card.appendChild(slot);
  });
  return card;
}

function tEl(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

// ══ MODAL ══
function openTModal(m) {
  if (!m.p1 || m.p1 === 'TBD' || !m.p2 || m.p2 === 'TBD') return;
  const labels = { W: 'WINNERS', L: 'LOSERS', F: 'GRANDE FINAL' };
  document.getElementById('t-modal-sub').textContent = `${labels[m.type]} · RODADA ${m.round}`;
  document.getElementById('t-modal-players').innerHTML = '';
  document.getElementById('t-modal-players2').innerHTML = '';

  const players = [m.p1, m.p2].filter(p => p && p !== 'BYE');
  players.forEach((player, idx) => {
    const btn = document.createElement('button');
    btn.className = 'modal-player-btn';
    const ico = document.createElement('span'); ico.className = 'sword'; ico.textContent = '🗡';
    btn.appendChild(ico); btn.appendChild(document.createTextNode(' ' + player));
    btn.addEventListener('click', () => { resolveMatch(m, player); closeTModal(); });
    const target = idx === 0 ? 't-modal-players' : 't-modal-players2';
    document.getElementById(target).appendChild(btn);
  });
  document.getElementById('t-modal-overlay').classList.add('open');
}

function closeTModal() {
  document.getElementById('t-modal-overlay').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('t-modal-overlay');
  if (overlay) overlay.addEventListener('click', function(e) { if (e.target === this) closeTModal(); });
});

// ══ STATS / CHAMPION ══
function updateTStats() {
  const done    = tMatches.filter(m => m.resolved).length;
  const pending = tMatches.filter(m => !m.resolved).length;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-done').textContent    = done;
  document.getElementById('stat-players').textContent = tPlayers.length;
}

function checkChampion() {
  const gf = _tBracket.grandFinal; // ← CORRIGIDO: era _bracket
  if (gf && gf.resolved && gf.winner && gf.winner !== 'BYE') {
    document.getElementById('champ-name').textContent = gf.winner.toUpperCase();
    document.getElementById('champion-display').style.display = 'block';
  }
}

// ══ RESET ══
function resetTournament() {
  if (!confirm('Resetar o torneio e voltar ao início?')) return;
  tPlayers = []; tMatches = []; tNextId = 0; _tBracket = null;
  document.getElementById('setup-panel').style.display = 'block';
  document.getElementById('tournament-view').style.display = 'none';
  document.getElementById('champion-display').style.display = 'none';
  document.getElementById('bracket-container').innerHTML = '';
  document.getElementById('player-list').innerHTML = '';
  document.getElementById('count-info').innerHTML = 'Adicione pelo menos <strong>4</strong> combatentes para iniciar.';
}