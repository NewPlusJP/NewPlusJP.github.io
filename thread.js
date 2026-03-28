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
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div class="aa" style="text-align:center; padding:50px;">スレッドが見つかりません。</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];
  const totalPosts = posts.length + 1;

  let html = `
    <div style="margin-bottom: 20px; padding: 10px; border-bottom: 2px solid #eee; display: flex; justify-content: space-between; align-items: center;">
      <h2 style="margin:0; font-size:1.4em; color: #333;">${escapeHTML(thread.title)}</h2>
      <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:6px 12px; border-radius:20px; border:1px solid #ddd; background:#fff; font-size:12px; transition:0.3s;">🔕 通知：オフ</button>
    </div>

    <div class="aa" style="border: none; background: #f8f9fa; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 30px;">
      <form id="post-form">
        <div style="margin-bottom:12px; font-weight:bold; color:#2ed573; font-size:1.1em;">✨ いまどうしてる？</div>
        <input type="text" id="user-name" placeholder="お名前（空欄で名無しさん）" style="width:100%; margin-bottom:10px; padding:12px; border:1px solid #e0e0e0; border-radius:10px; box-sizing:border-box; outline:none;">
        <textarea id="post-content" placeholder="最新メッセージを投稿しよう！" required style="width:100%; height:100px; margin-bottom:10px; padding:12px; border:1px solid #e0e0e0; border-radius:10px; box-sizing:border-box; outline:none; resize:none; font-family:inherit;"></textarea>
        <button type="submit" id="post-submit-btn" style="width:100%; padding:12px; background:#2ed573; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold; font-size:1em; box-shadow: 0 4px 10px rgba(46, 213, 115, 0.3);">送信する</button>
      </form>
    </div>

    <div id="posts-list">
  `;

  // 最新のレス
  html += posts.map((post, index) => {
    const postNumber = totalPosts - index;
    return `
      <div class="aa" style="border:none; background:#fff; border-radius:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.03); margin-bottom:15px; padding:15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span style="color:#2ed573; font-weight:bold; font-size:0.9em;">#${postNumber}</span>
            <span style="font-weight:bold; margin-left:8px; color:#444;">${escapeHTML(post.name)}</span>
          </div>
          <div style="font-size: 0.75em; color: #999;">${new Date(post.created_at).toLocaleString()}</div>
        </div>
        <div style="white-space: pre-wrap; line-height:1.6; color:#333;">${escapeHTML(post.content)}</div>
      </div>
    `;
  }).join('');

  // 1番（スレッド開始メッセージ）
  html += `
      <div style="text-align:center; margin: 30px 0 10px; color:#bbb; font-size:0.8em;">ーーー ここからスレッド開始 ーーー</div>
      <div class="aa" style="border:none; background:#e1ffed; border-radius:12px; padding:20px; border-left: 6px solid #2ed573;">
        <div style="margin-bottom:10px;">
          <span style="color:#2ed573; font-weight:bold;">#1</span>
          <span style="font-weight:bold; margin-left:8px; color:#333;">${escapeHTML(thread.name)}</span>
          <span style="font-size: 0.75em; color: #888; margin-left:10px;">${new Date(thread.created_at).toLocaleString()}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.6; color:#333; font-size:1.1em;">${escapeHTML(thread.content)}</div>
      </div>
    </div>
  `;

  mainContainer.innerHTML = html;
  setupFormListener();
  updateNotifyBtnStatus();
}

// --- 以下、書き込み・監視・通知のロジックは前回と同じ ---
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
  btn.style.background = isEnabled ? "#e1ffed" : "#fff";
}

document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
  startWatching();
});