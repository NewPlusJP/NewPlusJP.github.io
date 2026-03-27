<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>新規登録 - NewPlusJP</title>
  <style>
    body { font-family: sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding-top: 50px; }
    .auth-card { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 300px; text-align: center; }
    input { width: 90%; padding: 10px; margin: 10px 0; border-radius: 10px; border: 1px solid #ddd; }
    .btn-signup { width: 100%; padding: 12px; border-radius: 10px; border: none; cursor: pointer; font-weight: bold; background: #ff4757; color: white; }
    .link-text { display: block; margin-top: 15px; font-size: 0.8em; color: #555; text-decoration: none; }
    .link-text:hover { text-decoration: underline; }
    .rule-text { font-size: 0.8em; color: #666; margin: 15px 0; line-height: 1.5; }
    .rule-link { color: #ff4757; text-decoration: none; font-weight: bold; }
    .rule-link:hover { text-decoration: underline; }
  </style>
</head>
<body>

<div class="auth-card">
  <h2>アカウント作成</h2>
  
  <input type="text" id="username" placeholder="使いたいユーザー名">
  <input type="password" id="password" placeholder="パスワード">

  <p class="rule-text">
    アカウントを作成すると<br>
    <a href="https://newplusjp.github.io/rule" target="_blank" class="rule-link">利用規約</a>
    に同意したことになります。
  </p>

  <button class="btn-signup" onclick="handleSignUp()">同意して登録する</button>
  
  <a href="login.html" class="link-text">すでにアカウントを持っている</a>
  <a href="index.html" class="link-text">トップに戻る</a>
</div>

<script src="https://unpkg.com/@supabase/supabase-js@2"></script>

<script>
  // 設定
  const SUPABASE_URL = "https://ezishztrukqnrqsvaeur.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6aXNoenRydWtxbnJxc3ZhZXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY3MzIsImV4cCI6MjA5MDA5MjczMn0.u9rkxviylgWDoI3-FExNq1EPOT_NNNNuwkLT2FLRKUU";
  
  // クライアント作成
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function handleSignUp() {
    try {
      const user = document.getElementById('username').value.trim();
      const pass = document.getElementById('password').value.trim();

      if (!user || !pass) {
        alert("名前とパスワードを入力してください");
        return;
      }

      console.log("登録チェック開始:", user);

      // 1. 重複チェック ('user_accounts' を引用符で囲む)
      const { data: exist, error: checkError } = await supabase
        .from('user_accounts')
        .select('username')
        .eq('username', user)
        .maybeSingle();

      if (checkError) {
        console.error("チェックエラー:", checkError);
      }

      if (exist) {
        alert("その名前はすでに使われています");
        return;
      }

      // 2. 登録実行
      const { error: insError } = await supabase
        .from('user_accounts')
        .insert([{ username: user, password: pass }]);

      if (insError) {
        alert("登録エラー: " + insError.message);
      } else {
        alert("登録完了！ログイン画面へ移動します");
        window.location.href = "login.html";
      }

    } catch (e) {
      console.error("システムエラー:", e);
      alert("予期せぬエラーが発生しました");
    }
  }
</script>

</body>
</html>