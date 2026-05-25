// ===================== AUTENTICAÇÃO (refatorada) =====================
const AuthUI = (() => {
  // Elementos do DOM (cache)
  const bg = document.getElementById('login-modal-bg');
  const emailInput = document.getElementById('login-email');
  const pwInput = document.getElementById('login-pw');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  const navEmail = document.getElementById('nav-user-email');
  const navLoginBtn = document.getElementById('nav-login-btn');
  const navLogoutBtn = document.getElementById('nav-logout-btn');

  const lockInscritos = document.getElementById('lock-screen');
  const contentInscritos = document.getElementById('inscritos-content');

  const lockChamada = document.getElementById('chamada-lock-screen');
  const contentChamada = document.getElementById('chamada-content');

  // Estado interno
  let _loading = false;

  // --- Métodos públicos ---
  function open() {
    if (!bg) return;
    bg.classList.add('open');
    // Foco no campo e-mail
    setTimeout(() => emailInput?.focus(), 120);
  }

  function close() {
    if (!bg) return;
    bg.classList.remove('open');
    _resetForm();
  }

  async function login() {
    if (_loading) return; // evita duplo clique

    const email = emailInput?.value.trim() || '';
    const pw = pwInput?.value || '';

    if (!email || !pw) {
      _showError('Preencha e-mail e senha.');
      return;
    }

    _setLoading(true);
    _showError('');

    try {
      const { error } = await window._signIn(email, pw);
      if (error) throw error;

      // Login bem-sucedido: fecha o modal.
      // O evento 'authChanged' cuidará de atualizar o resto da UI.
      close();
    } catch (err) {
      const msg = _mapAuthError(err);
      _showError(msg);
    } finally {
      _setLoading(false);
    }
  }

  async function logout() {
    // Apenas dispara o logout; o listener authChanged fará o resto.
    await window._signOut();
  }

  // --- Atualização de UI com base no estado de autenticação ---
  async function onAuthStateUpdate(user) {
    const loggedIn = !!user;

    // Navbar
    if (navEmail) navEmail.textContent = loggedIn ? user.email : '';
    if (navLoginBtn) navLoginBtn.style.display = loggedIn ? 'none' : 'inline-flex';
    if (navLogoutBtn) navLogoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';

    if (loggedIn) {
      // Carrega dados (precisa estar definido globalmente)
      if (typeof loadInscritos === 'function') await loadInscritos();
      if (typeof loadChamadas === 'function') await loadChamadas();

      // Destrava seções restritas
      if (lockInscritos && contentInscritos) {
        lockInscritos.style.display = 'none';
        contentInscritos.style.display = 'block';
        if (typeof renderStats === 'function') renderStats();
        if (typeof renderTable === 'function') renderTable();
      }

      if (lockChamada && contentChamada) {
        lockChamada.style.display = 'none';
        contentChamada.style.display = 'block';
        if (typeof initChamada === 'function') initChamada();
      }

      // Arena: força reinicialização
      window._arenaInitialized = false;
      if (document.getElementById('tab-arena')?.classList.contains('active')) {
        if (typeof initArena === 'function') initArena();
      }
    } else {
      // Logout – limpa caches e bloqueia áreas
      window._inscritosCache = [];
      window._chamadaCache = [];
      window._arenaStateCache = null;
      window._arenaInitialized = false;

      if (lockInscritos && contentInscritos) {
        lockInscritos.style.display = 'flex';
        contentInscritos.style.display = 'none';
      }

      if (lockChamada && contentChamada) {
        lockChamada.style.display = 'block';
        contentChamada.style.display = 'none';
      }

      // Fecha o modal se estiver aberto (segurança)
      if (bg?.classList.contains('open')) close();
    }
  }

  // --- Helpers internos ---
  function _mapAuthError(err) {
    const message = err?.message || '';
    const code = err?.code || '';

    // Mapeamento por código (mais confiável)
    if (code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
    if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (message.includes('Email not confirmed')) return 'Confirme seu e-mail primeiro.';

    // fallback
    return message || 'Erro ao fazer login. Tente novamente.';
  }

  function _showError(text) {
    if (!errorEl) return;
    errorEl.textContent = text;
    errorEl.style.display = text ? 'block' : 'none';
  }

  function _setLoading(loading) {
    _loading = loading;
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Entrando...' : '⚔ ENTRAR';
  }

  function _resetForm() {
    if (emailInput) emailInput.value = '';
    if (pwInput) pwInput.value = '';
    _showError('');
  }

  // --- Eventos internos (ESC e clique fora) ---
  function _setupModalEvents() {
    if (!bg) return;

    // Fechar ao clicar no fundo escuro
    bg.addEventListener('click', (e) => {
      if (e.target === bg) close();
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bg.classList.contains('open')) {
        close();
      }
    });
  }

  // --- Inicialização ---
  function init() {
    _setupModalEvents();

    // Listener global para mudanças de autenticação (disparado pelo supabase_init)
    window.addEventListener('authChanged', (e) => {
      const user = e.detail.user;
      onAuthStateUpdate(user);
    });

    // Estado inicial (se já houver sessão ativa ao carregar a página)
    if (window._authUser) {
      onAuthStateUpdate(window._authUser);
    }
  }

  // API pública
  return {
    open,
    close,
    login,
    logout,
    init
  };
})();

// --- Substitui as chamadas antigas nos botões (via onclick) ---
// Em vez de chamar as funções globais soltas, exponha:
window.openLoginModal = AuthUI.open;
window.closeLoginModal = AuthUI.close;
window.doLogin = AuthUI.login;
window.adminSignOut = AuthUI.logout;

// Inicializa o módulo assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', AuthUI.init);