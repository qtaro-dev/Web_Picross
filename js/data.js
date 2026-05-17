// data.js: normalize puzzle data from built-in JSON and editor exports.
import { MODE_TO_DIFFICULTY, normalizeColorId, normalizeColorMode, normalizeDifficulty } from './config.js';

export async function loadPuzzles(mode){
  const path = `./data/${mode.toLowerCase()}.json`;
  try{
    const res = await fetch(path, {cache:'no-store'});
    if(!res.ok) throw new Error(res.statusText);
    return normalizePuzzles(await res.json(), { mode });
  }catch(e){
    console.warn('loadPuzzles failed:', e);
    return [];
  }
}

export function normalizePuzzles(json, context={}){
  const rawList = Array.isArray(json) ? json : (Array.isArray(json?.puzzles) ? json.puzzles : []);
  return rawList.map((raw,index)=>normalizePuzzle(raw, {...context, index})).filter(Boolean);
}

export function normalizePuzzle(raw, context={}){
  if(!raw || typeof raw !== 'object') return null;
  const difficulty = normalizeDifficulty(raw.difficulty || raw.level || MODE_TO_DIFFICULTY[context.mode] || context.mode || 'beginner');
  const colorMode = normalizeColorMode(raw.colorMode || raw.mode || raw.solutionMode || raw.modeType || 'mono', difficulty);
  const grid = normalizeGrid(raw);
  if(!grid.length || !grid[0]?.length) return null;
  const h = Number(raw.h ?? raw.height ?? grid.length);
  const w = Number(raw.w ?? raw.width ?? grid[0].length);
  if(!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const stageNo = Number(raw.stageNo ?? raw.no ?? context.index + 1);
  const id = raw.id != null ? String(raw.id) : String(Number.isFinite(stageNo) ? stageNo : context.index + 1);
  return {
    ...raw,
    id,
    stageNo: Number.isFinite(stageNo) ? stageNo : context.index + 1,
    title: raw.title || raw.name || `#${Number.isFinite(stageNo) ? stageNo : context.index + 1}`,
    difficulty,
    mode: colorMode,
    colorMode,
    w,
    h,
    grid: fitGrid(grid, w, h),
  };
}

export function findPuzzle(list, id){
  const target = String(id);
  const found = list.find(p => String(p.id)===target || String(p.stageNo)===target);
  if(!found){
    console.warn('findPuzzle: puzzle not found', {
      requested: target,
      loaded: list.length,
      candidates: list.map(p=>({id:p.id, stageNo:p.stageNo, title:p.title})),
    });
  }
  return found;
}

function normalizeGrid(raw){
  if(Array.isArray(raw.grid)) return raw.grid.map(normalizeRow);
  if(Array.isArray(raw.grid_strings)) return raw.grid_strings.map(row=>normalizeRow(String(row).split('')));
  if(Array.isArray(raw.solution)) return raw.solution.map(normalizeRow);
  if(raw.cells && typeof raw.cells === 'object') return gridFromCells(raw);
  return [];
}

function normalizeRow(row){
  if(typeof row === 'string') return row.split('').map(normalizeColorId);
  if(Array.isArray(row)) return row.map(normalizeColorId);
  return [];
}

function fitGrid(grid, w, h){
  return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>normalizeColorId(grid[y]?.[x] ?? '0')));
}

function gridFromCells(raw){
  const h = Number(raw.h ?? raw.height ?? 0);
  const w = Number(raw.w ?? raw.width ?? 0);
  if(!w || !h) return [];
  const grid = Array.from({length:h},()=>Array.from({length:w},()=> '0'));
  for(const [key,value] of Object.entries(raw.cells)){
    const [x,y] = key.split(',').map(Number);
    if(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h) grid[y][x] = normalizeColorId(value);
  }
  return grid;
}
