// ===================== ARENA (REFATORADA) =====================
// Dependências globais:
//   escHtml, escAttr (utils.js)
//   window._supabase, SUPABASE_URL, window._authUser (supabase_init.js)
//   window._inscritosCache (cache de inscritos)

// ---------- ESTADO GLOBAL ----------
let S = null;                // estado carregado do banco
let match = null;            // partida em andamento (local, não persistida)
let timerInterval = null;

// ---------- MODELO DE DADOS ----------
function mkState() {
  const now = new Date().toISOString();
  const seasonId = 's' + Date.now();
  return {
    players: [],                     // { id: string, name: string }
    seasons: [{                      // temporadas
      id: seasonId,
      name: 'Temporada 1',
      startDate: now,
      endDate: null,
      matches: []                    // { id, playerAId, playerBId, scoreA, scoreB, timestamp, winnerId }
    }],
    currentSeasonId: seasonId,
    semesterStart: now,              // data de início do semestre (para tiers)
    semesterSeasons: [seasonId]      // ids das temporadas do semestre
  };
}

// ---------- PERSISTÊNCIA NO SUPABASE ----------
async function loadState() {
  if (!window._authUser) return mkState();
  if (window._arenaStateCache) return window._arenaStateCache;

  const { data, error } = await window._supabase
    .from('config')
    .select('data')
    .eq('key', 'arena_state')
    .single();

  if (error || !data) {
    const fresh = mkState();
    window._arenaStateCache = fresh;
    return fresh;
  }

  window._arenaStateCache = data.data;
  return data.data;
}

async function saveState() {
  window._arenaStateCache = S;
  if (!window._authUser) return;

  const { error } = await window._supabase
    .from('config')
    .upsert({ key: 'arena_state', data: S }, { onConflict: 'key' });

  if (error) console.error('Erro ao salvar estado da arena:', error);
}

// ---------- INICIALIZAÇÃO ----------
async function initArena() {
  try {
    S = await loadState();
    populateSelects();
    renderRanking();
    updateSemesterInfo();
  } catch (err) {
    console.error('Erro ao inicializar Arena:', err);
    alert('Não foi possível carregar os dados da Arena.');
  }
}
window.initArena = initArena;

// ---------- NAVEGAÇÃO ENTRE PAINÉIS ----------
function arenaSwitchTab(tab) {
  document.querySelectorAll('.arena-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.arena-panel').forEach(p => p.classList.remove('active'));

  if (tab === 'duelo') {
    document.querySelector('.arena-tab-btn:nth-child(1)').classList.add('active');
    document.getElementById('arena-panel-duelo').classList.add('active');
    populateSelects(); // atualiza dropdowns caso players tenham mudado
  } else {
    document.querySelector('.arena-tab-btn:nth-child(2)').classList.add('active');
    document.getElementById('arena-panel-ranking').classList.add('active');
    renderRanking();
  }
}
window.arenaSwitchTab = arenaSwitchTab;

// ===================== DUELO =====================

