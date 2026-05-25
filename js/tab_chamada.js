// ===================== CHAMADA DE PRESENÇA =====================

const CHAMADA_SESSAO_KEY = 'cachorroboros_chamada_sessao';
let chamadaSessao = {};

function loadSessaoAtual() {
  try { return JSON.parse(localStorage.getItem(CHAMADA_SESSAO_KEY) || '{}'); }
  catch(e) { return {}; }
}

function saveSessaoAtual(obj) {
  try { localStorage.setItem(CHAMADA_SESSAO_KEY, JSON.stringify(obj)); }
  catch(e) {}
}

function initChamada() {
  const hoje = new Date();
  const label = hoje.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('chamada-hoje').textContent = label.charAt(0).toUpperCase() + label.slice(1);
  chamadaSessao = loadSessaoAtual();
  renderChamada();
  renderRelatorio();
}

function showChamadaView(view) {
  document.getElementById('view-chamada').style.display = view === 'chamada' ? 'block' : 'none';
  document.getElementById('view-relatorio').classList.toggle('show', view === 'relatorio');
  document.getElementById('toggle-chamada').classList.toggle('active', view === 'chamada');
  document.getElementById('toggle-relatorio').classList.toggle('active', view === 'relatorio');
  if (view === 'relatorio') renderRelatorio();
}

