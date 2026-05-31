const { createSecretClient, guarded, json } = require('./_adminGuard');

const EMAIL_MAX = 254;

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  return guarded(req, res, async ({ user:adminUser }) => {
    const body = await readBody(req);
    const userId = String(body?.userId || '').trim();
    const newEmail = normalizeEmail(body?.newEmail);
    if(!userId) return json(res, 400, { ok:false, message:'対象ユーザーが指定されていません。' });
    const validation = validateEmail(newEmail);
    if(validation) return json(res, 400, { ok:false, message:validation });

    const client = createSecretClient();
    const { data:target, error:targetError } = await client
      .from('profiles')
      .select('id, username, email')
      .eq('id', userId)
      .maybeSingle();
    if(targetError) throw apiError('対象ユーザーの確認に失敗しました。', 500, 'ADMIN_EMAIL_REPAIR_TARGET_SELECT_FAILED', targetError);
    if(!target) return json(res, 404, { ok:false, message:'対象ユーザーが見つかりません。' });
    const oldEmail = normalizeEmail(target.email);
    if(oldEmail && oldEmail === newEmail) return json(res, 400, { ok:false, message:'現在のメールアドレスと同じです。' });

    const { data:duplicate, error:duplicateError } = await client
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .neq('id', userId)
      .maybeSingle();
    if(duplicateError) throw apiError('メールアドレス重複確認に失敗しました。', 500, 'ADMIN_EMAIL_REPAIR_DUPLICATE_CHECK_FAILED', duplicateError);
    if(duplicate) return json(res, 409, { ok:false, message:'このメールアドレスはすでに別ユーザーで使用されています。' });

    const { error:authError } = await client.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });
    if(authError) throw apiError(localizeAuthEmailError(authError.message), 502, 'ADMIN_EMAIL_REPAIR_AUTH_UPDATE_FAILED', authError);

    const { error:profileError } = await client
      .from('profiles')
      .update({ email:newEmail })
      .eq('id', userId);
    if(profileError) throw apiError('profiles.email の更新に失敗しました。', 500, 'ADMIN_EMAIL_REPAIR_PROFILE_UPDATE_FAILED', profileError);

    const { error:logError } = await client
      .from('admin_email_repair_logs')
      .insert({
        target_user_id: userId,
        admin_user_id: adminUser.id,
        old_email: oldEmail || null,
        new_email: newEmail,
        reason: 'admin_email_repair',
      });
    if(logError) throw apiError('メール修復ログの保存に失敗しました。', 500, 'ADMIN_EMAIL_REPAIR_LOG_INSERT_FAILED', logError);

    return json(res, 200, { ok:true, message:'メールアドレスを修復しました。ユーザー情報を再読み込みしてください。' });
  });
};

function normalizeEmail(value){
  return String(value || '').trim().toLowerCase();
}

function validateEmail(email){
  if(!email) return 'メールアドレスを入力してください。';
  if(email.length > EMAIL_MAX) return `メールアドレスは${EMAIL_MAX}文字以内で入力してください。`;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'メールアドレスの形式を確認してください。';
  return '';
}

function localizeAuthEmailError(message){
  const text = String(message || '').toLowerCase();
  if(text.includes('already') || text.includes('registered') || text.includes('exists') || text.includes('duplicate')){
    return 'このメールアドレスはすでに別ユーザーで使用されています。';
  }
  if(text.includes('email') && (text.includes('invalid') || text.includes('valid'))){
    return 'メールアドレスの形式を確認してください。';
  }
  return 'Supabase Auth email の更新に失敗しました。';
}

function apiError(message, status, code, cause){
  if(cause) console.error(code, safeError(cause));
  return Object.assign(new Error(message), { status, code });
}

function safeError(error){
  return {
    code: error?.code || '',
    message: error?.message || '',
    details: error?.details || '',
    hint: error?.hint || '',
  };
}

async function readBody(req){
  if(req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}
