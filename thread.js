// --- 0. 初期化 ---
let supabaseClient;
try {
  if (typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { console.error("Supabase初期化失敗:", e); }

const params = new URLSearchParams(window.location.search);
const threadId = params.get('id');

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- 1. メイン読み込み & UI生成 ---
async function loadEverything() {
  const mainContainer = document.getElementById('single-thread-container');
  if (!mainContainer || !supabaseClient || !threadId) return;

  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle(),
    // ★ orderを 'desc' (降順) にして最新を上に持ってくる
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div class="aa">スレッドが見つかりません。</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];
  const totalPosts = posts.length + 1; // 1番を含めた総数

  // UIの組み立て
  let html = `
    <div class="aa" style="display:flex; justify-content:space-between; align-items:center;">
      <h2 style="margin:0; font-size:1.2em;">${escapeHTML(thread.title)}</h2>
      <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:5px 10px; border-radius:15px; border:1px solid #ccc; background:#fff; font-size:11px;">🔕 通知：オフ</button>
    </div>

    <div class="aa" style="border: 2px solid #2ed573; border-radius: 8px; background: #fff;">
      <form id="post-form">
        <input type="text" id="user-name" placeholder="名無しさん" style="width:100%; margin-bottom:8px; padding:10px; border:1px solid #ddd; border-radius:5px; box-sizing:border-box;">
        <textarea id="post-content" placeholder="最新メッセージを一番上に投稿します" required style="width:100%; height:80px; margin-bottom:8px; padding:10px; border:1px solid #ddd; border-radius:5px; box-sizing:border-box;"></textarea>
        <button type="submit" id="post-submit-btn" style="width:100%; padding:10px; background:#2ed573; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">書き込む</button>
      </form>
    </div>

    <div id="posts-list">
  `;

  // ① 最新のレス（2番以降を降順で表示）
  html += posts.map((post, index) => {
    // 降順なので、番号の計算を調整（totalPosts - index）
    const postNumber = totalPosts - index;
    return `
      <div class="aa" style="border-bottom: 1px solid #eee;">
        <div style="font-size: 0.85em; color: #666; margin-bottom:5px;">
          ${postNumber} ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(post.name)}</span>：${new Date(post.created_at).toLocaleString()}
        </div>
        <div style="white-space: pre-wrap; line-height:1.5;">${escapeHTML(post.content)}</div>
      </div>
    `;
  }).join('');

  // ② スレ主の投稿（1番：常に一番下）
  html += `
      <div class="aa" style="border-left: 5px solid #2ed573; background: rgba(46, 213, 115, 0.05); margin-top: 20px;">
        <div style="font-size: 0.85em; color: #666; margin-bottom:8px;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="white-space: pre-wrap; line-height:1.6;">${escapeHTML(thread.content)}</div>
        <div style="text-align:right; font-size:0.7em; color:#aaa;">--- スレッド開始 ---</div>
      </div>
    </div>
  `;

  mainContainer.innerHTML = html;

  setupFormListener();
  updateNotifyBtnStatus();
}

// --- 2. 書き込み & リアルタイム（変更なし） ---
function setupFormListener() {
  const form = document.getElementById('post-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('post-submit-btn');
    const content = document.getElementById('post-content').value.trim();
    if (!content || btn.disabled) return;

    btn.disabled = true;
    const { error } = await supabaseClient.from('posts').insert([{ 
      thread_id: threadId, 
      name: document.getElementById('user-name').value.trim() || "名無しさん", 
      content 
    }]);

    if (error) alert("エラー: " + error.message);
    document.getElementById('post-content').value = "";
    btn.disabled = false;
    // リアルタイムで更新されるはずだが、念のため再描画
    loadEverything();
  };
}

function startWatching() {
  if (!supabaseClient || !threadId) return;
  supabaseClient.channel(`thread_${threadId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `thread_id=eq.${threadId}` }, () => {
      loadEverything();
    }).subscribe();
}

function updateNotifyBtnStatus() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerHTML = isEnabled ? "🔔 通知：オン" : "🔕 通知：オフ";
}

document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
  startWatching();
});