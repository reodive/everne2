const API_BASE = 'http://127.0.0.1:5174';

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

document.addEventListener('DOMContentLoaded', async () => {
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

  const load = async () => {
    const items = await fetchList(q.value.trim());
    render(items);
  };
  q.addEventListener('input', load);
  reload.addEventListener('click', load);
  await load();
});

