// migrate.js — Exécuté en tout premier (avant que les vues lisent le localStorage).

// ── Migration v3 (plats du monde, assiettes + accompagnement) ──
// Les quantités ajustées des anciens plans pointaient vers l'ancien ordre d'ingrédients :
// on les retire (les plats restent, en portion standard). Il suffit de régénérer la semaine.
localStorage.removeItem('hebe_timers'); // minuteurs retirés

(function migrate() {
  const V = '3';
  if (localStorage.getItem('hebe_data_version') === V) return;
  try {
    const log = JSON.parse(localStorage.getItem('diet_log') || '[]');
    log.forEach(e => Object.values(e.meals || {}).forEach(list =>
      (list || []).forEach(it => { if (it && typeof it === 'object') delete it.overrides; })));
    localStorage.setItem('diet_log', JSON.stringify(log));
  } catch {}
  localStorage.removeItem('hebe_locked_days');
  localStorage.removeItem('hebe_week_plan');
  localStorage.setItem('hebe_data_version', V);
})();
