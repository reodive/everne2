// Members list page renderer. Expects window.MEM_CATEGORY to be set.
const API_BASE = '';

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', async () => {
  const cat = window.MEM_CATEGORY || '';
  const title = document.getElementById('pageTitle');
  if (title && cat) title.textContent = `${cat}`;
  const grid = document.getElementById('grid');
  const q = document.getElementById('q');
  const count = document.getElementById('count');

  let all = [];

  async function load(){
    const url = cat ? `${API_BASE}/api/members?category=${encodeURIComponent(cat)}` : `${API_BASE}/api/members`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(()=>({items:[]}));
    all = data.items || [];
    render();
  }

  function filtered(){
    const kw = (q?.value||'').trim().toLowerCase();
    if (!kw) return all;
    return all.filter(m => `${m.name||''} ${m.note||''}`.toLowerCase().includes(kw));
  }

  function render(){
    const items = filtered();
    if (count) count.textContent = `${items.length} 件`;
    grid.innerHTML = '';
    items.forEach(m => {
      const card = document.createElement('div');
      card.className = 'model-card';
      const img = m.image || '/image/everne.png';
      card.innerHTML = `
        <div class="thumb"><img src="${img}" alt="${escapeHtml(m.name)}"></div>
        <p class="model-name">${escapeHtml(m.name)}</p>
      `;
      grid.appendChild(card);
    });
  }

  if (q) q.addEventListener('input', render);
  await load();
});
