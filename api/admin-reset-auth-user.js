const { createSecretClient, guarded, json } = require('./_adminGuard');

const REQUEST_TYPE = 'admin_password_clear';
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  return guarded(req, res, async ({ user:adminUser }) => {
    const body = await readBody(req);
    const targetUserId = String(body?.userId || '').trim();
    if(!targetUserId) return json(res, 400, { ok:false, message:'対象ユーザーが指定されていません' });
    const appBaseUrl = normalizeAppBaseUrl(process.env.APP_BASE_URL);
    if(!appBaseUrl) return json(res, 503, { ok:false, message:'APP_BASE_URL が未設定のため、パスワード再設定メールを送信できません。' });
    const client = createSecretClient();
    const { data:target, error:targetError } = await client
      .from('profiles')
      .select('id, username, display_name, email, password_clear_count')
      .eq('id', targetUserId)
      .maybeSingle();
    if(targetError) throw Object.assign(new Error('対象ユーザーの確認に失敗しました'), { status:500 });
    if(!target) return json(res, 404, { ok:false, message:'対象ユーザーが見つかりません' });
    const email = String(target.email || '').trim();
    if(!email) return json(res, 400, { ok:false, message:'このユーザーにはメールアドレスが登録されていないため、パスワード再設定メールを送信できません。' });

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error:countError } = await client
      .from('password_reset_request_logs')
      .select('id', { count:'exact', head:true })
      .eq('target_user_id', targetUserId)
      .eq('request_type', REQUEST_TYPE)
      .gte('requested_at', windowStart);
    if(countError) throw Object.assign(new Error('パスワード再設定メール送信履歴の確認に失敗しました'), { status:500 });
    if(Number(count || 0) >= RATE_LIMIT_MAX){
      return json(res, 429, { ok:false, message:'このユーザーへのパスワード再設定メール送信は、1時間に5回までです。しばらく時間をおいてから再実行してください。' });
    }

    const { error:resetError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: appBaseUrl,
    });
    if(resetError) throw Object.assign(new Error('パスワード再設定メールの送信に失敗しました。送信回数と送信日時は更新していません。'), { status:502 });

    const now = new Date().toISOString();
    const { error:updateError } = await client
      .from('profiles')
      .update({
        password_clear_required: false,
        password_clear_requested_at: now,
        password_clear_requested_by: adminUser.id,
        password_clear_count: Math.max(0, Number(target.password_clear_count || 0) + 1),
      })
      .eq('id', targetUserId);
    if(updateError) throw Object.assign(new Error('パスワード再設定メール送信情報の更新に失敗しました'), { status:500 });

    const { error:logError } = await client
      .from('password_reset_request_logs')
      .insert({
        target_user_id: targetUserId,
        requested_by: adminUser.id,
        requested_at: now,
        request_type: REQUEST_TYPE,
      });
    if(logError) throw Object.assign(new Error('パスワード再設定メール送信履歴の保存に失敗しました'), { status:500 });

    return json(res, 200, { ok:true, message:'パスワード再設定メールを送信しました。対象ユーザーはメール内リンクから新しいパスワードを設定します。', redirectTo:appBaseUrl });
  });
};

function normalizeAppBaseUrl(value){
  const text = String(value || '').trim();
  if(!text) return '';
  try{
    const url = new URL(text);
    if(!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  }catch{
    return '';
  }
}

async function readBody(req){
  if(req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}
