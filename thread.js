/**
 * NewPlusJP - 掲示板システム
 * 無断転載・無断使用を禁止します。
 */

let supabaseClient;
try {
  if (typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { 
  console.error("初期化失敗:", e); 
}

const params = new URLSearchParams(window.location.search);
const threadId = params.get('id');

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- メイン表示処理 ---
async function loadEverything() {
  const mainContainer = document.getElementById('single-thread-container');
  if (!mainContainer || !supabaseClient || !threadId) return;

  document.body.style.backgroundColor = "#f8f9fa";

  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle(),
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div style="padding:20px; color:#d93025;">エラー：スレッドが見つかりません。</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];
  const totalPosts = posts.length + 1;

  let html = `
    <div style="background: #ffffff; padding: 25px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #1a73e8; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0; font-size:1.4em; color: #202124;">${escapeHTML(thread.title)}</h2>
        <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:6px 15px; border-radius:4px; border:1px solid #dadce0; background:#fff; color:#5f6368; font-size:12px;">
          読み込み中...
        </button>
      </div>
    </div>

    <div style="background: #ffffff; border-radius: 8px; padding: 25px; margin-bottom: 30px; border: 1px solid #dadce0;">
      <form id="post-form">
        <div style="margin-bottom:12px; color:#1a73e8; font-weight:bold; font-size:0.9em;">新規投稿</div>
        <input type="text" id="user-name" placeholder="名前（省略可）" style="width:100%; margin-bottom:10px; padding:10px; border:1px solid #dadce0; border-radius:4px; box-sizing:border-box; outline:none;">
        <textarea id="post-content" placeholder="投稿内容を入力してください" required style="width:100%; height:100px; margin-bottom:12px; padding:10px; border:1px solid #dadce0; border-radius:4px; box-sizing:border-box; outline:none; resize:none; font-family:inherit;"></textarea>
        <button type="submit" id="post-submit-btn" style="width:100%; padding:12px; background:#1a73e8; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; transition: 0.2s;">書き込む</button>
      </form>
    </div>

    <div id="posts-list">
  `;

  // --- レス一覧（新しい順） ---
  html += posts.map((post, index) => {
    const postNumber = totalPosts - index;
    return `
      <div style="margin-bottom:20px; border-bottom: 1px solid #eee; padding-bottom:15px;">
        <div style="display:flex; align-items:center; margin-bottom:6px;">
          <span style="color:#1a73e8; font-weight:bold; font-size:0.9em;">${postNumber}</span>
          <span style="font-weight:bold; margin-left:10px; color:#202124;">${escapeHTML(post.name)}</span>
          <span style="font-size: 0.75em; color: #70757a; margin-left:12px;">${new Date(post.created_at).toLocaleString()}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.6; color:#3c4043; font-size:15px;">${escapeHTML(post.content)}</div>
      </div>
    `;
  }).join('');

  // --- 最初の投稿（スレ主） ---
  html += `
      <div style="text-align:center; margin: 40px 0 20px; color:#9aa0a6; font-size:0.85em;">スレッドの開始地点</div>
      <div style="background: #f1f3f4; padding: 25px; border-radius: 8px; border: 1px solid #dadce0;">
        <div style="margin-bottom:10px;">
          <span style="color:#1a73e8; font-weight:bold;">#1</span>
          <span style="font-weight:bold; margin-left:10px; color:#202124;">${escapeHTML(thread.name)}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.7; color:#3c4043;">${escapeHTML(thread.content)}</div>
        <div style="margin-top:10px; font-size: 0.75em; color: #70757a;">作成日時：${new Date(thread.created_at).toLocaleString()}</div>
      </div>
    </div>
  `;

  mainContainer.innerHTML = html;
  setupFormListener();
  updateNotifyBtnStatus();
}

// --- 以下、ロジック部分は漢字表記に修正 ---
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
      name: document.getElementById('user-name').value.trim() || "名無し", 
      content 
    }]);

    document.getElementById('post-content').value = "";
    btn.disabled = false;
    btn.innerText = "書き込む";
    loadEverything();
  };
}

function updateNotifyBtnStatus() {
  const btn = document.getElementById('notify-toggle-btn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('notify_enabled') === 'true';
  btn.innerText = isEnabled ? "通知：ON" : "通知：OFF";
  btn.style.color = isEnabled ? "#1a73e8" : "#5f6368";
}

// (他、startWatchingやtoggleNotificationは以前のロジックのまま)
document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
});