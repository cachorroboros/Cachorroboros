function escHtml(s) {
  const t = (s == null ? '' : String(s));
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(t));
  return d.innerHTML;
}

function escAttr(s) {
  return escHtml(s).replace(/'/g, '&#39;');
}

function fmtDate(s) {
  if (!s) return '—';
  const p = s.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
}

function fmtNum(n) {
  return (n || '').replace(/\D/g, '');
}

// Variáveis globais (usadas por várias abas)
let _inscritosCache = [];
let _chamadaCache = [];

// ===================== TABS =====================
function showTab(tab, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  else document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + tab + "'")) b.classList.add('active');
  });
  if ((tab === 'inscritos' || tab === 'chamada') && !window._authUser) {
    openLoginModal();
  }
  if (tab === 'arena' && typeof initArena === 'function') initArena();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