function populateSelects() {
  const fa = document.getElementById('fa-select');
  const fb = document.getElementById('fb-select');
  if (!fa || !fb) return;

  const options = S.players
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`)
    .join('');

  fa.innerHTML = options;
  fb.innerHTML = options;

  // Seleciona padrões diferentes se possível
  if (S.players.length >= 2) {
    fa.selectedIndex = 0;
    fb.selectedIndex = 1;
  }
}

function getPlayerName(id) {
  const p = S.players.find(p => p.id === id);
  return p ? p.name : 'Desconhecido';
}

function startMatch() {
  const fa = document.getElementById('fa-select');
  const fb = document.getElementById('fb-select');
  const winPts = parseInt(document.getElementById('win-pts').value);
  const timeLimit = parseInt(document.getElementById('time-limit').value);

  if (fa.value === fb.value) {
    alert('Selecione dois combatentes diferentes.');
    return;
  }

  const playerA = fa.value;
  const playerB = fb.value;

  match = {
    playerA,
    playerB,
    scoreA: 0,
    scoreB: 0,
    winPts,
    timeLimit,
    timeLeft: timeLimit * 60, // em segundos (0 = sem limite)
    timerRunning: false,
    log: []
  };

  document.getElementById('setup-card').style.display = 'none';
  document.getElementById('match-card').style.display = 'block';
  updateMatchUI();
  clearTimer();
  document.getElementById('btn-timer').textContent = '▶ Iniciar Tempo';
  document.getElementById('match-log').innerHTML = '<div class="log-entry" style="color:var(--text3)">Duelo iniciado. Que vença o melhor!</div>';
}

function updateMatchUI() {
  if (!match) return;
  document.getElementById('disp-name-a').textContent = getPlayerName(match.playerA);
  document.getElementById('disp-name-b').textContent = getPlayerName(match.playerB);
  document.getElementById('disp-score-a').textContent = match.scoreA;
  document.getElementById('disp-score-b').textContent = match.scoreB;
  document.getElementById('timer-display').textContent = match.timeLimit === 0 ? '∞' : formatTime(match.timeLeft);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function addPoint(fighter) {
  if (!match) return;
  if (fighter === 'a') match.scoreA++;
  else match.scoreB++;

  addLog(`${getPlayerName(fighter === 'a' ? match.playerA : match.playerB)} marca um ponto!`);
  updateMatchUI();
  checkVictory();
}

function rmPoint(fighter) {
  if (!match) return;
  if (fighter === 'a' && match.scoreA > 0) match.scoreA--;
  else if (fighter === 'b' && match.scoreB > 0) match.scoreB--;

  addLog(`Ponto removido.`);
  updateMatchUI();
}

function addLog(msg) {
  if (!match) return;
  const timeStr = match.timeLimit === 0 ? '' : `[${formatTime(match.timeLeft)}] `;
  match.log.push(timeStr + msg);
  const logDiv = document.getElementById('match-log');
  if (logDiv) {
    logDiv.innerHTML = match.log.map(m => `<div class="log-entry">${escHtml(m)}</div>`).join('');
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}

function checkVictory() {
  if (!match) return;
  if (match.scoreA >= match.winPts || match.scoreB >= match.winPts) {
    clearTimer();
    match.timerRunning = false;
    const winner = match.scoreA >= match.winPts ? 'a' : 'b';
    showResultModal(winner);
  }
}

function toggleTimer() {
  if (!match || match.timeLimit === 0) return;
  if (match.timerRunning) {
    // Pausar
    clearTimer();
    match.timerRunning = false;
    document.getElementById('btn-timer').textContent = '▶ Continuar';
  } else {
    // Iniciar/retomar
    match.timerRunning = true;
    document.getElementById('btn-timer').textContent = '⏸ Pausar';
    timerInterval = setInterval(() => {
      if (!match || !match.timerRunning) return;
      match.timeLeft--;
      updateMatchUI();
      if (match.timeLeft <= 0) {
        clearTimer();
        match.timerRunning = false;
        document.getElementById('btn-timer').textContent = '⏹ Tempo Esgotado';
        // Determinar vencedor por pontos
        let winner = null;
        if (match.scoreA > match.scoreB) winner = 'a';
        else if (match.scoreB > match.scoreA) winner = 'b';
        // empate? decidimos por empate sem vencedor
        showResultModal(winner);
      }
    }, 1000);
  }
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function confirmEnd() {
  if (!match) return;
  clearTimer();
  match.timerRunning = false;
  // Determinar vencedor atual
  let winner = null;
  if (match.scoreA > match.scoreB) winner = 'a';
  else if (match.scoreB > match.scoreA) winner = 'b';
  showResultModal(winner);
}

function showResultModal(winner) {
  const modal = document.getElementById('arena-result-modal');
  if (!modal) return;

  const winnerName = winner ? getPlayerName(winner === 'a' ? match.playerA : match.playerB) : 'Empate';
  const trophy = winner ? '🏆' : '🤝';
  document.getElementById('modal-trophy').textContent = trophy;
  document.getElementById('modal-title').textContent = winner ? `${winnerName} venceu!` : 'Empate!';
  document.getElementById('modal-sub').textContent = `Placar final: ${match.scoreA} x ${match.scoreB}`;

  const scoresHtml = `
    <div style="display:flex;justify-content:center;gap:24px;align-items:center">
      <div style="text-align:center">
        <div style="font-family:'Cinzel Decorative',serif;font-size:28px;color:${winner === 'a' ? 'var(--gold2)' : 'var(--text3)'}">${getPlayerName(match.playerA)}</div>
        <div style="font-size:36px;font-weight:bold">${match.scoreA}</div>
      </div>
      <div style="font-family:'Cinzel',serif;font-size:20px;color:var(--text3)">VS</div>
      <div style="text-align:center">
        <div style="font-family:'Cinzel Decorative',serif;font-size:28px;color:${winner === 'b' ? 'var(--gold2)' : 'var(--text3)'}">${getPlayerName(match.playerB)}</div>
        <div style="font-size:36px;font-weight:bold">${match.scoreB}</div>
      </div>
    </div>
  `;
  document.getElementById('modal-scores').innerHTML = scoresHtml;

  modal.style.display = 'flex';
  // Armazena winner para registerResult
  modal._winner = winner;
}

function closeArenaModal() {
  document.getElementById('arena-result-modal').style.display = 'none';
  cancelMatch(); // volta ao setup sem registrar
}
window.closeArenaModal = closeArenaModal;

function registerResult() {
  const winner = document.getElementById('arena-result-modal')._winner;
  if (!match) return;

  // Registra partida na temporada atual
  const currentSeason = S.seasons.find(s => s.id === S.currentSeasonId);
  if (!currentSeason) {
    alert('Erro: temporada atual não encontrada.');
    return;
  }

  const newMatch = {
    id: 'm' + Date.now(),
    playerAId: match.playerA,
    playerBId: match.playerB,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    timestamp: new Date().toISOString(),
    winnerId: winner ? (winner === 'a' ? match.playerA : match.playerB) : null
  };

  currentSeason.matches.push(newMatch);
  saveState();

  // Fecha modal e volta ao setup
  document.getElementById('arena-result-modal').style.display = 'none';
  resetMatchUI();
  renderRanking();
  showToast('Resultado registrado!');
}

function resetMatchUI() {
  match = null;
  clearTimer();
  document.getElementById('setup-card').style.display = 'block';
  document.getElementById('match-card').style.display = 'none';
}

function cancelMatch() {
  resetMatchUI();
  // Não salva nada
}

// Toast simples
function showToast(msg) {
  const toast = document.getElementById('arena-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2000);
}

// ===================== RANKING =====================

function renderRanking() {
  if (!S) return;
  const currentSeason = S.seasons.find(s => s.id === S.currentSeasonId);
  if (!currentSeason) return;

  document.getElementById('season-title').textContent = currentSeason.name;
  document.getElementById('season-subtitle').textContent =
    `Iniciada em ${new Date(currentSeason.startDate).toLocaleDateString('pt-BR')}` +
    (currentSeason.endDate ? ` · Encerrada em ${new Date(currentSeason.endDate).toLocaleDateString('pt-BR')}` : '');

  document.getElementById('season-badge').textContent = currentSeason.endDate ? 'ENCERRADA' : 'ATIVA';

  // Calcula estatísticas da temporada
  const stats = calcSeasonStats(currentSeason);
  const sorted = Object.values(stats).sort((a, b) => b.points - a.points || b.wins - a.wins);

  const tbody = document.getElementById('rank-tbody');
  tbody.innerHTML = sorted.map((s, idx) => {
    const wr = s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escHtml(s.name)}</strong></td>
        <td>${s.points}</td>
        <td>${s.wins} / ${s.losses}</td>
        <td>${wr}%</td>
      </tr>
    `;
  }).join('');

  // Tiers (baseado no semestre)
  renderTiers();
  updateSemesterInfo();
  renderHistory();
}

