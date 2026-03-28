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
  // main要素を取得
  const mainContainer = document.getElementById('single-thread-container');
  if (!mainContainer || !supabaseClient || !threadId) return;

  // データの取得（スレッド本体 + レス）
  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle(),
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: true })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div class="aa">スレッドが見つかりません。</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];

  // ② UIの組み立て（通知ボタン・フォーム・投稿一覧を全部作る）
  // ここで res-list というIDも作っておくことで、HTML側のエラーを回避します
  let html = `
    <div id="res-list" style="display:none;">読み込み済み</div>
    <div class="aa" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <h2 style="margin:0; font-size:1.4em;">${escapeHTML(thread.title)}</h2>
      <button id="notify-toggle-btn" onclick="toggleNotification()" style="white-space:nowrap; cursor:pointer; padding:6px 12px; border-radius:20px; border:1px solid #ddd; background:#fff; font-size:12px; font-weight:bold;">
        🔕 通知：オフ
      </button>
    </div>

    <div class="aa">
      <form id="post-form">
        <input type="text" id="user-name" placeholder="名無しさん" style="width:100%; margin-bottom:10px; padding:10px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;">
        <textarea id="post-content" placeholder="内容を入力してください" required style="width:100%; height:100px; margin-bottom:10px; padding:10px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-family:inherit;"></textarea>
        <button type="submit" id="post-submit-btn" class="submit-btn" style="width:100%; padding:10px; cursor:pointer; font-weight:bold;">書き込む</button>
      </form>
    </div>

    <div id="posts-list">
      <div class="aa" style="border-left: 5px solid #2ed573; background: rgba(46, 213, 115, 0.03);">
        <div style="font-size: 0.85em; color: #666; margin-bottom:8px;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="white-space: pre-wrap; line-height:1.6;">${escapeHTML(thread.content)}</div>
      </div>
  `;

  html += posts.map((post, index) => `
      <div class="aa">
        <div style="font-size: 0.85em; color: #666; margin-bottom:5px;">
          ${index + 2} ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(post.name)}</span>：${new Date(post.created_at).toLocaleString()}
        </div>
        <div style="white-space: pre-wrap; line-height:1.5;">${escapeHTML(post.content)}</div>
      </div>
  `).join('');

  html += `</div>`;
  
  // HTMLを反映
  mainContainer.innerHTML = html;

  setupFormListener();
  updateNotifyBtnStatus();
}

// --- 2. 書き込み & リアルタイム監視 ---
function setupFormListener() {
  const form = document.getElementById('post-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('post-submit-btn');
    const content = document.getElementById('post-content').value.trim();
    if (!content || btn.disabled) return;

    btn.disabled = true;
    await supabaseClient.from('posts').insert([{ 
      thread_id: threadId, 
      name: document.getElementById('user-name').value.trim() || "名無しさん", 
      content 
    }]);
    document.getElementById('post-content').value = "";
    btn.disabled = false;
  };
}

function startWatching() {
  if (!supabaseClient || !threadId) return;
  supabaseClient.channel(`thread_view_${threadId}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'posts', 
      filter: `thread_id=eq.${threadId}` 
    }, () => {
      loadEverything(); // 自動更新
    })
    .subscribe();
}

// --- 3. 通知機能 ---
window.toggleNotification = async function() {
  if (Notification.permission !== "granted") await Notification.requestPermission();
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  localStorage.setItem('notify_enabled', !isEnabled);
  updateNotifyBtnStatus();
};

function updateNotifyBtnStatus() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerHTML = isEnabled ? "🔔 通知：オン" : "🔕 通知：オフ";
  btn.style.backgroundColor = isEnabled ? "#e1ffed" : "#fff";
}

// 起動
document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
  startWatching();
});