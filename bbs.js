// 1. Supabaseの初期化
const { createClient } = window.supabase; 
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. スレッド一覧を表示する関数
async function loadThreads() {
  const container = document.getElementById('thread-container');
  if (!container) return;

  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    container.innerHTML = '<p>エラー: ' + error.message + '</p>';
    return;
  }

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p>まだスレッドがありません。</p>';
    return;
  }

  // スレッド一覧の描画
  container.innerHTML = threads.map(thread => `
    <div class="aa">
      <h3 style="color: #ff0000;">${thread.title}</h3>
      <div class="res-meta">
        1 ：<span class="res-name">${thread.name}</span>：${new Date(thread.created_at).toLocaleString()}
      </div>
      <div class="res-content">${thread.content}</div>
      
      <hr style="border: 0; border-top: 1px dashed #ccc;">
      <div id="res-list-${thread.id}" style="margin-bottom:15px;">
         <small>読み込み中...</small>
      </div>

      <form onsubmit="postReply(event, ${thread.id})">
        <input type="text" id="res-name-${thread.id}" placeholder="名前" style="width: 20%;">
        <input type="text" id="res-content-${thread.id}" placeholder="本文" required style="width: 50%;">
        <button type="submit" class="submit-btn">書き込む</button>
      </form>
    </div>
  `).join('');

  // 各スレッドのレスを個別に読み込む
  threads.forEach(thread => loadPosts(thread.id));
}

// 3. レスを取得して表示する関数
async function loadPosts(threadId) {
  const postContainer = document.getElementById(`res-list-${threadId}`);
  if (!postContainer) return;

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error || !posts || posts.length === 0) {
    postContainer.innerHTML = '<small style="color:gray;">レスはありません</small>';
    return;
  }

  // レスを表示
  postContainer.innerHTML = posts.map((post, index) => `
    <div style="margin-bottom: 15px;">
      <div class="res-meta">
        ${index + 2} ：<span class="res-name">${post.name}</span>：${new Date(post.created_at).toLocaleString()}
      </div>
      <div class="res-content">${post.content}</div>
    </div>
  `).join('');
}

// 4. レスを投稿する関数
async function postReply(event, threadId) {
  event.preventDefault(); 

  const nameInput = document.getElementById(`res-name-${threadId}`);
  const contentInput = document.getElementById(`res-content-${threadId}`);
  
  const { error } = await supabaseClient
    .from('posts')
    .insert([{ 
      thread_id: threadId, 
      name: nameInput.value || "名無しさん", 
      content: contentInput.value 
    }]);

  if (error) {
    alert("書き込み失敗: " + error.message);
  } else {
    contentInput.value = ""; // 入力欄を空にする
    loadPosts(threadId);    // そのスレのレス欄だけ更新
  }
}

// 5. 新規スレッド作成のイベント
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('thread-title').value;
    const name = document.getElementById('user-name').value || "名無しさん";
    const content = document.getElementById('content').value;

    const { error } = await supabaseClient
      .from('threads')
      .insert([{ title, name, content }]);

    if (error) {
      alert("作成失敗: " + error.message);
    } else {
      alert("スレッドを作成しました！");
      this.reset();
      loadThreads(); 
    }
  });
}

// 起動時にスレッド読み込み
window.onload = loadThreads;