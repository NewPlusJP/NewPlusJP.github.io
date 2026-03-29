/**
 * NewPlusJP - 掲示板システム (最新順・枠付きモダン)
 */

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

async function loadEverything() {
  const mainContainer = document.getElementById('single-thread-container');
  if (!mainContainer || !supabaseClient || !threadId) return;

  // 背景を柔らかいグレーに（枠を際立たせるため）
  document.body.style.backgroundColor = "#f5f7f9";

  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).single(),
    // ★ orderを false (降順) にして最新を上に持ってくる
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div style="text-align:center; padding:20px;">スレッドが見つかりません。</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];
  const totalPosts = posts.length + 1; // 1番を含めた総数

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding:0 5px;">
      <h2 style="margin:0; font-size:1.3em; color:#333;">${escapeHTML(thread.title)}</h2>
      <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:6px 15px; border-radius:20px; border:1px solid #ddd; background:#fff; font-size:11px; font-weight:bold; transition:0.2s;">
        通知：確認中
      </button>
    </div>

    <div style="background:#fff; border-radius:15px; padding:20px; margin-bottom:30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border:1px solid #eee;">
      <form id="post-form">
        <input type="text" id="user-name" placeholder="名前 (名無しさん)" style="width:100%; margin-bottom:10px; padding:12px; border:1px solid #f0f0f0; background:#fafafa; border-radius:8px; box-sizing:border-box; outline:none;">
        <textarea id="post-content" placeholder="最新メッセージを一番上に表示します" required style="width:100%; height:90px; margin-bottom:12px; padding:12px; border:1px solid #f0f0f0; background:#fafafa; border-radius:8px; box-sizing:border-box; outline:none; resize:none; font-family:inherit;"></textarea>
        <button type="submit" id="post-submit-btn" style="width:100%; padding:12px; background:#2ed573; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1em;">書き込む</button>
      </form>
    </div>

    <div id="posts-list">
  `;

  // ① 最新のレス（カード形式の枠）
  html += posts.map((post, index) => {
    const postNumber = totalPosts - index;
    return `
      <div style="background:#fff; border-radius:12px; padding:15px 20px; margin-bottom:15px; border:1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <div style="font-size: 0.85em; color: #888; margin-bottom:8px;">
          <span style="color:#2ed573; font-weight:bold;">${postNumber}</span> : <strong style="color:#444;">${escapeHTML(post.name)}</strong> 
          <span style="margin-left:10px; font-size:0.9em; color:#bbb;">${new Date(post.created_at).toLocaleString()}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.6; color:#555;">${escapeHTML(post.content)}</div>
      </div>
    `;
  }).join('');

  // ② 1番（スレッド開始メッセージ：一番下に配置）
  html += `
      <div style="text-align:center; margin: 40px 0 15px; color:#ccc; font-size:0.8em; letter-spacing:2px;">--- THREAD START ---</div>
      <div style="background: #f0fff4; border-radius: 12px; padding: 20px; border: 2px dashed #2ed573;">
        <div style="font-size: 0.85em; color: #666; margin-bottom:10px;">
          <span style="color:#2ed573; font-weight:bold;">1</span> : <strong>${escapeHTML(thread.name)}</strong> 
          <span style="margin-left:10px; font-size:0.9em; color:#999;">${new Date(thread.created_at).toLocaleString()}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.7; color:#444; font-weight:500;">${escapeHTML(thread.content)}</div>
      </div>
    </div>
  `;

  mainContainer.innerHTML = html;
  setupFormListener();
  updateNotifyBtnStatus();
}

// 以下、ロジック部分は元のstartWatchingなどを維持してOK
function setupFormListener() {
  const form = document.getElementById('post-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('post-submit-btn');
    const content = document.getElementById('post-content').value.trim();
    if (!content || btn.disabled) return;

    btn.disabled = true;
    btn.innerText = "送信中...";
    await supabaseClient.from('posts').insert([{ 
      thread_id: threadId, 
      name: document.getElementById('user-name').value.trim() || "名無しさん", 
      content 
    }]);
    document.getElementById('post-content').value = "";
    btn.disabled = false;
    btn.innerText = "書き込む";
    // リアルタイム側で更新されるが念のため
    loadEverything();
  };
}

function startWatching() {
  if (!supabaseClient || !threadId) return;
  supabaseClient.channel('posts_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `thread_id=eq.${threadId}` }, () => {
      loadEverything();
    }).subscribe();
}

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
  btn.style.borderColor = isEnabled ? "#2ed573" : "#ddd";
  btn.style.color = isEnabled ? "#2ed573" : "#888";
}

document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
  startWatching();
});