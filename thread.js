function generateID() {
  const date = new Date().toISOString().slice(0, 10); // 2026-03-27
  
  // ブラウザに保存されている「あなただけの鍵」を取得。なければ作る。
  let userSecret = localStorage.getItem('user_uuid_seed');
  if (!userSecret) {
    userSecret = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('user_uuid_seed', userSecret);
  }

  // 「日付」と「あなただけの鍵」を混ぜる
  const seed = date + userSecret;
  
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  
  // 8文字の英数字IDにする
  return Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
}