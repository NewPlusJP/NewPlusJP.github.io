// --- 0. 追跡防止・ロードチェック ---
if (typeof window.supabase === 'undefined') {
    console.error("Supabase library blocked by browser tracking prevention.");
}

// --- 1. 初期化 ---
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');
let currentThreadData = null;

// --- 【重要】エスケープ関数 ---
function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

// --- 2. 起動処理 ---
async function init() {
    const container = document.getElementById('single-thread-container');
    if (!container) return;

    if (!supabaseClient) {
        container.innerHTML = `<div class="aa" style="border:2px solid red; padding:15px;"><h3 style="color:red; margin-top:0;">⚠️ 接続遮断</h3><p>追跡防止機能をオフにしてください。</p></div>`;
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

        if (Notification.permission === "granted") {
            startRealtimeMonitor();
        }
    } catch (e) {
        container.innerHTML = "接続エラー: " + escapeHTML(e.message);
    }
}

// --- 3. 画面の土台表示 ---
function renderPage(thread) {
    const container = document.getElementById('single-thread-container');
    const isAdmin = localStorage.getItem('is_admin') === 'true';

    // タイトルのエスケープ
    const safeTitle = escapeHTML(thread.title);

    let formHTML = '';
    if (thread.is_admin_thread && !isAdmin) {
        formHTML = `<div style="background:#eee; padding:15px; text-align:center; margin-bottom:20px;">📢 運営専用スレッドです</div>`;
    } else {
        const adminToggle = isAdmin ? `<label style="color:#ff4757; font-size:12px;"><input type="checkbox" id="admin-mode"> 管理者として投稿</label><br>` : '';
        // ユーザー表示名の取得とエスケープ
        const savedDisplayName = escapeHTML(localStorage.getItem('user_display_name') || '');
        
        formHTML = `
            <div style="background:#f4f4f4; padding:15px; border:1px solid #ccc; margin-bottom:20px; border-radius:10px;">
                <form id="reply-form">
                    <input type="text" id="res-name" value="${savedDisplayName}" placeholder="名前" style="margin-bottom:5px;"><br>
                    ${adminToggle}
                    <textarea id="res-content" placeholder="内容を入力してください" required style="width:95%; height:60px; margin-top:5px;"></textarea><br>
                    <button type="submit" id="submit-btn" style="margin-top:5px; padding:5px 20px;">書き込む</button>
                </form>
            </div>`;
    }

    const notifyBtn = `
        <div style="text-align:right; margin-bottom:10px;">
            <button onclick="toggleNotification()" id="notify-btn" style="font-size:11px; padding:3px 10px; cursor:pointer; background:#fff; border:1px solid #ddd; border-radius:20px;">
                🔔 通知設定中...
            </button>
        </div>`;

    container.innerHTML = `
        <div class="aa">
            <h2 style="color:${thread.is_admin_thread ? '#ff4757' : 'inherit'}; border-bottom:2px solid #ddd; padding-bottom:5px;">
                ${thread.is_admin_thread ? '📌' : ''} ${safeTitle}
            </h2>
            ${notifyBtn}
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

        // オーナー（スレ主）のデータもエスケープ対象
        const ownerItem = {
            name: currentThreadData.name || "名無しさん",
            content: currentThreadData.content || "",
            created_at: currentThreadData.created_at,
            user_id_display: "OWNER",
            is_owner: true,
            id: null
        };

        const allItems = [...(posts || []), ownerItem];
        listArea.innerHTML = allItems.map((p, index) => {
            const num = allItems.length - index;
            const isAdm = p.is_admin_only === true;
            const style = isAdm ? 'background:#fff5f5; border-left:5px solid #ff4757;' : 'border-bottom:1px solid #eee;';
            
            // 安全な名前と内容
            const safeName = escapeHTML(p.name);
            const safeContent = escapeHTML(p.content);
            const safeIDDisp = escapeHTML(p.user_id_display || '???');
            
            const deleteBtn = (isAdmin && !p.is_owner) ? `<button onclick="deletePost(${p.id})" style="color:red; font-size:10px; margin-left:10px; cursor:pointer; background:none; border:1px solid red; border-radius:3px; padding:2px 5px;">[削除]</button>` : '';

            return `
                <div style="padding:10px; margin-bottom:5px; ${style}">
                    <div style="font-size:12px; color:#666;">
                        <b>${num}</b> : <span style="color:${p.is_owner ? 'red' : 'green'}; font-weight:bold;">${safeName}</span>
                        [${new Date(p.created_at).toLocaleString()}] ID:${safeIDDisp}
                        ${deleteBtn}
                    </div>
                    <div style="margin-top:5px; white-space:pre-wrap;">${isAdm ? '<b>【運営】</b>' : ''}${safeContent}</div>
                </div>`;
        }).join('');
    } catch (e) { listArea.innerHTML = "エラー: " + escapeHTML(e.message); }
}

// --- 5. リアルタイム監視（通知もエスケープ） ---
function startRealtimeMonitor() {
    supabaseClient.channel(`thread-${threadId}`).on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'posts', filter: `thread_id=eq.${threadId}` 
    }, (payload) => {
        
        const isEnabled = localStorage.getItem('notify_enabled') === 'true';
        if (isEnabled && Notification.permission === "granted") {
            // 通知のテキストもエスケープ処理（※通知はHTML解釈されないことが多いですが念のため）
            new Notification(`新着: ${escapeHTML(currentThreadData.title)}`, { 
                body: `${escapeHTML(payload.new.name)}: ${escapeHTML(payload.new.content)}` 
            });
        }
        
        loadPosts(); 
    }).subscribe();
}

// --- 6. 通知・削除・投稿処理 ---
// (通知ボタン、通知更新、削除、投稿ハンドルは既存通り。ただし投稿時にIDをエスケープ)
window.toggleNotification = function() {
    if (!("Notification" in window)) return alert("非対応ブラウザです");
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                localStorage.setItem('notify_enabled', 'true');
                updateNotifyButton();
                startRealtimeMonitor();
            }
        });
        return;
    }
    const isNowEnabled = localStorage.getItem('notify_enabled') === 'true';
    localStorage.setItem('notify_enabled', !isNowEnabled);
    updateNotifyButton();
};

function updateNotifyButton() {
    const btn = document.getElementById('notify-btn');
    if (!btn) return;
    const isEnabled = localStorage.getItem('notify_enabled') === 'true';
    if (Notification.permission === "granted" && isEnabled) {
        btn.innerHTML = "🔔 通知：オン";
        btn.style.background = "#e1ffed"; btn.style.color = "#2ed573"; btn.style.borderColor = "#2ed573";
    } else {
        btn.innerHTML = "🔕 通知：オフ";
        btn.style.background = "#fff5f5"; btn.style.color = "#ff4757"; btn.style.borderColor = "#ff4757";
    }
}

window.deletePost = async function(postId) {
    if (!confirm("削除しますか？") || !supabaseClient) return;
    await supabaseClient.from('posts').delete().eq('id', postId);
    await loadPosts();
};

async function handlePost(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    const content = document.getElementById('res-content').value;
    const name = document.getElementById('res-name').value || "名無しさん";
    const adminMode = document.getElementById('admin-mode');
    if (!content.trim()) return;

    const myID = (localStorage.getItem('is_admin') === 'true') ? "ADMIN" : "ID:" + Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error } = await supabaseClient.from('posts').insert([{
        thread_id: threadId, name: name, content: content,
        user_id_display: myID, is_admin_only: adminMode ? adminMode.checked : false
    }]);

    if (error) alert("失敗: " + error.message);
    else {
        document.getElementById('res-content').value = "";
        // 名前を保存（次回のためにエスケープなしで保存してOK）
        localStorage.setItem('user_display_name', name);
    }
}

document.addEventListener('DOMContentLoaded', init);