function renderChamada() {
  const arr = loadInscritos();
  const q = (document.getElementById('search-chamada')?.value || '').toLowerCase().trim();
  const filtered = q ? arr.filter(i => i.nome.toLowerCase().includes(q)) : arr;
  const list = document.getElementById('chamada-list');
  const totalGeral = arr.length;
  const presentesTotal = arr.filter(i => chamadaSessao[i.id]).length;
  document.getElementById('ch-total').textContent = totalGeral;
  document.getElementById('ch-presentes').textContent = presentesTotal;
  document.getElementById('ch-ausentes').textContent = totalGeral - presentesTotal;

  if (arr.length === 0) {
    list.innerHTML = `<div class="chamada-empty">⚠️ Nenhum membro inscrito encontrado.<br>Cadastre membros na aba <strong>Inscrição</strong> primeiro.</div>`;
    return;
  }
  if (filtered.length === 0) {
    list.innerHTML = `<div class="chamada-empty">Nenhum resultado para "<strong>${escHtml(q)}</strong>"</div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    if (chamadaSessao[a.id] && !chamadaSessao[b.id]) return -1;
    if (!chamadaSessao[a.id] && chamadaSessao[b.id]) return 1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  list.innerHTML = sorted.map(i => {
    const presente = !!chamadaSessao[i.id];
    return `<div class="chamada-member ${presente ? 'present' : ''}" onclick="togglePresenca(${i.id})">
      <div class="chamada-check">${presente ? '✓' : ''}</div>
      <div class="chamada-member-name">${escHtml(i.nome)}${i.menor ? ' <span class="pill pill-menor" style="font-size:10px">Menor</span>' : ''}</div>
      <div class="chamada-member-meta">${i.idade ? `<span>🎂 ${i.idade} anos</span>` : ''}${i.restricao ? `<span style="color:var(--red-light)">⚠ Restrição</span>` : ''}</div>
    </div>`;
  }).join('');
}

function togglePresenca(id) {
  chamadaSessao[id] = !chamadaSessao[id];
  saveSessaoAtual(chamadaSessao);
  renderChamada();
}

async function salvarChamada() {
  const arr = loadInscritos();
  if (arr.length === 0) { alert('Nenhum membro cadastrado.'); return; }
  const presentes = arr.filter(i => chamadaSessao[i.id]).map(i => ({ id: i.id, nome: i.nome }));
  if (presentes.length === 0 && !confirm('Nenhum membro marcado. Salvar chamada vazia?')) return;

  const hoje = new Date();
  const dateKey = hoje.toISOString().split('T')[0];
  const dataFmt = hoje.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const { error } = await supabase
    .from('chamadas')
    .upsert({
      data: dateKey,
      data_fmt: dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1),
      total: arr.length,
      presentes,
      saved_at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }, { onConflict: 'data' });

  if (error) { alert('Erro ao salvar: ' + error.message); return; }

  // Recarrega cache
  await loadChamadasAsync();
  chamadaSessao = {};
  saveSessaoAtual({});
  renderChamada();
  alert(`✅ Chamada salva! ${presentes.length} de ${arr.length} presentes.`);
}

function resetarChamada() {
  if (!confirm('Limpar marcações?')) return;
  chamadaSessao = {};
  saveSessaoAtual({});
  renderChamada();
}

async function loadChamadasAsync() {
  const { data, error } = await supabase
    .from('chamadas')
    .select('*')
    .order('data', { ascending: false });
  if (error) { console.error('Erro ao carregar chamadas:', error); return _chamadaCache; }
  _chamadaCache = data;
  return _chamadaCache;
}

function loadChamadas() { return _chamadaCache; }

function renderRelatorio() {
  const chamadas = loadChamadas();
  const sessionsEl = document.getElementById('relatorio-sessions');
  const statsEl = document.getElementById('relatorio-member-stats');
  if (chamadas.length === 0) {
    sessionsEl.innerHTML = `<div class="chamada-empty" style="border:1px solid var(--border);border-radius:4px;padding:48px">📭 Nenhuma chamada salva ainda.</div>`;
    statsEl.style.display = 'none';
    return;
  }

  sessionsEl.innerHTML = chamadas.map((c, idx) => `
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
        ${c.presentes.length === 0 ? '<span style="color:var(--warm-gray);font-size:13px">Nenhum presente.</span>' : c.presentes.map(p => `<div class="relatorio-pill">${escHtml(p.nome)}</div>`).join('')}
      </div>
    </div>`).join('');

  const inscritos = loadInscritos();
  if (inscritos.length > 0) {
    statsEl.style.display = 'block';
    const freqMap = {};
    inscritos.forEach(i => { freqMap[i.id] = { nome: i.nome, count: 0 }; });
    chamadas.forEach(c => c.presentes.forEach(p => { if (freqMap[p.id]) freqMap[p.id].count++; }));
    const total = chamadas.length;
    const sorted = Object.values(freqMap).sort((a, b) => b.count - a.count);
    document.getElementById('relatorio-freq-list').innerHTML = sorted.map(m => {
      const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
      return `<div class="relatorio-member-row">
        <div class="relatorio-member-row-name">${escHtml(m.nome)}</div>
        <div class="relatorio-freq-bar-wrap">
          <div class="relatorio-freq-bar"><div class="relatorio-freq-fill" style="width:${pct}%"></div></div>
          <div class="relatorio-freq-pct">${pct}%</div>
        </div>
        <div class="relatorio-freq-count">${m.count} de ${total}</div>
      </div>`;
    }).join('');
  } else {
    statsEl.style.display = 'none';
  }
}

function toggleRelatorioSession(idx) {
  const body = document.getElementById('relatorio-body-' + idx);
  const chev = document.getElementById('relatorio-chevron-' + idx);
  body.classList.toggle('collapsed');
  chev.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
}

async function limparHistorico() {
  if (!confirm('Apagar TODO o histórico de chamadas?')) return;
  const { error } = await supabase.from('chamadas').delete().neq('data', '');
  if (error) { alert('Erro ao limpar: ' + error.message); return; }
  _chamadaCache = [];
  renderRelatorio();
}

function exportarRelatorioPDF() {
  const chamadas = loadChamadas();
  if (chamadas.length === 0) { alert('Nenhum histórico.'); return; }
  const inscritos = loadInscritos();
  const hoje = new Date().toLocaleDateString('pt-BR');
  const freqMap = {};
  inscritos.forEach(i => { freqMap[i.id] = { nome: i.nome, count: 0 }; });
  chamadas.forEach(c => c.presentes.forEach(p => { if (freqMap[p.id]) freqMap[p.id].count++; }));
  const total = chamadas.length;
  const freqSorted = Object.values(freqMap).sort((a, b) => b.count - a.count);

  const sessoesRows = chamadas.map((c, idx) => `<tr style="background:${idx%2===0?'#f9f9f9':'#fff'}"><td>${idx+1}</td><td><strong>${c.data_fmt}</strong></td><td style="color:#27ae60">${c.presentes.length}</td><td>${c.total}</td><td>${total>0?Math.round((c.presentes.length/c.total)*100):0}%</td><td style="font-size:9px">${c.presentes.map(p=>p.nome).join(', ')||'—'}</td></tr>`).join('');
  const freqRows = freqSorted.map((m, idx) => `<tr style="background:${idx%2===0?'#f9f9f9':'#fff'}"><td>${idx+1}</td><td><strong>${m.nome}</strong></td><td style="color:#27ae60">${m.count}</td><td>${total}</td><td>${total>0?Math.round((m.count/total)*100):0}%</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Cachorroboros — Relatório</title><style>@page{size:A4 landscape;margin:16mm 12mm}body{font-family:Arial,sans-serif;font-size:10px;color:#222;margin:0}.header{margin-bottom:14px;border-bottom:2px solid #D42020;padding-bottom:10px}.title{font-size:20px;font-weight:bold;color:#D42020}.sub{font-size:10px;color:#666;margin-top:3px}h3{font-size:13px;color:#D42020;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:20px}th{background:#D42020;color:white;padding:6px 7px;text-align:left}td{padding:5px 7px;border-bottom:1px solid #e0e0e0;vertical-align:top}.footer{margin-top:12px;font-size:9px;color:#aaa;text-align:right}</style></head><body><div class="header"><div class="title">⚔ CACHORROBOROS SWORDPLAY — RELATÓRIO DE PRESENÇA</div><div class="sub">Araras/SP · Gerado em: ${hoje} · Total de treinos: ${total}</div></div><h3>Histórico de Treinos</h3><table><thead><tr><th>#</th><th>Data</th><th>Presentes</th><th>Total</th><th>Freq.</th><th>Membros presentes</th></tr></thead><tbody>${sessoesRows}</tbody></table><h3>Frequência por Membro</h3><table><thead><tr><th>#</th><th>Membro</th><th>Treinos</th><th>Total</th><th>Frequência</th></tr></thead><tbody>${freqRows}</tbody></table><div class="footer">Cachorroboros Swordplay · @Cachorroboros · Araras/SP</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}