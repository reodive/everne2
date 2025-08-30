// Same-origin base
const API_BASE = '';

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}
function fmtDate(d){
  try{const dt=new Date(d);const y=dt.getFullYear();const m=String(dt.getMonth()+1).padStart(2,'0');const day=String(dt.getDate()).padStart(2,'0');return `${y}/${m}/${day}`;}catch{return d||''}
}

document.addEventListener('DOMContentLoaded', async () => {
  const q = document.getElementById('q');
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const pageInfo = document.getElementById('pageInfo');

  let all = [];
  let page = 1;
  const perPage = 10;

  async function load(){
    try{
      const res = await fetch(`${API_BASE}/api/news`, { cache:'no-store' });
      if(!res.ok) throw new Error('load_failed');
      const data = await res.json();
      all = (data.items||[]);
      page = 1;
      render();
    }catch(e){
      listEl.innerHTML = '<p style="color:#c00">ニュースの取得に失敗しました。</p>';
    }
  }

  function filtered(){
    const kw = q.value.trim().toLowerCase();
    return kw ? all.filter(n => `${n.title||''} ${n.summary||''}`.toLowerCase().includes(kw)) : all;
  }

  function render(){
    const items = filtered();
    countEl.textContent = `${items.length} 件`;
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    if (page > totalPages) page = totalPages;
    const start = (page-1)*perPage;
    const slice = items.slice(start, start+perPage);

    listEl.innerHTML = '';
    slice.forEach(n => {
      const el = document.createElement('article');
      el.className = 'news-item';
      el.innerHTML = `
        ${n.image?`<img src="${n.image}" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:10px;"/>`:''}
        <h3>${escapeHtml(n.title||'(無題)')}</h3>
        <time datetime="${n.date||''}">${fmtDate(n.date||n.createdAt)}</time>
        ${n.summary?`<p style="margin:8px 0 0">${escapeHtml(n.summary)}</p>`:''}
        ${n.link?`<p style="margin:8px 0 0"><a href="${n.link}" target="_blank" rel="noopener">リンク</a></p>`:''}
      `;
      listEl.appendChild(el);
    });

    pageInfo.textContent = `${page}/${totalPages}`;
    prev.disabled = page<=1;
    next.disabled = page>=totalPages;
  }

  q.addEventListener('input', ()=>{ page=1; render(); });
  prev.addEventListener('click', ()=>{ if(page>1){ page--; render(); } });
  next.addEventListener('click', ()=>{ page++; render(); });

  await load();
});
