// --- 初期化 ---
const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- 1. スレッド一覧表示 (修正：運営固定＋新着順) ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container || !supabaseClient) return;

  const { data: threads, error } = await supabaseClient
    .from('threads').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error("一覧の取得に失敗しました:", error);
    return;
  }

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">まだスレッドがありません。</p>';
    return;
  }

  // ★ここを修正：運営スレを優先しつつ、同じ優先度内では日付順（新着順）を維持する
  const sortedThreads = [...threads].sort((a, b) => {
    // 運営スレかどうかの重み付け
    const aWeight = a.is_admin_thread ? 1 : 0;
    const bWeight = b.is_admin_thread ? 1 : 0;
    
    if (bWeight !== aWeight) {
      return bWeight - aWeight; // 運営スレ(1)を通常(0)より上に
    }
    // 運営同士、または通常同士の場合は、元の降順（created_at）を維持する
    return 0; 
  });

  container.innerHTML = sortedThreads.map(thread => {
    const isSpecial = thread.is_admin_thread === true;
    const cardStyle = isSpecial ? 'border: 2px solid #ff4757; background: rgba(255, 71, 87, 0.05);' : '';
    const badge = isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-right:8px;">📌 運営</span>' : '';
    const isAdmin = localStorage.getItem('is_admin') === 'true';

    return `
      <div class="aa" style="${cardStyle} padding:15px; margin-bottom:10px; border-radius:10px; border:1px solid #ddd;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">
            ${badge}
            <a href="thread.html?id=${thread.id}" style="color: ${isSpecial ? '#ff4757' : 'inherit'}; text-decoration: none; font-weight:bold;">
              ${escapeHTML(thread.title)}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${thread.id}')" style="color:red; cursor:pointer; background:white; border:1px solid red; border-radius:4px; padding:2px 5px; font-size:12px;">削除</button>` : ''}
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

// --- 2. 管理者ログイン・ログアウト ---
window.handleAdminLogin = async function() {
  const name = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();
  if (!name || !pass) return;

  const { data, error } = await supabaseClient
    .from('user_accounts').select('username')
    .setHeaders({ 'x-admin-user': name, 'x-admin-pass': pass })
    .maybeSingle();

  if (data) {
    alert("管理者認証成功！");
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', name);
    location.reload();
  } else {
    alert("認証に失敗しました。");
  }
};

window.logout = function() { 
    if(!confirm("ログアウトしますか？")) return;
    localStorage.removeItem('is_admin');
    localStorage.removeItem('admin_name');
    location.reload(); 
};

window.deleteThread = async function(id) {
  if (!confirm("このスレッドを完全に削除しますか？")) return;
  await supabaseClient.from('threads').delete().eq('id', id);
  loadThreads();
};

// --- 3. スレ立て ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('create-btn');
    const title = document.getElementById('thread-title').value.trim();
    const name = document.getElementById('user-name').value.trim() || "名無しさん";
    const content = document.getElementById('content').value.trim();
    const adminCheck = document.getElementById('is-admin-thread');

    btn.disabled = true;
    btn.innerText = "作成中...";

    const { data, error } = await supabaseClient
      .from('threads').insert([{ 
        title, name, content, 
        is_admin_thread: adminCheck ? adminCheck.checked : false 
      }]).select(); 
    
    if (data && data[0]) {
      window.location.href = `thread.html?id=${data[0].id}`;
    } else {
      alert("失敗: " + error.message);
      btn.disabled = false; btn.innerText = "スレッドを作成する";
    }
  });
}

function checkAdminStatus() {
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const adminConsole = document.getElementById('admin-console');
  const adminInputs = document.getElementById('admin-auth-inputs');
  const optionContainer = document.getElementById('admin-thread-option');

  if (isAdmin) {
    if (adminConsole) adminConsole.style.display = 'block';
    if (adminInputs) adminInputs.style.display = 'none';
    if (optionContainer) {
      optionContainer.innerHTML = `<label style="color: #ff4757; font-weight: bold;"><input type="checkbox" id="is-admin-thread"> 📢 運営専用（ピン留め）にする</label>`;
    }
  }
}

// --- 4. 通知機能 ---
function renderNotifyButton() {
  const adminConsole = document.getElementById('admin-console');
  if (!adminConsole) return;

  const btnId = 'notify-toggle-btn';
  if (document.getElementById(btnId)) return;

  const notifyBtn = document.createElement('button');
  notifyBtn.id = btnId;
  notifyBtn.style = "margin-left:10px; font-size:12px; cursor:pointer; padding:2px 8px; border-radius:4px; border:1px solid #ddd; background:#fff;";
  adminConsole.appendChild(notifyBtn);

  notifyBtn.onclick = async () => {
    if (!("Notification" in window)) {
      alert("このブラウザは通知に対応していません。");
      return;
    }
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    localStorage.setItem('notify_enabled', !isEnabled);
    updateNotifyButtonText();
  };
  updateNotifyButtonText();
}

function updateNotifyButtonText() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerText = isEnabled ? "🔔 通知: オン" : "🔕 通知: オフ";
  btn.style.backgroundColor = isEnabled ? "#e1ffed" : "#fff5f5";
}

function startThreadWatch() {
  if (!supabaseClient) return;
  supabaseClient
    .channel('public:threads_watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads' }, payload => {
      loadThreads(); 
      const isEnabled = localStorage.getItem('notify_enabled') === 'true';
      if (isEnabled && Notification.permission === "granted") {
        new Notification("新着スレッド！", { body: payload.new.title });
      }
    })
    .subscribe();
}

// --- 5. 実行 ---
document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
  renderNotifyButton();
  startThreadWatch();
});