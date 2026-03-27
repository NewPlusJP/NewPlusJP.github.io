// 1. 初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');

// ユーザー固有ID生成（1日ごとに変わる＆他人とかぶらない）
function generateID() {
  const date = new Date().toISOString().slice(0, 10);
  let userSecret = localStorage.getItem('user_uuid_seed');
  if (!userSecret) {
    userSecret = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('user_uuid_seed', userSecret);
  }
  const seed = date + userSecret;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
}

// 2. スレッドとレスを読み込む（土台作成）
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
    .maybeSingle();

  if (error || !thread) {
    container.innerHTML = `
      <div class="aa">
        <h3>スレッドが見つかりません (ID: ${threadId})</h3>
        <p>すでに削除されたか、URLが間違っている可能性があります。</p>
        <a href="index.html">トップへ戻る</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="aa">
      <h2 style="color: #ff0000; margin-bottom: 5px;">${thread.title}</h2>
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
      <div style="margin-top:20px;"><a href="index.html">■掲示板トップに戻る</a></div>
    </div>
  `;

  loadPostsInThread(thread); 
}

// 3. レス一覧を表示（最新を一番上、1番を一番下にする）
async function loadPostsInThread(threadData) {
  const postList = document.getElementById('res-list');
  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('id', { ascending: false }); // 最新順

  if (error) {
    postList.innerHTML = 'レスの読み込みに失敗しました。';
    return;
  }

  // 表示用配列（レス + 最後にスレ主の本文）
  const displayArray = [...(posts || [])];
  displayArray.push({
    id: "first",
    name: threadData.name,
    content: threadData.content,
    created_at: threadData.created_at,
    user_id_display: "OWNER",
    is_owner: true
  });

  const isAdminLoggedIn = localStorage.getItem('is_admin') === 'true';

  postList.innerHTML = displayArray.map((post) => {
    const displayID = post.user_id_display || "???";
    let nameStyle = "color: green; font-weight: bold;";
    let label = '<span style="color:#888;">[最新]</span>';

    if (post.is_admin_post) {
      nameStyle = "color: #ffaa00; font-weight: bold;";
      label = '<span style="color:#ffaa00;">[★管理者]</span>';
    } else if (post.is_owner) {
      nameStyle = "color: #ff0000; font-weight: bold;";
      label = '<span style="color:#ff0000;">[>>1]</span>';
    }

    return `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <div class="res-meta" style="display: flex; justify-content: space-between;">
          <span>
            ${label} <span style="${nameStyle}">${post.name}</span>：${new Date(post.created_at).toLocaleString()} 
            <small style="color: #666; margin-left: 10px;">ID:${displayID}</small>
          </span>
          ${(isAdminLoggedIn && !post.is_owner) ? `<button onclick="deletePostInThread(${post.id})" style="color:red; background:none; border:none; cursor:pointer;">[削除]</button>` : ''}
        </div>
        <div class="res-content" style="margin-top: 5px; white-space: pre-wrap;">${post.content}</div>
      </div>
    `;
  }).join('');
}

// 4. レス投稿 ＆ お掃除
async function postReplyInThread(event) {
  event.preventDefault();
  const nameInput = document.getElementById('res-name');
  const contentInput = document.getElementById('res-content');
  const myID = generateID();
  const isAdmin = localStorage.getItem('is_admin') === 'true';

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

  // 最新20件キープ
  const MAX_RES = 20; 
  const { data: allPosts } = await supabaseClient
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .order('id', { ascending: false });

  if (allPosts && allPosts.length > MAX_RES) {
    const idsToDelete = allPosts.slice(MAX_RES).map(p => p.id);
    await supabaseClient.from('posts').delete().in('id', idsToDelete);
  }

  location.reload(); 
}

async function deletePostInThread(postId) {
  if (!confirm("削除しますか？")) return;
  await supabaseClient.from('posts').delete().eq('id', postId);
  location.reload();
}

document.addEventListener('DOMContentLoaded', loadSingleThread);