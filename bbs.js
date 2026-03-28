// --- 0. 初期化 ---
let supabaseClient;
try {
  if (typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("Supabase初期化失敗:", e);
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- 1. スレッド一覧表示 ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container || !supabaseClient) return;

  const { data: threads, error } = await supabaseClient
    .from('threads').select('*').order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p style="color:red;">エラー: ${error.message}</p>`;
    return;
  }

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">まだスレッドがありません。</p>';
    return;
  }

  // 運営スレを一番上にするソート
  const sortedThreads = [...threads].sort((a, b) => {
    if (a.is_admin_thread === b.is_admin_thread) return 0;
    return a.is_admin_thread ? -1 : 1;
  });

  container.innerHTML = sortedThreads.map(thread => {
    const isSpecial = thread.is_admin_thread === true;
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    const cardStyle = isSpecial ? 'border: 2px solid #ff4757; background: rgba(255, 71, 87, 0.05);' : '';
    const badge = isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75em; margin-right:8px;">📌 運営</span>' : '';

    return `
      <div class="aa" style="${cardStyle} padding:15px; margin-bottom:10px; border-radius:10px; border:1px solid #ddd;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">
            ${badge}
            <a href="thread.html?id=${thread.id}" style="color: ${isSpecial ? '#ff4757' : 'inherit'}; text-decoration: none; font-weight:bold;">
              ${escapeHTML(thread.title)}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${thread.id}')" style="color:red; border:1px solid red; background:none; cursor:pointer; border-radius:4px;">削除</button>` : ''}
        </div>
        <div style="font-size:0.85em; color:#666; margin:5px 0;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size:0.95em; white-space: pre-wrap;">
          ${escapeHTML(thread.content)}
        </div>
      </div>
    `;
  }).join('');
}

// --- 2. 管理者機能 ---
window.handleAdminLogin = async function() {
  const u = document.getElementById('admin-user')?.value.trim();
  const p = document.getElementById('admin-pass')?.value.trim();
  if (!u || !p) return;

  const { data } = await supabaseClient.from('user_accounts').select('username')
    .setHeaders({ 'x-admin-user': u, 'x-admin-pass': p }).maybeSingle();

  if (data) {
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', u);
    location.reload();
  } else {
    alert("認証失敗");
  }
};

window.logout = function() {
  localStorage.clear();
  location.reload();
};

window.deleteThread = async function(id) {
  if (!confirm("消すよ？")) return;
  await supabaseClient.from('threads').delete().eq('id', id);
  loadThreads();
};

// --- 3. スレ立て ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (document.getElementById('honey-pot')?.value) return;

    const btn = document.getElementById('create-btn');
    const title = document.getElementById('thread-title').value.trim();
    const name = document.getElementById('user-name').value.trim() || "名無しさん";
    const content = document.getElementById('content').value.trim();
    const isSpecial = document.getElementById('is-admin-thread')?.checked || false;

    btn.disabled = true;
    const { data, error } = await supabaseClient.from('threads').insert([{ title, name, content, is_admin_thread: isSpecial }]).select();

    if (data) window.location.href = `thread.html?id=${data[0].id}`;
    else { alert(error.message); btn.disabled = false; }
  });
}

// --- 4. 通知機能 (HTMLのID: notify-btn-top に対応) ---
window.toggleNotification = async function() {
  if (Notification.permission !== "granted") await Notification.requestPermission();
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  localStorage.setItem('notify_enabled', !isEnabled);
  updateNotifyBtn();
};

function updateNotifyBtn() {
  const btn = document.getElementById('notify-btn-top');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerText = isEnabled ? "🔔 通知：オン" : "🔕 通知をオンにする";
}

// --- 5. 実行 ---
document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  updateNotifyBtn();

  // 管理者UIの反映
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  if (isAdmin) {
    if (document.getElementById('admin-console')) document.getElementById('admin-console').style.display = 'block';
    if (document.getElementById('admin-auth-inputs')) document.getElementById('admin-auth-inputs').style.display = 'none';
    if (document.getElementById('admin-name')) document.getElementById('admin-name').innerText = localStorage.getItem('admin_name');
    const opt = document.getElementById('admin-thread-option');
    if (opt) opt.innerHTML = `<label style="color:red;"><input type="checkbox" id="is-admin-thread"> 運営スレにする</label>`;
  }
});