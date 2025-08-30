// js/apply.js
// Use same-origin by default to avoid CORS issues
const API_BASE = '';
console.debug('[apply] API_BASE =', API_BASE);

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('applyForm');
  const btn = document.getElementById('submitBtn');
  const agree = document.getElementById('agree');
  // 状態表示要素（存在しなければ #okMsg を使う or 生成）
  let state = document.getElementById('applyState') || document.getElementById('okMsg');
  if (!state) {
    state = document.createElement('p');
    state.id = 'applyState';
    state.className = 'ok';
    form.appendChild(state);
  }

  // 年齢に応じて保護者欄の表示切替
  const ageInput = form?.elements?.age;
  const guardianBlock = document.getElementById('guardianBlock');
  if (ageInput && guardianBlock) {
    const toggleGuardian = () => {
      const age = Number(ageInput.value || 0);
      guardianBlock.style.display = age < 18 ? 'block' : 'none';
    };
    ageInput.addEventListener('input', toggleGuardian);
    toggleGuardian();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();               // ← これが無いとページ遷移する
    state.textContent = '';
    if (!agree.checked) { state.textContent = '同意が必要です。'; return; }

    const fd = new FormData(form);
    // 念のため agree を文字列でサーバへ
    if (!fd.has('agree')) fd.append('agree', 'true');

    btn.disabled = true;
    btn.textContent = '送信中…';

    try {
      const res = await fetch(`${API_BASE}/api/apply`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const msg = data?.errors?.[0]?.msg || data?.error || '送信に失敗しました';
        throw new Error(msg);
      }
      if (data.mailStatus === 'sent') {
        state.textContent = '送信しました。担当者よりご連絡します。';
      } else if (data.mailStatus === 'skipped') {
        state.textContent = '送信完了（メール通知は設定未完了のため未送信）。管理画面に保存済み。';
      } else {
        state.textContent = '送信完了（メール通知に失敗）。管理画面に保存済み。';
      }
      form.reset();
    } catch (err) {
      console.error(err);
      state.textContent = `エラー: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = '送信する';
    }
  });
});
