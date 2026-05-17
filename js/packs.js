export const PACK_SIZES = { Beginner:20, Easy:40, Normal:60, Hard:40, Endless:40 };
export function getPack(mode){ const n=PACK_SIZES[mode]??0; return { mode, puzzles: Array.from({length:n},(_,i)=>({id:String(i+1), title:`パズル ${i+1}`})) }; }
