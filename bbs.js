// bbs.js

// 1. Supabaseの初期化（config.jsの変数を使います）
const { createClient } = supabase;
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
    console.error('データ取得エラー:', error);
    container.innerHTML = '<p>スレッドの読み込みに失敗しました。</p>';
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
  // ★重要：これでブラウザの勝手な送信（405エラー）を阻止！
  e.preventDefault();

  const title = document.getElementById('thread-title').value;
  const name = document.getElementById('user-name').value || "名無しさん";
  const content = document.getElementById('content').value;

  console.log("送信中...");

  // Supabaseにデータを送る
  const { error } = await supabaseClient
    .from('threads')
    .insert([{ title, name, content }]);

  if (error) {
    alert("エラーが発生しました: " + error.message);
    console.error(error);
  } else {
    alert("スレッドを作成しました！");
    this.reset(); // 入力欄をきれいにする
    loadThreads(); // リストを更新
  }
});

// 4. ページを開いた時に実行
window.onload = loadThreads;