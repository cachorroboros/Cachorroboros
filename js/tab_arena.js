// ===================== ARENA =====================

// O código da Arena permanece praticamente o mesmo, apenas altere
// loadState e saveState para usar Supabase.

window._arenaStateCache = null;

async function loadState() {
  if (!window._authUser) return null;
  if (window._arenaStateCache) return window._arenaStateCache;
  const { data, error } = await supabase
    .from('config')
    .select('data')
    .eq('key', 'arena_state')
    .single();
  if (error) return mkState();
  window._arenaStateCache = data.data;
  return data.data;
}

async function saveState() {
  window._arenaStateCache = S;
  if (window._authUser) {
    await supabase
      .from('config')
      .upsert({ key: 'arena_state', data: S }, { onConflict: 'key' });
  }
}

// As demais funções (initArena, populateSelects, startMatch, etc.) permanecem
// exatamente como estão no seu código atual, apenas usando loadState/saveState
// já adaptados.