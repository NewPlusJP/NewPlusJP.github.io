// --- config.jsの内容 ---
const SUPABASE_URL = 'https://ezishztrukqnrqsvaeur.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_BA9fejewdKLR7e_WfyBNyQ_2x0Mtrx9';

const { createClient } = window.supabase; 
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. スレッド一覧を表示
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) return;

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    container.innerHTML = '<p>エラー: ' + error.message + '</p>';
    return;
  }

  const isAdmin = localStorage.getItem('is_admin') === 'true';

  container.innerHTML = threads.map(thread => `
    <div class="aa" id="thread-card-${thread.id}">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="color: #ff0000; margin: 0;">${thread.title}</h3>
        ${isAdmin ? `<button onclick="deleteThread(${thread.id})" style="color:red; cursor:pointer; background:none; border:1px solid red; border-radius:4px;">スレごと削除 🗑️</button>` : ''}
      </div>
      <div class="res-meta">
        1 ：<span class="res-name" style="color: green; font-weight: bold;">${thread.name}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div class="res-content" style="margin: 10px 0; white-space: pre-wrap;">${thread.content}</div>
      
      <hr style="border: 0; border-top: 1px dashed #ccc;">
      <div id="res-list-${thread.id}" style="margin-bottom:15px; padding-left: 10px;"><small>読み込み中...</small></div>

      <form onsubmit="postReply(event, ${thread.id})">
        <input type="text" id="res-name-${thread.id}" placeholder="名前" style="width: 20%;">
        <input type="text" id="res-content-${thread.id}" placeholder="本文" required style="width: 50%;">
        <button type="submit" class="submit-btn">書き込む</button>
      </form>
    </div>
  `).join('');

  threads.forEach(thread => loadPosts(thread.id));
}

// 3. レスを表示
async function loadPosts(threadId) {
  const postContainer = document.getElementById(`res-list-${threadId}`);
  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error || !posts || posts.length === 0) {
    postContainer.innerHTML = '<small style="color:gray;">レスはありません</small>';
    return;
  }

  const isAdmin = localStorage.getItem('is_admin') === 'true';

  postContainer.innerHTML = posts.map((post, index) => `
    <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
      <div class="res-meta" style="display: flex; justify-content: space-between;">
        <span>${index + 2} ：<span class="res-name" style="color: green; font-weight: bold;">${post.name}</span>：${new Date(post.created_at).toLocaleString()}</span>
        ${isAdmin ? `<button onclick="deletePost(${post.id}, ${threadId})" style="color:red; font-size: 0.8em; cursor:pointer; background:none; border:none;">[削除]</button>` : ''}
      </div>
      <div class="res-content" style="margin: 5px 0 0 15px; white-space: pre-wrap;">${post.content}</div>
    </div>
  `).join('');
}

// --- ★削除用関数を追加 ---

// スレッド削除
async function deleteThread(id) {
  if (!confirm("このスレッドを完全に削除しますか？内のレスも消えます。")) return;
  
  // まず関連するレスを削除
  await supabaseClient.from('posts').delete().eq('thread_id', id);
  // スレッドを削除
  const { error } = await supabaseClient.from('threads').delete().eq('id', id);
  
  if (error) alert("削除失敗: " + error.message);
  else loadThreads();
}

// レス削除
async function deletePost(postId, threadId) {
  if (!confirm("このレスを削除しますか？")) return;
  const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
  
  if (error) alert("削除失敗: " + error.message);
  else loadPosts(threadId);
}

// 4. レス投稿
async function postReply(event, threadId) {
  event.preventDefault(); 
  const nameInput = document.getElementById(`res-name-${threadId}`);
  const contentInput = document.getElementById(`res-content-${threadId}`);
  const { error } = await supabaseClient.from('posts').insert([{ thread_id: threadId, name: nameInput.value || "名無しさん", content: contentInput.value }]);
  if (error) alert(error.message);
  else { contentInput.value = ""; loadPosts(threadId); }
}

// 5. スレ立て
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('thread-title').value;
    const name = document.getElementById('user-name').value || "名無しさん";
    const content = document.getElementById('content').value;
    const { error } = await supabaseClient.from('threads').insert([{ title, name, content }]);
    if (error) alert(error.message);
    else { alert("作成成功"); this.reset(); loadThreads(); }
  });
}

// 6. 管理者ログイン・ログアウト
async function handleAdminLogin() {
  const user = document.getElementById('admin-user').value;
  const pass = document.getElementById('admin-pass').value;
  const { data } = await supabaseClient.from('admin_users').select('*').eq('username', user).eq('password_hash', pass).single();
  if (data) {
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', data.username);
    location.reload(); 
  } else { alert("失敗"); }
}

function handleAdminLogout() {
  localStorage.removeItem('is_admin');
  localStorage.removeItem('admin_name');
  location.reload();
}

function checkAdminStatus() {
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const adminConsole = document.getElementById('admin-console');
  const adminInputs = document.getElementById('admin-auth-inputs');
  if (isAdmin && adminConsole) {
    adminConsole.style.display = 'block';
    adminInputs.style.display = 'none';
    document.getElementById('admin-name').innerText = localStorage.getItem('admin_name');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
});