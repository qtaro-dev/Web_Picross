import { MC_COLOR_MAP, normalizeColorId } from './config.js';

export const PLACEHOLDERS = {
  Beginner: './image/thumbs/_placeholders/beginner.png',
  Easy:     './image/thumbs/_placeholders/easy.png',
  Normal:   './image/thumbs/_placeholders/normal.png',
  Hard:     './image/thumbs/_placeholders/hard.png',
  Endless:  './image/thumbs/_placeholders/endless.png',
};
export function solvedThumbPath(mode, id){ return `./image/thumbs/${mode.toLowerCase()}/${id}.png`; }

export function createPuzzleThumb(puzzle, options={}){
  const thumb=document.createElement('div');
  thumb.className=options.className||'generated-thumb';
  if(!puzzle) return thumb;
  const w=Math.max(1,Number(puzzle.w)||Number(puzzle.width)||1);
  const h=Math.max(1,Number(puzzle.h)||Number(puzzle.height)||1);
  const grid=normalizeThumbGrid(puzzle,w,h);
  const maxCells=options.maxCells||50;
  const step=Math.max(1,Math.ceil(Math.max(w,h)/maxCells));
  const cols=Math.ceil(w/step);
  const rows=Math.ceil(h/step);
  const inner=document.createElement('div');
  inner.className='generated-thumb-grid';
  inner.style.gridTemplateColumns=`repeat(${cols}, 1fr)`;
  inner.style.gridTemplateRows=`repeat(${rows}, 1fr)`;
  if(cols>=rows){
    inner.style.width='92%';
    inner.style.height=`calc(92% * ${rows} / ${cols})`;
  }else{
    inner.style.width=`calc(92% * ${cols} / ${rows})`;
    inner.style.height='92%';
  }
  const colorMode=(puzzle.colorMode||puzzle.mode)==='color';
  for(let y=0;y<h;y+=step){
    for(let x=0;x<w;x+=step){
      const cell=document.createElement('span');
      const value=normalizeColorId(grid[y]?.[x]);
      cell.style.background=value==='0'?'#111':(colorMode?(MC_COLOR_MAP[value]?.hex||'#e0e0e0'):'#e0e0e0');
      inner.appendChild(cell);
    }
  }
  thumb.appendChild(inner);
  return thumb;
}

function normalizeThumbGrid(puzzle,w,h){
  const source=Array.isArray(puzzle.grid)?puzzle.grid:(Array.isArray(puzzle.grid_strings)?puzzle.grid_strings.map(row=>String(row).split('')):[]);
  return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>normalizeColorId(source[y]?.[x]??'0')));
}
