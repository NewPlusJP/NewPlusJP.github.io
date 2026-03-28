// --- Supabaseの設定 ---
const SUPABASE_URL = "https://ezishztrukqnrqsvaeur.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6aXNoenRydWtxbnJxc3ZhZXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY3MzIsImV4cCI6MjA5MDA5MjczMn0.u9rkxviylgWDoI3-FExNq1EPOT_NNNNuwkLT2FLRKUU";

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// --- 1. スレッド一覧表示 ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) return;

  if (!supabaseClient) {
    container.innerHTML = '<div class="aa" style="border:1px solid red; padding:10px;">⚠️ 接続エラー</div>';
    return;
  }

  const { data: threads, error } = await supabaseClient
    .from('threads').select('*').order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p>エラー: ' + error.message + '</p>';
    return;
  }

  const isAdmin = localStorage.getItem('is_admin') === 'true';

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p>まだスレッドがありません。</p>';
    return;
  }

  // ピン留め優先の並び替え
  const sortedThreads = [...threads].sort((a, b) => (b.is_admin_thread ? 1 : 0) - (a.is_admin_thread ? 1 : 0));

  container.innerHTML = sortedThreads.map(thread => {
    const isSpecial = thread.is_admin_thread === true;
    const cardStyle = isSpecial ? 'border: 2px solid #ff4757; background: rgba(255, 71, 87, 0.05);' : '';
    const badge = isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-right:8px; vertical-align:middle;">📌 置標 / 運営</span>' : '';

    return `
      <div class="aa" style="${cardStyle} padding:15px; margin-bottom:10px; border-radius:10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">
            ${badge}
            <a href="thread.html?id=${thread.id}" style="color: ${isSpecial ? '#ff4757' : 'inherit'}; text-decoration: none; font-weight:bold;">
              ${thread.title}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${thread.id}')" style="color:red; cursor:pointer; background:white; border:1px solid red; border-radius:4px; padding:2px 5px; font-size:12px;">削除 🗑️</button>` : ''}
        </div>
        <div style="font-size:0.85em; color:#666; margin:5px 0;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${thread.name}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size:0.95em; white-space: pre-wrap;">
          ${thread.content}
        </div>
      </div>
    `;
  }).join('');
}

// --- 2. 管理者ログイン・削除機能 ---
window.handleAdminLogin = async function() {
  const name = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();

  const { data } = await supabaseClient.from('user_accounts').select('*').eq('username', name).eq('password', pass).maybeSingle();

  if (data && name.toLowerCase().startsWith('admin')) {
    alert("管理者認証成功！");
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', name);
    localStorage.setItem('user_display_name', name);
    location.reload();
  } else {
    alert("認証失敗");
  }
};

window.deleteThread = async function(id) {
  if (!confirm("スレッドを完全に削除しますか？")) return;
  await supabaseClient.from('posts').delete().eq('thread_id', id);
  await supabaseClient.from('threads').delete().eq('id', id);
  location.reload();
};

// --- 3. スレ立て機能 ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('thread-title').value;
    const name = document.getElementById('user-name').value || "名無しさん";
    const content = document.getElementById('content').value;
    const adminCheck = document.getElementById('is-admin-thread');

    const { data, error } = await supabaseClient
      .from('threads').insert([{ title, name, content, is_admin_thread: adminCheck ? adminCheck.checked : false }]).select(); 
    
    if (error) alert("失敗: " + error.message);
    else if (data) window.location.href = `thread.html?id=${data[0].id}`;
  });
}

// --- 4. 通知設定（許可のみ・暴走防止） ---
window.toggleNotification = function() {
    if (!("Notification" in window)) return alert("非対応です");
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            alert("通知が有効になりました。各スレッド内で新着通知を受け取れます。");
            updateNotifyButton();
        }
    });
};

function updateNotifyButton() {
    const btn = document.getElementById('notify-btn-top');
    if (btn && Notification.permission === "granted") {
        btn.innerHTML = "✅ 通知許可済み";
        btn.style.background = "#eee";
        btn.style.color = "#888";
    }
}

// --- 5. UI制御 & 初期化 ---
function checkAdminStatus() {
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const adminConsole = document.getElementById('admin-console');
  const adminInputs = document.getElementById('admin-auth-inputs');
  const optionContainer = document.getElementById('admin-thread-option');

  if (isAdmin) {
    if (adminConsole) adminConsole.style.display = 'block';
    if (adminInputs) adminInputs.style.display = 'none';
    if (document.getElementById('admin-name')) document.getElementById('admin-name').innerText = localStorage.getItem('admin_name');
    if (optionContainer) {
      optionContainer.innerHTML = `<label style="color: #ff4757; font-weight: bold;"><input type="checkbox" id="is-admin-thread"> 📢 運営専用（ピン留め）にする</label>`;
    }
  }
}

window.logout = function() { localStorage.clear(); location.reload(); };

document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
  updateNotifyButton();
  
  // オンラインカウンター
  const counterEl = document.getElementById('online-counter');
  if (counterEl) {
    counterEl.innerText = `現在 ${Math.floor(Math.random() * 5) + 1} 人が閲覧中`;
  }
});