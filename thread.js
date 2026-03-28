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

// --- 1. スレッドとレスを表示 (ここが核心) ---
async function loadThreadAndPosts() {
  const postsContainer = document.getElementById('posts-container');
  const threadTitle = document.getElementById('thread-title');
  if (!postsContainer || !supabaseClient || !threadId) return;

  // ① スレッドの「1番」になるデータを取得
  const { data: thread, error: tError } = await supabaseClient
    .from('threads').select('*').eq('id', threadId).single();

  if (tError || !thread) {
    postsContainer.innerHTML = "スレッドが見つかりません。";
    return;
  }

  // タイトルセット
  if (threadTitle) threadTitle.innerText = thread.title;

  // ② 2番以降のレスを取得
  const { data: posts, error: pError } = await supabaseClient
    .from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });

  if (pError) return;

  // ③ HTML生成 (1番をthreadsから、2番以降をpostsから)
  let html = `
    <div class="aa" style="margin-bottom: 20px; border-left: 5px solid #2ed573;">
      <div style="font-size: 0.85em; color: #666;">
        1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div style="margin-top: 10px; white-space: pre-wrap;">${escapeHTML(thread.content)}</div>
    </div>
  `;

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

// --- 2. 書き込み ---
const postForm = document.getElementById('post-form');
if (postForm) {
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const name = document.getElementById('user-name').value.trim() || "名無しさん";
    const content = document.getElementById('post-content').value.trim();
    if (!content) return;

    btn.disabled = true;
    const { error } = await supabaseClient.from('posts').insert([{ thread_id: threadId, name, content }]);
    
    if (error) {
      alert("失敗: " + error.message);
    } else {
      document.getElementById('post-content').value = "";
      loadThreadAndPosts();
    }
    btn.disabled = false;
  });
}

// --- 3. 通知ボタン ---
window.toggleNotification = async function() {
  if (Notification.permission !== "granted") await Notification.requestPermission();
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  localStorage.setItem('notify_enabled', !isEnabled);
  updateNotifyStatus();
};

function updateNotifyStatus() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerHTML = isEnabled ? "🔔 通知：オン" : "🔕 通知：オフ";
}

// --- 4. 監視 ---
function subscribe() {
  if (!supabaseClient || !threadId) return;
  supabaseClient.channel(`thread:${threadId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `thread_id=eq.${threadId}` }, () => {
      loadThreadAndPosts();
    }).subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
  loadThreadAndPosts();
  updateNotifyStatus();
  subscribe();
});