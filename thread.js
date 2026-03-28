// --- 1. 設定 ---
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id'); // ここで取得したUUID

let currentThreadData = null;

// --- 2. スレッド本体を取得 ---
async function loadSingleThread() {
  const container = document.getElementById('single-thread-container');
  if (!container) return;
  if (!threadId) {
    container.innerHTML = "IDが指定されていません。";
    return;
  }

  try {
    // スレッド情報を取得
    const { data: thread, error } = await supabaseClient
      .from('threads')
      .select('*')
      .eq('id', threadId) // UUID型として比較
      .maybeSingle();

    if (error) throw error;
    if (!thread) {
      container.innerHTML = "スレッドが見つかりません。";
      return;
    }

    currentThreadData = thread;
    const isAdmin = localStorage.getItem('is_admin') === 'true';

    // フォームの準備
    let formHTML = '';
    if (thread.is_admin_thread && !isAdmin) {
      formHTML = `<div class="aa" style="text-align:center; color:#666;">📢 運営専用スレのため書き込み不可</div>`;
    } else {
      const adminToggle = isAdmin ? `<label style="color:#ff4757; font-size:0.8em;"><input type="checkbox" id="admin-only-chat"> 🔒 管理者モード</label><br>` : '';
      formHTML = `
        <div class="aa" style="background:var(--card-bg,#f9f9f9); border:1px solid #ddd; padding:15px; border-radius:10px; margin-bottom:20px;">
          <form id="reply-form">
            <input type="text" id="res-name" value="${localStorage.getItem('user_display_name') || ''}" placeholder="名前" style="width:150px; padding:5px; margin-bottom:5px;"><br>
            ${adminToggle}
            <textarea id="res-content" placeholder="内容を入力" required style="width:100%; height:60px; padding:8px; margin-bottom:5px;"></textarea><br>
            <button type="submit" id="submit-btn" class="submit-btn">書き込む</button>
          </form>
        </div>`;
    }

    // 全体構造をセット
    container.innerHTML = `
      <div class="aa">
        <h2 style="color:${thread.is_admin_thread ? '#ff4757' : 'inherit'}; border-bottom:2px solid #eee; padding-bottom:10px;">
          ${thread.is_admin_thread ? '📌 ' : ''}${thread.title}
        </h2>
        ${formHTML}
        <div id="res-list"></div>
        <div style="text-align:center; margin-top:20px;"><a href="index.html">← トップへ戻る</a></div>
      </div>
    `;

    if (document.getElementById('reply-form')) {
      document.getElementById('reply-form').addEventListener('submit', postReplyInThread);
    }

    // レス一覧の読み込みを開始
    loadPostsInThread();

  } catch (err) {
    console.error("Fatal Error:", err);
    container.innerHTML = "読み込みエラーが発生しました。";
  }
}

// --- 3. レス一覧の取得と表示 ---
async function loadPostsInThread() {
  const postList = document.getElementById('res-list');
  if (!postList || !currentThreadData) return;

  try {
    // 投稿(posts)を取得
    const { data: posts, error } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false }); // 最新を上に

    if (error) throw error;

    // スレ主のデータを作成（これが1番になる）
    const ownerItem = {
      name: currentThreadData.name || "名無しさん",
      content: currentThreadData.content || "",
      created_at: currentThreadData.created_at,
      user_id_display: "OWNER",
      is_owner: true
    };

    // 最新レスリストの最後にスレ主を追加
    const allItems = [...(posts || []), ownerItem];

    // HTMLの組み立て
    postList.innerHTML = allItems.map((post, index) => {
      const resNum = allItems.length - index; // 下から数えて1番にする計算
      const isSpecial = post.is_admin_only === true;
      const bg = isSpecial ? 'background:rgba(255,71,87,0.05); border-left:4px solid #ff4757;' : 'border-bottom:1px solid #eee;';
      
      return `
        <div style="padding:12px; margin-bottom:5px; ${bg}">
          <div style="font-size:0.85em; color:#666;">
            <strong>${resNum}</strong> : <span style="color:${post.is_owner ? '#ff0000' : '#2ed573'}; font-weight:bold;">${post.name}</span>
            <small> [${new Date(post.created_at).toLocaleString()}] ID:${post.user_id_display || '???'}</small>
          </div>
          <div style="margin-top:8px; white-space:pre-wrap; line-height:1.5;">${isSpecial ? '<strong>【運営】</strong>' : ''}${post.content}</div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error("Posts Load Error:", err);
    postList.innerHTML = "レスの読み込みに失敗しました。";
  }
}

// --- 4. 投稿処理 ---
async function postReplyInThread(e) {
  e.preventDefault();
  const content = document.getElementById('res-content').value;
  const name = document.getElementById('res-name').value || "名無しさん";
  const adminCheck = document.getElementById('admin-only-chat');
  const btn = document.getElementById('submit-btn');

  if (!content.trim()) return;

  btn.disabled = true;
  const isSecret = adminCheck ? adminCheck.checked : false;
  const myID = (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : "ID:" + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { error } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: name,
    content: content,
    user_id_display: myID,
    is_admin_only: isSecret
  }]);

  if (!error) {
    document.getElementById('res-content').value = "";
    loadPostsInThread(); // 一覧だけ更新
  } else {
    alert("投稿失敗: " + error.message);
  }
  btn.disabled = false;
}

// 起動
document.addEventListener('DOMContentLoaded', loadSingleThread);