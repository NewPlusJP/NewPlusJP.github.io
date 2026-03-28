// --- Supabaseの初期化 ---
// config.js が先に読み込まれている前提で、グローバル変数 SUPABASE_URL / SUPABASE_ANON_KEY を使用します。
const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// --- 【重要】エスケープ関数 ---
function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

// --- 1. スレッド一覧表示 ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) return;
  
  if (!supabaseClient) {
    container.innerHTML = `<p style="color:red;">エラー: Supabaseの設定が読み込めません。config.jsを確認してください。</p>`;
    return;
  }

  const { data: threads, error } = await supabaseClient
    .from('threads').select('*').order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p>エラー: ${escapeHTML(error.message)}</p>`;
    return;
  }

  const isAdmin = localStorage.getItem('is_admin') === 'true';
  if (!threads || threads.length === 0) {
    container.innerHTML = '<p>まだスレッドがありません。</p>';
    return;
  }

  // 管理者スレッド（is_admin_thread）を上に持ってくるソート
  const sortedThreads = [...threads].sort((a, b) => (b.is_admin_thread ? 1 : 0) - (a.is_admin_thread ? 1 : 0));

  container.innerHTML = sortedThreads.map(thread => {
    const isSpecial = thread.is_admin_thread === true;
    const cardStyle = isSpecial ? 'border: 2px solid #ff4757; background: rgba(255, 71, 87, 0.05);' : '';
    const badge = isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-right:8px; vertical-align:middle;">📌 置標 / 運営</span>' : '';

    const safeTitle = escapeHTML(thread.title);
    const safeName = escapeHTML(thread.name);
    const safeContent = escapeHTML(thread.content);
    const safeId = escapeHTML(thread.id);

    return `
      <div class="aa" style="${cardStyle} padding:15px; margin-bottom:10px; border-radius:10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">
            ${badge}
            <a href="thread.html?id=${safeId}" style="color: ${isSpecial ? '#ff4757' : 'inherit'}; text-decoration: none; font-weight:bold;">
              ${safeTitle}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${safeId}')" style="color:red; cursor:pointer; background:white; border:1px solid red; border-radius:4px; padding:2px 5px; font-size:12px;">削除 🗑️</button>` : ''}
        </div>
        <div style="font-size:0.85em; color:#666; margin:5px 0;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${safeName}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size:0.95em; white-space: pre-wrap;">
          ${safeContent}
        </div>
      </div>
    `;
  }).join('');
}

// --- 2. 管理者ログイン・削除機能 ---
window.handleAdminLogin = async function() {
  if (!supabaseClient) return alert("接続エラー");
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
    if (!supabaseClient) return;
    
    const title = document.getElementById('thread-title').value;
    const name = document.getElementById('user-name').value || "名無しさん";
    const content = document.getElementById('content').value;
    const adminCheck = document.getElementById('is-admin-thread');

    const { data, error } = await supabaseClient
      .from('threads').insert([{ 
        title, 
        name, 
        content, 
        is_admin_thread: adminCheck ? adminCheck.checked : false 
      }]).select(); 
    
    if (error) alert("失敗: " + error.message);
    else if (data) window.location.href = `thread.html?id=${data[0].id}`;
  });
}

// --- 4. 通知設定 ---
window.toggleNotification = function() {
    if (!("Notification" in window)) return alert("非対応ブラウザです");

    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                localStorage.setItem('notify_enabled', 'true');
                alert("通知を有効にしました！");
                updateNotifyButton();
            }
        });
        return;
    }

    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    localStorage.setItem('notify_enabled', isEnabled ? 'false' : 'true');
    alert(`通知を【${!isEnabled ? 'オン' : 'オフ'}】にしました。`);
    updateNotifyButton();
};

function updateNotifyButton() {
    const btn = document.getElementById('notify-btn-top');
    if (!btn) return;
    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    const isPermissionGranted = Notification.permission === "granted";

    if (isPermissionGranted && isEnabled) {
        btn.innerHTML = "🔔 通知：オン (クリックでオフ)";
        btn.style.background = "#e1ffed";
        btn.style.color = "#2ed573";
    } else {
        btn.innerHTML = "🔕 通知：オフ (クリックでオン)";
        btn.style.background = "#fff5f5";
        btn.style.color = "#ff4757";
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
    
    const adminDisplayName = escapeHTML(localStorage.getItem('admin_name'));
    if (document.getElementById('admin-name')) {
      document.getElementById('admin-name').innerText = adminDisplayName;
    }
    
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
  
  const counterEl = document.getElementById('online-counter');
  if (counterEl) {
    counterEl.innerText = `現在 ${Math.floor(Math.random() * 5) + 1} 人が閲覧中`;
  }
});