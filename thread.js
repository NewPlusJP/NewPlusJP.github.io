// --- 3. レス一覧を表示（最新を一番上にする修正版） ---
async function loadPostsInThread(originalPosterName) {
  const postList = document.getElementById('res-list');
  
  // .order('id', { ascending: false }) に変更して最新を上に！
  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('id', { ascending: false }); 

  if (error) {
    postList.innerHTML = 'レスの読み込みに失敗しました。';
    return;
  }

  if (!posts || posts.length === 0) {
    postList.innerHTML = '<div style="color:#888; padding:10px;">まだレスがありません。</div>';
    return;
  }

  const isAdminLoggedIn = localStorage.getItem('is_admin') === 'true';

  postList.innerHTML = posts.map((post) => {
    const displayID = post.user_id_display || "???";
    let nameStyle = "color: green; font-weight: bold;"; 
    let adminMark = "";

    if (post.is_admin_post) {
      nameStyle = "color: #ffaa00; font-weight: bold;"; 
      adminMark = " <small>(★管理者)</small>";
    } 
    else if (post.name === originalPosterName) {
      nameStyle = "color: #ff0000; font-weight: bold;"; 
    }

    return `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; background: #fff;">
        <div class="res-meta" style="display: flex; justify-content: space-between;">
          <span>
            <span style="color:#888;">[最新]</span> <span style="${nameStyle}">${post.name}${adminMark}</span>：${new Date(post.created_at).toLocaleString()} 
            <small style="color: #666; margin-left: 10px;">ID:${displayID}</small>
          </span>
          ${isAdminLoggedIn ? `<button onclick="deletePostInThread(${post.id})" style="color:red; background:none; border:none; cursor:pointer; font-size:0.8em;">[削除]</button>` : ''}
        </div>
        <div class="res-content" style="margin-top: 5px; white-space: pre-wrap; font-size: 0.95em;">${post.content}</div>
      </div>
    `;
  }).join('');
}

// --- 4. レス投稿処理 ＋ 自動お掃除（修正版） ---
async function postReplyInThread(event) {
  event.preventDefault();
  const nameInput = document.getElementById('res-name');
  const contentInput = document.getElementById('res-content');
  const myID = generateID();
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  // 1. レスを投稿
  const { error: postError } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameInput.value || "名無しさん",
    content: contentInput.value,
    user_id_display: myID,
    is_admin_post: isAdmin
  }]);

  if (postError) {
    alert("エラー: " + postError.message);
    return;
  }

  // 2. 自動お掃除（最新20件だけ残す）
  const MAX_RES = 20; 
  // 全件のIDを「新しい順」に取得
  const { data: allPosts } = await supabaseClient
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .order('id', { ascending: false });

  if (allPosts && allPosts.length > MAX_RES) {
    // 21件目以降（古いもの）のIDをピックアップして削除
    const idsToDelete = allPosts.slice(MAX_RES).map(p => p.id);

    const { error: deleteError } = await supabaseClient
      .from('posts')
      .delete()
      .in('id', idsToDelete);
      
    if (deleteError) console.error("お掃除失敗:", deleteError.message);
  }

  // 3. 画面更新
  contentInput.value = "";
  location.reload(); 
}