// Configuração do Supabase – SUBSTITUA com seus dados
const SUPABASE_URL = "https://qzjwxlfztrpaovmxhyqa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hysoU0WzUtYwLaRbjOqJKQ_LSX2H-jW";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = supabase;
window._authUser = null;

supabase.auth.onAuthStateChange((event, session) => {
  window._authUser = session?.user ?? null;
  window.dispatchEvent(new CustomEvent('authChanged', { detail: { user: window._authUser } }));
});

// Helpers globais
window._signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
window._signOut = () => supabase.auth.signOut();