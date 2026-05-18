import { isFilledValue, normalizeColorId } from './config.js';

export function makeClues(grid, w, h, colorMode='mono'){
  if(colorMode==='color') return makeColorClues(grid,w,h);
  const rows=[], cols=[];
  for(let y=0;y<h;y++){
    const seq=[]; let run=0;
    for(let x=0;x<w;x++){ const v = isFilledValue(grid[y]?.[x]) ? 1 : 0; if(v){run++;} else if(run){seq.push(run); run=0;} }
    if(run) seq.push(run); rows.push(seq.length?seq:[0]);
  }
  for(let x=0;x<w;x++){
    const seq=[]; let run=0;
    for(let y=0;y<h;y++){ const v = isFilledValue(grid[y]?.[x]) ? 1 : 0; if(v){run++;} else if(run){seq.push(run); run=0;} }
    if(run) seq.push(run); cols.push(seq.length?seq:[0]);
  }
  return {rows, cols};
}
function makeColorClues(grid,w,h){
  const rows=[], cols=[];
  for(let y=0;y<h;y++){
    const seq=[]; let run=0; let color=null;
    for(let x=0;x<w;x++){
      const id=normalizeColorId(grid[y]?.[x]);
      if(isFilledValue(id)){
        if(color===id) run++;
        else { if(run) seq.push({count:run,colorId:color}); color=id; run=1; }
      } else if(run){ seq.push({count:run,colorId:color}); run=0; color=null; }
    }
    if(run) seq.push({count:run,colorId:color}); rows.push(seq.length?seq:[0]);
  }
  for(let x=0;x<w;x++){
    const seq=[]; let run=0; let color=null;
    for(let y=0;y<h;y++){
      const id=normalizeColorId(grid[y]?.[x]);
      if(isFilledValue(id)){
        if(color===id) run++;
        else { if(run) seq.push({count:run,colorId:color}); color=id; run=1; }
      } else if(run){ seq.push({count:run,colorId:color}); run=0; color=null; }
    }
    if(run) seq.push({count:run,colorId:color}); cols.push(seq.length?seq:[0]);
  }
  return {rows,cols};
}
export function isSolved(state){
  const {w,h,solution,filled,cellColors,colorMode} = state;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const k=`${x},${y}`; const should = isFilledValue(solution[y]?.[x]) ? 1 : 0; const is = filled.has(k)?1:0;
    if(should!==is) return false;
    if(should&&colorMode==='color'&&normalizeColorId(solution[y]?.[x])!==normalizeColorId(cellColors?.get(k))) return false;
  }
  return true;
}
