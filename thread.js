// --- 0. 初期化 ---
let supabaseClient;
try {
  if (typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { console.error("初期化失敗:", e); }

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

  // 全体の背景を少し柔らかい色に（ページ全体に効かせるならCSS推奨だけどJSで一旦）
  document.body.style.backgroundColor = "#fdfbfb";

  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle(),
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div class="aa">スレッドが見つかりません(>_<)</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];
  const totalPosts = posts.length + 1;

  let html = `
    <div style="background: linear-gradient(135deg, #fff5f5 0%, #f0fff4 100%); padding: 20px; border-radius: 20px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0; font-size:1.5em; color: #555; letter-spacing: 1px;">✨ ${escapeHTML(thread.title)}</h2>
        <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:8px 16px; border-radius:30px; border:none; background:#fff; color:#888; font-size:12px; font-weight:bold; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">🔕 通知オフ</button>
      </div>
    </div>

    <div style="background: #fff; border-radius: 25px; padding: 20px; margin-bottom: 30px; border: 3px border-style: dotted; border-color: #ffe3e3; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
      <form id="post-form">
        <div style="margin-bottom:15px; text-align:center; color:#ff9a9e; font-weight:bold; font-size:1.2em;">〜 みんなとおしゃべり 〜</div>
        <input type="text" id="user-name" placeholder="おなまえ" style="width:100%; margin-bottom:10px; padding:12px 20px; border:2px solid #fff5f5; background:#fff9f9; border-radius:15px; box-sizing:border-box; outline:none; font-size:1em;">
        <textarea id="post-content" placeholder="ここに入力してね♪" required style="width:100%; height:90px; margin-bottom:15px; padding:15px 20px; border:2px solid #fff5f5; background:#fff9f9; border-radius:15px; box-sizing:border-box; outline:none; resize:none; font-family:inherit;"></textarea>
        <button type="submit" id="post-submit-btn" style="width:100%; padding:14px; background:linear-gradient(to right, #ff9a9e 0%, #fecfef 100%); color:white; border:none; border-radius:50px; cursor:pointer; font-weight:bold; font-size:1.1em; transition: 0.3s;">送信しちゃう！</button>
      </form>
    </div>

    <div id="posts-list">
  `;

  // 💬 最新レス：吹き出し風
  html += posts.map((post, index) => {
    const postNumber = totalPosts - index;
    return `
      <div style="margin-bottom:20px; position:relative;">
        <div style="display:flex; align-items:center; margin-bottom:5px; margin-left:10px;">
          <span style="background:#ff9a9e; color:#white; padding:2px 8px; border-radius:10px; font-size:0.7em; color:white; font-weight:bold;">${postNumber}</span>
          <span style="font-weight:bold; margin-left:8px; color:#666; font-size:0.9em;">${escapeHTML(post.name)}</span>
          <span style="font-size: 0.7em; color: #ccc; margin-left:10px;">${new Date(post.created_at).toLocaleTimeString()}</span>
        </div>
        <div style="background:white; padding:15px 20px; border-radius:20px; border:1px solid #eee; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display:inline-block; min-width:60%; max-width:90%; position:relative;">
          <div style="white-space: pre-wrap; line-height:1.6; color:#555;">${escapeHTML(post.content)}</div>
        </div>
      </div>
    `;
  }).join('');

  // 🏡 1番：はじまりのメッセージ
  html += `
      <div style="text-align:center; margin: 40px 0 20px; color:#ddd; font-size:0.9em;">˚✧₊ わたしたちの歴史はここから ₊✧˚</div>
      <div style="background: #f0fff4; padding: 25px; border-radius: 30px; border: 2px dashed #b2f2bb; text-align: center;">
        <div style="margin-bottom:10px;">
          <span style="color:#51cf66; font-weight:bold; font-size:1.2em;">#1</span>
          <span style="font-weight:bold; margin-left:8px; color:#444;">${escapeHTML(thread.name)}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.8; color:#555; font-size:1.1em; font-style:italic;">"${escapeHTML(thread.content)}"</div>
        <div style="margin-top:10px; font-size: 0.75em; color: #999;">Created at ${new Date(thread.created_at).toLocaleString()}</div>
      </div>
    </div>
  `;

  mainContainer.innerHTML = html;
  setupFormListener();
  updateNotifyBtnStatus();
}

// --- ロジック部分は省略（前回と同じものを適用してね） ---
function setupFormListener() {
  const form = document.getElementById('post-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('post-submit-btn');
    const content = document.getElementById('post-content').value.trim();
    if (!content || btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = "0.5";
    await supabaseClient.from('posts').insert([{ 
      thread_id: threadId, 
      name: document.getElementById('user-name').value.trim() || "名無しさん", 
      content 
    }]);
    document.getElementById('post-content').value = "";
    btn.disabled = false;
    btn.style.opacity = "1";
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
  btn.innerHTML = isEnabled ? "🔔 通知オン" : "🔕 通知オフ";
  btn.style.background = isEnabled ? "#fff5f5" : "#fff";
  btn.style.color = isEnabled ? "#ff9a9e" : "#888";
}

document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
  startWatching();
});