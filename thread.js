// --- 1. 初期化 ---
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

// --- 2. スレッド読み込み ---
async function loadSingleThread() {
  const container = document.getElementById('single-thread-container');
  if (!container || !threadId) return;

  const { data: thread, error } = await supabaseClient
    .from('threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle();
  
  if (error || !thread) {
    container.innerHTML = '<div class="aa">スレッドが見つかりません。</div>';
    return;
  }

  currentThreadData = thread; 
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  const adminThreadMark = thread.is_admin_thread ? '<span style="font-size:0.6em; background:#ff4757; color:#fff; padding:2px 5px; border-radius:4px; vertical-align:middle; margin-right:5px;">運営専用</span>' : '';

  const adminOnlyToggle = isAdmin ? `
    <label style="display:inline-block; margin: 5px 0; color: #ff4757; font-weight: bold; cursor: pointer; background: #fff; padding: 5px 10px; border-radius: 10px; border: 1px solid #ff4757;">
      <input type="checkbox" id="admin-only-chat"> 🔒 管理者のみ発言可モード
    </label>
  ` : '';

  let formHTML = '';
  if (thread.is_admin_thread && !isAdmin) {
    formHTML = `
      <div style="background:#eee; padding:20px; border-radius:15px; text-align:center; color:#666; border:1px solid #ccc;">
        <b>📢 お知らせ</b><br>
        このスレッドは運営専用のため、一般の方は書き込みできません。
      </div>`;
  } else {
    formHTML = `
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
      </div>`;
  }

  container.innerHTML = `
    <div class="aa">
      <h2 style="color: ${thread.is_admin_thread ? '#ff4757' : 'inherit'};">
        ${adminThreadMark}${thread.title}
      </h2>
      ${formHTML}
      <div id="res-list"></div>
      <div style="margin-top:20px;"><a href="index.html">■トップに戻る</a></div>
    </div>
  `;

  const replyForm = document.getElementById('reply-form');
  if (replyForm) {
    replyForm.addEventListener('submit', postReplyInThread);
  }

  await loadPostsInThread(); 
}

// --- 3. レス表示（最新が一番上） ---
async function loadPostsInThread() {
  const postList = document.getElementById('res-list');
  if (!postList || !currentThreadData) return;

  postList.innerHTML = '<div style="color:#666; font-size:0.9em; padding:10px;">データを取得中...</div>';

  try {
    // 最新順に取得
    const { data: posts, error } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false }); 

    if (error) throw error;

    // スレ主の投稿（1番）
    const ownerPost = {
      name: currentThreadData.name,
      content: currentThreadData.content,
      created_at: currentThreadData.created_at,
      user_id_display: "OWNER",
      is_owner: true
    };

    // 最新レスを上、一番下にスレ主を結合
    let allPosts = [...(posts || []), ownerPost];

    postList.innerHTML = allPosts.map((post, index) => {
      const isSecretMode = post.is_admin_only === true; 
      const specialStyle = isSecretMode ? 'background:rgba(255, 71, 87, 0.05); border-left:5px solid #ff4757; padding:10px; border-radius:5px;' : 'padding:10px; border-bottom:1px solid #eee;';
      const adminLabel = isSecretMode ? '<span style="color:#ff4757; font-weight:bold;">【運営からのお知らせ】</span>' : '';
      const nameColor = post.is_owner ? '#ff0000' : '#2ed573';
      
      // レス番号の逆算（一番下のスレ主が1になるように）
      const resNum = allPosts.length - index;
      
      return `
        <div style="margin-bottom: 10px; ${specialStyle}">
          <span style="font-weight:bold;">${resNum} ：</span>
          <span style="color:${nameColor}; font-weight:bold;">${post.name}</span> 
          <small>：${new Date(post.created_at).toLocaleString()} ID:${post.user_id_display || '???'}</small>
          <div style="margin-top:8px; white-space:pre-wrap;">${adminLabel}${post.content}</div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error("通信エラー:", err);
    postList.innerHTML = `<button onclick="loadPostsInThread()">再読み込みを試す</button>`;
  }
}

// --- 4. 投稿処理 ---
async function postReplyInThread(event) {
  event.preventDefault();
  
  const contentInput = document.getElementById('res-content');
  const nameInput = document.getElementById('res-name');
  const submitBtn = document.getElementById('submit-btn');
  const adminOnlyCheck = document.getElementById('admin-only-chat');

  if (!contentInput.value.trim()) return;

  const isSecret = adminOnlyCheck ? adminOnlyCheck.checked : false;
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const myID = isAdmin ? "ADMIN" : generateID();

  submitBtn.disabled = true;
  submitBtn.innerText = "送信中...";

  const { error } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameInput.value || "名無しさん",
    content: contentInput.value,
    user_id_display: myID,
    is_admin_only: isSecret
  }]);

  if (!error) {
    contentInput.value = "";
    if (adminOnlyCheck) adminOnlyCheck.checked = false;
    await cleanOldPosts();    
    await loadPostsInThread(); 
  } else {
    alert("エラー: " + error.message);
  }

  submitBtn.disabled = false;
  submitBtn.innerText = "書き込む";
}

// --- 5. お掃除（最新20件） ---
async function cleanOldPosts() {
  const { data } = await supabaseClient
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false });

  if (data && data.length > 20) {
    const idsToDelete = data.slice(20).map(p => p.id);
    await supabaseClient.from('posts').delete().in('id', idsToDelete);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  loadSingleThread();
});