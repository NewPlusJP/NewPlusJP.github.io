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

// --- 1. スレッド本体とレスの読み込み ---
async function loadThreadAndPosts() {
  const postsContainer = document.getElementById('posts-container');
  const threadTitle = document.getElementById('thread-title');
  if (!supabaseClient || !threadId) return;

  // ① スレッド本体（1番）を取得
  const { data: thread, error: tError } = await supabaseClient
    .from('threads').select('*').eq('id', threadId).single();

  if (tError || !thread) {
    if (postsContainer) postsContainer.innerHTML = "スレッドが見つかりません。";
    return;
  }

  // タイトル反映
  if (threadTitle) threadTitle.innerText = thread.title;

  // ② レス一覧を取得
  const { data: posts, error: pError } = await supabaseClient
    .from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });

  if (pError) return;

  // ③ 1番（スレ主）＋ レスを表示
  let html = `
    <div class="post-item" style="margin-bottom: 20px; padding: 15px; border-bottom: 2px solid #eee; background: #fafafa; border-radius: 8px;">
      <div style="font-size: 0.85em; color: #666;">
        1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div style="margin-top: 10px; white-space: pre-wrap; font-size: 1.1em;">${escapeHTML(thread.content)}</div>
    </div>
  `;

  // 2番以降を表示
  html += posts.map((post, index) => `
    <div class="post-item" style="margin-bottom: 20px; padding: 10px; border-bottom: 1px solid #eee;">
      <div style="font-size: 0.85em; color: #666;">
        ${index + 2} ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(post.name)}</span>：${new Date(post.created_at).toLocaleString()}
      </div>
      <div style="margin-top: 5px; white-space: pre-wrap;">${escapeHTML(post.content)}</div>
    </div>
  `).join('');

  if (postsContainer) postsContainer.innerHTML = html;
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
    const { error } = await supabaseClient.from('posts').insert([{ thread_id: threadId, name, content }]);

    if (error) {
      alert("エラー: " + error.message);
    } else {
      contentInput.value = "";
      loadThreadAndPosts();
    }
    btn.disabled = false;
  });
}

// --- 3. 通知ボタンの制御 (画像の位置に合わせる) ---
function initNotify() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;

  btn.onclick = async () => {
    if (Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    localStorage.setItem('notify_enabled', !isEnabled);
    updateNotifyStatus();
  };
  updateNotifyStatus();
}

function updateNotifyStatus() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerHTML = isEnabled ? "🔔 通知：オン" : "🔕 通知：オフ";
  btn.style.background = isEnabled ? "#e1ffed" : "#fff5f5";
}

// --- 4. リアルタイム監視 ---
function subscribePosts() {
  if (!supabaseClient || !threadId) return;
  supabaseClient
    .channel(`thread:${threadId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `thread_id=eq.${threadId}` }, () => {
      loadThreadAndPosts();
    })
    .subscribe();
}

// 実行
document.addEventListener('DOMContentLoaded', () => {
  loadThreadAndPosts();
  initNotify();
  subscribePosts();
});