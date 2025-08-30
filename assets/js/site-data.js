// Fill news and members dynamically if API is available
(async function(){
  const API_BASE = '';

  function fmt(d){
    try{ const dt = new Date(d); const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const day=String(dt.getDate()).padStart(2,'0'); return `${y}/${m}/${day}`;}catch{return d||''}
  }

  // News
  try{
    const res = await fetch(`${API_BASE}/api/news`, { cache:'no-store' });
    if(res.ok){
      const data = await res.json();
      const list = (data.items||[]).slice(0,5);
      if(list.length){
        const wrap = document.getElementById('newsCards');
        if (wrap){
          wrap.innerHTML = '';
          for(const n of list){
            const el = document.createElement('article');
            el.className = 'news-card';
            el.innerHTML = `
              ${n.image?`<img src="${n.image}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px;"/>`:''}
              <h3>TOPICS</h3>
              <hr />
              <p>${escapeHtml(n.title||n.summary||'')}</p>
              <time datetime="${n.date||''}">${fmt(n.date||n.createdAt)}</time>
            `;
            wrap.appendChild(el);
          }
        }
      }
    }
  }catch{}

  // Members
  async function fillMembers(cat, elId){
    try{
      const res = await fetch(`${API_BASE}/api/members?category=${encodeURIComponent(cat)}`, { cache:'no-store' });
      if(!res.ok) return; const data = await res.json(); const list = (data.items||[]).slice(0,4);
      if(list.length){
        const wrap = document.getElementById(elId); if(!wrap) return; wrap.innerHTML='';
        for(const m of list){
          const card = document.createElement('div');
          card.className = 'model-card';
          const img = m.image || '/image/everne.png';
          card.innerHTML = `
            <div class="thumb"><img src="${img}" alt="${escapeHtml(m.name)}"></div>
            <p class="model-name">${escapeHtml(m.name)}</p>
          `;
          wrap.appendChild(card);
        }
      }
    }catch{}
  }
  fillMembers('Ladies','list-ladies');
  fillMembers('Men','list-men');
  fillMembers('Mrs','list-mrs');
  fillMembers('Kids','list-kids');

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }
})();
