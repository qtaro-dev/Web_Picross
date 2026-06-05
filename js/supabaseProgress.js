import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { MODE_TO_DIFFICULTY } from './config.js';

function difficultyKey(game){
  return String(game?.difficulty || MODE_TO_DIFFICULTY[game?.mode] || game?.mode || 'custom').toLowerCase();
}

function stageNoFor(game){
  const stage = Number(game?.stageNo ?? game?.id);
  return Number.isFinite(stage) ? stage : null;
}

function playTimeMsFrom(entry){
  const value = entry?.latestPlayTimeMs ?? entry?.playTimeMs ?? entry?.clearTimeMs ?? entry?.latestFailTimeMs ?? entry?.latestGiveupTimeMs ?? null;
  return typeof value === 'number' ? Math.max(0, Math.floor(value)) : 0;
}

async function accessTokenFor(client){
  const { data, error } = await client.auth.getSession();
  if(error) throw error;
  return data?.session?.access_token || '';
}

function formatRankingRows(rows, profiles, currentUser){
  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
  const visibleRows = (rows || []).filter(row => profileMap.has(row.user_id));
  const ranked = visibleRows.map((row, index) => {
    const profile = profileMap.get(row.user_id) || {};
    const username = profile.display_name || profile.username || 'user';
    return {
      rank: index + 1,
      username,
      userId: row.user_id,
      puzzleId: row.puzzle_id,
      stageNo: row.stage_no,
      clearTimeMs: row.clear_time_ms,
      clearedAt: row.created_at,
    };
  });
  return ranked.slice(0, 100).map(row => ({ ...row, total: ranked.length }));
}

async function findPuzzle(client, game){
  const difficulty = difficultyKey(game);
  const stageNo = stageNoFor(game);
  if(!difficulty || !stageNo) return null;
  const { data, error } = await client
    .from('puzzles')
    .select('id, difficulty, stage_no, title')
    .eq('difficulty', difficulty)
    .eq('stage_no', stageNo)
    .maybeSingle();
  if(error) throw error;
  return data;
}

function progressPayload({ userId, puzzleId, type, entry, current, hintUsedCount }){
  const playTimeMs = playTimeMsFrom(entry);
  const old = current || {};
  const clearCount = (old.clear_count || 0) + (type === 'clear' ? 1 : 0);
  const failCount = (old.fail_count || 0) + (type === 'fail' ? 1 : 0);
  const giveupCount = (old.giveup_count || 0) + (type === 'giveup' ? 1 : 0);
  const bestClearTimeMs = type === 'clear'
    ? (typeof old.best_clear_time_ms === 'number' ? Math.min(old.best_clear_time_ms, playTimeMs) : playTimeMs)
    : old.best_clear_time_ms ?? null;
  return {
    user_id: userId,
    puzzle_id: puzzleId,
    cleared: Boolean(old.cleared || type === 'clear'),
    best_clear_time_ms: bestClearTimeMs,
    latest_clear_time_ms: type === 'clear' ? playTimeMs : old.latest_clear_time_ms ?? null,
    clear_count: clearCount,
    fail_count: failCount,
    giveup_count: giveupCount,
    hint_used_count: (old.hint_used_count || 0) + Math.max(0, Number(hintUsedCount || 0)),
    last_played_at: new Date().toISOString(),
    cleared_at: type === 'clear' ? new Date().toISOString() : old.cleared_at ?? null,
  };
}

export async function saveSupabaseGameResult({ user, game, entry, type, hintUsedCount = 0 }){
  if(user?.source !== 'supabase' || !user?.user_id || !entry) return { available:false };
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const puzzle = await findPuzzle(client, game);
  if(!puzzle) return { available:true, saved:false, reason:'puzzle_not_found' };

  const userId = user.user_id;
  const puzzleId = puzzle.id;
  const { data: current, error: currentError } = await client
    .from('user_progress')
    .select('cleared, best_clear_time_ms, latest_clear_time_ms, clear_count, fail_count, giveup_count, hint_used_count, cleared_at')
    .eq('user_id', userId)
    .eq('puzzle_id', puzzleId)
    .maybeSingle();
  if(currentError) throw currentError;

  const progress = progressPayload({ userId, puzzleId, type, entry, current, hintUsedCount });
  const { error: progressError } = await client
    .from('user_progress')
    .upsert(progress, { onConflict:'user_id,puzzle_id' });
  if(progressError) throw progressError;

  const playTimeMs = playTimeMsFrom(entry);
  const { error: historyError } = await client
    .from('play_history')
    .insert({
      user_id: userId,
      puzzle_id: puzzleId,
      result: type,
      play_time_ms: playTimeMs,
      hint_used_count: Math.max(0, Number(hintUsedCount || 0)),
    });
  if(historyError) throw historyError;

  let ranking = { saved:false, reason:'not_clear' };
  if(type === 'clear' && user.role !== 'admin'){
    ranking = await saveVerifiedRanking(client, {
      difficulty: difficultyKey(game),
      stageNo: stageNoFor(game),
      clearTimeMs: progress.best_clear_time_ms,
    });
  }

  return { available:true, saved:true, puzzleId, progress, ranking };
}

async function saveVerifiedRanking(client, payload){
  const token = await accessTokenFor(client);
  if(!token) return { saved:false, reason:'missing_session' };
  const response = await fetch('/api/save-ranking-record', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${token}`,
    },
    body:JSON.stringify(payload),
  });
  const body = await response.json().catch(()=>({}));
  if(!response.ok || body.ok === false){
    throw new Error(body.message || 'ランキング保存に失敗しました。');
  }
  return { saved:Boolean(body.saved), reason:body.reason || '', clearTimeMs:body.clearTimeMs };
}

export async function loadSupabaseRanking({ difficulty, currentUser } = {}){
  if(!(await isSupabaseConfigured())) return { available:false };
  const client = await getSupabaseClient();
  if(!client) return { available:false };
  const key = String(difficulty || 'beginner').toLowerCase();
  const { data: rows, error } = await client
    .from('ranking_records')
    .select('user_id, puzzle_id, difficulty, stage_no, clear_time_ms, created_at')
    .eq('difficulty', key)
    .order('clear_time_ms', { ascending:true })
    .order('created_at', { ascending:true })
    .limit(300);
  if(error) throw error;

  const ids = [...new Set((rows || []).map(row => row.user_id).filter(Boolean))];
  let profiles = [];
  if(ids.length){
    const { data: profileRows, error: profileError } = await client
      .from('public_profiles')
      .select('id, username, display_name')
      .in('id', ids);
    if(profileError) throw profileError;
    profiles = profileRows || [];
  }

  const rankings = formatRankingRows(rows || [], profiles, currentUser);
  const currentId = currentUser?.role === 'admin' ? '' : (currentUser?.user_id || currentUser?.id || '');
  const currentUserRanks = rankings
    .filter(row => currentId && row.userId === currentId)
    .map(row => ({
      stageNo: row.stageNo,
      rank: row.rank,
      total: row.total,
      clearTimeMs: row.clearTimeMs,
      clearedAt: row.clearedAt,
    }));
  return { available:true, ok:true, source:'supabase', difficulty:key, rankings, currentUserRanks };
}
