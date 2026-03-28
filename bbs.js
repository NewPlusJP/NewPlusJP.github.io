/**
 * NewPlusJP - BBS Main System
 * 管理者ログイン修正（数値ハッシュ対応）・スレッド一覧・スレ立て
 */

const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/**
 * 文字列を数値ハッシュに変換する関数
 * (2103650130 などの形式に対応)
 */
function getHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32ビット整数に変換
  }
  return Math.abs(hash).toString(); // 正の数にして文字列として返す
}

// --- 1. スレッド一覧表示 ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container || !supabaseClient) return;

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("取得失敗:", error);
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

// --- 2. 管理者認証 (ハッシュ化対応版) ---
window.handleAdminLogin = async function() {
  const name = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();
  if (!name || !pass) return;

  // 入力されたパスワードを数値ハッシュに変換
  const hashedPass = getHashCode(pass);

  const { data, error } = await supabaseClient
    .from('user_accounts')
    .select('username')
    .eq('username', name)
    .eq('password', hashedPass) // ハッシュ化した数値で照合
    .maybeSingle();

  if (data) {
    alert("管理者認証成功！");
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', name);
    location.reload();
  } else {
    alert("認証に失敗しました。ユーザー名またはパスワードが違います。");
    console.log("Hashed Input:", hashedPass); // デバッグ用
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
  const { error } = await supabaseClient.from('threads').delete().eq('id', id);
  if (error) alert("削除に失敗しました（権限エラー等）");
  loadThreads();
};

// --- 3. 新規スレッド作成 ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('create-btn');
    const title = document.getElementById('thread-title').value.trim();
    const name = document.getElementById('user-name').value.trim() || "名無しさん";
    const content = document.getElementById('content').value.trim();
    const adminCheck = document.getElementById('is-admin-thread');

    if (!title || !content) return;

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
      alert("失敗: " + (error ? error.message : "不明なエラー"));
      btn.disabled = false;
      btn.innerText = "スレッドを作成する";
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
      optionContainer.innerHTML = `
        <label style="color: #ff4757; font-weight: bold; cursor:pointer;">
          <input type="checkbox" id="is-admin-thread"> 📢 運営専用（ピン留め）として作成
        </label>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
});