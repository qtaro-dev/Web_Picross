const { createSecretClient, guarded, json } = require('./_adminGuard');

const DIFFICULTIES = new Set(['beginner', 'easy', 'normal', 'hard', 'endless']);
const COLOR_IDS = new Set('0123456789ABCDEF'.split(''));

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  return guarded(req, res, async () => {
    const body = await readBody(req);
    const difficulty = normalizeDifficulty(body?.difficulty);
    const dryRun = body?.dryRun !== false;
    if(!DIFFICULTIES.has(difficulty)) return json(res, 400, { ok:false, message:'難易度が正しくありません。' });

    const validation = normalizeUpload(body?.puzzles, difficulty);
    if(!validation.ok) return json(res, 400, validation);
    if(dryRun) return json(res, 200, { ok:true, dryRun:true, ...validation });

    const client = createSecretClient();
    const result = await applyPuzzles(client, difficulty, validation.puzzles);
    return json(res, 200, { ok:true, dryRun:false, ...validation, ...result, message:'パズルJSONをSupabaseへ反映しました。' });
  });
};

async function applyPuzzles(client, difficulty, puzzles){
  const { data:existingRows, error:selectError } = await client
    .from('puzzles')
    .select('id, difficulty, stage_no, puzzle_key')
    .eq('difficulty', difficulty);
  if(selectError) throw apiError('既存パズルの取得に失敗しました。', 500, 'PUZZLE_UPLOAD_SELECT_FAILED', selectError);

  const byKey = new Map();
  const byStage = new Map();
  for(const row of existingRows || []){
    if(row.puzzle_key) byKey.set(String(row.puzzle_key), row);
    byStage.set(Number(row.stage_no), row);
  }

  let inserted = 0;
  let updated = 0;
  const keepIds = new Set();
  for(const puzzle of puzzles){
    const existing = byKey.get(puzzle.puzzle_key) || byStage.get(puzzle.stage_no);
    const payload = {
      difficulty,
      stage_no: puzzle.stage_no,
      puzzle_key: puzzle.puzzle_key,
      title: puzzle.title,
      width: puzzle.width,
      height: puzzle.height,
      color_mode: puzzle.color_mode,
      palette: puzzle.palette,
      solution: puzzle.solution,
      thumbnail_path: puzzle.thumbnail_path,
      is_published: true,
    };
    if(existing?.id){
      const { error } = await client.from('puzzles').update(payload).eq('id', existing.id);
      if(error) throw apiError(`ステージ#${puzzle.stage_no}の更新に失敗しました。`, 500, 'PUZZLE_UPLOAD_UPDATE_FAILED', error);
      keepIds.add(existing.id);
      updated += 1;
    }else{
      const { data, error } = await client.from('puzzles').insert(payload).select('id').single();
      if(error) throw apiError(`ステージ#${puzzle.stage_no}の追加に失敗しました。`, 500, 'PUZZLE_UPLOAD_INSERT_FAILED', error);
      if(data?.id) keepIds.add(data.id);
      inserted += 1;
    }
  }

  const hideIds = (existingRows || []).map(row=>row.id).filter(id=>!keepIds.has(id));
  if(hideIds.length){
    const { error } = await client.from('puzzles').update({ is_published:false }).in('id', hideIds);
    if(error) throw apiError('未掲載パズルの非公開化に失敗しました。', 500, 'PUZZLE_UPLOAD_UNPUBLISH_FAILED', error);
  }
  return { inserted, updated, unpublished:hideIds.length };
}

