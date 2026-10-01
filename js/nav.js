import { state } from './state.js';

const ITEMS = [
  { id: 'week',     label: 'Semaine'  },
  { id: 'cook',     label: 'Cuisiner' },
  { id: 'shopping', label: 'Courses'  },
];

const SVGS = {
  week:     '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  cook:     '<path d="M4 11h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><line x1="2" y1="11" x2="22" y2="11"/><path d="M9 7c0-1 1-1.5 1-2.5M14 7c0-1 1-1.5 1-2.5"/>',
  planner:  '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  macros:   '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  recipes:  '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  shopping: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.93-1.46l1.38-5.54H6"/>',
};

export function renderNav() {
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.innerHTML = ITEMS.map(it => `
    <button class="nav-btn ${(state.currentView === it.id || (it.id === 'week' && ['recipes','settings'].includes(state.currentView))) ? 'active' : ''}" data-view="${it.id}">
      <svg viewBox="0 0 24 24">${SVGS[it.id]}</svg>
      <span>${it.label}</span>
    </button>`).join('');
  nav.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => window._nav?.(b.dataset.view))
  );
  document.getElementById('app').appendChild(nav);
}
