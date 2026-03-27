// --- config.jsの内容をここに直接書く ---
const SUPABASE_URL = 'https://ezishztrukqnrqsvaeur.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_BA9fejewdKLR7e_WfyBNyQ_2x0Mtrx9';
// ------------------------------------

// 1. Supabaseの初期化
const { createClient } = window.supabase; 
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("bbs.js が起動しました。URL:", SUPABASE_URL);

// 2. スレッド一覧を表示する関数
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) {
    console.error("thread-container が見つかりません");
    return;
  }

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    container.innerHTML = '<p>取得エラー: ' + error.message + '</p>';
    return;
  }

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p>まだスレッドがありません。</p>';
    return;
  }

  // スレッド一覧の描画
  container.innerHTML = threads.map(thread => `
    <div class="aa">
      <h3 style="color: #ff0000; margin-top:0;">${thread.title}</h3>
      <div class="res-meta">
        1 ：<span class="res-name" style="color: green; font-weight: bold;">${thread.name}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div class="res-content" style="margin: 10px 0; white-space: pre-wrap;">${thread.content}</div>
      
      <hr style="border: 0; border-top: 1px dashed #ccc;">
      
      <div id="res-list-${thread.id}" style="margin-bottom:15px; padding-left: 10px;">
         <small>読み込み中...</small>
      </div>

      <form onsubmit="postReply(event, ${thread.id})">
        <input type="text" id="res-name-${thread.id}" placeholder="名前" style="width: 20%;">
        <input type="text" id="res-content-${thread.id}" placeholder="本文" required style="width: 50%;">
        <button type="submit" class="submit-btn">書き込む</button>
      </form>
    </div>
  `).join('');

  threads.forEach(thread => loadPosts(thread.id));
}

// 3. レスを取得して表示する関数
async function loadPosts(threadId) {
  const postContainer = document.getElementById(`res-list-${threadId}`);
  if (!postContainer) return;

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error || !posts || posts.length === 0) {
    postContainer.innerHTML = '<small style="color:gray;">レスはありません</small>';
    return;
  }

  postContainer.innerHTML = posts.map((post, index) => `
    <div style="margin-bottom: 10px;">
      <div class="res-meta">
        ${index + 2} ：<span class="res-name" style="color: green; font-weight: bold;">${post.name}</span>：${new Date(post.created_at).toLocaleString()}
      </div>
      <div class="res-content" style="margin: 5px 0 0 15px; white-space: pre-wrap;">${post.content}</div>
    </div>
  `).join('');
}

// 4. レスを投稿する関数
async function postReply(event, threadId) {
  event.preventDefault(); 
  const nameInput = document.getElementById(`res-name-${threadId}`);
  const contentInput = document.getElementById(`res-content-${threadId}`);
  
  const { error } = await supabaseClient
    .from('posts')
    .insert([{ 
      thread_id: threadId, 
      name: nameInput.value || "名無しさん", 
      content: contentInput.value 
    }]);

  if (error) {
    alert("書き込み失敗: " + error.message);
  } else {
    contentInput.value = "";
    loadPosts(threadId); 
  }
}

// 5. 新規スレッド作成
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('thread-title').value;
    const name = document.getElementById('user-name').value || "名無しさん";
    const content = document.getElementById('content').value;

    const { error } = await supabaseClient
      .from('threads')
      .insert([{ title, name, content }]);

    if (error) {
      alert("作成失敗: " + error.message);
    } else {
      alert("スレッドを作成しました！");
      this.reset();
      loadThreads(); 
    }
  });
}

// DOMContentLoadedを使うことでHTMLの読み込み完了を待ってから実行する
document.addEventListener('DOMContentLoaded', loadThreads);

// 簡易ログイン処理
async function login() {
  const user = document.getElementById('login-name').value;
  const pass = document.getElementById('login-pass').value;

  // board_users テーブルに照合しに行く
  const { data, error } = await supabaseClient
    .from('board_users')
    .select('*')
    .eq('username', user)
    .eq('password_hash', pass) // 本来はハッシュ化すべきですが、まずは簡易的に
    .single();

  if (data) {
    alert("ログイン成功！");
    localStorage.setItem('loggedInUser', JSON.stringify(data));
  } else {
    alert("名前かパスワードが違います");
  }
}

// --- アカウント管理機能 ---

// 1. 新規登録
async function handleRegister() {
  const user = document.getElementById('auth-username').value;
  const pass = document.getElementById('auth-password').value;
  if(!user || !pass) return alert("名前とパスワードを入力してね");

  const { error } = await supabaseClient
    .from('board_users')
    .insert([{ username: user, password_hash: pass }]);

  if (error) {
    alert("その名前はすでに使われているか、エラーが発生しました");
  } else {
    alert("登録完了！ログインしてください");
  }
}

// 2. ログイン
async function handleLogin() {
  const user = document.getElementById('auth-username').value;
  const pass = document.getElementById('auth-password').value;

  const { data, error } = await supabaseClient
    .from('board_users')
    .select('*')
    .eq('username', user)
    .eq('password_hash', pass)
    .single();

  if (data) {
    localStorage.setItem('bbs_user', JSON.stringify(data));
    updateAuthUI();
    alert("ログインしました！");
  } else {
    alert("名前かパスワードが違います");
  }
}

// 3. ログアウト
function handleLogout() {
  localStorage.removeItem('bbs_user');
  updateAuthUI();
  alert("ログアウトしました");
}

// 4. 表示の切り替え
function updateAuthUI() {
  const userData = localStorage.getItem('bbs_user');
  const authInputs = document.getElementById('auth-inputs');
  const userInfo = document.getElementById('user-info');
  
  if (userData) {
    const user = JSON.parse(userData);
    authInputs.style.display = 'none';
    userInfo.style.display = 'block';
    document.getElementById('current-user-name').innerText = user.username;
  } else {
    authInputs.style.display = 'block';
    userInfo.style.display = 'none';
  }
}

// 起動時にログイン状態をチェック
document.addEventListener('DOMContentLoaded', updateAuthUI);