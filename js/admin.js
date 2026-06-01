import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const ADMIN_LIMIT = 100;

export function isAdminUser(user){
  return user?.source === 'supabase' && user?.role === 'admin' && user?.account_status !== 'disabled';
}

async function adminClient(){
  if(!(await isSupabaseConfigured())) return null;
  return getSupabaseClient();
}

function withProfile(rows, profiles){
  const map = new Map((profiles || []).map(profile => [profile.id, profile]));
  return (rows || []).map(row => ({ ...row, profile:map.get(row.user_id) || null }));
}

export async function loadAdminSnapshot(){
  const client = await adminClient();
  if(!client) return { available:false, profiles:[], progress:[], history:[], rankings:[], message:'Supabase未設定のため管理者機能は利用できません' };

  const { data:profiles, error:profileError } = await client
    .from('profiles')
    .select('id, username, display_name, email, role, account_status, disabled_at, disabled_reason, delete_request_count, delete_approved_count, delete_rejected_count, account_disabled_count, account_reactivated_count, last_delete_requested_at, last_disabled_at, last_reactivated_at, password_clear_required, password_clear_requested_at, password_clear_requested_by, password_clear_count, last_password_changed_at, created_at, updated_at')
    .order('created_at', { ascending:false })
    .limit(ADMIN_LIMIT);
  if(profileError) throw profileError;

  const { data:progress, error:progressError } = await client
    .from('user_progress')
    .select('user_id, puzzle_id, cleared, best_clear_time_ms, latest_clear_time_ms, clear_count, fail_count, giveup_count, hint_used_count, last_played_at, cleared_at')
    .order('last_played_at', { ascending:false })
    .limit(ADMIN_LIMIT);
  if(progressError) throw progressError;

  const { data:history, error:historyError } = await client
    .from('play_history')
    .select('id, user_id, puzzle_id, result, play_time_ms, hint_used_count, created_at')
    .order('created_at', { ascending:false })
    .limit(ADMIN_LIMIT);
  if(historyError) throw historyError;

  const { data:rankings, error:rankingError } = await client
    .from('ranking_records')
    .select('id, user_id, puzzle_id, difficulty, stage_no, clear_time_ms, created_at')
    .order('clear_time_ms', { ascending:true })
    .limit(ADMIN_LIMIT);
  if(rankingError) throw rankingError;

  const { data:deleteRequests, error:deleteRequestError } = await client
    .from('account_delete_requests')
    .select('id, user_id, username, display_name, email, status, requested_at, reviewed_at, reviewed_by, admin_note, created_at, updated_at')
    .order('requested_at', { ascending:false })
    .limit(ADMIN_LIMIT);

  return {
    available:true,
    profiles:profiles || [],
    progress:withProfile(progress || [], profiles || []),
    history:withProfile(history || [], profiles || []),
    rankings:withProfile(rankings || [], profiles || []),
    deleteRequests:deleteRequestError ? [] : withProfile(deleteRequests || [], profiles || []),
    deleteRequestError:deleteRequestError ? 'アカウント削除申請を取得できませんでした。RLSポリシーで管理者のselectが許可されているか確認してください。' : '',
  };
}

export async function checkAdminServerApi(){
  const client = await adminClient();
  if(!client) return { available:false, status:'unconfigured', message:'Supabase未設定' };
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if(!token) return { available:true, status:'unauthorized', message:'ログインセッションを確認できません' };
  try{
    const response = await fetch('/api/admin-auth-check', {
      method: 'GET',
      headers: { Authorization:`Bearer ${token}` },
    });
    const body = await response.json().catch(()=>({}));
    if(response.ok && body.admin) return { available:true, status:'ok', message:'利用可能', body };
    if(response.status === 401) return { available:true, status:'unauthorized', message:body.message||'未ログイン' };
    if(response.status === 403) return { available:true, status:'forbidden', message:body.message||'権限エラー' };
    if(response.status === 503) return { available:true, status:'unconfigured', message:body.message||'未設定' };
    return { available:true, status:'error', message:body.message||`HTTP ${response.status}` };
  }catch{
    return { available:true, status:'error', message:'管理者サーバーAPIに接続できません' };
  }
}

export async function requestAdminPasswordClearReset(userId){
  const client = await adminClient();
  if(!client) return { available:false };
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if(!token) throw new Error('ログインセッションを確認できません');
  const response = await fetch('/api/admin-reset-auth-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
  });
  const body = await response.json().catch(()=>({}));
  if(!response.ok || body.ok === false) throw new Error(body.message || `HTTP ${response.status}`);
  return { available:true, ...body };
}

export async function repairAdminAuthEmail(userId, newEmail){
  const client = await adminClient();
  if(!client) return { available:false };
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if(!token) throw new Error('ログインセッションを確認できません');
  const response = await fetch('/api/admin-update-auth-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, newEmail }),
  });
  const body = await response.json().catch(()=>({}));
  if(!response.ok || body.ok === false) throw new Error(body.message || `HTTP ${response.status}`);
  return { available:true, ...body };
}

export async function uploadAdminPuzzles({ difficulty, puzzles, dryRun = true }){
  const client = await adminClient();
  if(!client) return { available:false };
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if(!token) throw new Error('ログインセッションを確認できません');
  const response = await fetch('/api/admin-upload-puzzles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ difficulty, puzzles, dryRun }),
  });
  const body = await response.json().catch(()=>({}));
  if(!response.ok || body.ok === false){
    const detail = Array.isArray(body.errors) && body.errors.length ? `\n${body.errors.slice(0, 8).join('\n')}` : '';
    throw new Error((body.message || `HTTP ${response.status}`) + detail);
  }
  return { available:true, ...body };
}

