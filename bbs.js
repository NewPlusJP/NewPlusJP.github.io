document.getElementById('thread-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const formData = {
    title: document.getElementById('thread-title').value,
    name: document.getElementById('user-name').value || "名無しさん",
    content: document.getElementById('content').value
  };

  try {
    const response = await fetch('https://your-app.fly.dev/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      alert("スレッドを作成しました！");
      location.reload(); // 投稿後に一覧を更新
    }
  } catch (error) {
    console.error("送信エラー:", error);
    alert("投稿に失敗しました。サーバーが寝てるかもしれません。");
  }
});

async function loadThreads() {
  const container = document.getElementById('thread-container');
  
  try {
    const response = await fetch('https://your-app.fly.dev/api/threads');
    const threads = await response.json();

    container.innerHTML = threads.map(thread => `
      <div class="aa thread-post">
        <div class="thread-header">
          <span class="thread-num">ID:${thread.id}</span> 
          <span class="thread-name"><b>${thread.name}</b></span> 
          <span class="thread-date">${thread.created_at}</span>
        </div>
        <h3 class="thread-title-display">${thread.title}</h3>
        <p class="thread-content-display">${thread.content.replace(/\n/g, '<br>')}</p>
        <div class="thread-footer">
          <a href="thread.html?id=${thread.id}" class="reply-link">このスレを開く</a>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = "<p>スレッドの読み込みに失敗しました。</p>";
  }
}

// ページ読み込み時に実行
window.onload = loadThreads;

// スレ一覧を読み込む関数
async function loadThreads() {
  const container = document.getElementById('thread-container');
  
  // Supabaseからデータ取得
  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('id', { ascending: false }); // 新しい順

  if (error) {
    console.error('データ取得失敗:', error);
    return;
  }

  // HTMLを組み立てて表示
  container.innerHTML = threads.map(thread => `
    <div style="border: 1px solid #ccc; margin: 10px; padding: 10px;">
      <small>ID:${thread.id} 名前:<b>${thread.name}</b> 日時:${new Date(thread.created_at).toLocaleString()}</small>
      <h4>${thread.title}</h4>
      <p>${thread.content}</p>
    </div>
  `).join('');
}

// ページを開いた時に実行
window.onload = loadThreads;

// --- 2. スレッドの新規作成（POST） ---
const threadForm = document.getElementById('thread-form');
if (threadForm) {
  threadForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
      title: document.getElementById('thread-title').value,
      name: document.getElementById('user-name').value || "名無しさん",
      content: document.getElementById('content').value
    };

    try {
      const response = await fetch(`${API_BASE_URL}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert("スレッドを作成しました！");
        this.reset(); // フォームを空にする
        loadThreads(); // 一覧を再読み込み
      } else {
        alert("作成に失敗しました。");
      }
    } catch (error) {
      console.error("送信エラー:", error);
      alert("通信に失敗しました。");
    }
  });
}

// ページ読み込み時に一覧を表示
window.addEventListener('DOMContentLoaded', loadThreads);