// Same-origin base
const API_BASE = '';

function getToken() {
  let t = localStorage.getItem('ADMIN_TOKEN') || '';
  if (!t && !confirm('管理トークンが未設定です。未設定のまま続行しますか？（サーバ側で未設定なら閲覧可能）')) {
    t = prompt('ADMIN_TOKEN を入力してください') || '';
  }
  if (t) localStorage.setItem('ADMIN_TOKEN', t);
  return t;
}

async function fetchList(query = '') {
  const status = document.getElementById('status');
  status.textContent = '読み込み中…';
  const headers = {};
  const token = getToken();
  if (token) headers['x-admin-token'] = token;
  const res = await fetch(`${API_BASE}/api/admin/applications`, { headers });
  if (!res.ok) {
    status.textContent = 'エラー: 認証失敗または取得に失敗しました。';
    return [];
  }
  const data = await res.json();
  let items = data.items || [];
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(r => `${r.name} ${r.email} ${r.phone} ${r.category}`.toLowerCase().includes(q));
  }
  status.textContent = `${items.length} 件`;
  return items;
}

function render(items) {
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = '';
  for (const r of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(r.createdAt).toLocaleString()}</td>
      <td>${escapeHtml(r.name)}<div class="muted">${escapeHtml(r.kana||'')}</div></td>
      <td>${escapeHtml(r.email)}<div class="muted">${escapeHtml(r.phone)}</div></td>
      <td>${escapeHtml(r.category||'')}</td>
      <td>${escapeHtml((r.message||'').slice(0,120))}</td>
      <td class="files">${(r.files||[]).map(f=>`<a href="/${f.path}" target="_blank" rel="noopener">${escapeHtml(f.filename)}</a>`).join('')}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

// -------------- News management --------------
async function loadNews() {
  const headers = {};
  const t = localStorage.getItem('ADMIN_TOKEN') || '';
  if (t) headers['x-admin-token'] = t;
  const res = await fetch(`${API_BASE}/api/admin/news`, { headers });
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.querySelector('#newsTable tbody');
  tbody.innerHTML = '';
  (data.items||[]).sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt)).forEach(n => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${n.date||''}</td>
      <td>${escapeHtml(n.title||'')}</td>
      <td>${escapeHtml(n.summary||'')}</td>
      <td>${n.link?`<a href="${n.link}" target="_blank">Link</a>`:''}</td>
      <td>${n.active!==false?'公開':'非公開'}</td>
      <td>
        <button data-edit="${n.id}">編集</button>
        <button data-del="${n.id}">削除</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', async () => {
      if (!confirm('削除しますか？')) return;
      const id = btn.getAttribute('data-del');
      await fetch(`${API_BASE}/api/admin/news/${id}`, { method:'DELETE', headers: t?{ 'x-admin-token': t }:{} });
      loadNews();
    });
  });
  tbody.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-edit');
      const row = btn.closest('tr');
      const current = {
        date: row.children[0].textContent.trim(),
        title: row.children[1].textContent.trim(),
        summary: row.children[2].textContent.trim(),
        link: (row.children[3].querySelector('a')||{}).href || '',
        active: row.children[4].textContent.includes('公開')
      };
      const title = prompt('タイトル:', current.title); if (title===null) return;
      const date = prompt('日付(YYYY-MM-DD):', current.date || new Date().toISOString().slice(0,10)); if (date===null) return;
      const summary = prompt('概要:', current.summary||''); if (summary===null) return;
      const link = prompt('リンク(URL任意):', current.link||''); if (link===null) return;
      const active = confirm('公開しますか？ OK=公開 / キャンセル=非公開');
      await fetch(`${API_BASE}/api/admin/news/${id}`, { method:'PUT', headers: { 'Content-Type':'application/json', ...(t?{ 'x-admin-token': t }:{} ) }, body: JSON.stringify({ title, date, summary, link, active }) });
      loadNews();
    });
  });
}

// -------------- Members management --------------
async function uploadFile(file) {
  const t = localStorage.getItem('ADMIN_TOKEN') || '';
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch(`${API_BASE}/api/admin/upload`, { method:'POST', headers: t?{ 'x-admin-token': t }:undefined, body: fd });
  if (!res.ok) throw new Error('upload_failed');
  return res.json();
}

