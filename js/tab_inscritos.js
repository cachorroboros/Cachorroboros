// ===================== TABELA DE INSCRITOS (ADMIN) =====================

async function loadInscritosAsync() {
  const { data, error } = await supabase
    .from('inscritos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar inscritos:', error);
    return _inscritosCache;
  }
  _inscritosCache = data.map(i => ({ ...i, _docId: i.id }));
  return _inscritosCache;
}

function loadInscritos() {
  return _inscritosCache;
}

async function deleteInscrito(id) {
  if (!confirm('Remover esta inscrição? Esta ação não pode ser desfeita.')) return;
  const { error } = await supabase.from('inscritos').delete().eq('id', id);
  if (error) { alert('Erro ao remover: ' + error.message); return; }
  _inscritosCache = _inscritosCache.filter(i => i.id !== id);
  renderTable(document.getElementById('search-inscritos')?.value || '');
}

function renderStats() {
  const arr = loadInscritos();
  document.getElementById('st-total').textContent = arr.length;
  document.getElementById('st-menores').textContent = arr.filter(i => i.menor).length;
  document.getElementById('st-restric').textContent = arr.filter(i => i.restricao_flag).length;
  document.getElementById('st-imagem').textContent = arr.filter(i => i.aceita_imagem).length;
}

