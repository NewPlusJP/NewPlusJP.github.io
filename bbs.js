// --- Supabaseの初期化 ---
const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// --- エスケープ関数 ---
function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// --- 1. スレッド一覧表示 ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) return;
  
  if (!supabaseClient) {
    container.innerHTML = `<p style="color:red;">エラー: config.jsを確認してください。</p>`;
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

  const sortedThreads = [...threads].sort((a, b) => (b.is_admin_thread ? 1 : 0) - (a.is_admin_thread ? 1 : 0));

  container.innerHTML = sortedThreads.map(thread => {
    const isSpecial = thread.is_admin_thread === true;
    const cardStyle = isSpecial ? 'border: 2px solid #ff4757; background: rgba(255, 71, 87, 0.05);' : '';
    const badge = isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-right:8px;">📌 運営</span>' : '';

    return `
      <div class="aa" style="${cardStyle} padding:15px; margin-bottom:10px; border-radius:10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">
            ${badge}
            <a href="thread.html?id=${thread.id}" style="color: ${isSpecial ? '#ff4757' : 'inherit'}; text-decoration: none; font-weight:bold;">
              ${escapeHTML(thread.title)}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${thread.id}')" style="color:red; cursor:pointer; background:white; border:1px solid red; border-radius:4px; padding:2px 5px; font-size:12px;">削除 🗑️</button>` : ''}
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
  const name = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();
  if (!name || !pass) return;

  const { data } = await supabaseClient.from('user_accounts').select('*').eq('username', name).eq('password', pass).maybeSingle();

  if (data && name.toLowerCase().startsWith('admin')) {
    alert("管理者認証成功！");
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', name);
    location.reload();
  } else {
    alert("認証失敗");
  }
};

window.deleteThread = async function(id) {
  if (!confirm("スレッドを完全に削除しますか？")) return;
  await supabaseClient.from('posts').delete().eq('thread_id', id);
  await supabaseClient.from('threads').delete().eq('id', id);
  loadThreads();
};

// --- 3. スレ立て機能 (Bot対策強化) ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    
    const btn = document.getElementById('create-btn');
    const honey = document.getElementById('honey-pot').value; // 【対策：ハニーポット】
    const title = document.getElementById('thread-title').value.trim();
    const name = document.getElementById('user-name').value.trim() || "名無しさん";
    const content = document.getElementById('content').value.trim();
    const adminCheck = document.getElementById('is-admin-thread');

    // 【対策1】ハニーポットに値があればBotとみなして無視
    if (honey) return;

    // 【対策2】HTMLタグの混入をチェック
    if (/[<>]/.test(title) || /[<>]/.test(content)) {
      alert("HTMLタグは使用できません。");
      return;
    }

    // 【対策3】連投防止 (クールタイム)
    btn.disabled = true;
    btn.innerText = "作成中...";

    const { data, error } = await supabaseClient
      .from('threads').insert([{ 
        title, name, content, 
        is_admin_thread: adminCheck ? adminCheck.checked : false 
      }]).select(); 
    
    if (error) {
      alert("失敗: " + error.message);
      btn.disabled = false;
      btn.innerText = "スレッドを作成する";
    } else if (data) {
      // 成功したらそのスレッドへ移動
      window.location.href = `thread.html?id=${data[0].id}`;
    }
  });
}

// --- 4. 通知 & UI制御 ---
window.toggleNotification = function() {
    if (!("Notification" in window)) return alert("非対応ブラウザです");
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(p => { if (p === "granted") { localStorage.setItem('notify_enabled', 'true'); updateNotifyButton(); } });
        return;
    }
    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    localStorage.setItem('notify_enabled', !isEnabled);
    updateNotifyButton();
};

function updateNotifyButton() {
    const btn = document.getElementById('notify-btn-top');
    if (!btn) return;
    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    if (Notification.permission === "granted" && isEnabled) {
        btn.innerHTML = "🔔 通知：オン"; btn.style.background = "#e1ffed"; btn.style.color = "#2ed573";
    } else {
        btn.innerHTML = "🔕 通知：オフ"; btn.style.background = "#fff5f5"; btn.style.color = "#ff4757";
    }
}

function checkAdminStatus() {
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const adminConsole = document.getElementById('admin-console');
  const adminInputs = document.getElementById('admin-auth-inputs');
  const optionContainer = document.getElementById('admin-thread-option');

  if (isAdmin) {
    if (adminConsole) adminConsole.style.display = 'block';
    if (adminInputs) adminInputs.style.display = 'none';
    if (document.getElementById('admin-name')) {
      document.getElementById('admin-name').innerText = localStorage.getItem('admin_name');
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
});