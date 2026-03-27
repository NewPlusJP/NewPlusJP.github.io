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
  // ... (省略)
  const { data: thread } = await supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle();
  
  currentThreadData = thread; 
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  // もし「運営専用スレッド」ならタイトルにマークをつける
  const adminThreadMark = thread.is_admin_thread ? '<span style="font-size:0.6em; background:#ff4757; color:#fff; padding:2px 5px; border-radius:4px; vertical-align:middle; margin-right:5px;">運営専用</span>' : '';

  container.innerHTML = `
    <div class="aa">
      <h2 style="color: ${thread.is_admin_thread ? '#ff4757' : '#ff0000'};">
        ${adminThreadMark}${thread.title}
      </h2>
      
      ${thread.is_admin_thread && !isAdmin ? 
        '<div style="background:#eee; padding:10px; border-radius:10px; text-align:center;">このスレッドは運営のみ書き込み可能です。</div>' : 
        ` <div style="background: #f0f0f0; padding: 20px; border-radius: 20px; border: 1px solid #ccc; margin-bottom: 20px;">
            <form id="reply-form">
               </form>
          </div> `
      }
      <div id="res-list"></div>
    </div>
  `;
  // ...
}

// 3. レス表示（さらに色を際立たせる）
async function loadPostsInThread() {
  // ... (データ取得部分は同じ)
  postList.innerHTML = displayArray.map((post) => {
    const isSecretMode = post.is_admin_only === true; 

    // デザインをさらに「特別」に
    const specialStyle = isSecretMode ? `
      background: #fff9e6; 
      border: 2px solid #ff4757; 
      border-radius: 15px; 
      box-shadow: 0 4px 15px rgba(255, 71, 87, 0.1);
      position: relative;
    ` : 'border-bottom: 1px solid #eee;';

    const adminBadge = isSecretMode ? `
      <div style="position:absolute; top:-10px; right:10px; background:#ff4757; color:#fff; font-size:10px; padding:2px 8px; border-radius:10px;">公式回答</div>
    ` : '';

    return `
      <div style="margin-bottom: 20px; padding: 15px; ${specialStyle}">
        ${adminBadge}
        <span style="color:${post.is_owner ? '#ff0000' : 'green'}; font-weight:bold;">${post.name}</span>
        <div style="margin-top:8px;">${post.content}</div>
      </div>
    `;
  }).join('');
}

// --- 4. 投稿（DBにフラグを正しく送る） ---
async function postReplyInThread(event) {
  event.preventDefault();
  
  const contentInput = document.getElementById('res-content');
  const nameInput = document.getElementById('res-name');
  const submitBtn = document.getElementById('submit-btn');
  // チェックボックスの要素をしっかり取得
  const adminOnlyCheck = document.getElementById('admin-only-chat');

  const contentValue = contentInput.value;
  if (!contentValue.trim()) return;

  // ★ここでチェックが入っているか確認
  const isSecret = adminOnlyCheck ? adminOnlyCheck.checked : false;
  const myID = (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : generateID();

  submitBtn.disabled = true;
  submitBtn.innerText = "送信中...";

  // ★insertの中に「is_admin_only」をしっかり入れる
  const { error } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameInput.value || "名無しさん",
    content: contentValue,
    user_id_display: myID,
    is_admin_only: isSecret // ここがDBに保存される！
  }]);

  if (!error) {
    contentInput.value = "";
    if (adminOnlyCheck) adminOnlyCheck.checked = false; // 送信後はチェックを外す
    await cleanOldPosts();    
    await loadPostsInThread(); 
  } else {
    alert("エラー: " + error.message);
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

// 起動時に実行
document.addEventListener('DOMContentLoaded', loadSingleThread);