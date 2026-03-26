// 1. Supabaseの初期化
// window.supabase を使うことで読み込みエラーを防ぎます
const { createClient } = window.supabase; 
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. スレッド一覧を表示する関数
async function loadThreads() {
  console.log("loadThreads関数が実行されました"); 
  const container = document.getElementById('thread-container');
  
  if (!container) {
    console.error("HTMLに thread-container が見つかりません！");
    return;
  }

  // Supabaseからデータ取得
  const { data: threads, error } = await supabaseClient
    .from('threads')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('取得エラー:', error);
    container.innerHTML = '<p>エラー: ' + error.message + '</p>';
    return;
  }

  console.log("取得したデータ:", threads);

  if (!threads || threads.length === 0) {
    container.innerHTML = '<p>まだスレッドがありません。最初のスレを立ててみよう！</p>';
    return;
  }

  // 画面に表示
  container.innerHTML = threads.map(thread => `
    <div class="aa" style="border: 1px solid #ccc; margin-bottom: 10px; padding: 10px;">
      <small>ID:${thread.id} <b>${thread.name}</b> ${new Date(thread.created_at).toLocaleString()}</small>
      <h3 style="margin: 5px 0;">${thread.title}</h3>
      <p style="white-space: pre-wrap;">${thread.content}</p>
    </div>
  `).join('');
}

// 3. 送信ボタンが押された時の処理
document.getElementById('thread-form').addEventListener('submit', async function(e) {
  // ブラウザのデフォルト送信を止めて405エラーを防ぐ
  e.preventDefault();
  console.log("送信ボタンが押されました");

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
    loadThreads(); // リストを最新の状態に更新
  }
});

// 4. ページを開いた時に実行
window.onload = loadThreads;