export const DIFFICULTY_RULES = {
  beginner: { key:'beginner', modeKey:'Beginner', label:'ビギナー', sizes:[[5,5],[5,10]], color:false, min:5, max:10 },
  easy: { key:'easy', modeKey:'Easy', label:'イージー', sizes:[[10,10],[5,10],[10,5]], color:false, min:5, max:10 },
  normal: { key:'normal', modeKey:'Normal', label:'ノーマル', sizes:[[15,10],[10,10],[5,10],[10,5]], color:true, min:5, max:15 },
  hard: { key:'hard', modeKey:'Hard', label:'ハード', sizes:[[20,20],[15,10],[10,10]], color:true, min:10, max:20 },
  endless: { key:'endless', modeKey:'Endless', label:'エンドレス', sizes:[[20,20],[25,25],[30,30],[40,40],[50,50]], color:true, min:20, max:50 },
};

export const MODE_TO_DIFFICULTY = Object.fromEntries(Object.values(DIFFICULTY_RULES).map(r=>[r.modeKey,r.key]));
export const DIFFICULTY_TO_MODE = Object.fromEntries(Object.values(DIFFICULTY_RULES).map(r=>[r.key,r.modeKey]));
export const COLOR_MODES = { mono:'モノクロ', color:'カラー' };

export const MC_COLORS = [
  { id:'0', name:'Black', label:'ブラック', hex:'#000000' },
  { id:'1', name:'Dark Blue', label:'ダークブルー', hex:'#0000AA' },
  { id:'2', name:'Dark Green', label:'ダークグリーン', hex:'#00AA00' },
  { id:'3', name:'Dark Aqua', label:'ダークアクア', hex:'#00AAAA' },
  { id:'4', name:'Dark Red', label:'ダークレッド', hex:'#AA0000' },
  { id:'5', name:'Dark Purple', label:'ダークパープル', hex:'#AA00AA' },
  { id:'6', name:'Gold', label:'ゴールド', hex:'#FFAA00' },
  { id:'7', name:'Gray', label:'グレー', hex:'#AAAAAA' },
  { id:'8', name:'Dark Gray', label:'ダークグレー', hex:'#555555' },
  { id:'9', name:'Blue', label:'ブルー', hex:'#5555FF' },
  { id:'A', name:'Green', label:'グリーン', hex:'#55FF55' },
  { id:'B', name:'Aqua', label:'アクア', hex:'#55FFFF' },
  { id:'C', name:'Red', label:'レッド', hex:'#FF5555' },
  { id:'D', name:'Light Purple', label:'ライトパープル', hex:'#FF55FF' },
  { id:'E', name:'Yellow', label:'イエロー', hex:'#FFFF55' },
  { id:'F', name:'White', label:'ホワイト', hex:'#FFFFFF' },
];

export const MC_COLOR_MAP = Object.fromEntries(MC_COLORS.map(c=>[c.id,c]));
export const EDITOR_SAVE_KEY = 'web_picross_editor_puzzles';

export function normalizeColorId(value){
  const id = String(value ?? '0').trim().toUpperCase();
  return MC_COLOR_MAP[id] ? id : '0';
}

export function isFilledValue(value){
  const id = normalizeColorId(value);
  return id !== '0';
}

export function normalizeColorMode(mode, difficulty='beginner'){
  const key = String(difficulty||'beginner').toLowerCase();
  const requested = String(mode||'mono').toLowerCase();
  if(!DIFFICULTY_RULES[key]?.color) return 'mono';
  return requested === 'color' ? 'color' : 'mono';
}

export function normalizeDifficulty(value){
  const key = String(value||'beginner').toLowerCase();
  return DIFFICULTY_RULES[key] ? key : 'beginner';
}

export function normalizeSizeForDifficulty(difficulty, w, h){
  const rule = DIFFICULTY_RULES[normalizeDifficulty(difficulty)];
  const match = rule.sizes.find(([sw,sh])=>sw===Number(w)&&sh===Number(h));
  return match || rule.sizes[0];
}
