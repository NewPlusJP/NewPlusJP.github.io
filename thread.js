// --- 0. 追跡防止・ロードチェック ---
if (typeof window.supabase === 'undefined') {
    console.error("Supabase library blocked by browser tracking prevention.");
}

// --- 1. 初期化 ---
const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');
let currentThreadData = null;
let lastPostContent = ""; 

// --- 【重要】エスケープ関数 ---
function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// --- 2. 起動処理 ---
async function init() {
    const container = document.getElementById('single-thread-container');
    if (!container) return;
    if (!supabaseClient) {
        container.innerHTML = `<div class="aa" style="border:2px solid red; padding:15px;"><h3 style="color:red; margin-top:0;">⚠️ 接続エラー</h3><p>config.jsを確認してください。</p></div>`;
        return;
    }
    if (!threadId) {
        container.innerHTML = "IDが指定されていません。";
        return;
    }

    try {
        const { data: thread, error } = await supabaseClient
            .from('threads').select('*').eq('id', threadId).maybeSingle();

        if (error) throw error;
        if (!thread) {
            container.innerHTML = "スレッドが存在しません。";
            return;
        }

        currentThreadData = thread;
        renderPage(thread);
        await loadPosts();

        // リアルタイム監視を開始（常に実行）
        startRealtimeMonitor();
        
    } catch (e) {
        container.innerHTML = "接続エラー: " + escapeHTML(e.message);
    }
}

// --- 3. 画面の土台表示 ---
function renderPage(thread) {
    const container = document.getElementById('single-thread-container');
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    const safeTitle = escapeHTML(thread.title);

    let formHTML = '';
    if (thread.is_admin_thread && !isAdmin) {
        formHTML = `<div style="background:#eee; padding:15px; text-align:center; margin-bottom:20px;">📢 運営専用スレッドです</div>`;
    } else {
        const adminToggle = isAdmin ? `<label style="color:#ff4757; font-size:12px;"><input type="checkbox" id="admin-mode"> 管理者として投稿</label><br>` : '';
        const savedDisplayName = escapeHTML(localStorage.getItem('user_display_name') || '');
        
        formHTML = `
            <div style="background:#f4f4f4; padding:15px; border:1px solid #ccc; margin-bottom:20px; border-radius:10px;">
                <form id="reply-form">
                    <input type="text" id="res-name" value="${savedDisplayName}" placeholder="名前" style="margin-bottom:5px;"><br>
                    <input type="text" id="honey-pot" style="display:none !important;" tabindex="-1" autocomplete="off">
                    ${adminToggle}
                    <textarea id="res-content" placeholder="内容を入力してください" required style="width:95%; height:60px; margin-top:5px;"></textarea><br>
                    <button type="submit" id="submit-btn" style="margin-top:5px; padding:5px 20px;">書き込む</button>
                </form>
            </div>`;
    }

    container.innerHTML = `
        <div class="aa">
            <h2 style="color:${thread.is_admin_thread ? '#ff4757' : 'inherit'}; border-bottom:2px solid #ddd; padding-bottom:5px;">
                ${thread.is_admin_thread ? '📌' : ''} ${safeTitle}
            </h2>
            <div style="text-align:right; margin-bottom:10px;">
                <button onclick="toggleNotification()" id="notify-btn" style="font-size:11px; padding:3px 10px; cursor:pointer; background:#fff; border:1px solid #ddd; border-radius:20px;">🔔 通知設定中...</button>
            </div>
            ${formHTML}
            <div id="res-list">読み込み中...</div>
            <p style="text-align:center; margin-top:20px;"><a href="index.html">【トップに戻る】</a></p>
        </div>`;

    if (document.getElementById('reply-form')) {
        document.getElementById('reply-form').addEventListener('submit', handlePost);
    }
    updateNotifyButton();
}

