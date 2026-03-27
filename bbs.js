const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- スレッド一覧表示 ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) return;

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('created_at', { ascending: false }); // 基本は新しい順

  if (error) {
    container.innerHTML = '<p>エラー: ' + error.message + '</p>';
    return;
  }

  const isAdmin = localStorage.getItem('is_admin') === 'true';

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p>まだスレッドがありません。</p>';
    return;
  }

  // ★ ピン留め（運営専用スレ）を一番上に持ってくる並び替え
  const sortedThreads = [...threads].sort((a, b) => {
    return (b.is_admin_thread ? 1 : 0) - (a.is_admin_thread ? 1 : 0);
  });

  container.innerHTML = sortedThreads.map(thread => {
    // 運営用スレッドのスタイル設定
    const isSpecial = thread.is_admin_thread === true;
    const cardStyle = isSpecial ? 'border: 2px solid #ff4757; background: #fff9f9;' : '';
    const badge = isSpecial ? '<span style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-right:8px; vertical-align:middle;">📌 置標 / 運営</span>' : '';

    return `
      <div class="aa" id="thread-card-${thread.id}" style="${cardStyle}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">
            ${badge}
            <a href="thread.html?id=${thread.id}" style="color: ${isSpecial ? '#ff4757' : '#ff0000'}; text-decoration: none;">
              ${thread.title}
            </a>
          </h3>
          ${isAdmin ? `<button onclick="deleteThread('${thread.id}')" style="color:red; cursor:pointer; background:none; border:1px solid red; border-radius:4px; padding:2px 5px;">スレごと削除 🗑️</button>` : ''}
        </div>
        <div class="res-meta">
          1 ：<span class="res-name">${thread.name}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div class="res-content" style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
          ${thread.content}
        </div>
        <div style="margin-top: 10px;">
          <a href="thread.html?id=${thread.id}" style="font-size: 0.9em; color: #555;">>> このスレッドを開く</a>
        </div>
      </div>
    `;
  }).join('');
}

// --- 削除機能 ---
async function deleteThread(id) {
  if (!confirm("完全に削除しますか？")) return;
  // UUIDの場合は引用符が必要なため文字列として扱う
  await supabaseClient.from('posts').delete().eq('thread_id', id);
  const { error } = await supabaseClient.from('threads').delete().eq('id', id);
  if (error) alert("削除失敗: " + error.message);
  else location.reload();
}

// --- スレ立て機能 ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const title = document.getElementById('thread-title').value;
    const name = document.getElementById('user-name').value || "名無しさん";
    const content = document.getElementById('content').value;
    
    // 管理者用チェックボックスの状態を取得
    const adminThreadCheck = document.getElementById('is-admin-thread');
    const isAdminThread = adminThreadCheck ? adminThreadCheck.checked : false;

    const { data, error } = await supabaseClient
      .from('threads')
      .insert([{ 
        title, 
        name, 
        content,
        is_admin_thread: isAdminThread 
      }])
      .select(); 
    
    if (error) {
      alert("失敗: " + error.message);
    } else if (data) {
      alert(isAdminThread ? "運営専用スレッドを作成しました！" : "スレッドを作成しました！");
      window.location.href = `thread.html?id=${data[0].id}`;
    }
  });
}

// --- 管理者ログアウト ---
function handleAdminLogout() {
  localStorage.removeItem('is_admin');
  localStorage.removeItem('admin_name');
  location.reload();
}

// --- 管理者状態チェックとUI更新 ---
function checkAdminStatus() {
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const adminConsole = document.getElementById('admin-console');
  const adminInputs = document.getElementById('admin-auth-inputs');
  const optionContainer = document.getElementById('admin-thread-option');

  if (isAdmin) {
    if (adminConsole) adminConsole.style.display = 'block';
    if (adminInputs) adminInputs.style.display = 'none';
    const nameEl = document.getElementById('admin-name');
    if (nameEl) nameEl.innerText = localStorage.getItem('admin_name') || "管理者";

    // スレッド作成フォームに「運営専用」チェックボックスを出す
    if (optionContainer) {
      optionContainer.innerHTML = `
        <div style="margin: 10px 0; padding: 10px; border: 2px dashed #ff4757; border-radius: 10px; background: #fff5f5;">
          <label style="color: #ff4757; font-weight: bold; cursor: pointer;">
            <input type="checkbox" id="is-admin-thread"> 📢 運営専用（ピン留め）にする
          </label>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
});

// --- 簡易オンラインカウンター ---
async function updateOnlineCount() {
  const counterEl = document.getElementById('online-counter');
  if (!counterEl) return;

  // 1〜5人くらいでランダムに「見てる感」を出す（簡単な方法）
  // もし本格的にやるならSupabase Realtimeを使いますが、まずはこれで！
  const baseCount = Math.floor(Math.random() * 3) + 1; 
  counterEl.innerText = `現在 ${baseCount} 人が閲覧中`;
}

// DOMContentLoadedの中に追加
document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
  updateOnlineCount(); // これを追加
});

// --- ログイン状態を画面に反映させる関数 ---
function updateAuthDisplay() {
  const userName = localStorage.getItem('user_display_name');
  const authStatusDiv = document.getElementById('auth-status'); // HTMLにこのIDのdivを作っておく
  const nameInput = document.getElementById('user-name'); // 投稿フォームの名前欄

  if (userName) {
    // ログインしている場合
    if (authStatusDiv) {
      authStatusDiv.innerHTML = `
        <span style="font-weight:bold; color:#2ed573;">● ログイン中: ${userName}さん</span>
        <button onclick="logout()" style="margin-left:10px; font-size:0.8em;">ログアウト</button>
      `;
    }
    // 投稿フォームの名前欄に、自動でユーザー名を入れる（書き換え不可にする）
    if (nameInput) {
      nameInput.value = userName;
      nameInput.readOnly = true; 
      nameInput.style.background = "#eee";
    }
  } else {
    // ログインしていない場合
    if (authStatusDiv) {
      authStatusDiv.innerHTML = `
        <a href="login.html" style="color:#ff4757; font-weight:bold;">ログイン</a> 
        または <a href="signup.html">新規登録</a> して投稿を固定しよう！
      `;
    }
  }
}

// ログアウト処理
function logout() {
  localStorage.removeItem('user_display_name');
  // 管理者フラグも消すなら
  localStorage.removeItem('is_admin');
  location.reload();
}

// 既存のDOMContentLoadedに追加
document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
  updateAuthDisplay(); // ← これを追加！
});

function toggleDarkMode() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  
  if (currentTheme === 'dark') {
    html.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
}

// ページ読み込み時に保存されたテーマを適用
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
});