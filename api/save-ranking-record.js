const { createSecretClient, guardedUser, json } = require('./_authGuard');

const DIFFICULTIES = new Set(['beginner', 'easy', 'normal', 'hard', 'endless']);
const MIN_CLEAR_TIME_MS = 1000;

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  return guardedUser(req, res, async ({ user, profile }) => {
    const body = await readBody(req);
    if(profile?.role === 'admin'){
      return json(res, 200, { ok:true, saved:false, reason:'admin_skipped' });
    }

    const difficulty = normalizeDifficulty(body?.difficulty);
    const stageNo = integer(body?.stageNo);
    const clearTimeMs = integer(body?.clearTimeMs);
    if(!DIFFICULTIES.has(difficulty)){
      return json(res, 400, { ok:false, message:'難易度が正しくありません。' });
    }
    if(!stageNo || stageNo <= 0){
      return json(res, 400, { ok:false, message:'ステージ番号が正しくありません。' });
    }
    if(!clearTimeMs || clearTimeMs < MIN_CLEAR_TIME_MS){
      return json(res, 400, { ok:false, message:'クリアタイムが正しくありません。' });
    }

    const client = createSecretClient();
    const puzzle = await findPuzzle(client, difficulty, stageNo);
    if(!puzzle) return json(res, 404, { ok:false, message:'ランキング対象のパズルが見つかりません。' });

    const progress = await findProgress(client, user.id, puzzle.id);
    if(!progress?.cleared || !Number.isInteger(progress.best_clear_time_ms) || progress.best_clear_time_ms < MIN_CLEAR_TIME_MS){
      return json(res, 409, { ok:false, message:'検証済みのクリア記録がありません。' });
    }
    if(clearTimeMs < progress.best_clear_time_ms){
      return json(res, 400, { ok:false, message:'クリアタイムが検証済み記録と一致しません。' });
    }

    const verifiedTime = progress.best_clear_time_ms;
    const { error } = await client
      .from('ranking_records')
      .upsert({
        user_id: user.id,
        puzzle_id: puzzle.id,
        difficulty,
        stage_no: stageNo,
        clear_time_ms: verifiedTime,
      }, { onConflict:'user_id,puzzle_id' });
    if(error) throw apiError('ランキング保存に失敗しました。', 500, 'RANKING_SAVE_FAILED', error);

    return json(res, 200, { ok:true, saved:true, clearTimeMs:verifiedTime });
  });
};

async function findPuzzle(client, difficulty, stageNo){
  const { data, error } = await client
    .from('puzzles')
    .select('id, difficulty, stage_no, is_published')
    .eq('difficulty', difficulty)
    .eq('stage_no', stageNo)
    .eq('is_published', true)
    .maybeSingle();
  if(error) throw apiError('パズル確認に失敗しました。', 500, 'RANKING_PUZZLE_SELECT_FAILED', error);
  return data;
}

async function findProgress(client, userId, puzzleId){
  const { data, error } = await client
    .from('user_progress')
    .select('cleared, best_clear_time_ms')
    .eq('user_id', userId)
    .eq('puzzle_id', puzzleId)
    .maybeSingle();
  if(error) throw apiError('クリア記録の確認に失敗しました。', 500, 'RANKING_PROGRESS_SELECT_FAILED', error);
  return data;
}

function normalizeDifficulty(value){
  return String(value || '').trim().toLowerCase();
}

function integer(value){
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : 0;
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
  let length = 0;
  for await (const chunk of req){
    length += chunk.length;
    if(length > 65536) throw apiError('JSONサイズが大きすぎます。', 413, 'RANKING_BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}
