// --- 0. 起動チェック ---
if (typeof window.supabase === 'undefined') {
    console.error("Supabase library blocked.");
}

// --- 1. 初期化 ---
const supabaseClient = (window.supabase && typeof SUPABASE_URL !== 'undefined') 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

const urlParams = new URLSearchParams(window.location.search);
const threadId = urlParams.get('id');
let currentThreadData = null;
let lastPostContent = ""; 

// ブラウザ固有ID (UUID)
function getPermanentID() {
    if (localStorage.getItem('is_admin') === 'true') {
        return "ADMIN-" + localStorage.getItem('admin_name');
    }
    let myID = localStorage.getItem('user_permanent_id');
    if (!myID) {
        myID = "ID-" + crypto.randomUUID(); 
        localStorage.setItem('user_permanent_id', myID);
    }
    return myID;
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// --- 2. 起動処理 ---
async function init() {
    const container = document.getElementById('single-thread-container');
    if (!container || !supabaseClient || !threadId) return;

    try {
        const { data: thread, error } = await supabaseClient
            .from('threads').select('*').eq('id', threadId).maybeSingle();

        if (error || !thread) {
            container.innerHTML = "スレッドが存在しません。";
            return;
        }

        currentThreadData = thread;
        renderPage(thread);
        await loadPosts();
        startRealtimeMonitor();
    } catch (e) {
        container.innerHTML = "接続エラー: " + escapeHTML(e.message);
    }
}

// --- 3. 画面描画 ---
function renderPage(thread) {
    const container = document.getElementById('single-thread-container');
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    const safeTitle = escapeHTML(thread.title);

    let formHTML = '';
    if (thread.is_admin_thread && !isAdmin) {
        formHTML = `<div style="background:#eee; padding:15px; text-align:center; margin-bottom:20px; border-radius:10px;">📢 運営専用スレッドです</div>`;
    } else {
        const adminToggle = isAdmin ? `<label style="color:#ff4757; font-size:12px;"><input type="checkbox" id="admin-mode" checked> 管理者として投稿</label><br>` : '';
        const savedName = escapeHTML(localStorage.getItem('user_display_name') || '');
        
        formHTML = `
            <div style="background:#f4f4f4; padding:15px; border:1px solid #ccc; margin-bottom:20px; border-radius:10px;">
                <form id="reply-form">
                    <input type="text" id="res-name" value="${savedName}" placeholder="名前" style="margin-bottom:5px;"><br>
                    <input type="text" id="honey-pot" style="display:none !important;" tabindex="-1" autocomplete="off">
                    ${adminToggle}
                    <textarea id="res-content" placeholder="内容を入力してください" required style="width:95%; height:60px; margin-top:5px;"></textarea><br>
                    <button type="submit" id="submit-btn" style="margin-top:5px; padding:5px 20px; cursor:pointer;">書き込む</button>
                </form>
            </div>`;
    }

    container.innerHTML = `
        <div class="aa">
            <h2 style="color:${thread.is_admin_thread ? '#ff4757' : 'inherit'}; border-bottom:2px solid #ddd; padding-bottom:5px;">
                ${thread.is_admin_thread ? '📌' : ''} ${safeTitle}
            </h2>
            <div style="text-align:right; margin-bottom:10px;">
                <button onclick="toggleNotification()" id="notify-btn" style="font-size:11px; padding:3px 10px; cursor:pointer; background:#fff; border:1px solid #ddd; border-radius:20px;">通知設定</button>
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

// --- 4. レス一覧取得 (最新レスを一番上に固定する修正版) ---
async function loadPosts() {
    const listArea = document.getElementById('res-list');
    const isAdmin = localStorage.getItem('is_admin') === 'true'; 
    const myID = getPermanentID();
    if (!listArea || !currentThreadData) return;

    // 最新順（降順）で取得
    const { data: posts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true }); 

    if (error) {
        console.error("データ取得エラー:", error);
        return; // エラー時は上書きせず前の表示を維持
    }

    // --- A. まずスレ主（1番）のHTMLを作る ---
    const ownerHTML = `
        <div style="padding:10px; margin-bottom:5px; border-bottom:2px solid #ddd; background: #fffcf0;">
            <div style="font-size:12px; color:#666;">
                <b>1</b> : <span style="color:red; font-weight:bold;">${escapeHTML(currentThreadData.name || "名無しさん")}</span>
                [${new Date(currentThreadData.created_at).toLocaleString()}] ID:OWNER
            </div>
            <div style="margin-top:5px; white-space:pre-wrap;">${escapeHTML(currentThreadData.content)}</div>
        </div>`;

    // --- B. 次にレス（2番以降）のHTMLを生成 ---
    const postsHTML = (posts || []).map((p) => {
        // シャドウバン判定
        if (p.is_shadow_banned && p.user_id_display !== myID && !isAdmin) return '';

        const isAdmPost = p.is_admin_only === true;
        const shadowStyle = p.is_shadow_banned ? 'opacity: 0.5; border: 1px dashed gray;' : '';
        const style = isAdmPost ? 'background:#fff5f5; border-left:5px solid #ff4757;' : 'border-bottom:1px solid #eee;';

        let adminControls = '';
        if (isAdmin) {
            const banLabel = p.is_shadow_banned ? '解除 👻' : 'シャドウバン 👻';
            adminControls = `
                <button onclick="deletePost(event, ${p.id})" style="color:red; font-size:10px; margin-left:10px; cursor:pointer; background:white; border:1px solid red; border-radius:3px; padding:2px 5px;">削除</button>
                <button onclick="toggleShadowBan(event, ${p.id}, ${p.is_shadow_banned})" style="color:gray; font-size:10px; margin-left:5px; cursor:pointer; background:white; border:1px solid gray; border-radius:3px; padding:2px 5px;">${banLabel}</button>
            `;
        }

        return `
            <div style="padding:10px; margin-bottom:5px; ${style} ${shadowStyle}">
                <div style="font-size:12px; color:#666;">
                    <b>RES</b> : <span style="color:${isAdmPost ? 'red' : '#2ed573'}; font-weight:bold;">${escapeHTML(p.name)}</span>
                    [${new Date(p.created_at).toLocaleString()}] ID:${escapeHTML(p.user_id_display?.substring(0,11))}
                    ${p.is_shadow_banned ? '<b style="color:orange;">[隔離中]</b>' : ''}
                    ${adminControls}
                </div>
                <div style="margin-top:5px; white-space:pre-wrap;">${isAdmPost ? '<b>【運営】</b>' : ''}${escapeHTML(p.content)}</div>
            </div>`;
    }).join('');

    // スレ主(1番) + 最新レスの順で合体
    listArea.innerHTML = ownerHTML + postsHTML;
}

// --- 5. 投稿処理 (連投・待機) ---
async function handlePost(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const content = document.getElementById('res-content').value.trim();
    const name = document.getElementById('res-name').value.trim() || "名無しさん";
    const honey = document.getElementById('honey-pot').value;
    const adminMode = document.getElementById('admin-mode');

    if (honey || !content) return;
    if (content === lastPostContent) { alert("同じ内容は連投できません。"); return; }

    btn.disabled = true;
    btn.innerText = "送信中...";

    const { error } = await supabaseClient.from('posts').insert([{
        thread_id: threadId, name, content,
        user_id_display: getPermanentID(), 
        is_admin_only: adminMode ? adminMode.checked : false
    }]);

    if (error) {
        alert("失敗: " + error.message);
        btn.disabled = false; btn.innerText = "書き込む";
    } else {
        lastPostContent = content;
        document.getElementById('res-content').value = "";
        localStorage.setItem('user_display_name', name);
        let timer = 3; 
        const itv = setInterval(() => {
            timer--; btn.innerText = `待機(${timer})`;
            if (timer <= 0) { clearInterval(itv); btn.disabled = false; btn.innerText = "書き込む"; }
        }, 1000);
    }
}

// --- 6. リアルタイム監視 ---
function startRealtimeMonitor() {
    supabaseClient.channel(`thread-${threadId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `thread_id=eq.${threadId}` }, () => loadPosts())
        .subscribe();
}

