// ===================== FORMULÁRIO DE INSCRIÇÃO =====================

function toggleRestricao(el) {
  document.getElementById('restricao-detail').style.display = el.value === 'sim' ? 'block' : 'none';
}

function checkMinor(input) {
  const dob = new Date(input.value);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  const ageField = document.querySelector('[name=idade]');
  if (age > 0 && age < 120) ageField.value = age;
  const minorSection = document.getElementById('minor-fields');
  if (age < 18 && age > 0) minorSection.classList.add('show');
  else minorSection.classList.remove('show');
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const submitBtn = form.querySelector('.submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

  const data = new FormData(form);
  const isMinor = document.getElementById('minor-fields').classList.contains('show');
  const hasRestric = data.get('restricao') === 'sim';

  const body = {
    nome: data.get('nome') || '',
    data_nasc: data.get('data_nasc') || '',
    idade: data.get('idade') || null,
    whatsapp: data.get('whatsapp') || '',
    endereco: data.get('endereco') || '',
    restricao: hasRestric ? (data.get('restricao_detalhe') || 'Sim') : null,
    restricao_flag: hasRestric,
    menor: isMinor,
    resp_nome: isMinor ? (data.get('resp_nome') || '') : null,
    resp_whatsapp: isMinor ? (data.get('resp_whatsapp') || '') : null,
    aceita_imagem: !!data.get('aceita_imagem'),
    aceita_termos: !!data.get('aceita_termos'),
    cpf: data.get('cpf') || '',
    rg: data.get('rg') || '',
    resp_cpf: data.get('resp_cpf') || '',
    aceita_resp: !!data.get('aceita_resp')
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-inscricao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao enviar inscrição');
    }
    const { id } = await res.json();
    // Adiciona ao cache global (sem dados sensíveis)
    const novo = {
      id, _docId: id,
      nome: body.nome,
      data_nasc: body.data_nasc,
      idade: body.idade,
      whatsapp: body.whatsapp,
      endereco: body.endereco,
      restricao: body.restricao,
      menor: body.menor,
      resp_nome: body.resp_nome,
      resp_whatsapp: body.resp_whatsapp,
      aceita_imagem: body.aceita_imagem,
      created_at: new Date().toISOString()
    };
    _inscritosCache.unshift(novo);
    document.getElementById('form-container').style.display = 'none';
    document.getElementById('success-state').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '⚔ ENVIAR FICHA DE INSCRIÇÃO'; }
  }
}

function resetForm() {
  document.getElementById('inscricao-form').reset();
  document.getElementById('minor-fields').classList.remove('show');
  document.getElementById('restricao-detail').style.display = 'none';
  document.getElementById('success-state').classList.remove('show');
  document.getElementById('form-container').style.display = 'block';
}