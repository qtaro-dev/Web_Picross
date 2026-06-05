const { createClient } = require('@supabase/supabase-js');
const { createSecretClient, json } = require('./_authGuard');

const USERNAME_PATTERN = /^[\p{L}\p{N}_-]+$/u;
const GENERIC_LOGIN_ERROR = 'ユーザー名またはパスワードを確認してください';
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const attempts = new Map();

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  const body = await readBody(req);
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  if(!username || username.length > 10 || !USERNAME_PATTERN.test(username)){
    return json(res, 400, { ok:false, message:GENERIC_LOGIN_ERROR });
  }
  if(!password){
    return json(res, 400, { ok:false, message:GENERIC_LOGIN_ERROR });
  }
  if(rateLimited(req, username)){
    return json(res, 429, { ok:false, message:GENERIC_LOGIN_ERROR });
  }
  try{
    const secretClient = createSecretClient();
    const { data:profile, error } = await secretClient
      .from('profiles')
      .select('id, username, email, display_name, role, account_status, disabled_at, disabled_reason, delete_request_count, delete_approved_count, delete_rejected_count, account_disabled_count, account_reactivated_count, last_delete_requested_at, last_disabled_at, last_reactivated_at, password_clear_required, password_clear_requested_at, password_clear_requested_by, password_clear_count, last_password_changed_at, created_at')
      .eq('username', username)
      .maybeSingle();
    if(error) throw error;
    const email = String(profile?.email || '').trim().toLowerCase();
    if(!email) return json(res, 401, { ok:false, message:GENERIC_LOGIN_ERROR });

    const authClient = createAuthClient();
    const { data:login, error:loginError } = await authClient.auth.signInWithPassword({ email, password });
    if(loginError){
      const text = String(loginError.message || '').toLowerCase();
      if(text.includes('email not confirmed') || text.includes('email_not_confirmed')){
        return json(res, 200, { ok:true, emailUnconfirmed:true });
      }
      return json(res, 401, { ok:false, message:GENERIC_LOGIN_ERROR });
    }
    if(!login?.session?.access_token || !login?.session?.refresh_token || !login?.user?.id){
      return json(res, 401, { ok:false, message:GENERIC_LOGIN_ERROR });
    }
    clearRateLimit(req, username);
    const safeProfile = await ensureProfile(secretClient, profile, login.user, username);
    return json(res, 200, {
      ok:true,
      session:{
        access_token: login.session.access_token,
        refresh_token: login.session.refresh_token,
        expires_at: login.session.expires_at || null,
        expires_in: login.session.expires_in || null,
        token_type: login.session.token_type || 'bearer',
      },
      user: publicProfile(safeProfile, login.user, username),
    });
  }catch(error){
    const status = Number(error.status || 500);
    return json(res, status === 503 ? 503 : 401, { ok:false, message:GENERIC_LOGIN_ERROR });
  }
};

function readAuthEnv(){
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if(!supabaseUrl || !publishableKey){
    throw Object.assign(new Error('Supabase公開設定が未設定です'), { status:503 });
  }
  return { supabaseUrl, publishableKey };
}

function createAuthClient(){
  const { supabaseUrl, publishableKey } = readAuthEnv();
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession:false, autoRefreshToken:false },
  });
}

async function ensureProfile(client, profile, authUser, username){
  if(profile?.id) return profile;
  const name = String(authUser?.user_metadata?.username || username || '').trim();
  const payload = {
    id: authUser.id,
    username: name,
    email: String(authUser.email || '').trim().toLowerCase(),
    display_name: name,
    role: 'user',
  };
  const { data, error } = await client
    .from('profiles')
    .upsert(payload, { onConflict:'id' })
    .select('id, username, display_name, role, account_status, disabled_at, disabled_reason, delete_request_count, delete_approved_count, delete_rejected_count, account_disabled_count, account_reactivated_count, last_delete_requested_at, last_disabled_at, last_reactivated_at, password_clear_required, password_clear_requested_at, password_clear_requested_by, password_clear_count, last_password_changed_at, created_at')
    .single();
  if(error) throw error;
  return data;
}

function publicProfile(profile, authUser, username){
  const name = profile?.username || username || 'user';
  return {
    id: authUser?.id || profile?.id || '',
    user_id: authUser?.id || profile?.id || '',
    username: name,
    display_name: profile?.display_name || name,
    role: profile?.role || 'user',
    account_status: profile?.account_status || 'active',
    disabled_at: profile?.disabled_at || '',
    disabled_reason: profile?.disabled_reason || '',
    delete_request_count: profile?.delete_request_count || 0,
    delete_approved_count: profile?.delete_approved_count || 0,
    delete_rejected_count: profile?.delete_rejected_count || 0,
    account_disabled_count: profile?.account_disabled_count || 0,
    account_reactivated_count: profile?.account_reactivated_count || 0,
    last_delete_requested_at: profile?.last_delete_requested_at || '',
    last_disabled_at: profile?.last_disabled_at || '',
    last_reactivated_at: profile?.last_reactivated_at || '',
    password_clear_required: Boolean(profile?.password_clear_required),
    password_clear_requested_at: profile?.password_clear_requested_at || '',
    password_clear_requested_by: profile?.password_clear_requested_by || '',
    password_clear_count: profile?.password_clear_count || 0,
    last_password_changed_at: profile?.last_password_changed_at || '',
    created_at: authUser?.created_at || profile?.created_at || '',
    last_sign_in_at: authUser?.last_sign_in_at || '',
    email_confirmed_at: authUser?.email_confirmed_at || authUser?.confirmed_at || '',
    emailConfirmed: Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at),
    source: 'supabase',
    loginSource: 'supabase',
  };
}

function rateLimited(req, username){
  const now = Date.now();
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  const key = `${ip}:${username.toLowerCase()}`;
  const current = attempts.get(key) || [];
  const recent = current.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
  if(recent.length >= RATE_LIMIT_MAX){
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

function clearRateLimit(req, username){
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  attempts.delete(`${ip}:${username.toLowerCase()}`);
}

async function readBody(req){
  if(req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let length = 0;
  for await (const chunk of req){
    length += chunk.length;
    if(length > 65536) throw Object.assign(new Error('body too large'), { status:413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}
