// --- 0. 追跡防止・ロードチェック ---
if (typeof window.supabase === 'undefined') {
    console.error("Supabase library blocked by browser tracking prevention.");
}

// --- 1. 初期化 ---
// SUPABASE_URL と SUPABASE_ANON_KEY が正しく定義されていることが前提です
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');

let currentThreadData = null;

// --- 2. 起動処理 ---
async function init() {
    const container = document.getElementById('single-thread-container');
    if (!container) return;

    // ライブラリがブロックされている場合の警告
    if (!supabaseClient) {
        container.innerHTML = `
            <div class="aa" style="border:2px solid red; padding:15px;">
                <h3 style="color:red; margin-top:0;">⚠️ 接続が遮断されました</h3>
                <p>ブラウザの「追跡防止機能」または「広告ブロック」によって通信が制限されています。</p>
                <p>表示するには、ブラウザの設定で本サイトの追跡防止をオフにするか、別のブラウザをお試しください。</p>
            </div>`;
        return;
    }

    if (!threadId) {
        container.innerHTML = "IDが指定されていません。";
        return;
    }

    try {
        // スレッド情報を取得
        const { data: thread, error } = await supabaseClient
            .from('threads')
            .select('*')
            .eq('id', threadId)
            .maybeSingle();

        if (error) throw error;
        if (!thread) {
            container.innerHTML = "スレッドが存在しません。";
            return;
        }

        currentThreadData = thread;
        renderPage(thread); // ページ全体の枠組みを表示
        await loadPosts();  // レス一覧を表示
    } catch (e) {
        console.error("Init Error:", e);
        container.innerHTML = "接続エラーが発生しました: " + e.message;
    }
}

// --- 3. 画面の土台表示 ---
function renderPage(thread) {
    const container = document.getElementById('single-thread-container');
    const isAdmin = localStorage.getItem('is_admin') === 'true';

    let formHTML = '';
    if (thread.is_admin_thread && !isAdmin) {
        formHTML = `<div style="background:#eee; padding:15px; text-align:center; margin-bottom:20px;">📢 運営専用スレッドです</div>`;
    } else {
        const adminToggle = isAdmin ? `<label style="color:#ff4757; font-size:12px;"><input type="checkbox" id="admin-mode"> 管理者として投稿</label><br>` : '';
        formHTML = `
            <div style="background:#f4f4f4; padding:15px; border:1px solid #ccc; margin-bottom:20px; border-radius:10px;">
                <form id="reply-form">
                    <input type="text" id="res-name" value="${localStorage.getItem('user_display_name') || ''}" placeholder="名前" style="margin-bottom:5px;"><br>
                    ${adminToggle}
                    <textarea id="res-content" placeholder="内容を入力してください" required style="width:95%; height:60px; margin-top:5px;"></textarea><br>
                    <button type="submit" id="submit-btn" style="margin-top:5px; padding:5px 20px;">書き込む</button>
                </form>
            </div>`;
    }

    container.innerHTML = `
        <div class="aa">
            <h2 style="color:${thread.is_admin_thread ? '#ff4757' : 'blue'}; border-bottom:2px solid #ddd; padding-bottom:5px;">
                ${thread.is_admin_thread ? '📌' : ''} ${thread.title}
            </h2>
            ${formHTML}
            <div id="res-list">読み込み中...</div>
            <p style="text-align:center; margin-top:20px;"><a href="index.html">【トップに戻る】</a></p>
        </div>
    `;

    if (document.getElementById('reply-form')) {
        document.getElementById('reply-form').addEventListener('submit', handlePost);
    }
}

// --- 4. レス一覧の取得 ---
async function loadPosts() {
    const listArea = document.getElementById('res-list');
    if (!listArea || !currentThreadData || !supabaseClient) return;

    try {
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const ownerItem = {
            name: currentThreadData.name || "名無しさん",
            content: currentThreadData.content || "",
            created_at: currentThreadData.created_at,
            user_id_display: "OWNER",
            is_owner: true
        };

        const allItems = [...(posts || []), ownerItem];

        listArea.innerHTML = allItems.map((p, index) => {
            const num = allItems.length - index;
            const isAdm = p.is_admin_only === true;
            const style = isAdm ? 'background:#fff5f5; border-left:5px solid #ff4757;' : 'border-bottom:1px solid #eee;';
            
            return `
                <div style="padding:10px; margin-bottom:5px; ${style}">
                    <div style="font-size:12px; color:#666;">
                        <b>${num}</b> : <span style="color:${p.is_owner ? 'red' : 'green'}; font-weight:bold;">${p.name}</span>
                        [${new Date(p.created_at).toLocaleString()}] ID:${p.user_id_display || '???'}
                    </div>
                    <div style="margin-top:5px; white-space:pre-wrap;">${isAdm ? '<b>【運営】</b>' : ''}${p.content}</div>
                </div>`;
        }).join('');

    } catch (e) {
        listArea.innerHTML = "レスの読み込みに失敗しました: " + e.message;
    }
}

// --- 5. 投稿処理 ---
async function handlePost(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const btn = document.getElementById('submit-btn');
    const content = document.getElementById('res-content').value;
    const name = document.getElementById('res-name').value || "名無しさん";
    const adminMode = document.getElementById('admin-mode');

    if (!content.trim()) return;

    btn.disabled = true;
    const isSecret = adminMode ? adminMode.checked : false;
    const myID = (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : "ID:" + Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error } = await supabaseClient
        .from('posts')
        .insert([{
            thread_id: threadId,
            name: name,
            content: content,
            user_id_display: myID,
            is_admin_only: isSecret
        }]);

    if (error) {
        alert("投稿失敗: " + error.message);
    } else {
        document.getElementById('res-content').value = "";
        await loadPosts();
    }
    btn.disabled = false;
}

// 実行
document.addEventListener('DOMContentLoaded', init);