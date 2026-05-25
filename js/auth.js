// ===================== AUTENTICAÇÃO =====================

function openLoginModal() {
  document.getElementById('login-modal-bg').classList.add('open');
  setTimeout(() => {
    const em = document.getElementById('login-email');
    if (em) em.focus();
  }, 120);
}

function closeLoginModal() {
  document.getElementById('login-modal-bg').classList.remove('open');
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pw').value = '';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-submit');

  if (!email || !pw) {
    errEl.textContent = 'Preencha e-mail e senha.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';
  errEl.style.display = 'none';

  try {
    const { error } = await window._signIn(email, pw);
    if (error) throw error;
    closeLoginModal();
  } catch (err) {
    const messages = {
      'Invalid login credentials': 'E-mail ou senha incorretos.',
      'Email not confirmed': 'Confirme seu e-mail primeiro.',
    };
    errEl.textContent = messages[err.message] || err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '⚔ ENTRAR';
  }
}

async function adminSignOut() {
  await window._signOut();
}

// Listener para mudanças de autenticação (compatível com o event 'authChanged')
window.addEventListener('authChanged', (e) => {
  const user = e.detail.user;
  _onAuthStateUpdate(user);
});

async function _onAuthStateUpdate(user) {
  const loggedIn = !!user;

  // Navbar
  const emailEl   = document.getElementById('nav-user-email');
  const loginBtn  = document.getElementById('nav-login-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');
  if (emailEl)  emailEl.textContent  = loggedIn ? user.email : '';
  if (loginBtn)  loginBtn.style.display  = loggedIn ? 'none'  : 'inline-flex';
  if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';

  if (loggedIn) {
    await loadInscritosAsync();
    await loadChamadasAsync();

    // Destrava abas restritas
    const lockInscritos    = document.getElementById('lock-screen');
    const contentInscritos = document.getElementById('inscritos-content');
    if (lockInscritos && contentInscritos) {
      lockInscritos.style.display    = 'none';
      contentInscritos.style.display = 'block';
      if (typeof renderStats === 'function') renderStats();
      if (typeof renderTable === 'function') renderTable();
    }

    const lockChamada    = document.getElementById('chamada-lock-screen');
    const contentChamada = document.getElementById('chamada-content');
    if (lockChamada && contentChamada) {
      lockChamada.style.display    = 'none';
      contentChamada.style.display = 'block';
      if (typeof initChamada === 'function') initChamada();
    }

    // Arena: recarrega config
    window._arenaInitialized = false;
    if (document.getElementById('tab-arena')?.classList.contains('active')) {
      if (typeof initArena === 'function') initArena();
    }
  } else {
    // Logout – limpa caches e fecha áreas restritas
    _inscritosCache = [];
    _chamadaCache   = [];
    window._arenaStateCache = null;
    window._arenaInitialized = false;

    const lockInscritos    = document.getElementById('lock-screen');
    const contentInscritos = document.getElementById('inscritos-content');
    if (lockInscritos && contentInscritos) {
      lockInscritos.style.display    = 'flex';
      contentInscritos.style.display = 'none';
    }

    const lockChamada    = document.getElementById('chamada-lock-screen');
    const contentChamada = document.getElementById('chamada-content');
    if (lockChamada && contentChamada) {
      lockChamada.style.display    = 'block';
      contentChamada.style.display = 'none';
    }
  }
}