function normalizeUpload(input, targetDifficulty){
  const list = Array.isArray(input) ? input : (Array.isArray(input?.puzzles) ? input.puzzles : []);
  const errors = [];
  const normalized = [];
  const keys = new Set();
  const stages = new Set();
  if(!list.length) errors.push('パズルが0件です。');
  list.forEach((raw, index)=>{
    const rowNo = index + 1;
    const difficulty = normalizeDifficulty(raw?.difficulty || raw?.level || targetDifficulty);
    if(difficulty !== targetDifficulty) errors.push(`#${rowNo}: 難易度が選択値と一致しません。`);
    const stageNo = Number(raw?.stageNo ?? raw?.stage_no ?? raw?.no);
    if(!Number.isInteger(stageNo) || stageNo <= 0) errors.push(`#${rowNo}: stageNo が正しくありません。`);
    const colorMode = normalizeColorMode(raw?.colorMode || raw?.color_mode || raw?.mode);
    const puzzleKey = normalizePuzzleKey(raw?.puzzle_key || raw?.puzzleKey || raw?.id || makePuzzleKey(targetDifficulty, colorMode, stageNo));
    if(!puzzleKey) errors.push(`#${rowNo}: id または puzzle_key が必要です。`);
    if(keys.has(puzzleKey)) errors.push(`#${rowNo}: puzzle_key が重複しています。`);
    keys.add(puzzleKey);
    if(stages.has(stageNo)) errors.push(`#${rowNo}: stageNo が重複しています。`);
    stages.add(stageNo);
    const title = String(raw?.title || raw?.name || '').trim();
    if(!title) errors.push(`#${rowNo}: title が必要です。`);
    const width = Number(raw?.w ?? raw?.width);
    const height = Number(raw?.h ?? raw?.height);
    if(!Number.isInteger(width) || width <= 0) errors.push(`#${rowNo}: width/w が正しくありません。`);
    if(!Number.isInteger(height) || height <= 0) errors.push(`#${rowNo}: height/h が正しくありません。`);
    const grid = normalizeGrid(raw, width, height);
    if(!grid.length) errors.push(`#${rowNo}: 正解盤面がありません。`);
    if(grid.length && (grid.length !== height || grid.some(row=>row.length !== width))){
      errors.push(`#${rowNo}: 正解盤面のサイズが w/h と一致しません。`);
    }
    normalized.push({
      puzzle_key: puzzleKey,
      stage_no: stageNo,
      title,
      width,
      height,
      color_mode: colorMode,
      palette: Array.isArray(raw?.palette) ? raw.palette : [],
      solution: grid,
      thumbnail_path: raw?.thumbnailPath || raw?.thumbnail_path || null,
    });
  });
  if(errors.length) return { ok:false, message:'パズルJSONの検証に失敗しました。', errors };
  return {
    ok:true,
    difficulty:targetDifficulty,
    count:normalized.length,
    preview:normalized.map(p=>({ puzzle_key:p.puzzle_key, stage_no:p.stage_no, title:p.title, size:`${p.width}x${p.height}`, color_mode:p.color_mode })),
    puzzles:normalized,
  };
}

function normalizeGrid(raw, width, height){
  let grid = [];
  if(Array.isArray(raw?.grid)) grid = raw.grid.map(normalizeRow);
  else if(Array.isArray(raw?.grid_strings)) grid = raw.grid_strings.map(row=>normalizeRow(String(row).split('')));
  else if(Array.isArray(raw?.solution)) grid = raw.solution.map(normalizeRow);
  else if(raw?.cells && typeof raw.cells === 'object') grid = gridFromCells(raw, width, height);
  return grid;
}

function normalizeRow(row){
  if(typeof row === 'string') return row.split('').map(normalizeColorId);
  if(Array.isArray(row)) return row.map(normalizeColorId);
  return [];
}

function gridFromCells(raw, width, height){
  const grid = Array.from({ length:height },()=>Array.from({ length:width },()=> '0'));
  for(const [key, value] of Object.entries(raw.cells || {})){
    const [x, y] = key.split(',').map(Number);
    if(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height){
      grid[y][x] = normalizeColorId(value);
    }
  }
  return grid;
}

function normalizeColorId(value){
  const id = String(value ?? '0').trim().toUpperCase();
  return COLOR_IDS.has(id) ? id : '0';
}

function normalizeColorMode(value){
  return String(value || 'mono').toLowerCase() === 'color' ? 'color' : 'mono';
}

function normalizeDifficulty(value){
  return String(value || '').trim().toLowerCase();
}

function normalizePuzzleKey(value){
  return String(value || '').trim();
}

function makePuzzleKey(difficulty, mode, stageNo){
  return Number.isInteger(stageNo) && stageNo > 0 ? `${difficulty}_${mode || 'mono'}_id${String(stageNo).padStart(8, '0')}` : '';
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
    if(length > 5 * 1024 * 1024) throw apiError('JSONサイズが大きすぎます。', 413, 'PUZZLE_UPLOAD_BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}
