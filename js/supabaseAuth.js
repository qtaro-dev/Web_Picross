import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const DEFAULT_ROLE = 'user';
const PROFILE_SELECT = 'id, username, email, display_name, role, account_status, disabled_at, disabled_reason, delete_request_count, delete_approved_count, delete_rejected_count, account_disabled_count, account_reactivated_count, last_delete_requested_at, last_disabled_at, last_reactivated_at, password_clear_required, password_clear_requested_at, password_clear_requested_by, password_clear_count, last_password_changed_at, created_at';

function normalizeUsername(username){
  return String(username || '').trim();
}

function normalizeEmail(email){
  return String(email || '').trim().toLowerCase();
}

function publicProfile(profile, authUser, username){
  const name = profile?.username || username || authUser?.email || 'user';
  return {
    id: authUser?.id || profile?.id || '',
    user_id: authUser?.id || profile?.id || '',
    username: name,
    email: profile?.email || authUser?.email || '',
    display_name: profile?.display_name || name,
    role: profile?.role || DEFAULT_ROLE,
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

function localizeAuthError(message){
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  if(!text) return 'Supabase認証に失敗しました';
  if(lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) return 'メールアドレスの確認が完了していません。確認メールを開いて登録を完了してください。';
  if(lower.includes('invalid login credentials')) return 'ユーザー名、メールアドレス、またはパスワードが違います';
  if(lower.includes('email') && (lower.includes('invalid') || lower.includes('valid'))) return 'メールアドレスの形式を確認してください';
  if(lower.includes('password') && (lower.includes('least') || lower.includes('short') || lower.includes('characters') || lower.includes('6'))) return 'パスワードは6文字以上で入力してください';
  if(lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user already registered') || lower.includes('already exists')) return 'このメールアドレスはすでに登録されています';
  if(lower.includes('rate limit') || lower.includes('too many')) return '試行回数が多すぎます。しばらく待ってから再試行してください';
  if(lower.includes('network') || lower.includes('failed to fetch') || lower.includes('fetch failed')) return '通信に失敗しました。接続状態を確認してください';
  return '認証に失敗しました。入力内容を確認してください';
}

function authError(message){
  return new Error(localizeAuthError(message));
}

async function getProfile(client, userId){
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if(error) throw authError(error.message);
  return data;
}

async function syncOwnProfileEmail(client, authUser, profile){
  const authEmail = normalizeEmail(authUser?.email);
  if(!authUser?.id || !authEmail || normalizeEmail(profile?.email)===authEmail) return profile;
  const { data, error } = await client
    .from('profiles')
    .update({ email:authEmail })
    .eq('id', authUser.id)
    .select(PROFILE_SELECT)
    .maybeSingle();
  if(error){
    console.info(`Supabase profile email sync skipped: ${error.message}`);
    return profile;
  }
  return data || profile;
}

async function clearLegacyPasswordClearRequired(client, authUser, profile){
  if(!authUser?.id || profile?.password_clear_required !== true) return profile;
  const { data, error } = await client
    .from('profiles')
    .update({ password_clear_required:false })
    .eq('id', authUser.id)
    .select(PROFILE_SELECT)
    .maybeSingle();
  if(error){
    console.info(`Supabase legacy password clear flag sync skipped: ${error.message}`);
    return { ...profile, password_clear_required:false };
  }
  return data || { ...profile, password_clear_required:false };
}

async function upsertProfile(client, authUser, username){
  const name = normalizeUsername(username);
  const payload = {
    id: authUser.id,
    username: name,
    email: normalizeEmail(authUser.email),
    display_name: name,
    role: DEFAULT_ROLE,
  };
  const { data, error } = await client
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select(PROFILE_SELECT)
    .single();
  if(error) throw authError(error.message);
  return data;
}

export async function isSupabaseAuthAvailable(){
  return isSupabaseConfigured();
}

export async function registerSupabaseUser(username, email, password){
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const cleanUsername = normalizeUsername(username);
  const cleanEmail = normalizeEmail(email);
  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        username: cleanUsername,
        display_name: cleanUsername,
      },
    },
  });
  if(error){
    console.info(`Supabase signup failed: ${error.message}`);
    throw authError(error.message);
  }
  if(data?.user && data?.session){
    const profile = await upsertProfile(client, data.user, cleanUsername);
    return { available:true, user:publicProfile(profile, data.user, cleanUsername), confirmationRequired:false };
  }
  return {
    available:true,
    user: null,
    confirmationRequired: true,
    profilePending: true,
  };
}

