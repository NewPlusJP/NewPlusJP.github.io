// --- 初期化 ---
const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

const params = new URLSearchParams(window.location.search);
const threadId = params.get('id');

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- 1. スレッド本体(1番)とレス一覧を表示 ---
async function loadThreadAndPosts() {
  const postsContainer = document.getElementById('posts-container');
  const threadTitle = document.getElementById('thread-title');
  if (!postsContainer || !supabaseClient || !threadId) return;

  // ① スレッドの基本情報（1番の内容）を取得
  const { data: thread, error: tError } = await supabaseClient
    .from('threads').select('*').eq('id', threadId).single();

  if (tError || !thread) {
    postsContainer.innerHTML = '<p style="text-align:center; padding:20px;">スレッドが見つかりません。</p>';
    return;
  }

  // タイトルを画面に反映
  if (threadTitle) threadTitle.innerText = thread.title;

  // ② レス一覧を取得（作成順）
  const { data: posts, error: pError } = await supabaseClient
    .from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });

  if (pError) {
    console.error("レスの取得失敗:", pError);
    return;
  }

  // ③ HTML組み立て
  // まずは「1番（スレ主）」を一番上に固定
  let html = `
    <div class="aa" style="margin-bottom: 20px; border-left: 5px solid #2ed573;">
      <div style="font-size: 0.85em; color: #666;">
        1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div style="margin-top: 10px; white-space: pre-wrap; font-size: 1.05em;">${escapeHTML(thread.content)}</div>
    </div>
  `;

  // 続けて2番以降のレスをループで追加
  html += posts.map((post, index) => `
    <div class="aa" style="margin-bottom: 15px;">
      <div style="font-size: 0.85em; color: #666;">
        ${index + 2} ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(post.name)}</span>：${new Date(post.created_at).toLocaleString()}
      </div>
      <div style="margin-top: 5px; white-space: pre-wrap;">${escapeHTML(post.content)}</div>
    </div>
  `).join('');

  postsContainer.innerHTML = html;
}

// --- 2. 書き込み機能 ---
const postForm = document.getElementById('post-form');
if (postForm) {
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const nameInput = document.getElementById('user-name');
    const contentInput = document.getElementById('post-content');
    
    const name = nameInput.value.trim() || "名無しさん";
    const content = contentInput.value.trim();
    if (!content) return;

    btn.disabled = true;
    const { error } = await supabaseClient.from('posts').insert([{ 
      thread_id: threadId, 
      name: name, 
      content: content 
    }]);

    if (error) {
      alert("書き込みに失敗しました: " + error.message);
    } else {
      contentInput.value = "";
      loadThreadAndPosts(); // 再読み込み
    }
    btn.disabled = false;
  });
}

// --- 3. 通知ボタンの制御 (index.htmlと共通) ---
window.toggleNotification = async function() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  localStorage.setItem('notify_enabled', !isEnabled);
  updateNotifyStatus();
};

function updateNotifyStatus() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerHTML = isEnabled ? "🔔 通知：オン" : "🔕 通知：オフ";
  btn.style.backgroundColor = isEnabled ? "#e1ffed" : "#fff5f5";
}

// --- 4. リアルタイム更新の監視 ---
function subscribeToPosts() {
  if (!supabaseClient || !threadId) return;
  supabaseClient
    .channel(`public:posts:thread=${threadId}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'posts', 
      filter: `thread_id=eq.${threadId}` 
    }, () => {
      loadThreadAndPosts();
    })
    .subscribe();
}

// --- 5. 実行 ---
document.addEventListener('DOMContentLoaded', () => {
  loadThreadAndPosts();
  updateNotifyStatus(); // 初期状態反映
  subscribeToPosts();
});