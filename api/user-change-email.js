const { createSecretClient, guardedUser, json } = require('./_authGuard');

const REQUEST_TYPE = 'user_email_change';
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const EMAIL_MAX = 254;

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  return guardedUser(req, res, async ({ user, profile, token, supabaseUrl, publishableKey }) => {
    const body = await readBody(req);
    const newEmail = normalizeEmail(body?.newEmail);
    const validation = validateEmail(newEmail);
    if(validation) return json(res, 400, { ok:false, message:validation });
    const currentEmail = normalizeEmail(profile?.email || user?.email);
    if(currentEmail && newEmail === currentEmail){
      return json(res, 400, { ok:false, message:'現在のメールアドレスと同じです' });
    }

    const secretClient = createSecretClient();
    const logProfile = await ensureProfileForEmailChangeLog(secretClient, user, profile, currentEmail);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error:countError } = await secretClient
      .from('email_change_request_logs')
      .select('id', { count:'exact', head:true })
      .eq('target_user_id', user.id)
      .eq('request_type', REQUEST_TYPE)
      .gte('requested_at', windowStart);
    if(countError){
      console.error('email_change_request_logs count failed', safeDbError(countError));
      throw apiError('メールアドレス変更確認メール送信履歴の確認に失敗しました', 500, 'EMAIL_CHANGE_LOG_COUNT_FAILED');
    }
    if(Number(count || 0) >= RATE_LIMIT_MAX){
      return json(res, 429, { ok:false, code:'EMAIL_CHANGE_RATE_LIMITED', message:'メールアドレス変更確認メールの送信は1時間に5回までです。時間をおいて再度お試しください。' });
    }

    const appBaseUrl = normalizeAppBaseUrl(process.env.APP_BASE_URL);
    const updateResult = await requestSupabaseEmailChange({ supabaseUrl, publishableKey, token, newEmail, appBaseUrl });
    if(!updateResult.ok){
      console.info(`Supabase user email change failed: ${updateResult.message}`);
      throw apiError(localizeEmailChangeError(updateResult.message), 502, 'EMAIL_CHANGE_SEND_FAILED');
    }

    const now = new Date().toISOString();
    const logPayload = {
      target_user_id: logProfile.id,
      old_email: currentEmail || null,
      new_email: newEmail,
      requested_at: now,
      request_type: REQUEST_TYPE,
    };
    const { data:logRow, error:logError } = await secretClient
      .from('email_change_request_logs')
      .insert(logPayload)
      .select('id')
      .single();
    if(logError || !logRow?.id){
      console.error('email_change_request_logs insert failed', safeDbError(logError), { target_user_id:user.id, request_type:REQUEST_TYPE });
      throw apiError('メールアドレス変更確認メールの送信後、送信履歴の保存に失敗しました。時間をおいて再度お試しください。', 500, 'EMAIL_CHANGE_LOG_INSERT_FAILED');
    }

    return json(res, 200, {
      ok:true,
      message:'メールアドレス変更確認メールを送信しました。メール内のリンクを確認してください。',
      redirectTo: appBaseUrl || '',
    });
  });
};

async function ensureProfileForEmailChangeLog(client, user, profile, currentEmail){
  if(profile?.id) return profile;
  const fallbackUsername = safeUsername(user?.user_metadata?.username || user?.email || user?.id);
  const payload = {
    id: user.id,
    username: fallbackUsername,
    email: currentEmail || normalizeEmail(user?.email) || null,
    display_name: user?.user_metadata?.display_name || user?.user_metadata?.username || fallbackUsername,
    role: 'user',
  };
  const { data, error } = await client
    .from('profiles')
    .upsert(payload, { onConflict:'id' })
    .select('id, email')
    .maybeSingle();
  if(!error && data?.id) return data;
  const retryPayload = { ...payload, username:`user_${String(user.id).replace(/-/g, '').slice(0, 12)}` };
  const { data:retryData, error:retryError } = await client
    .from('profiles')
    .upsert(retryPayload, { onConflict:'id' })
    .select('id, email')
    .maybeSingle();
  if(retryError || !retryData?.id){
    console.error('profiles upsert for email change log failed', safeDbError(retryError || error), { user_id:user.id });
    throw apiError('メールアドレス変更確認メール送信履歴の保存準備に失敗しました', 500, 'EMAIL_CHANGE_PROFILE_UPSERT_FAILED');
  }
  return retryData;
}

function safeUsername(value){
  const base = String(value || 'user').trim().toLowerCase().replace(/@.*$/, '').replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return base || 'user';
}

function apiError(message, status, code){
  return Object.assign(new Error(message), { status, code });
}

function safeDbError(error){
  if(!error) return null;
  return {
    code: error.code || '',
    message: error.message || '',
    details: error.details || '',
    hint: error.hint || '',
  };
}

function normalizeEmail(value){
  return String(value || '').trim().toLowerCase();
}

async function requestSupabaseEmailChange({ supabaseUrl, publishableKey, token, newEmail, appBaseUrl }){
  const body = { email:newEmail };
  if(appBaseUrl) body.email_redirect_to = appBaseUrl;
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if(response.ok) return { ok:true };
  const data = await response.json().catch(()=>({}));
  return { ok:false, message:data.msg || data.message || `HTTP ${response.status}` };
}

function validateEmail(email){
  if(!email) return '新しいメールアドレスを入力してください';
  if(email.length > EMAIL_MAX) return `メールアドレスは${EMAIL_MAX}文字以内で入力してください`;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'メールアドレスの形式を確認してください';
  return '';
}

function localizeEmailChangeError(message){
  const text = String(message || '').toLowerCase();
  if(text.includes('rate limit') || text.includes('too many')) return '試行回数が多すぎます。しばらく待ってから再試行してください';
  if(text.includes('email') && (text.includes('invalid') || text.includes('valid'))) return 'メールアドレスの形式を確認してください';
  if(text.includes('already') || text.includes('registered') || text.includes('exists')) return 'このメールアドレスはすでに使用されています';
  return 'メールアドレス変更確認メールの送信に失敗しました。時間をおいて再度お試しください。';
}

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
