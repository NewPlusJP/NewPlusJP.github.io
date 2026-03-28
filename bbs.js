// --- 0. 初期化と設定 ---
const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- 1. スレッド一覧の読み込み (運営スレ固定 + 最新順) ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container || !supabaseClient) return;

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Fetch error:", error);
    container.innerHTML = `<p style="color:red;">データの読み込みに失敗しました。</p>`;
    return;
  }

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">まだスレッドがありません。</p>';
    return;
  }

  // 運営スレ(is_admin_thread: true)を最上部に固定
  const sortedThreads = [...threads].sort((a, b) => {
    if (a.is_admin_thread === b.is_admin_thread) return 0;
    return a.is_admin_thread ? -1 : 1;
  });

  container.innerHTML = sortedThreads.map(thread => {
    const isSpecial = thread.is_admin_thread === true;
    const cardStyle = isSpecial ? 'border: 2px solid #ff4757; background: rgba(255, 71, 87, 0.03);' : '';
    const badge = isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75em; margin-right:8px; vertical-align:middle;">📌 運営</span>' : '';
    const isAdmin = localStorage.getItem('is_admin') === 'true';

    return `
      <div class="aa" style="${cardStyle} padding:15px; margin-bottom:12px; border-radius:10px; border:1px solid #ddd; position:relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 style="margin: 0; font-size: 1.15em;">
            ${badge}
            <a href="thread.html?id=${thread.id}" style="color: ${isSpecial ? '#ff4757' : 'inherit'}; text-decoration: none; font-weight:bold;">
              ${escapeHTML(thread.title)}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${thread.id}')" style="background:#fff; color:#ff4757; border:1px solid #ff4757; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:12px;">削除</button>` : ''}
        </div>
        <div style="font-size:0.85em; color:#666; margin:8px 0;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size:0.95em; color:#444; white-space: pre-wrap;">
          ${escapeHTML(thread.content)}
        </div>
      </div>
    `;
  }).join('');
}

// --- 2. スレッド作成機能 ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // スパム対策（ハニーポット）
    if (document.getElementById('honey-pot')?.value) return;

    const btn = document.getElementById('create-btn');
    const title = document.getElementById('thread-title').value.trim();
    const name = document.getElementById('user-name').value.trim() || "名無しさん";
    const content = document.getElementById('content').value.trim();
    const adminCheck = document.getElementById('is-admin-thread');

    if (!title || !content) {
      alert("タイトルと本文を入力してください。");
      return;
    }

    btn.disabled = true;
    btn.innerText = "作成中...";

    const { data, error } = await supabaseClient
      .from('threads')
      .insert([{ 
        title, name, content, 
        is_admin_thread: adminCheck ? adminCheck.checked : false 
      }])
      .select(); 
    
    if (data && data[0]) {
      window.location.href = `thread.html?id=${data[0].id}`;
    } else {
      alert("エラーが発生しました: " + error.message);
      btn.disabled = false;
      btn.innerText = "スレッドを作成する";
    }
  });
}

// --- 3. 管理者認証 (ログイン・ログアウト・削除) ---
window.handleAdminLogin = async function() {
  const u = document.getElementById('admin-user')?.value.trim();
  const p = document.getElementById('admin-pass')?.value.trim();
  if (!u || !p) return alert("IDとパスワードを入力してください");

  const { data, error } = await supabaseClient
    .from('user_accounts').select('username')
    .setHeaders({ 'x-admin-user': u, 'x-admin-pass': p })
    .maybeSingle();

  if (data) {
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', u);
    alert("ログインしました");
    location.reload();
  } else {
    alert("認証に失敗しました。");
  }
};

window.logout = function() { 
  if(confirm("ログアウトしますか？")) {
    localStorage.removeItem('is_admin');
    localStorage.removeItem('admin_name');
    location.reload(); 
  }
};

window.deleteThread = async function(id) {
  if (!confirm("このスレッドを完全に削除しますか？\n付随する書き込みもすべて消去されます。")) return;
  const { error } = await supabaseClient.from('threads').delete().eq('id', id);
  if (error) alert("削除失敗: " + error.message);
  else loadThreads();
};

// --- 4. 通知機能 ---
window.toggleNotification = async function() {
  if (!("Notification" in window)) return alert("お使いのブラウザは通知非対応です。");

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
  }

  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  localStorage.setItem('notify_enabled', !isEnabled);
  updateNotifyButtonStatus();
};

function updateNotifyButtonStatus() {
  const btn = document.getElementById('notify-btn-top');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerText = isEnabled ? "🔔 通知：オン" : "🔕 通知をオンにする";
  btn.style.background = isEnabled ? "#e1ffed" : "#fff";
}

// リアルタイム監視
function startRealtimeWatch() {
  if (!supabaseClient) return;
  supabaseClient.channel('thread-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads' }, payload => {
      loadThreads();
      if (localStorage.getItem('notify_enabled') === 'true' && Notification.permission === "granted") {
        new Notification("新着スレッド！", { body: payload.new.title });
      }
    }).subscribe();
}

// --- 5. 初期化実行 ---
document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  updateNotifyButtonStatus();
  startRealtimeWatch();

  // 管理者状態のUI反映
  try {
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    if (isAdmin) {
      const consoleEl = document.getElementById('admin-console');
      const authEl = document.getElementById('admin-auth-inputs');
      const nameEl = document.getElementById('admin-name');
      const optEl = document.getElementById('admin-thread-option');

      if (consoleEl) consoleEl.style.display = 'block';
      if (authEl) authEl.style.display = 'none';
      if (nameEl) nameEl.innerText = localStorage.getItem('admin_name');
      if (optEl) optEl.innerHTML = `<label style="color:#ff4757; font-weight:bold; cursor:pointer;"><input type="checkbox" id="is-admin-thread"> 📢 運営専用スレッドとして作成</label>`;
    }
  } catch(e) { console.error("Admin UI Init Error:", e); }
});