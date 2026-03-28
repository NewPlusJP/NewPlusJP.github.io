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

  // ① データの取得（スレッド本体 + レス）
  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).single(),
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: true })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div class="aa">スレッドが見つかりません。</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];

  // ② UIの組み立て（通知ボタン・フォーム・投稿一覧を全部作る）
  let html = `
    <div class="aa" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <h2 style="margin:0; font-size:1.4em;">${escapeHTML(thread.title)}</h2>
      <button id="notify-toggle-btn" onclick="toggleNotification()" style="white-space:nowrap; cursor:pointer; padding:6px 12px; border-radius:20px; border:1px solid #ddd; background:#fff; font-size:12px; font-weight:bold; transition: 0.2s;">
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

  // 2番以降のレス
  html += posts.map((post, index) => `
      <div class="aa">
        <div style="font-size: 0.85em; color: #666; margin-bottom:5px;">
          ${index + 2} ：<span style="font-weight:bold; color:#2ed573;">${escapeHTML(post.name)}</span>：${new Date(post.created_at).toLocaleString()}
        </div>
        <div style="white-space: pre-wrap; line-height:1.5;">${escapeHTML(post.content)}</div>
      </div>
  `).join('');

  html += `</div>`;
  
  // HTMLを一気に反映
  mainContainer.innerHTML = html;

  // フォームと通知ボタンの初期設定
  setupFormListener();
  updateNotifyBtnStatus();
}

// --- 2. 書き込み処理 ---
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
    btn.innerText = "送信中...";

    const { error } = await supabaseClient.from('posts').insert([{ thread_id: threadId, name, content }]);

    if (error) {
      alert("エラー: " + error.message);
      btn.disabled = false;
      btn.innerText = "書き込む";
    } else {
      loadEverything(); // 再読み込みして更新
    }
  });
}

// --- 3. 通知機能 ---
window.toggleNotification = async function() {
  if (!("Notification" in window)) return alert("通知非対応ブラウザです");

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return alert("通知がブロックされています");
  }

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
  btn.style.borderColor = isEnabled ? "#2ed573" : "#ddd";
  btn.style.color = isEnabled ? "#27ae60" : "#666";
}

// ページ読み込み時に開始
document.addEventListener('DOMContentLoaded', loadEverything);