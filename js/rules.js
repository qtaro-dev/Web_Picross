export const MODES = ['Beginner','Easy','Normal','Hard','Endless'];
export function puzzlesPerPage(mode){ return (mode==='Hard'||mode==='Endless') ? 10 : 20; }
export function recommendedSize(mode){
  switch(mode){
    case 'Beginner': return {w:5,h:5};
    case 'Easy': return {w:10,h:10};
    case 'Normal': return {w:15,h:15};
    case 'Hard': return {w:31,h:31};
    case 'Endless': return {w:35,h:35};
    default: return {w:10,h:10};
  }
}
