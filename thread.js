/**
 * NewPlusJP - Thread System (Modern Edition)
 * All rights reserved.
 */

let supabaseClient;
try {
  if (typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { 
  console.error("Connection Failed:", e); 
}

const params = new URLSearchParams(window.location.search);
const threadId = params.get('id');

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- Main UI Rendering ---
async function loadEverything() {
  const mainContainer = document.getElementById('single-thread-container');
  if (!mainContainer || !supabaseClient || !threadId) return;

  // Background style
  document.body.style.backgroundColor = "#f8f9fa";

  const [tRes, pRes] = await Promise.all([
    supabaseClient.from('threads').select('*').eq('id', threadId).maybeSingle(),
    supabaseClient.from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false })
  ]);

  if (tRes.error || !tRes.data) {
    mainContainer.innerHTML = '<div class="error">Error: Thread Not Found.</div>';
    return;
  }

  const thread = tRes.data;
  const posts = pRes.data || [];
  const totalPosts = posts.length + 1;

  let html = `
    <div style="background: #ffffff; padding: 25px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #1a73e8; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0; font-size:1.4em; color: #202124;">${escapeHTML(thread.title)}</h2>
        <button id="notify-toggle-btn" onclick="toggleNotification()" style="cursor:pointer; padding:8px 20px; border-radius:6px; border:1px solid #dadce0; background:#fff; color:#5f6368; font-size:12px; font-weight:600; transition:0.2s;">
          Loading...
        </button>
      </div>
    </div>

    <div style="background: #ffffff; border-radius: 12px; padding: 25px; margin-bottom: 40px; border: 1px solid #dadce0;">
      <form id="post-form">
        <div style="margin-bottom:15px; color:#1a73e8; font-weight:bold; font-size:0.9em; text-transform: uppercase; letter-spacing:1px;">New Post</div>
        <input type="text" id="user-name" placeholder="Name" style="width:100%; margin-bottom:12px; padding:12px; border:1px solid #dadce0; border-radius:6px; box-sizing:border-box; outline:none; font-size:14px;">
        <textarea id="post-content" placeholder="Enter your message..." required style="width:100%; height:120px; margin-bottom:15px; padding:12px; border:1px solid #dadce0; border-radius:6px; box-sizing:border-box; outline:none; resize:none; font-family:inherit; font-size:14px;"></textarea>
        <button type="submit" id="post-submit-btn" style="width:100%; padding:14px; background:#1a73e8; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; transition: 0.2s;">POST MESSAGE</button>
      </form>
    </div>

    <div id="posts-list">
  `;

  // --- Response List (Latest First) ---
  html += posts.map((post, index) => {
    const postNumber = totalPosts - index;
    return `
      <div style="margin-bottom:24px; border-bottom: 1px solid #eee; padding-bottom:15px;">
        <div style="display:flex; align-items:center; margin-bottom:8px;">
          <span style="color:#1a73e8; font-weight:bold; font-size:0.85em;">ID: ${postNumber}</span>
          <span style="font-weight:700; margin-left:12px; color:#202124; font-size:0.95em;">${escapeHTML(post.name)}</span>
          <span style="font-size: 0.75em; color: #70757a; margin-left:15px;">${new Date(post.created_at).toLocaleString()}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.6; color:#3c4043; font-size:15px; padding-left:5px;">${escapeHTML(post.content)}</div>
      </div>
    `;
  }).join('');

  // --- Initial Post (Anchor) ---
  html += `
      <div style="text-align:center; margin: 50px 0 30px; color:#9aa0a6; font-size:0.8em; text-transform: uppercase; letter-spacing:2px;">End of Thread / Archive</div>
      <div style="background: #f1f3f4; padding: 30px; border-radius: 12px; border: 1px solid #dadce0;">
        <div style="margin-bottom:12px;">
          <span style="color:#1a73e8; font-weight:bold; font-size:1.1em;">#1 (Original Post)</span>
          <span style="font-weight:bold; margin-left:12px; color:#202124;">${escapeHTML(thread.name)}</span>
        </div>
        <div style="white-space: pre-wrap; line-height:1.7; color:#3c4043; font-size:1.05em;">${escapeHTML(thread.content)}</div>
        <div style="margin-top:15px; font-size: 0.75em; color: #70757a;">Created: ${new Date(thread.created_at).toLocaleString()}</div>
      </div>
    </div>
  `;

  mainContainer.innerHTML = html;
  setupFormListener();
  updateNotifyBtnStatus();
}

// --- Logic Implementation ---
function setupFormListener() {
  const form = document.getElementById('post-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('post-submit-btn');
    const content = document.getElementById('post-content').value.trim();
    if (!content || btn.disabled) return;

    btn.disabled = true;
    btn.innerText = "SENDING...";

    await supabaseClient.from('posts').insert([{ 
      thread_id: threadId, 
      name: document.getElementById('user-name').value.trim() || "Guest", 
      content 
    }]);

    document.getElementById('post-content').value = "";
    btn.disabled = false;
    btn.innerText = "POST MESSAGE";
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
  btn.innerText = isEnabled ? "Notification: ON" : "Notification: OFF";
  btn.style.borderColor = isEnabled ? "#1a73e8" : "#dadce0";
  btn.style.color = isEnabled ? "#1a73e8" : "#5f6368";
}

document.addEventListener('DOMContentLoaded', () => {
  loadEverything();
  startWatching();
});