async function loadMembers() {
  const headers = {};
  const t = localStorage.getItem('ADMIN_TOKEN') || '';
  if (t) headers['x-admin-token'] = t;
  const res = await fetch(`${API_BASE}/api/admin/members`, { headers });
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.querySelector('#memTable tbody');
  tbody.innerHTML='';
  (data.items||[]).sort((a,b)=>(a.order??0)-(b.order??0)||a.name.localeCompare(b.name)).forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.image?`<img class="thumb" src="${m.image}"/>`:''}</td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.category)}</td>
      <td>${m.order??0}</td>
      <td>${m.active!==false?'公開':'非公開'}</td>
      <td>
        <button data-medit="${m.id}">編集</button>
        <button data-mdel="${m.id}">削除</button>
      </td>`;
    tbody.appendChild(tr);
  });
  const tkn = localStorage.getItem('ADMIN_TOKEN') || '';
  tbody.querySelectorAll('[data-mdel]').forEach(btn=>{
    btn.addEventListener('click', async () => {
      if (!confirm('削除しますか？')) return;
      const id = btn.getAttribute('data-mdel');
      await fetch(`${API_BASE}/api/admin/members/${id}`, { method:'DELETE', headers: tkn?{ 'x-admin-token': tkn }:{} });
      loadMembers();
    });
  });
  tbody.querySelectorAll('[data-medit]').forEach(btn=>{
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-medit');
      const row = btn.closest('tr');
      const current = {
        name: row.children[1].textContent.trim(),
        category: row.children[2].textContent.trim(),
        order: Number(row.children[3].textContent.trim())||0,
        active: row.children[4].textContent.includes('公開')
      };
      const name = prompt('氏名:', current.name); if (name===null) return;
      const category = prompt('カテゴリ(Ladies/Men/Mrs/Kids):', current.category); if (category===null) return;
      const order = Number(prompt('順序(数値):', current.order)); if (Number.isNaN(order)) return alert('数値を入力');
      const active = confirm('公開しますか？ OK=公開 / キャンセル=非公開');
      await fetch(`${API_BASE}/api/admin/members/${id}`, { method:'PUT', headers: { 'Content-Type':'application/json', ...(tkn?{ 'x-admin-token': tkn }:{} ) }, body: JSON.stringify({ name, category, order, active }) });
      loadMembers();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // tabs
  const tabs = document.querySelectorAll('.tabs button');
  const sections = {
    apps: document.getElementById('appsSection'),
    news: document.getElementById('newsSection'),
    members: document.getElementById('membersSection')
  };
  tabs.forEach(b=>b.addEventListener('click',()=>{
    tabs.forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const target = b.dataset.tab;
    for (const k in sections) sections[k].style.display = (k===target?'block':'none');
  }));

  // 応募一覧
  const q = document.getElementById('q');
  const reload = document.getElementById('reload');
  const csv = document.getElementById('csv');
  const token = localStorage.getItem('ADMIN_TOKEN') || '';
  csv.href = `${API_BASE}/api/admin/applications.csv`;
  if (token) csv.setAttribute('data-token', '1');
  csv.addEventListener('click', (e) => {
    const t = localStorage.getItem('ADMIN_TOKEN') || '';
    if (t) {
      e.preventDefault();
      // fetchしてBlobダウンロード（ヘッダにトークン付与のため）
      fetch(`${API_BASE}/api/admin/applications.csv`, { headers: { 'x-admin-token': t } })
        .then(r => r.blob())
        .then(b => {
          const url = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = url; a.download = 'applications.csv'; a.click();
          URL.revokeObjectURL(url);
        });
    }
  });
  const loadApps = async () => { const items = await fetchList(q.value.trim()); render(items); };
  q.addEventListener('input', loadApps);
  reload.addEventListener('click', loadApps);
  await loadApps();

  // ニュース: 追加
  document.getElementById('newsAdd').addEventListener('click', async () => {
    const t = localStorage.getItem('ADMIN_TOKEN') || '';
    const headers = { 'Content-Type': 'application/json', ...(t?{ 'x-admin-token': t }:{} ) };
    const body = {
      title: document.getElementById('newsTitle').value.trim(),
      date: document.getElementById('newsDate').value,
      summary: document.getElementById('newsSummary').value.trim(),
      link: document.getElementById('newsLink').value.trim(),
      active: document.getElementById('newsActive').checked
    };
    if (!body.title) return alert('タイトルは必須です');
    await fetch(`${API_BASE}/api/admin/news`, { method:'POST', headers, body: JSON.stringify(body) });
    document.getElementById('newsTitle').value='';
    document.getElementById('newsSummary').value='';
    document.getElementById('newsLink').value='';
    loadNews();
  });
  await loadNews();

  // メンバー: 追加
  document.getElementById('memAdd').addEventListener('click', async () => {
    const t = localStorage.getItem('ADMIN_TOKEN') || '';
    const name = document.getElementById('memName').value.trim();
    const category = document.getElementById('memCategory').value;
    const order = Number(document.getElementById('memOrder').value) || 0;
    const active = document.getElementById('memActive').checked;
    if (!name) return alert('氏名は必須です');
    let image = document.getElementById('memImage').value.trim();
    const file = document.getElementById('memFile').files[0];
    if (!image && file) {
      try {
        const up = await uploadFile(file);
        image = up.path;
      } catch {
        alert('画像アップロードに失敗しました');
        return;
      }
    }
    await fetch(`${API_BASE}/api/admin/members`, {
      method:'POST',
      headers: { 'Content-Type':'application/json', ...(t?{ 'x-admin-token': t }:{} ) },
      body: JSON.stringify({ name, category, image, order, active })
    });
    document.getElementById('memName').value='';
    document.getElementById('memImage').value='';
    document.getElementById('memFile').value='';
    document.getElementById('memOrder').value='0';
    loadMembers();
  });
  await loadMembers();
});