// --- 4. レス一覧の取得 ---
async function loadPosts() {
    const listArea = document.getElementById('res-list');
    const isAdmin = localStorage.getItem('is_admin') === 'true'; 
    if (!listArea || !currentThreadData || !supabaseClient) return;

    try {
        const { data: posts, error } = await supabaseClient
            .from('posts').select('*').eq('thread_id', threadId).order('created_at', { ascending: false });

        if (error) throw error;

        const ownerItem = {
            name: currentThreadData.name || "名無しさん",
            content: currentThreadData.content || "",
            created_at: currentThreadData.created_at,
            user_id_display: "OWNER", 
            is_real_owner: true, 
            id: 'THREAD_ROOT' 
        };

        const allItems = [...(posts || []), ownerItem];

        listArea.innerHTML = allItems.map((p, index) => {
            const num = allItems.length - index;
            const isAdmPost = p.is_admin_only === true;
            const style = isAdmPost ? 'background:#fff5f5; border-left:5px solid #ff4757;' : 'border-bottom:1px solid #eee;';
            const nameColor = p.is_real_owner ? 'red' : '#2ed573';

            let deleteBtn = '';
            if (isAdmin && p.id !== 'THREAD_ROOT') {
                deleteBtn = `<button onclick="deletePost(${p.id})" style="color:red; font-size:10px; margin-left:10px; cursor:pointer; background:white; border:1px solid red; border-radius:3px; padding:2px 5px;">削除 🗑️</button>`;
            }

            return `
                <div style="padding:10px; margin-bottom:5px; ${style}">
                    <div style="font-size:12px; color:#666;">
                        <b>${num}</b> : <span style="color:${nameColor}; font-weight:bold;">${escapeHTML(p.name)}</span>
                        [${new Date(p.created_at).toLocaleString()}] ID:${escapeHTML(p.user_id_display || '???')}
                        ${deleteBtn}
                    </div>
                    <div style="margin-top:5px; white-space:pre-wrap;">${isAdmPost ? '<b>【運営】</b>' : ''}${escapeHTML(p.content)}</div>
                </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

// --- 5. 投稿処理 (Bot対策) ---
async function handlePost(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const content = document.getElementById('res-content').value.trim();
    const name = document.getElementById('res-name').value.trim() || "名無しさん";
    const honey = document.getElementById('honey-pot').value;
    const adminMode = document.getElementById('admin-mode');

    if (honey || !content || !supabaseClient) return;
    if (content === lastPostContent) { alert("同じ内容は連投できません。"); return; }

    btn.disabled = true;
    btn.innerText = "送信中...";

    const myID = (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : "ID:" + Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error } = await supabaseClient.from('posts').insert([{
        thread_id: threadId, name: name, content: content,
        user_id_display: myID, is_admin_only: adminMode ? adminMode.checked : false
    }]);

    if (error) {
        alert("失敗: " + error.message);
        btn.disabled = false;
        btn.innerText = "書き込む";
    } else {
        lastPostContent = content;
        document.getElementById('res-content').value = "";
        localStorage.setItem('user_display_name', name);
        
        let timer = 5;
        const interval = setInterval(() => {
            timer--;
            btn.innerText = `待機(${timer})`;
            if (timer <= 0) { clearInterval(interval); btn.disabled = false; btn.innerText = "書き込む"; }
        }, 1000);
    }
}

// --- 6. リアルタイム監視 (最強版) ---
function startRealtimeMonitor() {
    if (!supabaseClient) return;

    // もし既存のチャンネルがあれば解除して作り直す
    supabaseClient.channel(`thread-${threadId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'posts', 
            filter: `thread_id=eq.${threadId}` 
        }, (payload) => {
            // 1. データを再読み込み
            loadPosts(); 

            // 2. ブラウザ通知 (設定オンの場合のみ)
            const isNotify = localStorage.getItem('notify_enabled') === 'true';
            if (isNotify && Notification.permission === "granted") {
                new Notification(`新着: ${escapeHTML(currentThreadData.title)}`, {
                    body: `${payload.new.name}: ${payload.new.content}`
                });
            }
        })
        .subscribe((status) => {
            console.log("リアルタイム接続状態:", status);
        });
}

// --- 7. その他機能 ---
window.deletePost = async function(postId) {
    if (!confirm("削除しますか？") || !supabaseClient) return;
    await supabaseClient.from('posts').delete().eq('id', postId);
    loadPosts(); // 削除時も一覧を更新
};

window.toggleNotification = function() {
    if (!("Notification" in window)) return alert("非対応です");
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(p => { if(p==="granted"){ localStorage.setItem('notify_enabled','true'); updateNotifyButton(); startRealtimeMonitor(); } });
        return;
    }
    const enabled = localStorage.getItem('notify_enabled') === 'true';
    localStorage.setItem('notify_enabled', !enabled);
    updateNotifyButton();
};

function updateNotifyButton() {
    const btn = document.getElementById('notify-btn');
    if (!btn) return;
    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    if (Notification.permission === "granted" && isEnabled) {
        btn.innerHTML = "🔔 通知：オン"; btn.style.background = "#e1ffed"; btn.style.color = "#2ed573";
    } else {
        btn.innerHTML = "🔕 通知：オフ"; btn.style.background = "#fff5f5"; btn.style.color = "#ff4757";
    }
}

document.addEventListener('DOMContentLoaded', init);