// --- 7. 管理者機能 ---
window.toggleShadowBan = async function(event, postId, currentStatus) {
    if (!confirm(currentStatus ? "解除しますか？" : "シャドウバンしますか？")) return;
    const { error } = await supabaseClient.from('posts').update({ is_shadow_banned: !currentStatus }).eq('id', postId);
    if (error) { alert("権限エラーまたは接続失敗。"); return; }
    loadPosts();
};

window.deletePost = async function(event, postId) {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
    if (error) { alert("権限エラーまたは接続失敗。"); return; }
    loadPosts(); 
};

// --- その他通知系 ---
window.toggleNotification = function() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(p => { if(p==="granted"){ localStorage.setItem('notify_enabled','true'); updateNotifyButton(); } });
    } else {
        const en = localStorage.getItem('notify_enabled') === 'true';
        localStorage.setItem('notify_enabled', !en);
        updateNotifyButton();
    }
};

function updateNotifyButton() {
    const btn = document.getElementById('notify-btn');
    if (!btn) return;
    const en = localStorage.getItem('notify_enabled') === 'true';
    btn.innerHTML = (Notification.permission === "granted" && en) ? "🔔 通知：オン" : "🔕 通知：オフ";
    btn.style.background = en ? "#e1ffed" : "#fff5f5";
}

document.addEventListener('DOMContentLoaded', init);