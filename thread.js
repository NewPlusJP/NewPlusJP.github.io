// 1. 初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');

let currentThreadData = null;

function generateID() {
  const date = new Date().toISOString().slice(0, 10);
  let userSecret = localStorage.getItem('user_uuid_seed') || (Math.random().toString(36).substring(2) + Date.now().toString(36));
  localStorage.setItem('user_uuid_seed', userSecret);
  const seed = date + userSecret;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
}

async function loadSingleThread() {
  const container = document.getElementById('single-thread-container');
  
  // --- デバッグ表示 ---
  if (!container) {
    alert("エラー: HTMLに id='single-thread-container' が見つかりません！");
    return;
  }
  if (!threadId) {
    container.innerHTML = "URLにIDが含まれていません（?id=xxx の形式が必要です）";
    return;
  }
  // ------------------

  const { data: thread, error } = await supabaseClient
    .from('threads')
    .select('id, title, name, content, created_at')
    .eq('id', threadId)
    .maybeSingle();

  if (error) {
    container.innerHTML = "データ取得失敗: " + error.message;
    return;
  }
  if (!thread) {
    container.innerHTML = "スレッドが存在しません (ID: " + threadId + ")";
    return;
  }

  currentThreadData = thread;
  const savedName = localStorage.getItem('user_display_name') || "";

  container.innerHTML = `
    <div class="aa">
      <h2 style="color: #ff0000; margin-bottom: 5px;">${thread.title}</h2>
      <div style="background: #f0f0f0; padding: 20px; border-radius: 20px; border: 1px solid #ccc; margin-bottom: 20px;">
        <h3 style="margin-top:0;">レスを書き込む</h3>
        <form id="reply-form">
          <input type="text" id="res-name" placeholder="名前" value="${savedName}" style="width: 200px; padding: 8px; border-radius: 10px; border: 1px solid #ddd; margin-bottom: 5px;"><br>
          <textarea id="res-content" placeholder="内容を入力" required style="width: 95%; height: 80px; padding: 10px; border-radius: 10px; border: 1px solid #ddd;"></textarea><br>
          <button type="submit" id="submit-btn" class="submit-btn" style="padding: 8px 25px; margin-top:10px;">書き込む</button>
        </form>
      </div>
      <div id="res-list">レスを読み込み中...</div>
      <div style="margin-top:20px;"><a href="index.html">■掲示板トップに戻る</a></div>
    </div>
  `;

  document.getElementById('reply-form').addEventListener('submit', postReplyInThread);
  await loadPostsInThread(); 
}

async function loadPostsInThread() {
  const postList = document.getElementById('res-list');
  if (!postList) return;

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('id, name, content, created_at, user_id_display')
    .eq('thread_id', threadId)
    .order('id', { ascending: false })
    .limit(20);

  if (error) {
    postList.innerHTML = "レスの取得に失敗しました: " + error.message;
    return;
  }

  const displayArray = [...(posts || [])];
  if (currentThreadData) {
    displayArray.push({
      id: "first",
      name: currentThreadData.name,
      content: currentThreadData.content,
      created_at: currentThreadData.created_at,
      user_id_display: "OWNER",
      is_owner: true
    });
  }

  postList.innerHTML = displayArray.map((post) => {
    const isAdmin = (post.user_id_display === "ADMIN");
    const adminBadge = isAdmin ? '<span style="background:#ff4757; color:white; padding:2px 8px; border-radius:10px; font-size:0.75em; margin-left:5px; vertical-align:middle;">管理者</span>' : '';
    const nameColor = post.is_owner ? "#ff0000" : "green";
    return `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <span style="color:${nameColor}; font-weight:bold;">${post.name}${adminBadge}</span> 
        <small>：${new Date(post.created_at).toLocaleString()} ID:${post.user_id_display || "???"}</small>
        <div style="margin-top:8px; white-space:pre-wrap;">${post.content}</div>
      </div>
    `;
  }).join('');
}

async function postReplyInThread(event) {
  event.preventDefault();
  const contentInput = document.getElementById('res-content');
  const submitBtn = document.getElementById('submit-btn');
  const nameToSave = document.getElementById('res-name').value || "名無しさん";

  submitBtn.disabled = true;
  submitBtn.innerText = "送信中...";

  const { error } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameToSave,
    content: contentInput.value,
    user_id_display: (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : generateID()
  }]);

  if (!error) {
    contentInput.value = "";
    await cleanOldPosts();
    await loadPostsInThread();
  } else {
    alert("投稿エラー: " + error.message);
  }
  submitBtn.disabled = false;
  submitBtn.innerText = "書き込む";
}

async function cleanOldPosts() {
  const { data } = await supabaseClient.from('posts').select('id').eq('thread_id', threadId).order('id', { ascending: false });
  if (data && data.length > 20) {
    const idsToDelete = data.slice(20).map(p => p.id);
    await supabaseClient.from('posts').delete().in('id', idsToDelete);
  }
}

document.addEventListener('DOMContentLoaded', loadSingleThread);