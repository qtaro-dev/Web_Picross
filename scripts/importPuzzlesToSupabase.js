require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const difficulties = ['beginner', 'easy', 'normal', 'hard', 'endless'];
const publish = String(process.env.SUPABASE_IMPORT_PUBLISHED || 'true').toLowerCase() !== 'false';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const placeholderValues = new Set([
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_SECRET_KEY',
  'YOUR_SERVER_SIDE_SUPABASE_SECRET_KEY',
  'YOUR_SUPABASE_SERVICE_ROLE_KEY',
]);

function isPlaceholder(value){
  return placeholderValues.has(String(value || '').trim());
}

function printHelp(){
  console.log(`Usage:
  npm run import:puzzles
  npm run import:puzzles -- --dry-run

Required for import:
  SUPABASE_URL
  SUPABASE_SECRET_KEY

Optional:
  SUPABASE_IMPORT_PUBLISHED=true|false

Legacy fallback:
  SUPABASE_SERVICE_ROLE_KEY`);
}

function normalizeColorId(value){
  const id = String(value ?? '0').trim().toUpperCase();
  return /^[0-9A-F]$/.test(id) ? id : '0';
}

function normalizeGrid(raw){
  if(Array.isArray(raw.grid)) return raw.grid.map(normalizeRow);
  if(Array.isArray(raw.grid_strings)) return raw.grid_strings.map(row=>normalizeRow(String(row).split('')));
  if(Array.isArray(raw.solution)) return raw.solution.map(normalizeRow);
  return [];
}

function normalizeRow(row){
  if(typeof row === 'string') return row.split('').map(normalizeColorId);
  if(Array.isArray(row)) return row.map(normalizeColorId);
  return [];
}

function fitGrid(grid, width, height){
  return Array.from({ length:height }, (_, y)=>Array.from({ length:width }, (_, x)=>normalizeColorId(grid[y]?.[x] ?? '0')));
}

function normalizePuzzle(raw, difficulty, index){
  const grid = normalizeGrid(raw);
  const height = Number(raw.h ?? raw.height ?? grid.length);
  const width = Number(raw.w ?? raw.width ?? grid[0]?.length);
  if(!width || !height) return null;
  const stageNo = Number(raw.stageNo ?? raw.no ?? index + 1);
  const colorMode = String(raw.colorMode || raw.mode || 'mono').toLowerCase() === 'color' ? 'color' : 'mono';
  const safeStageNo = Number.isFinite(stageNo) ? stageNo : index + 1;
  return {
    difficulty,
    stage_no: safeStageNo,
    puzzle_key: String(raw.puzzle_key || raw.puzzleKey || raw.id || makePuzzleKey(difficulty, colorMode, safeStageNo)),
    title: String(raw.title || raw.name || `#${index + 1}`),
    width,
    height,
    color_mode: colorMode,
    palette: Array.isArray(raw.palette) ? raw.palette : [],
    solution: fitGrid(grid, width, height),
    thumbnail_path: raw.thumbnailPath || raw.thumbnail_path || null,
    is_published: publish,
  };
}

function makePuzzleKey(difficulty, mode, stageNo){
  return Number.isFinite(stageNo) && stageNo > 0 ? `${difficulty}_${mode || 'mono'}_id${String(stageNo).padStart(8, '0')}` : '';
}

async function loadDifficulty(difficulty){
  const file = path.join(dataDir, `${difficulty}.json`);
  const json = JSON.parse(await fs.readFile(file, 'utf8'));
  const list = Array.isArray(json) ? json : (Array.isArray(json.puzzles) ? json.puzzles : []);
  return list.map((raw, index)=>normalizePuzzle(raw, difficulty, index)).filter(Boolean);
}

async function main(){
  if(args.has('--help') || args.has('-h')){
    printHelp();
    return;
  }
  if(dryRun){
    let total = 0;
    for(const difficulty of difficulties){
      const rows = await loadDifficulty(difficulty);
      total += rows.length;
      console.log(`${difficulty}: ${rows.length} rows`);
    }
    console.log(`Dry run. ${total} puzzles would be imported. is_published=${publish}`);
    return;
  }
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if(!supabaseUrl || !key || isPlaceholder(supabaseUrl) || isPlaceholder(key)){
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for puzzle import.');
  }
  const client = createClient(supabaseUrl, key);
  let total = 0;
  for(const difficulty of difficulties){
    const rows = await loadDifficulty(difficulty);
    if(!rows.length) continue;
    const { error } = await client
      .from('puzzles')
      .upsert(rows, { onConflict:'difficulty,stage_no' });
    if(error) throw error;
    total += rows.length;
    console.log(`${difficulty}: imported ${rows.length}`);
  }
  console.log(`Done. imported ${total} puzzles. is_published=${publish}`);
}

main().catch(error=>{
  console.error(error.message || error);
  process.exit(1);
});
