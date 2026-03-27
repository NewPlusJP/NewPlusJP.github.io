<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>NewPlusJP</title>
  <meta name="description" content="NewPlusJPの掲示板だよ！">
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <header>
    <h1>NewPlusJP</h1>
  </header>

  <div class="aa">
    <h1>広告</h1>
    <div class="aa">
      <div id="onecolor">
        <h2>Newとは？</h2>
      </div>
      <p>Discordで活動している同盟のことです！<br>
      交流をメインとした同盟です！<br>
      <a href="https://Rousoku740.github.io/New">詳しくはこちらから</a></p>
    </div>
<div class="aa">
  <h2>公式コミュニティサーバーへのご案内</h2>
  <p>公式コミュニティサーバーではサイトの<B>アップデート</B>や<B>サイト利用規約</B>など重要な情報を見ることができます。</br>
  <B>サイト利用規約</B>などといったものはサイトを利用するうえで欠かせないものでありますので必ず参加お願いします。</p>
</div>

  </div>

  <section class="aa" id="admin-section">
    <div id="onecolor"><h2>管理者メニュー</h2></div>
    
    <div id="admin-auth-inputs">
      <input type="text" id="admin-user" placeholder="管理者ID" style="width: 150px;">
      <input type="password" id="admin-pass" placeholder="パスワード" style="width: 150px;">
      <button onclick="handleAdminLogin()" class="submit-btn" style="padding: 5px 15px;">ログイン</button>
    </div>

    <div id="admin-console" style="display:none;">
      <p>管理者：<strong id="admin-name"></strong> としてログイン中</p>
      <button onclick="handleAdminLogout()" class="submit-btn" style="background-color: #e74c3c;">ログアウト</button>
    </div>
  </section>


  <section class="aa" id="create-thread">
    <div id="onecolor">
      <h2>新規スレッドを作成する</h2>
    </div>
    <p>新しい話題を投稿しましょう。画像などはDiscordへ！</p>

    <form id="thread-form">
      <div class="form-group-inner">
        <label for="thread-title">スレッドタイトル</label>
        <input type="text" id="thread-title" placeholder="タイトルを入力してください" required>
      </div>

      <div class="form-group-inner">
        <label for="user-name">名前（省略可）</label>
        <input type="text" id="user-name" placeholder="名無しさん">
      </div>

      <div class="form-group-inner">
        <label for="content">本文</label>
        <textarea id="content" rows="8" placeholder="ここに内容を書き込んでください" required></textarea>
      </div>

      <button type="submit" class="submit-btn">スレッドを作成する</button>
    </form>
  </section>

    <section class="aa">
    <div id="onecolor">
      <h2>スレッド一覧</h2>
    </div>
    <div id="thread-container">
      <p>読み込み中...</p>
    </div>
  </section>

  <script src="config.js"></script>
  <script src="bbs.js"></script>

  <script>
    // Formspreeの設定
    if (typeof FORMSPREE_ID !== 'undefined') {
      document.getElementById('contact-form').action = "https://formspree.io/f/" + FORMSPREE_ID;
    }
  </script>
</body>
</html>