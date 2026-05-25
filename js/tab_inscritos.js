// ===================== TABELA DE INSCRITOS (ADMIN) – REFATORADA =====================
// Dependências globais:
//   escHtml, escAttr, fmtDate, fmtNum (utils.js)
//   SUPABASE_URL, window._supabase (supabase_init.js)
//   _inscritosCache (cache global, compartilhado com auth.js)

// ---------------------------
// 1. CARREGAMENTO DE DADOS
// ---------------------------

/**
 * Carrega os inscritos do Supabase, atualiza o cache global e retorna os dados.
 * Deve ser usada tanto no login quanto na atualização manual da aba.
 */
async function loadInscritosData() {
  const { data, error } = await window._supabase
    .from('inscritos')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;
  window._inscritosCache = data || [];
  return window._inscritosCache;
}

// Substitui a função global que o auth.js chama (se houver)
window.loadInscritos = loadInscritosData;

// ---------------------------
// 2. BUSCA DE DADOS SENSÍVEIS
// ---------------------------

/**
 * Obtém CPF e RG para uma lista de IDs. Retorna um Map id -> {cpf, rg}.
 * Se a sessão não existir ou a requisição falhar, retorna 🔒 para ambos.
 */
async function fetchSensitiveDataBatch(ids) {
  if (!ids.length) return new Map();
  
  const session = (await window._supabase.auth.getSession()).data.session;
  if (!session) return new Map(ids.map(id => [id, { cpf: '🔒', rg: '🔒' }]));

  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(`${SUPABASE_URL}/functions/v1/get-sensitive-data?id=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
    )
  );

  const map = new Map();
  ids.forEach((id, index) => {
    const result = results[index];
    if (result.status === 'fulfilled' && result.value.ok) {
      // Nota: a resposta é lida apenas se bem-sucedida; como não podemos usar .json()
      // dentro do map, faremos uma segunda passagem assíncrona para ler os corpos.
      // Para simplificar, deixaremos a leitura real para depois.
      // (ver implementação final abaixo)
    } else {
      map.set(id, { cpf: '🔒', rg: '🔒' });
    }
  });

  // Segunda passagem para leitura do JSON
  await Promise.allSettled(
    ids.map(async (id, index) => {
      const result = results[index];
      if (result.status !== 'fulfilled' || !result.value.ok) return;
      try {
        const data = await result.value.json();
        map.set(id, { cpf: data.cpf || '—', rg: data.rg || '—' });
      } catch {
        map.set(id, { cpf: '🔒', rg: '🔒' });
      }
    })
  );

  // Garante que todos os IDs estejam no mapa
  ids.forEach(id => {
    if (!map.has(id)) map.set(id, { cpf: '🔒', rg: '🔒' });
  });

  return map;
}

// ---------------------------
// 3. EXCLUSÃO DE INSCRIÇÃO
// ---------------------------

async function deleteInscrito(id) {
  if (!confirm('Remover esta inscrição? Esta ação não pode ser desfeita.')) return;

  const loading = showLoading(true);
  try {
    const { error } = await window._supabase.from('inscritos').delete().eq('id', id);
    if (error) throw error;

    window._inscritosCache = window._inscritosCache.filter(i => i.id !== id);
    await refreshTableAndStats();
  } catch (err) {
    alert('Erro ao remover inscrição: ' + err.message);
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// ---------------------------
// 4. ESTATÍSTICAS
// ---------------------------

function updateStats() {
  const arr = window._inscritosCache;
  document.getElementById('st-total').textContent   = arr.length;
  document.getElementById('st-menores').textContent = arr.filter(i => i.menor).length;
  document.getElementById('st-restric').textContent = arr.filter(i => i.restricao_flag).length;
  document.getElementById('st-imagem').textContent  = arr.filter(i => i.aceita_imagem).length;
}

// ---------------------------
// 5. RENDERIZAÇÃO DA TABELA
// ---------------------------

let currentSearchTerm = '';

async function renderTable(searchTerm = currentSearchTerm) {
  currentSearchTerm = searchTerm || '';
  const arr = window._inscritosCache;
  const q = currentSearchTerm.toLowerCase().trim();
  const filtered = q ? arr.filter(i => i.nome.toLowerCase().includes(q)) : arr;

  const tbody = document.getElementById('inscritos-tbody');
  const emptyState = document.getElementById('empty-state');
  const tableWrap = document.querySelector('.table-wrap');

  updateStats();

  // Estado completamente vazio (sem inscritos cadastrados)
  if (arr.length === 0) {
    if (tableWrap) tableWrap.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    tbody.innerHTML = '';
    return;
  }

  // Estado com dados (mesmo que a busca não encontre nada)
  if (tableWrap) tableWrap.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  // Busca sensível em lote para os IDs filtrados (otimização)
  const displayedIds = filtered.map(i => i.id);
  const sensitiveMap = await fetchSensitiveDataBatch(displayedIds);

  const rowsHtml = filtered.map((i, idx) => {
    const sens = sensitiveMap.get(i.id) || { cpf: '🔒', rg: '🔒' };
    return `
    <tr>
      <td style="color:var(--warm-gray);font-size:12px">${idx + 1}</td>
      <td class="td-name">${escHtml(i.nome)}${i.menor ? '<br><span class="pill pill-menor">Menor</span>' : ''}</td>
      <td>${fmtDate(i.data_nasc)}</td>
      <td>${i.idade || '—'}</td>
      <td style="white-space:nowrap">${escHtml(i.whatsapp)}</td>
      <td>${escHtml(sens.rg)}</td>
      <td style="font-size:12px">${escHtml(sens.cpf)}</td>
      <td>${i.menor ? '<span class="pill pill-menor">Sim</span>' : '<span class="pill pill-no">Não</span>'}</td>
      <td>${i.restricao ? `<span class="pill pill-restric" title="${escAttr(i.restricao)}">Sim</span>` : '<span class="pill pill-ok">Não</span>'}</td>
      <td>${i.aceita_imagem ? '<span class="pill pill-ok">Autorizado</span>' : '<span class="pill pill-no">Não</span>'}</td>
      <td style="font-size:12px;white-space:nowrap">${i.created_at ? new Date(i.created_at).toLocaleDateString('pt-BR') : '—'}</td>
      <td>
        <div class="td-actions">
          <button class="act-btn act-wpp" title="WhatsApp" onclick="sendWpp('${escAttr(i.whatsapp)}','${escAttr(i.nome)}')">💬</button>
          <button class="act-btn act-del" title="Remover" onclick="deleteInscrito(${i.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--warm-gray);font-size:14px">Nenhum resultado para "${escHtml(q)}"</td></tr>`;
  } else {
    tbody.innerHTML = rowsHtml.join('');
  }
}

// Atualiza estatísticas e renderiza a tabela mantendo o termo de busca atual
async function refreshTableAndStats() {
  updateStats();
  await renderTable();
}

// ---------------------------
// 6. WHATSAPP (mantido)
// ---------------------------

function sendWpp(whatsapp, nome) {
  const num = fmtNum(whatsapp);
  if (!num) { alert('Número de WhatsApp inválido.'); return; }
  const msg = encodeURIComponent(`Olá, ${nome}! 🗡️\n\nSua inscrição no *Cachorroboros Swordplay* foi confirmada!\n\n📍 Parque Ecológico "Gilberto Ruegger Ometto" — Araras/SP\n📅 Domingos, das *9h às 12h*\n\nApareça com roupa confortável. Nos vemos em campo! ⚔️\n\n— Cachorroboros Swordplay · @Cachorroboros`);
  window.open('https://wa.me/55' + num + '?text=' + msg, '_blank');
}

function openWppModal() {
  const arr = window._inscritosCache;
  if (arr.length === 0) { alert('Nenhum inscrito cadastrado ainda.'); return; }
  const list = document.getElementById('wpp-modal-list');
  list.innerHTML = arr.map(i => {
    const num = fmtNum(i.whatsapp);
    const msg = encodeURIComponent(`Olá, ${i.nome}! 🗡️\n\nSua inscrição no *Cachorroboros Swordplay* foi confirmada!\n\n📍 Parque Ecológico "Gilberto Ruegger Ometto" — Araras/SP\n📅 Domingos, das *9h às 12h*\n\nApareça com roupa confortável. Nos vemos em campo! ⚔️\n\n— Cachorroboros Swordplay · @Cachorroboros`);
    const href = num ? 'https://wa.me/55' + num + '?text=' + msg : '#';
    return `<div class="modal-person">
      <div class="modal-person-info">
        <div class="p-name">${escHtml(i.nome)}${i.menor ? ' <span class="pill pill-menor" style="font-size:10px">Menor</span>' : ''}</div>
        <div class="p-tel">${escHtml(i.whatsapp) || 'Sem número'}</div>
      </div>
      ${num ? `<a class="modal-wpp-link" href="${href}" target="_blank">💬 Abrir</a>` : '<span style="font-size:12px;color:var(--warm-gray)">Sem número</span>'}
    </div>`;
  }).join('');
  document.getElementById('wpp-modal-bg').classList.add('open');
}

function closeWppModal(e) {
  if (!e || e.target === document.getElementById('wpp-modal-bg'))
    document.getElementById('wpp-modal-bg').classList.remove('open');
}

function sendCustomWpp() {
  const num = fmtNum(document.getElementById('wpp-custom-input').value);
  if (num.length < 10) { alert('Digite um número válido.'); return; }
  const msg = encodeURIComponent(`Olá! 🗡️\n\nVocê está recebendo um contato do *Cachorroboros Swordplay*!\n\n📍 Parque Ecológico "Gilberto Ruegger Ometto" — Araras/SP\n📅 Domingos, das *9h às 12h*\n\n⚔️ Venha treinar com a gente!\n\n@Cachorroboros`);
  window.open('https://wa.me/55' + num + '?text=' + msg, '_blank');
}

// ---------------------------
// 7. EXPORTAÇÕES (PDF e XLSX)
// ---------------------------

async function exportPDF() {
  const arr = window._inscritosCache;
  if (arr.length === 0) { alert('Nenhum inscrito para exportar.'); return; }
  const hoje = new Date().toLocaleDateString('pt-BR');

  const rows = arr.map((i, idx) => `
    <tr style="background:${idx%2===0?'#f4f4f4':'#fff'}">
      <td>${idx+1}</td>
      <td><strong>${escHtml(i.nome)}</strong>${i.menor ? ' <span class="badge-m">Menor</span>' : ''}</td>
      <td>${fmtDate(i.data_nasc)}</td>
      <td>${i.idade || '—'}</td>
      <td>${escHtml(i.whatsapp)}</td>
      <td>Confidencial</td>
      <td>Confidencial</td>
      <td>${escHtml(i.endereco || '—')}</td>
      <td style="color:${i.restricao ? '#c0392b' : '#27ae60'}">${i.restricao || 'Não'}</td>
      <td>${i.menor ? (escHtml(i.resp_nome||'') + (i.resp_whatsapp ? ' — ' + escHtml(i.resp_whatsapp) : '')) : '—'}</td>
      <td style="color:${i.aceita_imagem ? '#27ae60' : '#999'}">${i.aceita_imagem ? 'Autorizado' : 'Não'}</td>
      <td>${i.created_at ? new Date(i.created_at).toLocaleDateString('pt-BR') : '—'}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Cachorroboros — Inscritos</title><style>@page{size:A4 landscape;margin:16mm 12mm}body{font-family:Arial,sans-serif;font-size:10px;color:#222;margin:0}.header{margin-bottom:14px;border-bottom:2px solid #D42020;padding-bottom:10px}.title{font-size:22px;font-weight:bold;color:#D42020}.sub{font-size:10px;color:#666;margin-top:3px}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#D42020;color:white;padding:6px 7px;text-align:left}td{padding:5px 7px;border-bottom:1px solid #e0e0e0;vertical-align:top}.badge-m{background:#f39c12;color:white;padding:1px 5px;border-radius:10px;font-size:8px}.footer{margin-top:12px;font-size:9px;color:#aaa;text-align:right}</style></head><body><div class="header"><div class="title">⚔ CACHORROBOROS SWORDPLAY — LISTA DE INSCRITOS</div><div class="sub">Araras/SP · Domingos 9h–12h · Gerado em: ${hoje} · Total: ${arr.length}</div></div><table><thead><tr><th>#</th><th>Nome</th><th>Nasc.</th><th>Idade</th><th>WhatsApp</th><th>RG</th><th>CPF</th><th>Endereço</th><th>Restrição</th><th>Responsável</th><th>Imagem</th><th>Inscrito em</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Cachorroboros Swordplay · @Cachorroboros · Araras/SP</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

async function exportXLSX() {
  if (typeof XLSX === 'undefined') { alert('Biblioteca carregando. Tente em instantes.'); return; }
  const arr = window._inscritosCache;
  if (arr.length === 0) { alert('Nenhum inscrito para exportar.'); return; }

  const headers = ['#','Nome','Data Nasc.','Idade','WhatsApp','RG','CPF','Endereço','Restrição Médica','Menor de Idade','Resp. Nome','Resp. WhatsApp','Uso de Imagem','Data Inscrição'];
  const rows = arr.map((i, idx) => [
    idx+1,
    i.nome || '',
    i.data_nasc ? fmtDate(i.data_nasc) : '',
    i.idade || '',
    i.whatsapp || '',
    'Confidencial',
    'Confidencial',
    i.endereco || '',
    i.restricao || 'Não',
    i.menor ? 'Sim' : 'Não',
    i.resp_nome || '',
    i.resp_whatsapp || '',
    i.aceita_imagem ? 'Autorizado' : 'Não autorizado',
    i.created_at ? new Date(i.created_at).toLocaleDateString('pt-BR') : ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    {wch:4},{wch:30},{wch:12},{wch:6},{wch:16},
    {wch:14},{wch:15},{wch:28},{wch:22},{wch:8},
    {wch:28},{wch:14},{wch:16},{wch:14},{wch:14}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inscritos');

  const resumo = [
    ['CACHORROBOROS SWORDPLAY — RESUMO'],
    [''],
    ['Total de inscritos', arr.length],
    ['Menores de idade', arr.filter(i => i.menor).length],
    ['Com restrição médica', arr.filter(i => i.restricao_flag).length],
    ['Autorizaram uso de imagem', arr.filter(i => i.aceita_imagem).length],
    [''],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Local', 'Parque Ecológico "Gilberto Ruegger Ometto" — Araras/SP'],
    ['Horário', 'Domingos, das 9h às 12h'],
    ['Instagram/TikTok', '@Cachorroboros']
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(resumo);
  ws2['!cols'] = [{wch:30},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');

  XLSX.writeFile(wb, 'cachorroboros_inscritos.xlsx');
}

// ---------------------------
// 8. INICIALIZAÇÃO
// ---------------------------

/**
 * Função principal chamada quando a aba de inscritos é exibida/após login.
 * Garante o carregamento inicial e renderiza tudo.
 */
async function initInscritosTab() {
  try {
    showLoading(true);
    // Carrega dados apenas se o cache estiver vazio (evita recarga desnecessária)
    if (!window._inscritosCache.length) {
      await loadInscritosData();
    }
    updateStats();
    await renderTable();
  } catch (err) {
    console.error('Erro ao inicializar aba de inscritos:', err);
    alert('Não foi possível carregar os inscritos. Verifique a conexão.');
  } finally {
    showLoading(false);
  }
}

// Disponibiliza globalmente (chamada via auth.js ou botões de aba)
window.initInscritosTab = initInscritosTab;

// Handler do campo de busca
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-inscritos');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderTable(e.target.value);
    });
  }
});

// Loading helper (pode ser usado por outras abas também)
function showLoading(show) {
  const loader = document.getElementById('fb-loading');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}
window.showLoading = showLoading; // se quiser manter compatibilidade