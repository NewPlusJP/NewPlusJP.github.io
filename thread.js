// 1. 初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');

let currentThreadData = null; // スレ主データを保持する変数

// ID生成（1日固定）
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

// 2. スレッド読み込み
async function loadSingleThread() {
  const container = document.getElementById('single-thread-container');
  if (!container) return;
  if (!threadId) {
    container.innerHTML = "スレッドIDが指定されていません。";
    return;
  }

  const { data: thread, error } = await supabaseClient
    .from('threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle();

  if (error || !thread) {
    container.innerHTML = '<div class="aa">スレッドが見つかりません</div>';
    return;
  }

  currentThreadData = thread; // データを保存
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

      <div id="res-list">読み込み中...</div>
      
      <div style="margin-top:20px;"><a href="index.html">■掲示板トップに戻る</a></div>
    </div>
  `;

  // フォーム送信イベント（リロード防止）
  document.getElementById('reply-form').addEventListener('submit', postReplyInThread);
  
  // 初回表示
  await loadPostsInThread(); 
}

// 3. レス表示
async function loadPostsInThread() {
  const postList = document.getElementById('res-list');
  if (!postList || !currentThreadData) return;

  const { data: posts } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('id', { ascending: false })
    .limit(20);

  const displayArray = [...(posts || [])];
  
  // スレ主（1レス目）を末尾に追加
  displayArray.push({
    id: "first",
    name: currentThreadData.name,
    content: currentThreadData.content,
    created_at: currentThreadData.created_at,
    user_id_display: "OWNER",
    is_owner: true
  });

  postList.innerHTML = displayArray.map((post) => {
    const isOwner = post.is_owner;
    const isAdmin = (post.user_id_display === "ADMIN");
    const adminBadge = isAdmin ? '<span style="background:#ff4757; color:white; padding:2px 8px; border-radius:10px; font-size:0.75em; margin-left:5px; vertical-align:middle;">管理者</span>' : '';
    const nameColor = isOwner ? "#ff0000" : "green";
    
    return `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <span style="color:${nameColor}; font-weight:bold;">${post.name}${adminBadge}</span> 
        <small>：${new Date(post.created_at).toLocaleString()} ID:${post.user_id_display || "???"}</small>
        <div style="margin-top:8px; white-space:pre-wrap;">${post.content}</div>
      </div>
    `;
  }).join('');
}

// 4. 投稿
async function postReplyInThread(event) {
  event.preventDefault(); // リロードを止める
  
  const contentInput = document.getElementById('res-content');
  const nameInput = document.getElementById('res-name');
  const submitBtn = document.getElementById('submit-btn');
  
  const nameToSave = nameInput.value || "名無しさん";
  const contentValue = contentInput.value;
  if (!contentValue.trim()) return;

  localStorage.setItem('user_display_name', nameToSave);
  const myID = (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : generateID();

  submitBtn.disabled = true;
  submitBtn.innerText = "送信中...";

  const { error } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameToSave,
    content: contentValue,
    user_id_display: myID
  }]);

  if (!error) {
    contentInput.value = "";
    await cleanOldPosts();    // 20件以上を削除
    await loadPostsInThread(); // 画面を更新
  } else {
    alert("エラーが発生しました: " + error.message);
  }

  submitBtn.disabled = false;
  submitBtn.innerText = "書き込む";
}

// 5. お掃除（20件制限）
async function cleanOldPosts() {
  const { data } = await supabaseClient
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .order('id', { ascending: false });

  if (data && data.length > 20) {
    const idsToDelete = data.slice(20).map(p => p.id);
    await supabaseClient.from('posts').delete().in('id', idsToDelete);
  }
}

// 起動
document.addEventListener('DOMContentLoaded', loadSingleThread);