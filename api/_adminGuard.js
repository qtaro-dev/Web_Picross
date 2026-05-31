const { createClient } = require('@supabase/supabase-js');

const PLACEHOLDER_VALUES = new Set([
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY',
  'YOUR_SUPABASE_PUBLISHABLE_KEY',
  'YOUR_SUPABASE_SECRET_KEY',
]);

function readEnv(){
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { supabaseUrl, publishableKey, secretKey };
}

function isPlaceholder(value){
  return PLACEHOLDER_VALUES.has(String(value || '').trim());
}

function json(res, status, body){
  return res.status(status).json(body);
}

function bearerToken(req){
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function createUserClient(supabaseUrl, publishableKey, token){
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createSecretClient(){
  const { supabaseUrl, secretKey } = readEnv();
  if(!supabaseUrl || !secretKey || isPlaceholder(supabaseUrl) || isPlaceholder(secretKey)){
    throw Object.assign(new Error('SUPABASE_SECRET_KEY が未設定です'), { status: 503 });
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(req){
  const { supabaseUrl, publishableKey } = readEnv();
  if(!supabaseUrl || !publishableKey || isPlaceholder(supabaseUrl) || isPlaceholder(publishableKey)){
    throw Object.assign(new Error('Supabase公開設定が未設定です'), { status: 503 });
  }
  const token = bearerToken(req);
  if(!token) throw Object.assign(new Error('Authorization Bearer token が必要です'), { status: 401 });
  const client = createUserClient(supabaseUrl, publishableKey, token);
  const { data:userData, error:userError } = await client.auth.getUser(token);
  if(userError || !userData?.user?.id){
    throw Object.assign(new Error('ログイン状態を確認できません'), { status: 401 });
  }
  const { data:profile, error:profileError } = await client
    .from('profiles')
    .select('id, role, account_status')
    .eq('id', userData.user.id)
    .maybeSingle();
  if(profileError) throw Object.assign(new Error('管理者権限を確認できません'), { status: 403 });
  if(!profile || profile.id !== userData.user.id || profile.role !== 'admin' || profile.account_status === 'disabled'){
    throw Object.assign(new Error('管理者専用です'), { status: 403 });
  }
  return { user:userData.user, profile, token };
}

async function guarded(req, res, handler){
  try{
    const context = await requireAdmin(req);
    return handler(context);
  }catch(error){
    const status = Number(error.status || 500);
    return json(res, status, { ok:false, message:error.message || '管理者APIエラー' });
  }
}

module.exports = {
  createSecretClient,
  guarded,
  json,
  requireAdmin,
};
