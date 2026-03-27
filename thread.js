// 1. 初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');

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
  if (!threadId) return;

  const { data: thread, error } = await supabaseClient
    .from('threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle();

  if (error || !thread) {
    container.innerHTML = '<div class="aa">スレッドが見つかりません</div>';
    return;
  }

  // 保存されている名前を取得
  const savedName = localStorage.getItem('user_display_name') || "";

  // フォームを一番上に配置（リンク先を threadlist.html に修正）
  container.innerHTML = `
    <div class="aa">
      <h2 style="color: #ff0000; margin-bottom: 5px;">${thread.title}</h2>
      
      <div style="background: #f0f0f0; padding: 10px; border: 1px solid #ccc; margin-bottom: 20px;">
        <h3 style="margin-top:0;">レスを書き込む</h3>
    <form id="thread-form">
      <div class="form-group-inner">
        <label for="thread-title">スレッドタイトル</label>
        <input type="text" id="thread-title" placeholder="タイトルを入力してください" required>
      </div>

      <div class="form-group-inner">
        <label for="user-name">名前（省略可）</label>
        <input type="text" id="user-name" placeholder="名無しさん">
      </div>

      <div class="form-group-inner">
        <label for="content">本文</label>
        <textarea id="content" rows="8" placeholder="ここに内容を書き込んでください" required></textarea>
      </div>

      <button type="submit" class="submit-btn">スレッドを作成する</button>
    </form>
      </div>

      <div id="res-list">読み込み中...</div>
      
      <div style="margin-top:20px;">
        <a href="threadlist.html">■ スレッド一覧に戻る</a><br>
        <a href="index.html" style="font-size:0.8em; color:#666;">トップページへ</a>
      </div>
    </div>
  `;

  loadPostsInThread(thread); 
}

// 3. レス表示
async function loadPostsInThread(threadData) {
  const postList = document.getElementById('res-list');
  const myID = generateID(); // 自分のIDを取得
  
  const { data: posts } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('id', { ascending: false });

  const displayArray = [...(posts || [])];
  displayArray.push({
    id: "first",
    name: threadData.name,
    content: threadData.content,
    created_at: threadData.created_at,
    user_id_display: "OWNER",
    is_owner: true
  });

  postList.innerHTML = displayArray.map((post) => {
    const isOwner = post.is_owner;
    const isMe = (post.user_id_display === myID); // 自分の書き込みか判定
    const nameColor = isOwner ? "#ff0000" : "green";
    
    // 自分のレスなら背景を薄い黄色にする
    const bgColor = isMe ? "background-color: #ffffe0;" : "";

    return `
      <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; ${bgColor}">
        <span style="color:${nameColor}; font-weight:bold;">${post.name}</span> 
        <small>：${new Date(post.created_at).toLocaleString()} ID:${post.user_id_display || "???"}</small>
        <div style="margin-top:5px; white-space:pre-wrap;">${post.content}</div>
      </div>
    `;
  }).join('');
}

// 4. 投稿 ＆ 名前保存
async function postReplyInThread(event) {
  event.preventDefault();
  const nameInput = document.getElementById('res-name');
  const contentInput = document.getElementById('res-content');
  
  const nameToSave = nameInput.value || "名無しさん";
  localStorage.setItem('user_display_name', nameToSave);

  const myID = generateID();

  await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameToSave,
    content: contentInput.value,
    user_id_display: myID
  }]);

  // お掃除（最新20件）
  const { data: allPosts } = await supabaseClient
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .order('id', { ascending: false });

  if (allPosts && allPosts.length > 20) {
    const idsToDelete = allPosts.slice(20).map(p => p.id);
    await supabaseClient.from('posts').delete().in('id', idsToDelete);
  }

  location.reload(); 
}

document.addEventListener('DOMContentLoaded', loadSingleThread);