function calcSeasonStats(season) {
  const map = {};
  // Inicializa com todos os players
  S.players.forEach(p => {
    map[p.id] = { name: p.name, points: 0, wins: 0, losses: 0, matches: 0 };
  });

  season.matches.forEach(m => {
    const a = map[m.playerAId];
    const b = map[m.playerBId];
    if (!a || !b) return;

    a.matches++;
    b.matches++;

    if (m.winnerId === m.playerAId) {
      a.wins++;
      b.losses++;
      a.points += 3;
      b.points += 1;
    } else if (m.winnerId === m.playerBId) {
      b.wins++;
      a.losses++;
      b.points += 3;
      a.points += 1;
    } else {
      // empate
      a.points += 1;
      b.points += 1;
    }
  });

  return map;
}

function renderTiers() {
  const container = document.getElementById('tiers-grid');
  if (!container) return;

  // Agrega todas as partidas do semestre
  const semesterStats = {};
  S.players.forEach(p => {
    semesterStats[p.id] = { name: p.name, wins: 0, losses: 0, matches: 0 };
  });

  const semesterSeasonIds = S.semesterSeasons || [S.currentSeasonId];
  semesterSeasonIds.forEach(seasonId => {
    const season = S.seasons.find(s => s.id === seasonId);
    if (!season) return;
    season.matches.forEach(m => {
      const a = semesterStats[m.playerAId];
      const b = semesterStats[m.playerBId];
      if (!a || !b) return;
      a.matches++;
      b.matches++;
      if (m.winnerId === m.playerAId) { a.wins++; b.losses++; }
      else if (m.winnerId === m.playerBId) { b.wins++; a.losses++; }
    });
  });

  const tierOrder = ['S', 'A', 'B', 'C', 'D'];
  const tiers = { S: [], A: [], B: [], C: [], D: [] };

  Object.values(semesterStats).forEach(stat => {
    if (stat.matches === 0) return;
    const wr = (stat.wins / stat.matches) * 100;
    if (wr >= 80) tiers.S.push(stat);
    else if (wr >= 65) tiers.A.push(stat);
    else if (wr >= 50) tiers.B.push(stat);
    else if (wr >= 35) tiers.C.push(stat);
    else tiers.D.push(stat);
  });

  container.innerHTML = tierOrder.map(tier => {
    const players = tiers[tier];
    return `
      <div class="tier-card">
        <div class="tier-label">${tier}</div>
        <div class="tier-players">
          ${players.map(p => `<div class="tier-player-name">${escHtml(p.name)}</div>`).join('') || '<div style="color:var(--text3);font-size:12px">—</div>'}
        </div>
      </div>
    `;
  }).join('');
}

