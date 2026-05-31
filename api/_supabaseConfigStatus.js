const PLACEHOLDER_VALUES = new Set([
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY',
  'YOUR_SUPABASE_PUBLISHABLE_KEY',
]);

function readSupabasePublicConfig(env = process.env){
  const supabaseUrl = String(env.SUPABASE_URL || '').trim();
  const publishableRaw = String(env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const legacyAnonRaw = String(env.SUPABASE_ANON_KEY || '').trim();
  const supabasePublishableKey = publishableRaw || legacyAnonRaw;
  const urlOk = Boolean(supabaseUrl && !PLACEHOLDER_VALUES.has(supabaseUrl));
  const keyOk = Boolean(supabasePublishableKey && !PLACEHOLDER_VALUES.has(supabasePublishableKey));
  return {
    supabaseUrl,
    supabasePublishableKey,
    supabaseAnonKey: supabasePublishableKey,
    configured: Boolean(urlOk && keyOk),
    status: {
      urlOk,
      publishableKeyOk: keyOk,
      legacyAnonKey: !publishableRaw && legacyAnonRaw && !PLACEHOLDER_VALUES.has(legacyAnonRaw) ? '使用中' : '未使用',
    },
  };
}

function publicConfigJson(env = process.env){
  const config = readSupabasePublicConfig(env);
  return {
    supabaseUrl: config.supabaseUrl,
    supabasePublishableKey: config.supabasePublishableKey,
    supabaseAnonKey: config.supabaseAnonKey,
    configured: config.configured,
  };
}

function maskKey(value){
  const key = String(value || '').trim();
  if(!key) return '未設定';
  if(key.length <= 18) return `${key.slice(0, 6)}...`;
  return `${key.slice(0, 18)}...${key.slice(-8)}`;
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function statusBadge(ok, okText = 'OK', ngText = 'NG'){
  return `<span class="status-badge ${ok ? 'is-ok' : 'is-ng'}">${ok ? okText : ngText}</span>`;
}

function row(label, stateHtml, value){
  return `<tr><th>${escapeHtml(label)}</th><td>${stateHtml}</td><td>${escapeHtml(value)}</td></tr>`;
}

function renderConfigStatusHtml(env = process.env){
  const config = readSupabasePublicConfig(env);
  const rows = [
    row('SUPABASE_URL', statusBadge(config.status.urlOk), config.status.urlOk ? config.supabaseUrl : '未設定または雛形値です'),
    row('SUPABASE_PUBLISHABLE_KEY', statusBadge(config.status.publishableKeyOk), config.status.publishableKeyOk ? maskKey(config.supabasePublishableKey) : '未設定または雛形値です'),
    row('SUPABASE_ANON_KEY互換', `<span class="status-badge is-neutral">${escapeHtml(config.status.legacyAnonKey)}</span>`, config.status.legacyAnonKey === '使用中' ? '旧名の環境変数から読み込んでいます' : '新規設定では使用しません'),
    row('SUPABASE_SECRET_KEY', '<span class="status-badge is-neutral">非表示</span>', 'サーバー専用 / ブラウザには表示しません'),
    row('configured', statusBadge(config.configured), String(config.configured)),
  ].join('');
  const summary = config.configured ? 'Supabase接続設定: OK' : 'Supabase接続設定: 未設定または不足';
  const summaryClass = config.configured ? 'is-ok' : 'is-ng';
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supabase設定確認</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #000; color: #fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans JP', sans-serif; line-height: 1.6; }
    main { width: min(920px, 94vw); margin: 0 auto; padding: 32px 0 48px; }
    h1 { margin: 0 0 16px; font-size: 30px; letter-spacing: 0; text-align: center; }
    .summary { border: 1px solid #444; border-radius: 10px; background: rgba(10,10,10,.94); padding: 14px 16px; text-align: center; font-weight: 800; margin-bottom: 16px; }
    .summary.is-ok { border-color: #3d8f5b; color: #b7ffd2; }
    .summary.is-ng { border-color: #8f3d3d; color: #ffb4ae; }
    .panel { border: 1px solid #444; border-radius: 10px; background: rgba(10,10,10,.94); padding: 14px; overflow: auto; }
    table { width: 100%; min-width: 680px; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 10px 12px; text-align: left; vertical-align: middle; }
    th { width: 240px; background: #111; color: #fff; }
    td { color: #ddd; overflow-wrap: anywhere; }
    .status-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 76px; padding: 4px 10px; border: 1px solid #555; border-radius: 999px; background: #111; color: #ddd; font-weight: 800; }
    .status-badge.is-ok { border-color: #3d8f5b; background: rgba(16, 72, 38, .72); color: #b7ffd2; }
    .status-badge.is-ng { border-color: #8f3d3d; background: rgba(70, 12, 12, .78); color: #ffb4ae; }
    .status-badge.is-neutral { border-color: #555; background: #151515; color: #ddd; }
    .note { margin-top: 14px; color: #bbb; font-size: 14px; }
    .actions { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; }
    a.button { display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border: 2px solid #666; border-radius: 10px; background: #111; color: #fff; text-decoration: none; font-weight: 700; }
    a.button:hover { border-color: #42a5f5; box-shadow: 0 0 0 3px rgba(66,165,245,.35) inset; }
  </style>
</head>
<body>
  <main>
    <h1>Supabase設定確認</h1>
    <div class="summary ${summaryClass}">${escapeHtml(summary)}</div>
    <section class="panel">
      <table>
        <thead><tr><th>項目</th><th>状態</th><th>表示内容</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">このページは人間向けの確認表示です。アプリ本体は <code>/api/supabase-config</code> のJSONを使用します。secret key、DB password、JWT secretの値は表示しません。</p>
    </section>
    <div class="actions">
      <a class="button" href="/">トップへ戻る</a>
      <a class="button" href="/api/supabase-config">JSON APIを確認</a>
    </div>
  </main>
</body>
</html>`;
}

module.exports = {
  publicConfigJson,
  renderConfigStatusHtml,
};
