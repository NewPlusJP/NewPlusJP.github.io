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

// --- 1. メインの読み込み処理 ---
async function loadEverything() {
  const mainContainer = document.getElementById('single-thread-container');
  if (!mainContainer || !supabaseClient || !threadId) return;

  // ① スレッド本体（1番）を取得
  const { data: thread, error: tError } = await supabaseClient
    .from('threads').select('*').eq('id', threadId).single();

  if (tError || !thread) {
    mainContainer.innerHTML = '<div class="aa">スレッドが見つかりません。</div>';
    return;
  }

  // ② レス一覧を取得
  const { data: posts, error: pError } = await supabaseClient
    .from('posts').select('*').eq('id', threadId).order('created_at', { ascending: true });

  // ③ 表示を組み立て
  let html = `
    <div class="aa" style="display:flex; justify-content:space-between; align-items:center;">
      <h2 style="margin:0;">${escapeHTML(thread.title)}</h2>
      <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:5px 10px; border-radius:15px; border:1px solid #ddd; background:#fff; font-size:12px;">🔕 通知：オフ</button>
    </div>

    <div class="aa">
      <form id="post-form">
        <input type="text" id="user-name" placeholder="名無しさん" style="width:100%; margin-bottom:10px; padding:8px; border:1px solid #ddd; border-radius:5px;">
        <textarea id="post-content" placeholder="内容を入力してください" required style="width:100%; height:80px; margin-bottom:10px; padding:8px; border:1px solid #ddd; border-radius:5px;"></textarea>
        <button type="submit" id="post-submit-btn" class="submit-btn" style="padding:8px 20px; cursor:pointer;">書き込む</button>
      </form>
    </div>

    <div id="posts-list">
      <div class="aa" style="border-left: 5px solid #2ed573; background: rgba(46, 213, 115, 0.05);">
        <div style="font-size: 0.85em; color: #666;">
          1 ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(thread.name)}</span>：${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="margin-top: 10px; white-space: pre-wrap;">${escapeHTML(thread.content)}</div>
      </div>
  `;

  // 2番以降：レス
  if (posts && posts.length > 0) {
    html += posts.map((post, index) => `
      <div class="aa">
        <div style="font-size: 0.85em; color: #666;">
          ${index + 2} ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(post.name)}</span>：${new Date(post.created_at).toLocaleString()}
        </div>
        <div style="margin-top: 5px; white-space: pre-wrap;">${escapeHTML(post.content)}</div>
      </div>
    `).join('');
  }

  html += `</div> <p style="text-align:center;"><a href="index.html">【トップに戻る】</a></p>`;
  
  // コンテナをまるごと差し替え
  mainContainer.innerHTML = html;

  // フォームのイベントリスナーを再設定
  setupFormListener();
  updateNotifyBtn();
}

// --- 2. 書き込みフォームの制御 ---
function setupFormListener() {
  const form = document.getElementById('post-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('post-submit-btn');
    const name = document.getElementById('user-name').value.trim() || "名無しさん";
    const content = document.getElementById('post-content').value.trim();
    if (!content) return;

    btn.disabled = true;
    const { error } = await supabaseClient.from('posts').insert([{ thread_id: threadId, name, content }]);

    if (error) {
      alert("失敗: " + error.message);
      btn.disabled = false;
    } else {
      loadEverything(); // 再読み込み
    }
  });
}

// --- 3. 通知ボタンの制御 ---
window.toggleNotification = async function() {
  if (Notification.permission !== "granted") await Notification.requestPermission();
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  localStorage.setItem('notify_enabled', !isEnabled);
  updateNotifyBtn();
};

function updateNotifyBtn() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerHTML = isEnabled ? "🔔 通知：オン" : "🔕 通知：オフ";
  btn.style.background = isEnabled ? "#e1ffed" : "#fff";
}

// 実行
document.addEventListener('DOMContentLoaded', loadEverything);