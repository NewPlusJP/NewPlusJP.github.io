/**
 * NewPlusJP - 掲示板システム (Soft Modern Edition)
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

  // 全体の背景色を設定
  document.body.style.backgroundColor = "#f0f2f5";
  document.body.style.color = "#444";

  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle(),
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div style="padding:20px; text-align:center;">スレッドが見つかりません。</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];
  const totalPosts = posts.length + 1;

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding:0 10px;">
      <h2 style="margin:0; font-size:1.4em; color: #333;">${escapeHTML(thread.title)}</h2>
      <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:6px 12px; border-radius:20px; border:1px solid #ddd; background:#fff; font-size:12px; color:#666;">通知：確認中</button>
    </div>

    <div style="border: 1px solid #e0e0e0; border-radius: 15px; background: #fff; padding: 20px; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <form id="post-form">
        <div style="font-weight:bold; margin-bottom:10px; color:#555; font-size:0.9em;">新規メッセージを投稿</div>
        <input type="text" id="user-name" placeholder="名前（空欄で名無しさん）" style="width:100%; margin-bottom:10px; padding:12px; border:1px solid #eee; background:#fafafa; border-radius:10px; box-sizing:border-box; outline:none;">
        <textarea id="post-content" placeholder="内容を入力してください" required style="width:100%; height:90px; margin-bottom:12px; padding:12px; border:1px solid #eee; background:#fafafa; border-radius:10px; box-sizing:border-box; outline:none; resize:none; font-family:inherit;"></textarea>
        <button type="submit" id="post-submit-btn" style="width:100%; padding:12px; background:#4cd137; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold; font-size:1em; transition:0.3s;">メッセージを送信</button>
      </form>
    </div>

    <div id="posts-list">
  `;

  // 最新のレス（カード形式の枠）
  html += posts.map((post, index) => {
    const postNumber = totalPosts - index;
    return `
      <div style="background: #fff; border-radius: 12px; padding: 15px 20px; margin-bottom: 15px; border: 1px solid #eaeaea; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
        <div style="font-size: 0.85em; color: #888; margin-bottom:8px; display:flex; justify-content:space-between;">
          <span><strong style="color:#4cd137;">${postNumber}</strong> : <strong>${escapeHTML(post.name)}</strong></span>
          <span>${new Date(post.created_at).toLocaleString()}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.6; color:#444;">${escapeHTML(post.content)}</div>
      </div>
    `;
  }).join('');

  // スレ主の投稿（一番下の枠、少し色を変えて区別）
  html += `
      <div style="text-align:center; margin: 30px 0 15px; color:#bbb; font-size:0.8em; letter-spacing:1px;">THREAD START</div>
      <div style="background: #f9fff9; border-radius: 12px; padding: 20px; border: 1px dashed #4cd137; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
        <div style="font-size: 0.85em; color: #888; margin-bottom:10px;">
          <strong style="color:#4cd137;">1</strong> : <strong>${escapeHTML(thread.name)}</strong> : ${new Date(thread.created_at).toLocaleString()}
        </div>
        <div style="white-space: pre-wrap; line-height:1.7; color:#333; font-weight:500;">${escapeHTML(thread.content)}</div>
      </div>
    </div>
  `;

  mainContainer.innerHTML = html;
  setupFormListener();
  updateNotifyBtnStatus();
}

// 投稿ロジック（漢字・落ち着いた表現に修正）
function setupFormListener() {
  const form = document.getElementById('post-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('post-submit-btn');
    const content = document.getElementById('post-content').value.trim();
    if (!content || btn.disabled) return;

    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.innerText = "送信中...";

    const { error } = await supabaseClient.from('posts').insert([{ 
      thread_id: threadId, 
      name: document.getElementById('user-name').value.trim() || "名無しさん", 
      content 
    }]);

    if (error) {
      alert("送信に失敗しました: " + error.message);
    } else {
      document.getElementById('post-content').value = "";
    }
    
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.innerText = "メッセージを送信";
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
  btn.style.borderColor = isEnabled ? "#4cd137" : "#ddd";
  btn.style.color = isEnabled ? "#4cd137" : "#666";
}

document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
  startWatching();
});