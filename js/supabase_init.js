// Configuração do Supabase – SUBSTITUA com seus dados
const SUPABASE_URL = "https://qzjwxlfztrpaovmxhyqa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hysoU0WzUtYwLaRbjOqJKQ_LSX2H-jW";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = supabaseClient;
window._authUser = null;

supabaseClient.auth.onAuthStateChange((event, session) => {
  window._authUser = session?.user ?? null;
  window.dispatchEvent(new CustomEvent('authChanged', { detail: { user: window._authUser } }));
});

// Helpers globais
window._signIn = (email, password) => supabaseClient.auth.signInWithPassword({ email, password });
window._signOut = () => supabaseClient.auth.signOut();