async function renderTable(search) {
  const arr = loadInscritos();
  const q = (search || '').toLowerCase().trim();
  const filtered = q ? arr.filter(i => i.nome.toLowerCase().includes(q)) : arr;

  const tbody = document.getElementById('inscritos-tbody');
  const empty = document.getElementById('empty-state');
  const tableWrap = document.querySelector('.table-wrap');
  renderStats();

  if (arr.length === 0) {
    if (tableWrap) tableWrap.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (tableWrap) tableWrap.style.display = 'block';
  if (empty) empty.style.display = 'none';

  const rowsHtml = await Promise.all(filtered.map(async (i, idx) => {
    let cpf = '🔒', rg = '🔒';
    if (window._authUser) {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/get-sensitive-data?id=${i.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const sensitive = await res.json();
            cpf = sensitive.cpf || '—';
            rg = sensitive.rg || '—';
          }
        }
      } catch (e) { /* mantém 🔒 */ }
    }

    return `
    <tr>
      <td style="color:var(--warm-gray);font-size:12px">${idx + 1}</td>
      <td class="td-name">${escHtml(i.nome)}${i.menor ? '<br><span class="pill pill-menor">Menor</span>' : ''}</td>
      <td>${fmtDate(i.data_nasc)}</td>
      <td>${i.idade || '—'}</td>
      <td style="white-space:nowrap">${escHtml(i.whatsapp)}</td>
      <td>${escHtml(rg)}</td>
      <td style="font-size:12px">${escHtml(cpf)}</td>
      <td>${i.menor ? '<span class="pill pill-menor">Sim</span>' : '<span class="pill pill-no">Não</span>'}</td>
      <td>${i.restricao ? '<span class="pill pill-restric" title="'+escHtml(i.restricao)+'">Sim</span>' : '<span class="pill pill-ok">Não</span>'}</td>
      <td>${i.aceita_imagem ? '<span class="pill pill-ok">Autorizado</span>' : '<span class="pill pill-no">Não</span>'}</td>
      <td style="font-size:12px;white-space:nowrap">${i.created_at ? new Date(i.created_at).toLocaleDateString('pt-BR') : '—'}</td>
      <td>
        <div class="td-actions">
          <button class="act-btn act-wpp" title="WhatsApp" onclick="sendWpp('${escAttr(i.whatsapp)}','${escAttr(i.nome)}')">💬</button>
          <button class="act-btn act-del" title="Remover" onclick="deleteInscrito(${i.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  }));

  tbody.innerHTML = rowsHtml.join('');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--warm-gray);font-size:14px">Nenhum resultado para "${escHtml(q)}"</td></tr>`;
  }
}

// WhatsApp
function sendWpp(whatsapp, nome) {
  const num = fmtNum(whatsapp);
  if (!num) { alert('Número de WhatsApp inválido.'); return; }
  const msg = encodeURIComponent(`Olá, ${nome}! 🗡️\n\nSua inscrição no *Cachorroboros Swordplay* foi confirmada!\n\n📍 Parque Ecológico "Gilberto Ruegger Ometto" — Araras/SP\n📅 Domingos, das *9h às 12h*\n\nApareça com roupa confortável. Nos vemos em campo! ⚔️\n\n— Cachorroboros Swordplay · @Cachorroboros`);
  window.open('https://wa.me/55' + num + '?text=' + msg, '_blank');
}

function openWppModal() {
  const arr = loadInscritos();
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

// Exportações (PDF e XLSX) sem dados sensíveis
async function exportPDF() {
  const arr = loadInscritos();
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
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Cachorroboros — Inscritos</title><style>@page{size:A4 landscape;margin:16mm 12mm}body{font-family:Arial,sans-serif;font-size:10px;color:#222;margin:0}.header{margin-bottom:14px;border-bottom:2px solid #D42020;padding-bottom:10px}.title{font-size:22px;font-weight:bold;color:#D42020}.sub{font-size:10px;color:#666;margin-top:3px}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#D42020;color:white;padding:6px 7px;text-align:left}td{padding:5px 7px;border-bottom:1px solid #e0e0e0;vertical-align:top}.badge-m{background:#f39c12;color:white;padding:1px 5px;border-radius:10px;font-size:8px}.footer{margin-top:12px;font-size:9px;color:#aaa;text-align:right}</style></head><body><div class="header"><div class="title">⚔ CACHORROBOROS SWORDPLAY — LISTA DE INSCRITOS</div><div class="sub">Araras/SP · Domingos 9h–12h · Gerado em: ${hoje} · Total: ${arr.length}</div></div><table><thead><tr><th>#</th><th>Nome</th><th>Nasc.</th><th>Idade</th><th>WhatsApp</th><th>RG</th><th>CPF</th><th>Endereço</th><th>Restrição</th><th>Responsável</th><th>Imagem</th><th>Inscrito em</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Cachorroboros Swordplay · @Cachorroboros · Araras/SP</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

async function exportXLSX() {
  if (typeof XLSX === 'undefined') { alert('Biblioteca carregando. Tente em instantes.'); return; }
  const arr = loadInscritos();
  if (arr.length === 0) { alert('Nenhum inscrito para exportar.'); return; }
  const headers = ['#','Nome','Data Nasc.','Idade','WhatsApp','RG','CPF','Endereço','Restrição Médica','Menor de Idade','Resp. Nome','Resp. WhatsApp','Uso de Imagem','Data Inscrição'];
  const rows = arr.map((i, idx) => [idx+1, i.nome||'', i.data_nasc?fmtDate(i.data_nasc):'', i.idade||'', i.whatsapp||'', 'Confidencial', 'Confidencial', i.endereco||'', i.restricao||'Não', i.menor?'Sim':'Não', i.resp_nome||'', i.resp_whatsapp||'', i.aceita_imagem?'Autorizado':'Não autorizado', i.created_at ? new Date(i.created_at).toLocaleDateString('pt-BR') : '']);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:4},{wch:30},{wch:12},{wch:6},{wch:16},{wch:14},{wch:15},{wch:28},{wch:22},{wch:8},{wch:28},{wch:14},{wch:16},{wch:14},{wch:14}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inscritos');
  const resumo = [['CACHORROBOROS SWORDPLAY — RESUMO'],[''],['Total de inscritos',arr.length],['Menores de idade',arr.filter(i=>i.menor).length],['Com restrição médica',arr.filter(i=>i.restricao).length],['Autorizaram uso de imagem',arr.filter(i=>i.aceita_imagem).length],[''],['Gerado em',new Date().toLocaleString('pt-BR')],['Local','Parque Ecológico "Gilberto Ruegger Ometto" — Araras/SP'],['Horário','Domingos, das 9h às 12h'],['Instagram/TikTok','@Cachorroboros']];
  const ws2 = XLSX.utils.aoa_to_sheet(resumo);
  ws2['!cols'] = [{wch:30},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');
  XLSX.writeFile(wb, 'cachorroboros_inscritos.xlsx');
}