export async function updateAdminProfile(id, patch){
  const client = await adminClient();
  if(!client) return { available:false };
  const payload = {
    display_name: String(patch.display_name || '').trim(),
    role: patch.role === 'admin' ? 'admin' : 'user',
  };
  const { error } = await client.from('profiles').update(payload).eq('id', id);
  if(error) throw error;
  return { available:true };
}

export async function updateAdminProgress(key, patch){
  const client = await adminClient();
  if(!client) return { available:false };
  const [userId, puzzleId] = String(key || '').split('|');
  const payload = {
    cleared: Boolean(patch.cleared),
    best_clear_time_ms: nullableNumber(patch.best_clear_time_ms),
    latest_clear_time_ms: nullableNumber(patch.latest_clear_time_ms),
    clear_count: integerNumber(patch.clear_count),
    fail_count: integerNumber(patch.fail_count),
    giveup_count: integerNumber(patch.giveup_count),
    hint_used_count: integerNumber(patch.hint_used_count),
  };
  const { error } = await client.from('user_progress').update(payload).eq('user_id', userId).eq('puzzle_id', puzzleId);
  if(error) throw error;
  return { available:true };
}

export async function updateAdminRanking(id, patch){
  const client = await adminClient();
  if(!client) return { available:false };
  const payload = {
    clear_time_ms: integerNumber(patch.clear_time_ms),
  };
  const { error } = await client.from('ranking_records').update(payload).eq('id', id);
  if(error) throw error;
  return { available:true };
}

export async function deleteAdminRanking(id){
  const client = await adminClient();
  if(!client) return { available:false };
  const { error } = await client.from('ranking_records').delete().eq('id', id);
  if(error) throw error;
  return { available:true };
}

export async function deleteAdminRankingsForUser(userId){
  const client = await adminClient();
  if(!client) return { available:false };
  const { error } = await client.from('ranking_records').delete().eq('user_id', userId);
  if(error) throw error;
  return { available:true };
}

export async function updateAccountDeleteRequest(id, patch, reviewerId){
  const client = await adminClient();
  if(!client) return { available:false };
  const status = ['approved', 'rejected'].includes(patch.status) ? patch.status : 'pending';
  const reviewedAt = new Date().toISOString();
  const payload = {
    status,
    admin_note: String(patch.admin_note || '').trim(),
    reviewed_at: reviewedAt,
    reviewed_by: reviewerId || null,
  };
  const { data:reviewed, error } = await client
    .from('account_delete_requests')
    .update(payload)
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, user_id, status')
    .maybeSingle();
  if(error) throw error;
  if(!reviewed) return { available:true, skipped:true };
  if(status === 'approved'){
    await updateProfileCounters(client, patch.user_id, {
      account_status: 'disabled',
      disabled_at: reviewedAt,
      disabled_reason: 'アカウント削除申請承認',
      delete_approved_count: 1,
      account_disabled_count: 1,
      last_disabled_at: reviewedAt,
    });
  }else if(status === 'rejected'){
    await updateProfileCounters(client, patch.user_id, {
      delete_rejected_count: 1,
    });
  }
  return { available:true };
}

export async function reactivateAdminUser(id){
  const client = await adminClient();
  if(!client) return { available:false };
  const reactedAt = new Date().toISOString();
  const { data:profile, error:profileError } = await client
    .from('profiles')
    .select('id, account_status, account_reactivated_count')
    .eq('id', id)
    .maybeSingle();
  if(profileError) throw profileError;
  if(!profile || profile.account_status !== 'disabled') return { available:true, skipped:true };
  await updateProfileCounters(client, id, {
    account_status: 'active',
    disabled_at: null,
    disabled_reason: null,
    account_reactivated_count: 1,
    last_reactivated_at: reactedAt,
  });
  return { available:true };
}

export async function markAdminPasswordClearRequired(id, requestedBy){
  const client = await adminClient();
  if(!client) return { available:false };
  const { data:profile, error:selectError } = await client
    .from('profiles')
    .select('id, password_clear_count')
    .eq('id', id)
    .maybeSingle();
  if(selectError) throw selectError;
  if(!profile) throw new Error('対象ユーザーが見つかりません');
  const { error } = await client
    .from('profiles')
    .update({
      password_clear_required: false,
      password_clear_requested_at: new Date().toISOString(),
      password_clear_requested_by: requestedBy || null,
      password_clear_count: Math.max(0, Number(profile.password_clear_count || 0) + 1),
    })
    .eq('id', id);
  if(error) throw error;
  return { available:true };
}

async function updateProfileCounters(client, id, patch){
  const counterKeys = ['delete_request_count', 'delete_approved_count', 'delete_rejected_count', 'account_disabled_count', 'account_reactivated_count'];
  const increments = Object.fromEntries(counterKeys.filter(key=>Object.prototype.hasOwnProperty.call(patch, key)).map(key=>[key, Number(patch[key]) || 0]));
  const payload = { ...patch };
  for(const key of counterKeys) delete payload[key];
  if(Object.keys(increments).length){
    const { data:profile, error:selectError } = await client
      .from('profiles')
      .select(counterKeys.join(', '))
      .eq('id', id)
      .maybeSingle();
    if(selectError) throw selectError;
    for(const [key, delta] of Object.entries(increments)){
      payload[key] = Math.max(0, Number(profile?.[key] || 0) + delta);
    }
  }
  const { error } = await client.from('profiles').update(payload).eq('id', id);
  if(error) throw error;
}

function nullableNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function integerNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
