// ===================== CHAMADA DE PRESENÇA (REFATORADA) =====================
// Dependências:
//   - utils.js: escHtml, escAttr, fmtDate, fmtNum
//   - supabase_init.js: SUPABASE_URL, window._supabase
//   - inscritos_tab.js: window.loadInscritos (async), window.showLoading
// Compartilha caches globais: window._inscritosCache, window._chamadaCache

const CHAMADA_SESSAO_KEY = 'cachorroboros_chamada_sessao';
let chamadaSessao = {};

// ---------- localStorage da sessão atual ----------
function loadSessaoAtual() {
  try {
    return JSON.parse(localStorage.getItem(CHAMADA_SESSAO_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSessaoAtual(obj) {
  try {
    localStorage.setItem(CHAMADA_SESSAO_KEY, JSON.stringify(obj));
  } catch {}
}

// ---------- Garantia de dados carregados ----------
async function ensureInscritosLoaded() {
  if (!window._inscritosCache || !window._inscritosCache.length) {
    if (typeof window.loadInscritos === 'function') {
      await window.loadInscritos();       // definida em inscritos_tab.js
    } else {
      // fallback direto (caso o script de inscritos não esteja presente)
      const { data, error } = await window._supabase
        .from('inscritos')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      window._inscritosCache = data || [];
    }
  }
  return window._inscritosCache;
}

async function ensureChamadasLoaded() {
  if (!window._chamadaCache || !window._chamadaCache.length) {
    const { data, error } = await window._supabase
      .from('chamadas')
      .select('*')
      .order('data', { ascending: false });
    if (error) throw error;
    window._chamadaCache = data || [];
  }
  return window._chamadaCache;
}

// Acessos síncronos (cache já deve estar populado)
function getInscritos() {
  return window._inscritosCache || [];
}
function getChamadas() {
  return window._chamadaCache || [];
}

// ---------- Renderização da lista de chamada ----------
async function renderChamada() {
  const arr = getInscritos();
  const q = (document.getElementById('search-chamada')?.value || '').toLowerCase().trim();
  const filtered = q ? arr.filter(i => i.nome.toLowerCase().includes(q)) : arr;
  const list = document.getElementById('chamada-list');

  const totalGeral = arr.length;
  const presentesTotal = arr.filter(i => chamadaSessao[i.id]).length;
  document.getElementById('ch-total').textContent = totalGeral;
  document.getElementById('ch-presentes').textContent = presentesTotal;
  document.getElementById('ch-ausentes').textContent = totalGeral - presentesTotal;

  // Estado vazio global
  if (arr.length === 0) {
    list.innerHTML = `<div class="chamada-empty">⚠️ Nenhum membro inscrito encontrado.<br>Cadastre membros na aba <strong>Inscrição</strong> primeiro.</div>`;
    return;
  }

  // Nenhum resultado na busca
  if (filtered.length === 0) {
    list.innerHTML = `<div class="chamada-empty">Nenhum resultado para "<strong>${escHtml(q)}</strong>"</div>`;
    return;
  }

  // Ordena: presentes primeiro, depois por nome
  const sorted = [...filtered].sort((a, b) => {
    const aPres = !!chamadaSessao[a.id];
    const bPres = !!chamadaSessao[b.id];
    if (aPres && !bPres) return -1;
    if (!aPres && bPres) return 1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  list.innerHTML = sorted
    .map(i => {
      const presente = !!chamadaSessao[i.id];
      return `
      <div class="chamada-member ${presente ? 'present' : ''}" onclick="togglePresenca(${i.id})">
        <div class="chamada-check">${presente ? '✓' : ''}</div>
        <div class="chamada-member-name">${escHtml(i.nome)}${i.menor ? ' <span class="pill pill-menor" style="font-size:10px">Menor</span>' : ''}</div>
        <div class="chamada-member-meta">
          ${i.idade ? `<span>🎂 ${i.idade} anos</span>` : ''}
          ${i.restricao ? `<span style="color:var(--red-light)">⚠ Restrição</span>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

// ---------- Marcação de presença ----------
function togglePresenca(id) {
  chamadaSessao[id] = !chamadaSessao[id];
  saveSessaoAtual(chamadaSessao);
  renderChamada(); // re-renderiza imediatamente
}

// ---------- Salvamento no banco ----------
async function salvarChamada() {
  const arr = getInscritos();
  if (arr.length === 0) {
    alert('Nenhum membro cadastrado.');
    return;
  }

  const presentes = arr
    .filter(i => chamadaSessao[i.id])
    .map(i => ({ id: i.id, nome: i.nome }));

  if (presentes.length === 0 && !confirm('Nenhum membro marcado. Salvar chamada vazia?')) return;

  const hoje = new Date();
  const dateKey = hoje.toISOString().split('T')[0];
  const dataFmt = hoje.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  window.showLoading?.(true);
  try {
    const { error } = await window._supabase.from('chamadas').upsert(
      {
        data: dateKey,
        data_fmt: dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1),
        total: arr.length,
        presentes,
        saved_at: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      },
      { onConflict: 'data' }
    );

    if (error) throw error;

    // Recarrega o cache de chamadas (garante sincronia)
    await ensureChamadasLoaded();
    chamadaSessao = {};
    saveSessaoAtual({});
    await renderChamada();

    alert(`✅ Chamada salva! ${presentes.length} de ${arr.length} presentes.`);
  } catch (err) {
    alert('Erro ao salvar chamada: ' + err.message);
    console.error(err);
  } finally {
    window.showLoading?.(false);
  }
}

// ---------- Reset da sessão atual ----------
function resetarChamada() {
  if (!confirm('Limpar todas as marcações do dia?')) return;
  chamadaSessao = {};
  saveSessaoAtual({});
  renderChamada();
}

// ---------- Relatório de presença ----------
async function renderRelatorio() {
  const chamadas = getChamadas();
  const sessionsEl = document.getElementById('relatorio-sessions');
  const statsEl = document.getElementById('relatorio-member-stats');

  // Histórico vazio
  if (chamadas.length === 0) {
    sessionsEl.innerHTML = `<div class="chamada-empty" style="border:1px solid var(--border);border-radius:4px;padding:48px">📭 Nenhuma chamada salva ainda.</div>`;
    statsEl.style.display = 'none';
    return;
  }

  // Lista de sessões
  sessionsEl.innerHTML = chamadas
    .map(
      (c, idx) => `
    <div class="relatorio-session">
      <div class="relatorio-session-head" onclick="toggleRelatorioSession(${idx})">
        <div>
          <div class="relatorio-session-date">${escHtml(c.data_fmt)}</div>
          <div style="font-size:12px;color:var(--warm-gray);margin-top:3px">Salvo às ${escHtml(c.saved_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <div class="relatorio-session-count">${c.presentes.length}<span style="font-family:var(--font-body,'Barlow');font-size:14px;color:var(--warm-gray)"> / ${c.total}</span></div>
          <span style="color:var(--warm-gray);font-size:18px" id="relatorio-chevron-${idx}">▾</span>
        </div>
      </div>
      <div class="relatorio-session-body" id="relatorio-body-${idx}">
        ${
          c.presentes.length === 0
            ? '<span style="color:var(--warm-gray);font-size:13px">Nenhum presente.</span>'
            : c.presentes.map(p => `<div class="relatorio-pill">${escHtml(p.nome)}</div>`).join('')
        }
      </div>
    </div>`
    )
    .join('');

  // Frequência por membro
  const inscritos = getInscritos();
  if (inscritos.length > 0) {
    statsEl.style.display = 'block';
    const freqMap = {};
    inscritos.forEach(i => {
      freqMap[i.id] = { nome: i.nome, count: 0 };
    });
    chamadas.forEach(c =>
      c.presentes.forEach(p => {
        if (freqMap[p.id]) freqMap[p.id].count++;
      })
    );

    const total = chamadas.length;
    const sorted = Object.values(freqMap).sort((a, b) => b.count - a.count);

    document.getElementById('relatorio-freq-list').innerHTML = sorted
      .map(m => {
        const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
        return `
        <div class="relatorio-member-row">
          <div class="relatorio-member-row-name">${escHtml(m.nome)}</div>
          <div class="relatorio-freq-bar-wrap">
            <div class="relatorio-freq-bar"><div class="relatorio-freq-fill" style="width:${pct}%"></div></div>
            <div class="relatorio-freq-pct">${pct}%</div>
          </div>
          <div class="relatorio-freq-count">${m.count} de ${total}</div>
        </div>`;
      })
      .join('');
  } else {
    statsEl.style.display = 'none';
  }
}

// Alterna a exibição do corpo de uma sessão no relatório
function toggleRelatorioSession(idx) {
  const body = document.getElementById('relatorio-body-' + idx);
  const chev = document.getElementById('relatorio-chevron-' + idx);
  if (!body || !chev) return;
  body.classList.toggle('collapsed');
  chev.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
}

// ---------- Limpeza do histórico ----------
async function limparHistorico() {
  if (!confirm('Apagar TODO o histórico de chamadas? Esta ação é irreversível.')) return;

  window.showLoading?.(true);
  try {
    const { error } = await window._supabase.from('chamadas').delete().neq('data', '');
    if (error) throw error;
    window._chamadaCache = [];
    await renderRelatorio();
    alert('Histórico limpo com sucesso.');
  } catch (err) {
    alert('Erro ao limpar histórico: ' + err.message);
    console.error(err);
  } finally {
    window.showLoading?.(false);
  }
}

// ---------- Exportação PDF ----------
function exportarRelatorioPDF() {
  const chamadas = getChamadas();
  if (chamadas.length === 0) {
    alert('Nenhum histórico de chamadas para exportar.');
    return;
  }

  const inscritos = getInscritos();
  const hoje = new Date().toLocaleDateString('pt-BR');

  // Mapa de frequência
  const freqMap = {};
  inscritos.forEach(i => {
    freqMap[i.id] = { nome: i.nome, count: 0 };
  });
  chamadas.forEach(c =>
    c.presentes.forEach(p => {
      if (freqMap[p.id]) freqMap[p.id].count++;
    })
  );

  const total = chamadas.length;
  const freqSorted = Object.values(freqMap).sort((a, b) => b.count - a.count);

  // Linhas das tabelas (com escape em nomes)
  const sessoesRows = chamadas
    .map(
      (c, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f9f9f9' : '#fff'}">
      <td>${idx + 1}</td>
      <td><strong>${escHtml(c.data_fmt)}</strong></td>
      <td style="color:#27ae60">${c.presentes.length}</td>
      <td>${c.total}</td>
      <td>${total > 0 ? Math.round((c.presentes.length / c.total) * 100) : 0}%</td>
      <td style="font-size:9px">${c.presentes.map(p => escHtml(p.nome)).join(', ') || '—'}</td>
    </tr>`
    )
    .join('');

  const freqRows = freqSorted
    .map(
      (m, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f9f9f9' : '#fff'}">
      <td>${idx + 1}</td>
      <td><strong>${escHtml(m.nome)}</strong></td>
      <td style="color:#27ae60">${m.count}</td>
      <td>${total}</td>
      <td>${total > 0 ? Math.round((m.count / total) * 100) : 0}%</td>
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cachorroboros — Relatório de Presença</title>
  <style>
    @page{size:A4 landscape;margin:16mm 12mm}
    body{font-family:Arial,sans-serif;font-size:10px;color:#222;margin:0}
    .header{margin-bottom:14px;border-bottom:2px solid #D42020;padding-bottom:10px}
    .title{font-size:20px;font-weight:bold;color:#D42020}
    .sub{font-size:10px;color:#666;margin-top:3px}
    h3{font-size:13px;color:#D42020;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:20px}
    th{background:#D42020;color:white;padding:6px 7px;text-align:left}
    td{padding:5px 7px;border-bottom:1px solid #e0e0e0;vertical-align:top}
    .footer{margin-top:12px;font-size:9px;color:#aaa;text-align:right}
  </style>
</head>
<body>
  <div class="header">
    <div class="title">⚔ CACHORROBOROS SWORDPLAY — RELATÓRIO DE PRESENÇA</div>
    <div class="sub">Araras/SP · Gerado em: ${hoje} · Total de treinos: ${total}</div>
  </div>
  <h3>Histórico de Treinos</h3>
  <table>
    <thead><tr><th>#</th><th>Data</th><th>Presentes</th><th>Total</th><th>Freq.</th><th>Membros presentes</th></tr></thead>
    <tbody>${sessoesRows}</tbody>
  </table>
  <h3>Frequência por Membro</h3>
  <table>
    <thead><tr><th>#</th><th>Membro</th><th>Treinos</th><th>Total</th><th>Frequência</th></tr></thead>
    <tbody>${freqRows}</tbody>
  </table>
  <div class="footer">Cachorroboros Swordplay · @Cachorroboros · Araras/SP</div>
  <script>window.onload=function(){window.print()}<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// ---------- Controle de visualização (Chamada / Relatório) ----------
function showChamadaView(view) {
  const viewChamada = document.getElementById('view-chamada');
  const viewRelatorio = document.getElementById('view-relatorio');
  const toggleChamada = document.getElementById('toggle-chamada');
  const toggleRelatorio = document.getElementById('toggle-relatorio');

  if (viewChamada) viewChamada.style.display = view === 'chamada' ? 'block' : 'none';
  if (viewRelatorio) viewRelatorio.classList.toggle('show', view === 'relatorio');
  if (toggleChamada) toggleChamada.classList.toggle('active', view === 'chamada');
  if (toggleRelatorio) toggleRelatorio.classList.toggle('active', view === 'relatorio');

  if (view === 'relatorio') {
    renderRelatorio();
  } else {
    renderChamada();
  }
}

// ---------- Inicialização (chamada ao carregar a aba) ----------
async function initChamada() {
  try {
    window.showLoading?.(true);

    // Data por extenso no cabeçalho
    const hoje = new Date();
    const label = hoje.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const headerEl = document.getElementById('chamada-hoje');
    if (headerEl) headerEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);

    // Garante que os dados básicos estejam no cache
    await Promise.all([ensureInscritosLoaded(), ensureChamadasLoaded()]);

    // Carrega a sessão de marcação do dia (localStorage)
    chamadaSessao = loadSessaoAtual();

    // Renderiza a visualização ativa
    if (document.getElementById('view-chamada')?.style.display !== 'none') {
      await renderChamada();
    }
    if (document.getElementById('view-relatorio')?.classList.contains('show')) {
      await renderRelatorio();
    }
  } catch (err) {
    console.error('Erro ao inicializar a chamada:', err);
    alert('Não foi possível carregar os dados da chamada. Verifique sua conexão.');
  } finally {
    window.showLoading?.(false);
  }
}

// ---------- Exposição de funções globais ----------
window.initChamada = initChamada;
window.showChamadaView = showChamadaView;
window.togglePresenca = togglePresenca;
window.salvarChamada = salvarChamada;
window.resetarChamada = resetarChamada;
window.toggleRelatorioSession = toggleRelatorioSession;
window.limparHistorico = limparHistorico;
window.exportarRelatorioPDF = exportarRelatorioPDF;

// ---------- Eventos do DOM ----------
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-chamada');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderChamada());
  }
});