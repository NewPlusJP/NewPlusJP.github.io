// 1. 初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');

function generateID() {
  const date = new Date().toISOString().slice(0, 10);
  const userAgent = navigator.userAgent; 
  const seed = date + userAgent;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
}

// 2. スレッドとレスを読み込む
async function loadSingleThread() {
  const container = document.getElementById('single-thread-container');
  if (!threadId) {
    container.innerHTML = '<div class="aa">スレッドIDが指定されていません。</div>';
    return;
  }

  const { data: thread, error } = await supabaseClient
    .from('threads')
    .select('*')
    .eq('id', threadId)
    .single();

  if (error || !thread) {
    container.innerHTML = '<div class="aa">スレッドが見つかりませんでした。</div>';
    return;
  }

  // スレ主の名前は「赤色」にする
  container.innerHTML = `
    <div class="aa">
      <h2 style="color: #ff0000; margin-bottom: 5px;">${thread.title}</h2>
      <div class="res-meta">
        1 ：<span style="color: #ff0000; font-weight: bold;">${thread.name}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div class="res-content" style="margin: 15px 0; white-space: pre-wrap; line-height: 1.6;">${thread.content}</div>
      <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
      <div id="res-list">読み込み中...</div>
      <hr style="margin: 20px 0;">
      <h3>レスを書き込む</h3>
      <form onsubmit="postReplyInThread(event)">
        <div style="margin-bottom: 10px;">
          <input type="text" id="res-name" placeholder="名前（省略可）" style="width: 200px; padding: 5px;">
        </div>
        <div style="margin-bottom: 10px;">
          <textarea id="res-content" placeholder="内容を入力してください" required style="width: 90%; height: 80px; padding: 5px;"></textarea>
        </div>
        <button type="submit" class="submit-btn" style="padding: 10px 30px;">書き込む</button>
      </form>
    </div>
  `;

  loadPostsInThread(thread.name); 
}

// 3. レス一覧を表示
async function loadPostsInThread(originalPosterName) {
  const postList = document.getElementById('res-list');
  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) {
    postList.innerHTML = 'レスの読み込みに失敗しました。';
    return;
  }

  const isAdminLoggedIn = localStorage.getItem('is_admin') === 'true';

  postList.innerHTML = posts.map((post, index) => {
    const displayID = post.user_id_display || "???";
    let nameStyle = "color: green; font-weight: bold;"; 
    let adminMark = "";

    if (post.is_admin_post) {
      nameStyle = "color: #ffaa00; font-weight: bold;"; 
      adminMark = " <small>(★管理者)</small>";
    } 
    else if (post.name === originalPosterName) {
      nameStyle = "color: #ff0000; font-weight: bold;"; 
    }

    return `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <div class="res-meta" style="display: flex; justify-content: space-between;">
          <span>
            ${index + 2} ：<span style="${nameStyle}">${post.name}${adminMark}</span>：${new Date(post.created_at).toLocaleString()} 
            <small style="color: #666; margin-left: 10px;">ID:${displayID}</small>
          </span>
          ${isAdminLoggedIn ? `<button onclick="deletePostInThread(${post.id})" style="color:red; background:none; border:none; cursor:pointer;">[削除]</button>` : ''}
        </div>
        <div class="res-content" style="margin-top: 5px; white-space: pre-wrap;">${post.content}</div>
      </div>
    `;
  }).join('');
}

// 4. レス投稿処理 ＋ 自動お掃除機能
async function postReplyInThread(event) {
  event.preventDefault();
  const nameInput = document.getElementById('res-name');
  const contentInput = document.getElementById('res-content');
  const myID = generateID();
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  // 1. レスを投稿
  const { error: postError } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameInput.value || "名無しさん",
    content: contentInput.value,
    user_id_display: myID,
    is_admin_post: isAdmin
  }]);

  if (postError) {
    alert("エラー: " + postError.message);
    return;
  }

  // 2. 自動お掃除（最新20件だけ残す）
  const MAX_RES = 20; 
  const { data: currentPosts } = await supabaseClient
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .order('id', { ascending: true }); // 古い順に取得

  if (currentPosts && currentPosts.length > MAX_RES) {
    const deleteCount = currentPosts.length - MAX_RES;
    const idsToDelete = currentPosts.slice(0, deleteCount).map(p => p.id);

    await supabaseClient
      .from('posts')
      .delete()
      .in('id', idsToDelete);
  }

  // 3. 画面リセット
  contentInput.value = "";
  location.reload(); 
}

async function deletePostInThread(postId) {
  if (!confirm("このレスを削除しますか？")) return;
  await supabaseClient.from('posts').delete().eq('id', postId);
  location.reload();
}

document.addEventListener('DOMContentLoaded', loadSingleThread);