/**
 * NewPlusJP - BBS Main System (Reflect-Fix Version)
 */

const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function getHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString();
}

/**
 * ログイン情報の反映（ここを大幅強化）
 */
function initUserInfo() {
  const savedName = localStorage.getItem('display_name');
  
  const guestDiv = document.getElementById('auth-guest');
  const userDiv = document.getElementById('auth-user');
  const nameDisplay = document.getElementById('user-name-display');
  const nameInput = document.getElementById('user-name'); // スレ立てフォーム

  if (savedName && savedName !== "undefined") {
    // 1. エントランスのリンクを「ようこそ」に切り替え
    if (guestDiv) guestDiv.style.display = 'none';
    if (userDiv) {
        userDiv.style.display = 'block';
        userDiv.style.background = 'rgba(46, 213, 115, 0.1)'; // ログイン中を薄緑で強調
        userDiv.style.padding = '8px';
        userDiv.style.borderRadius = '5px';
        userDiv.style.border = '1px solid #2ed573';
    }
    
    // 2. ユーザー名を表示
    if (nameDisplay) {
        nameDisplay.innerText = savedName;
        nameDisplay.style.color = '#2ed573'; 
    }

    // 3. スレ立てフォームの名前欄を「強制固定」
    if (nameInput) {
      nameInput.value = savedName;
      nameInput.readOnly = true; // ログイン中は変更不可にして本人証明とする
      nameInput.style.backgroundColor = '#eee';
      nameInput.style.cursor = 'not-allowed';
    }
    console.log("Login check: OK (" + savedName + ")");
  } else {
    // 未ログイン時
    if (guestDiv) guestDiv.style.display = 'block';
    if (userDiv) userDiv.style.display = 'none';
    console.log("Login check: No session");
  }
}

/**
 * 1. スレッド一覧表示
 */
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container || !supabaseClient) return;

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("スレッド取得失敗:", error);
    return;
  }

  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const sortedThreads = [...(threads || [])].sort((a, b) => 
    (b.is_admin_thread ? 1 : 0) - (a.is_admin_thread ? 1 : 0)
  );

  container.innerHTML = sortedThreads.map(thread => {
    const isSpecial = thread.is_admin_thread === true;
    return `
      <div class="aa" style="padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid ${isSpecial ? '#ff4757' : '#ddd'}; background:${isSpecial ? 'rgba(255, 71, 87, 0.03)' : '#fff'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 style="margin: 0; font-size: 1.2em;">
            ${isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-right:8px; vertical-align:middle;">📌 運営</span>' : ''}
            <a href="thread.html?id=${thread.id}" style="color: ${isSpecial ? '#ff4757' : '#1a73e8'}; text-decoration: none; font-weight:bold;">
              ${escapeHTML(thread.title)}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${thread.id}')" style="color:#ff4757; cursor:pointer; background:#fff; border:1px solid #ff4757; border-radius:4px; padding:2px 8px; font-size:12px;">削除</button>` : ''}
        </div>
        <div style="font-size:0.85em; color:#666; margin:8px 0;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span> ：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="font-size:0.95em; color:#444; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height:1.5;">
          ${escapeHTML(thread.content)}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 2. 認証関連
 */
window.handleAdminLogin = async function() {
  const name = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();
  if (!name || !pass) return;

  const hashedPass = getHashCode(pass);
  const { data } = await supabaseClient.from('user_accounts').select('username').eq('username', name).eq('password', hashedPass).maybeSingle();

  if (data) {
    alert("管理者認証成功！");
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', name);
    localStorage.setItem('display_name', name); 
    location.reload();
  } else {
    alert("認証失敗");
  }
};

window.userLogout = function() {
  if(!confirm("ログアウトしますか？")) return;
  localStorage.clear(); // すべてクリアして確実にリセット
  location.reload();
};
window.logout = window.userLogout;

window.deleteThread = async function(id) {
  if (!confirm("削除しますか？")) return;
  await supabaseClient.from('threads').delete().eq('id', id);
  loadThreads();
};

/**
 * 3. スレッド作成
 */
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('create-btn');
    const title = document.getElementById('thread-title').value.trim();
    const name = document.getElementById('user-name').value.trim() || localStorage.getItem('display_name') || "名無しさん";
    const content = document.getElementById('content').value.trim();
    const adminCheck = document.getElementById('is-admin-thread');
    const userUuid = localStorage.getItem('user_uuid');

    if (!title || !content) return;
    btn.disabled = true;
    btn.innerText = "作成中...";

    const { data, error } = await supabaseClient.from('threads').insert([{ 
      title, name, content, 
      is_admin_thread: adminCheck ? adminCheck.checked : false,
      user_id_display: userUuid 
    }]).select(); 
    
    if (data && data[0]) window.location.href = `thread.html?id=${data[0].id}`;
    else { alert("失敗"); btn.disabled = false; }
  });
}

function checkAdminStatus() {
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  if (isAdmin) {
    if (document.getElementById('admin-console')) document.getElementById('admin-console').style.display = 'block';
    if (document.getElementById('admin-auth-inputs')) document.getElementById('admin-auth-inputs').style.display = 'none';
    if (document.getElementById('admin-name')) document.getElementById('admin-name').innerText = localStorage.getItem('admin_name');
    const opt = document.getElementById('admin-thread-option');
    if (opt) opt.innerHTML = `<label style="color:#ff4757; font-weight:bold;"><input type="checkbox" id="is-admin-thread"> 📢 運営専用スレッド</label>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
  initUserInfo(); 
});

async function sendUserIP() {
  try {
    // 1. 外部APIを使って閲覧者のIPアドレスを取得
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    const userIP = data.ip;

    // 2. Supabaseのテーブル（例: access_logs）に送信・保存
    if (supabaseClient) {
      await supabaseClient.from('access_logs').insert([{ 
        ip_address: userIP,
        // 必要なら開いているページのURLなども一緒に送れる
        // page_url: window.location.href 
      }]);
    }
  } catch (error) {
    console.error("IP記録エラー:", error);
  }
}

// ページ読み込み時に実行する場合
document.addEventListener('DOMContentLoaded', () => {
  sendUserIP();
});