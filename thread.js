// ...（初期化やID生成はそのまま）

// 3. レス一覧表示（★ここで強制的に20件にカットする）
async function loadPostsInThread() {
  const postList = document.getElementById('res-list');
  
  const { data: posts } = await supabaseClient
    .from('posts')
    .select('id, name, content, created_at, user_id_display')
    .eq('thread_id', threadId)
    .order('id', { ascending: false })
    .limit(20); // サーバーから取る時点で最大20件

  const displayArray = [...(posts || [])];
  
  if (currentThreadData) {
    displayArray.push({
      id: "first",
      name: currentThreadData.name,
      content: currentThreadData.content,
      created_at: currentThreadData.created_at,
      user_id_display: "OWNER",
      is_owner: true
    });
  }

  // 念のためフロント側でも20件＋スレ主の計21件以上にならないようガード
  const finalDisplay = displayArray.slice(0, 21);

  postList.innerHTML = finalDisplay.map((post) => {
    const isAdmin = (post.user_id_display === "ADMIN");
    const adminBadge = isAdmin ? '<span style="background:#ff4757; color:white; padding:2px 8px; border-radius:10px; font-size:0.75em; margin-left:5px; vertical-align:middle;">管理者</span>' : '';
    const nameColor = post.is_owner ? "#ff0000" : "green";
    
    return `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <span style="color:${nameColor}; font-weight:bold;">${post.name}${adminBadge}</span> 
        <small>：${new Date(post.created_at).toLocaleString()} ID:${post.user_id_display || "???"}</small>
        <div style="margin-top:8px; white-space:pre-wrap;">${post.content}</div>
      </div>
    `;
  }).join('');
}

// 4. 投稿（★投稿完了を待ってからリストを更新する）
async function postReplyInThread(event) {
  event.preventDefault();
  const contentInput = document.getElementById('res-content');
  const submitBtn = document.getElementById('submit-btn');
  const nameToSave = document.getElementById('res-name').value || "名無しさん";

  if (!contentInput.value.trim()) return;

  submitBtn.disabled = true;
  submitBtn.innerText = "送信中...";

  // 1. まずサーバーに保存（awaitで完了を待つ）
  const { error } = await supabaseClient.from('posts').insert([{
    thread_id: threadId,
    name: nameToSave,
    content: contentInput.value,
    user_id_display: (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : generateID()
  }]);

  if (!error) {
    contentInput.value = "";
    // 2. 保存が終わってからお掃除を実行（これも待つ）
    await cleanOldPosts();
    // 3. 最後にリストを再読み込み（これで確実に最新20件になる）
    await loadPostsInThread();
  } else {
    alert("エラーだわこれ: " + error.message);
  }

  submitBtn.disabled = false;
  submitBtn.innerText = "書き込む";
}

// お掃除（★これがないとDBがパンクする）
async function cleanOldPosts() {
  const { data } = await supabaseClient
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .order('id', { ascending: false });

  if (data && data.length > 20) {
    const idsToDelete = data.slice(20).map(p => p.id);
    await supabaseClient.from('posts').delete().in('id', idsToDelete);
  }
}