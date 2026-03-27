// --- 1. 初期化 ---
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. スレッド一覧を表示 ---
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

  // 返信リストと返信フォームを削除し、タイトルと最初の本文だけに集約
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
        1 ：<span style="color: green; font-weight: bold;">${thread.name}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div class="res-content" style="margin: 10px 0; white-space: pre-wrap; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
        ${thread.content}
      </div>
      
      <div style="margin-top: 10px;">
        <a href="thread.html?id=${thread.id}" style="font-size: 0.9em; color: #555;">>> このスレッドを開く</a>
      </div>
    </div>
  `).join('');
}

// --- 3. 削除機能 ---
async function deleteThread(id) {
  if (!confirm("このスレッドを内のレスごと完全に削除しますか？")) return;
  
  // 関連するレスを削除
  await supabaseClient.from('posts').delete().eq('thread_id', id);
  // スレッド自体を削除
  const { error } = await supabaseClient.from('threads').delete().eq('id', id);
  
  if (error) alert("削除失敗: " + error.message);
  else loadThreads();
}

// --- 4. スレ立て機能 ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('thread-title').value;
    const name = document.getElementById('user-name').value || "名無しさん";
    const content = document.getElementById('content').value;
    
    const { error } = await supabaseClient.from('threads').insert([{ title, name, content }]);
    
    if (error) alert(error.message);
    else {
      alert("スレッドを作成しました！");
      this.reset();
      loadThreads();
    }
  });
}

async function handleAdminLogin() {
  const user = document.getElementById('admin-user').value;
  const pass = document.getElementById('admin-pass').value;

  console.log("ログイン試行:", user); // デバッグ用

  const { data, error } = await supabaseClient
    .from('admin_users')
    .select('*')
    .eq('username', user)
    .eq('password_hash', pass)
    .single();

  if (error) {
    console.error("ログインエラー:", error.message);
    alert("ログイン失敗: IDまたはパスワードが違います");
  } else if (data) {
    alert("ログイン成功！");
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', data.username);
    location.reload(); 
  }
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
    if (adminInputs) adminInputs.style.display = 'none';
    const nameDisp = document.getElementById('admin-name');
    if (nameDisp) nameDisp.innerText = localStorage.getItem('admin_name');
  }
}

// --- 6. 実行 ---
document.addEventListener('DOMContentLoaded', () => {
  loadThreads();
  checkAdminStatus();
});