function updateSemesterInfo() {
  document.getElementById('sem-info').textContent =
    `Início do semestre: ${new Date(S.semesterStart).toLocaleDateString('pt-BR')}`;
  document.getElementById('sem-seasons-count').textContent =
    `${S.semesterSeasons.length} temporada(s) no semestre`;
}

function renderHistory() {
  const historyDiv = document.getElementById('history-list');
  if (!historyDiv) return;

  // Lista campeões de cada temporada encerrada
  const closedSeasons = S.seasons.filter(s => s.endDate);
  if (closedSeasons.length === 0) {
    historyDiv.innerHTML = '<div style="color:var(--text3);font-style:italic">Nenhuma temporada concluída.</div>';
    return;
  }

  historyDiv.innerHTML = closedSeasons.map(season => {
    const stats = calcSeasonStats(season);
    const sorted = Object.values(stats).sort((a, b) => b.points - a.points);
    const champion = sorted[0];
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(180,140,60,0.15)">
        <span style="font-family:'Cinzel',serif;font-size:13px;color:var(--gold2)">${season.name}</span>
        <span style="font-size:14px;color:var(--text2)">${champion ? escHtml(champion.name) : '?'}</span>
        <span style="font-size:12px;color:var(--text3)">${new Date(season.endDate).toLocaleDateString('pt-BR')}</span>
      </div>
    `;
  }).join('');
}

// ---------- CRUD de Jogadores ----------
async function addPlayer() {
  const input = document.getElementById('new-player-name');
  const name = input.value.trim();
  if (!name) return alert('Digite um nome.');

  // Verifica duplicata
  if (S.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    alert('Jogador já existe.');
    return;
  }

  const newPlayer = { id: 'p' + Date.now(), name };
  S.players.push(newPlayer);
  await saveState();
  input.value = '';
  populateSelects();
  renderRanking();
}

async function importFromInscritos() {
  const inscritos = window._inscritosCache;
  if (!inscritos || inscritos.length === 0) {
    alert('Nenhum inscrito disponível. Cadastre membros primeiro.');
    return;
  }

  let added = 0;
  inscritos.forEach(i => {
    const name = i.nome.trim();
    if (!name) return;
    if (!S.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      S.players.push({ id: 'p' + Date.now() + Math.random(), name });
      added++;
    }
  });

  if (added > 0) {
    await saveState();
    populateSelects();
    renderRanking();
    document.getElementById('import-status').style.display = 'block';
    document.getElementById('import-status').textContent = `${added} combatente(s) importado(s).`;
  } else {
    alert('Todos os inscritos já são combatentes.');
  }
}

// ---------- Navegação entre temporadas ----------
function prevSeason() {
  const idx = S.seasons.findIndex(s => s.id === S.currentSeasonId);
  if (idx > 0) {
    S.currentSeasonId = S.seasons[idx - 1].id;
    renderRanking();
  }
}

function nextSeason() {
  const idx = S.seasons.findIndex(s => s.id === S.currentSeasonId);
  if (idx < S.seasons.length - 1) {
    S.currentSeasonId = S.seasons[idx + 1].id;
    renderRanking();
  }
}

// ---------- Resetar Semestre ----------
async function confirmReset() {
  if (!confirm('Isso encerrará a temporada atual (se ativa) e iniciará um novo semestre, resetando o ranking do semestre. Deseja continuar?')) return;

  // Encerra a temporada atual se ainda não estiver
  const current = S.seasons.find(s => s.id === S.currentSeasonId);
  if (current && !current.endDate) {
    current.endDate = new Date().toISOString();
  }

  // Cria nova temporada
  const newSeasonId = 's' + Date.now();
  const newSeason = {
    id: newSeasonId,
    name: `Temporada ${S.seasons.length + 1}`,
    startDate: new Date().toISOString(),
    endDate: null,
    matches: []
  };
  S.seasons.push(newSeason);
  S.currentSeasonId = newSeasonId;
  S.semesterStart = new Date().toISOString();
  S.semesterSeasons = [newSeasonId]; // apenas a nova temporada no novo semestre

  await saveState();
  renderRanking();
  alert('Novo semestre iniciado!');
}

// Expor funções globais para os botões HTML
window.addPlayer = addPlayer;
window.importFromInscritos = importFromInscritos;
window.prevSeason = prevSeason;
window.nextSeason = nextSeason;
window.confirmReset = confirmReset;
window.startMatch = startMatch;
window.addPoint = addPoint;
window.rmPoint = rmPoint;
window.toggleTimer = toggleTimer;
window.confirmEnd = confirmEnd;
window.registerResult = registerResult;
window.cancelMatch = cancelMatch;

// Inicialização ao trocar para aba arena (já existe listener)