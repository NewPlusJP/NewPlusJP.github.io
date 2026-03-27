const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- スレッド一覧表示 ---
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

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p>まだスレッドがありません。</p>';
    return;
  }

  container.innerHTML = threads.map(thread => `
    <div class="aa" id="thread-card-${thread.id}">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0;">
          <a href="thread.html?id=${thread.id}" style="color: #ff0000; text-decoration: none;">
            ${thread.title}
          </a>
        </h3>
        ${isAdmin ? `<button onclick="deleteThread(${thread.id})" style="color:red; cursor:pointer; background:none; border:1px solid red; border-radius:4px; padding:2px 5px;">スレごと削除 🗑️</button>` : ''}
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
  `).join('');
}

// --- 削除機能 ---
async function deleteThread(id) {
  if (!confirm("完全に削除しますか？")) return;
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
    
    const { data, error } = await supabaseClient
      .from('threads')
      .insert([{ title, name, content }])
      .select(); 
    
    if (error) alert("失敗: " + error.message);
    else if (data) window.location.href = `thread.html?id=${data[0].id}`;
  });
}

// --- 管理者ログイン ---
// スレッド作成ボタンが押された時の処理の中
async function createThread() {
  const title = document.getElementById('thread-title').value;
  const name = document.getElementById('user-name').value || "名無しさん";
  const content = document.getElementById('content').value;

  // ★ 追加：チェックボックスの状態を取得（管理者じゃない場合は自動で false）
  const adminThreadCheck = document.getElementById('is-admin-thread');
  const isAdminThread = adminThreadCheck ? adminThreadCheck.checked : false;

  if (!title || !content) return;

  const { data, error } = await supabaseClient
    .from('threads')
    .insert([
      { 
        title: title, 
        name: name, 
        content: content,
        is_admin_thread: isAdminThread // ★ ここでDBに送る！
      }
    ]);

  if (error) {
    alert("エラーが発生しました: " + error.message);
  } else {
    alert("スレッドを作成しました！");
    location.reload(); // 一覧を更新
  }
}

function handleAdminLogout() {
  localStorage.removeItem('is_admin');
  location.reload();
}

function checkAdminStatus() {
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const adminConsole = document.getElementById('admin-console');
  const adminInputs = document.getElementById('admin-auth-inputs');
  if (isAdmin && adminConsole) {
    adminConsole.style.display = 'block';
    if (adminInputs) adminInputs.style.display = 'none';
    document.getElementById('admin-name').innerText = localStorage.getItem('admin_name');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
});