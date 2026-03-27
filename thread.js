// 1. 初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');

let currentThreadData = null; 

// 通知許可
async function requestNotification() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') alert('通知ONになったよ！');
}

// ID生成
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

// 2. スレッド読み込み
async function loadSingleThread() {
  const container = document.getElementById('single-thread-container');
  if (!container || !threadId) return;

  const { data: thread } = await supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle();
  if (!thread) {
    container.innerHTML = 'スレッドが見つかりません';
    return;
  }

  currentThreadData = thread; 
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  // 管理者のみチェックボックスを表示
  const adminOnlyToggle = isAdmin ? `
    <label style="display:inline-block; margin: 5px 0; color: #ff4757; font-weight: bold; cursor: pointer; background: #fff; padding: 5px 10px; border-radius: 10px; border: 1px solid #ff4757;">
      <input type="checkbox" id="admin-only-chat"> 🔒 管理者のみ発言可モード
    </label>
  ` : '';

  container.innerHTML = `
    <div class="aa">
      <h2 style="color: #ff0000;">${thread.title}</h2>
      <div style="background: #f0f0f0; padding: 20px; border-radius: 20px; border: 1px solid #ccc; margin-bottom: 20px;">
        <form id="reply-form">
          <input type="text" id="res-name" value="${localStorage.getItem('user_display_name') || ''}" placeholder="名前" style="width:200px; padding:8px; border-radius:10px; border:1px solid #ddd;"><br>
          ${adminOnlyToggle}
          <textarea id="res-content" placeholder="内容を入力" required style="width:95%; height:80px; padding:10px; border-radius:10px; border:1px solid #ddd; margin-top:5px;"></textarea><br>
          <div style="display:flex; justify-content:space-between; margin-top:10px;">
            <button type="submit" id="submit-btn" class="submit-btn">書き込む</button>
            <button type="button" onclick="requestNotification()" style="background:none; border:none; color:#666; font-size:0.8em; cursor:pointer; text-decoration:underline;">🔔通知をオン</button>
          </div>
        </form>
      </div>
      <div id="res-list"></div>
      <div style="margin-top:20px;"><a href="index.html">■トップに戻る</a></div>
    </div>
  `;

  document.getElementById('reply-form').addEventListener('submit', postReplyInThread);
  await loadPostsInThread(); 
}

// 3. レス表示
async function loadPostsInThread() {
  const postList = document.getElementById('res-list');
  if (!postList || !currentThreadData) return;

  const isAdmin = localStorage.getItem('is_admin') === 'true';

  // ★ select('*') で is_admin_only も確実に取得する
  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*') 
    .eq('thread_id', threadId)
    .order('id', { ascending: false })
    .limit(20);

  if (error) {
    console.error("データ取得エラー:", error);
    return;
  }

  const displayArray = [...(posts || [])];
  
  // スレ主データ（これは管理者限定ではないので false 固定）
  displayArray.push({
    id: "first",
    name: currentThreadData.name,
    content: currentThreadData.content,
    created_at: currentThreadat,
    user_id_display: "OWNER",
    is_owner: true,
    is_admin_only: false 
  });

  postList.innerHTML = displayArray.map((post) => {
    const isOwner = post.is_owner;
    const postIsAdmin = (post.user_id_display === "ADMIN");
    const adminBadge = postIsAdmin ? '<span style="background:#ff4757; color:white; padding:2px 8px; border-radius:10px; font-size:0.75em; margin-left:5px; vertical-align:middle;">管理者</span>' : '';
    
    // ★ 再読み込みしても消えないように、保存された post.is_admin_only を使う
    const isSecretMode = post.is_admin_only === true;
    const adminLabel = isSecretMode ? '<span style="color:#ff4757; font-weight:bold;">【管理者のみ発言可】</span>' : '';
    const specialStyle = isSecretMode ? 'background:#fff9e6; border-left:5px solid #ff4757; padding-left:15px;' : '';

    const nameColor = isOwner ? "#ff0000" : "green";
    
    return `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding: 10px; ${specialStyle}">
        <span style="color:${nameColor}; font-weight:bold;">${post.name}${adminBadge}</span> 
        <small>：${new Date(post.created_at).toLocaleString()} ID:${post.user_id_display || "???"}</small>
        <div style="margin-top:8px; white-space:pre-wrap;">${adminLabel}${post.content}</div>
      </div>
    `;
  }).join('');
}

// 4. 投稿
async function postReplyInThread(event) {
  event.preventDefault();
  const contentInput = document.getElementById('res-content');
  const nameInput = document.getElementById('res-name');
  const submitBtn = document.getElementById('submit-btn');
  const adminOnlyCheck = document.getElementById('admin-only-chat');

  const isSecret = adminOnlyCheck ? adminOnlyCheck.checked : false;
  const myID = (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : generateID();

  submitBtn.disabled = true;
  const { error } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameInput.value || "名無しさん",
    content: contentInput.value,
    user_id_display: myID,
    is_admin_only: isSecret
  }]);

  if (!error) {
    contentInput.value = "";
    if (Notification.permission === "granted") new Notification("投稿完了！");
    await cleanOldPosts();    
    await loadPostsInThread(); 
  }
  submitBtn.disabled = false;
}

// お掃除
async function cleanOldPosts() {
  const { data } = await supabaseClient.from('posts').select('id').eq('thread_id', threadId).order('id', { ascending: false });
  if (data && data.length > 20) {
    await supabaseClient.from('posts').delete().in('id', data.slice(20).map(p => p.id));
  }
}

document.addEventListener('DOMContentLoaded', loadSingleThread);