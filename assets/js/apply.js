const API_BASE = 'http://localhost:5174';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('applyForm');
  const state = document.getElementById('applyState');
  const btn = document.getElementById('submitBtn');
  const agree = document.getElementById('agree');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.textContent = '';
    if (!agree.checked) { state.textContent = '同意が必要です。'; return; }

    const fd = new FormData(form);
    fd.append('agree', 'true');

    btn.disabled = true;
    btn.textContent = '送信中…';

    try {
      const res = await fetch(`${API_BASE}/api/apply`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('送信に失敗しました');
      state.textContent = '送信しました。担当者よりご連絡します。';
      form.reset();
    } catch (err) {
      state.textContent = 'エラー: 送信できませんでした。時間をおいて再度お試しください。';
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = '送信する';
    }
  });
});