export async function loginSupabaseUser(email, password){
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const cleanEmail = normalizeEmail(email);
  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if(error){
    console.info(`Supabase login failed: ${error.message}`);
    throw authError(error.message);
  }
  if(!data.user?.email_confirmed_at && !data.user?.confirmed_at){
    await client.auth.signOut();
    return { available:true, emailUnconfirmed:true, user:null };
  }
  let profile = await getProfile(client, data.user.id);
  if(!profile) profile = await upsertProfile(client, data.user, data.user.user_metadata?.username || data.user.email);
  profile = await syncOwnProfileEmail(client, data.user, profile);
  profile = await clearLegacyPasswordClearRequired(client, data.user, profile);
  return { available:true, user:publicProfile(profile, data.user, profile?.username) };
}

export async function logoutSupabaseUser(){
  if(!(await isSupabaseConfigured())) return false;
  const client = await getSupabaseClient();
  if(!client) return false;
  await client.auth.signOut();
  return true;
}

export async function updateSupabasePassword(password){
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const { error } = await client.auth.updateUser({ password });
  if(error){
    console.info(`Supabase password update failed: ${error.message}`);
    throw authError(error.message);
  }
  return { available:true };
}

export async function updateSupabaseEmail(email){
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if(!token) throw new Error('ログイン状態を確認できません');
  const response = await fetch('/api/user-change-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newEmail:normalizeEmail(email) }),
  });
  const body = await response.json().catch(()=>({}));
  if(!response.ok || body.ok === false){
    throw new Error(body.message || 'メールアドレス変更確認メールの送信に失敗しました。時間をおいて再度お試しください。');
  }
  return { available:true, ...body };
}

export async function requestSupabasePasswordReset(email){
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email));
  if(error){
    console.info(`Supabase password reset request failed: ${error.message}`);
    throw new Error('パスワード再設定メールの送信に失敗しました。\n時間をおいて再度お試しください。');
  }
  return { available:true };
}

export async function resendSupabaseConfirmationEmail(email){
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const { error } = await client.auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
  });
  if(error){
    console.info(`Supabase confirmation resend failed: ${error.message}`);
    throw new Error('確認メールの再送に失敗しました。\n時間をおいて再度お試しください。');
  }
  return { available:true };
}

export async function beginSupabasePasswordRecovery(){
  const hash = globalThis.location?.hash || '';
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if(params.get('type') !== 'recovery') return { detected:false, valid:false };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  globalThis.history?.replaceState(null, globalThis.document?.title || '', `${globalThis.location.pathname}${globalThis.location.search}`);
  if(!accessToken || !refreshToken || !(await isSupabaseConfigured())) return { detected:true, valid:false };
  const client = await getSupabaseClient();
  if(!client) return { detected:true, valid:false };
  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return { detected:true, valid:!error };
}

export async function loadAccountDeleteRequest(user){
  if(user?.source !== 'supabase' || !user?.id) return { available:false, request:null };
  if(!(await isSupabaseConfigured())) return { available:false, request:null };
  const client = await getSupabaseClient();
  if(!client) return { available:false, request:null };
  const { data, error } = await client
    .from('account_delete_requests')
    .select('id, user_id, username, display_name, email, status, requested_at, reviewed_at, reviewed_by, admin_note, created_at, updated_at')
    .eq('user_id', user.id)
    .order('requested_at', { ascending:false })
    .limit(1);
  if(error) throw new Error('アカウント削除申請の状態取得に失敗しました');
  return { available:true, request:data?.[0] || null };
}

export async function submitAccountDeleteRequest(user){
  if(user?.source !== 'supabase' || !user?.id) return { available:false };
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const { data:pending, error:pendingError } = await client
    .from('account_delete_requests')
    .select('id, user_id, username, display_name, email, status, requested_at, reviewed_at, reviewed_by, admin_note, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if(pendingError) throw new Error('アカウント削除申請の確認に失敗しました');
  if(pending) return { available:true, duplicate:true, request:pending };
  const payload = {
    user_id: user.id,
    username: user.username || '',
    display_name: user.display_name || user.username || '',
    email: user.email || '',
    status: 'pending',
  };
  const { data, error } = await client
    .from('account_delete_requests')
    .insert(payload)
    .select('id, user_id, username, display_name, email, status, requested_at, reviewed_at, reviewed_by, admin_note, created_at, updated_at')
    .single();
  if(error) throw new Error('アカウント削除申請の保存に失敗しました。時間をおいて再度お試しください。');
  await incrementDeleteRequestCount(client, user.id, data.requested_at || new Date().toISOString());
  return { available:true, duplicate:false, request:data };
}

async function incrementDeleteRequestCount(client, userId, requestedAt){
  const { data:profile, error:selectError } = await client
    .from('profiles')
    .select('delete_request_count')
    .eq('id', userId)
    .maybeSingle();
  if(selectError) throw new Error('削除申請カウントの確認に失敗しました');
  const { error } = await client
    .from('profiles')
    .update({
      delete_request_count: Math.max(0, Number(profile?.delete_request_count || 0) + 1),
      last_delete_requested_at: requestedAt,
    })
    .eq('id', userId);
  if(error) throw new Error('削除申請カウントの更新に失敗しました');
}
