// --- 1. 初期化 ---
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. スレッド一覧を表示 ---
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) return;

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('id', { ascending: true });

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
  if (!confirm("このスレッド内のレスごと完全に削除しますか？")) return;
  await supabaseClient.from('posts').delete().eq('thread_id', id);
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
    
    const { data, error } = await supabaseClient
      .from('threads')
      .insert([{ title, name, content }])
      .select(); 
    
    if (error) {
      alert("スレ立て失敗: " + error.message);
    } else if (data && data.length > 0) {
      this.reset();
      window.location.href = `thread.html?id=${data[0].id}`;
    }
  });
}

// --- 5. 管理者ログイン（最強デバッグ版） ---
async function handleAdminLogin() {
  // .trim() を追加して、前後の余計な空白を自動削除！
  const user = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();

  console.log("ログイン試行中...");

  const { data, error } = await supabaseClient
    .from('admin_users')
    .select('*')
    .eq('username', user)
    .eq('password_hash', pass);

  if (error) {
    console.error("通信エラー:", error.message);
    alert("通信エラー: " + error.message);
  } else if (data && data.length > 0) {
    alert("ログイン成功！");
    localStorage.setItem('is_admin', 'true');
    localStorage.setItem('admin_name', data[0].username);
    location.reload(); 
  } else {
    // 【重要】失敗したときにDBの中身をチラ見して原因を探る
    const { data: checkData } = await supabaseClient.from('admin_users').select('username');
    
    if (!checkData || checkData.length === 0) {
      alert("ログイン失敗：そもそもDBに管理者が1人も登録されていません！SQL EditorでINSERTしてください。");
    } else {
      alert(`ログイン失敗：IDまたはパスワードが一致しません。\n(DBには ${checkData.length} 件のデータが存在します)`);
      console.log("DBに登録されているユーザー名リスト:", checkData.map(d => d.username));
    }
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