// editor: numeric palette 0..9, 5-grid bold lines
import { render } from './render.js';
import { COLOR_MODES, DIFFICULTY_RULES, EDITOR_SAVE_KEY, MC_COLORS, MC_COLOR_MAP, normalizeColorId, normalizeColorMode, normalizeDifficulty, normalizeSizeForDifficulty } from './config.js';
const DEFAULTS = { w:5, h:5, mode:'mono', difficulty:'beginner', stageNo:1, title:'エディタ作成', active:'1', cells:{}, importMessage:'' };
const EDITOR_TEXT = { importJson:'JSON読込', importOk:'JSONを読み込みました', importInvalid:'読み込めるパズルデータではありません', importError:'JSONの読み込みに失敗しました', editPlay:'エディットプレイ', exportJson:'JSONダウンロード', filePlaceholder:'ファイル名（例：beginner.json）', save:'保存', loadSaved:'保存読込', deleteSaved:'保存削除', saveOk:'保存しました', loadOk:'保存データを読み込みました', noSaved:'保存データがありません', overwriteTitle:'保存確認', overwrite:'同じ難易度・面数の保存があります。上書きしますか？', overwriteAction:'上書き' };

export function renderEditor(state, actions){
  const root = state.root; if(!state.edit) state.edit = JSON.parse(JSON.stringify(DEFAULTS)); const E = state.edit;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const rule=DIFFICULTY_RULES[E.difficulty]||DIFFICULTY_RULES.beginner; if(!rule.color&&E.mode==='color') E.mode='mono';
  const currentSize=`${E.w}x${E.h}`; const sizeList=rule.sizes.some(([w,h])=>currentSize===`${w}x${h}`)?rule.sizes:[[E.w,E.h],...rule.sizes];
  const sizeOptions=sizeList.map(([w,h])=>`<option value="${w}x${h}" ${currentSize===`${w}x${h}`?'selected':''}>${w} x ${h}</option>`).join('');
  const makeOptions=(items,value)=>Object.entries(items).map(([k,label])=>`<option value="${k}" ${k===value?'selected':''}>${label}</option>`).join('');
  const saved=loadSavedPuzzles();
  const savedOptions=saved.map(p=>`<option value="${p.difficulty}:${p.stageNo}">${DIFFICULTY_RULES[p.difficulty]?.label||p.difficulty} #${p.stageNo} ${escapeAttr(p.title||'')}</option>`).join('');

  root.innerHTML = `
    <div class="screen select-padding-top">
      <button class="btn fixed-top-left" id="backTop">← メニューへ</button>
      <div class="editor-wrap">
        <div class="editor-bar">
          <label>盤面サイズ：<select id="boardSize" class="select-input">${sizeOptions}</select></label>
          <input type="hidden" id="ew" value="${E.w}" />
          <input type="hidden" id="eh" value="${E.h}" />
          <button class="btn" id="resize">サイズ変更</button>
          <button class="btn" id="clear">全消去</button>
          <div style="display:flex; gap:8px; align-items:center;">
            <span>モード：</span>
            <button class="btn" id="monoBtn" ${E.mode==='mono'?'disabled':''}>モノクロ</button>
            <button class="btn" id="colorBtn" ${E.mode==='color'||!rule.color?'disabled':''}>カラー</button>
          </div>
        </div>
        <div class="editor-bar">
          <label>難易度：<select id="difficulty" class="select-input">${Object.values(DIFFICULTY_RULES).map(r=>`<option value="${r.key}" ${r.key===E.difficulty?'selected':''}>${r.label}</option>`).join('')}</select></label>
          <label>種別：<select id="colorMode" class="select-input" ${rule.color?'':'disabled'}>${makeOptions(COLOR_MODES,E.mode||'mono')}</select></label>
          <label>面数：<input class="stage-input" id="stageNo" type="number" min="1" value="${E.stageNo||1}" /></label>
          <label>パズル名：<input class="filename" id="titleInput" value="${escapeAttr(E.title||'')}" /></label>
          <button class="btn" id="saveLocal">${EDITOR_TEXT.save}</button>
        </div>
        <div class="editor-bar">
          <label>保存済み：<select id="savedList" class="select-input">${savedOptions || `<option value="">${EDITOR_TEXT.noSaved}</option>`}</select></label>
          <button class="btn" id="loadSaved">${EDITOR_TEXT.loadSaved}</button>
          <button class="btn" id="deleteSaved">${EDITOR_TEXT.deleteSaved}</button>
        </div>
        <div class="editor-bar">
          <input class="filename" id="importFile" type="file" accept=".json,application/json" />
          <button class="btn" id="importJson">${EDITOR_TEXT.importJson}</button>
          <span class="editor-message" id="importMessage">${E.importMessage||''}</span>
        </div>
        <div class="palette" id="palette"></div>
        <div class="editor-bar">
          <button class="btn" id="test">${EDITOR_TEXT.editPlay}</button>
          <input class="filename" id="fname" placeholder="${EDITOR_TEXT.filePlaceholder}" value="puzzles.json" />
          <button class="btn" id="export">${EDITOR_TEXT.exportJson}</button>
        </div>
        <div id="grid" class="editor-grid"></div>
        <button class="btn" id="backBottom">← メニューへ</button>
      </div>
    </div>`;

  // palette 0..9
  const pal = root.querySelector('#palette'); pal.innerHTML='';
  for(const color of MC_COLORS){ const sw=document.createElement('div'); sw.className='swatch color-'+color.id+(E.active===color.id?' active':''); sw.style.background=color.hex;
    sw.style.color=(color.id==='0'||color.id==='1'||color.id==='4'||color.id==='5'||color.id==='8')?'#fff':'#000';
    sw.textContent=color.id; sw.title=`${color.id} = ${color.label}`;
    sw.addEventListener('click', ()=>{ E.active=color.id; if(rule.color) E.mode='color'; render(state, actions); }); pal.appendChild(sw); }

  // grid
  const grid=root.querySelector('#grid'); const px=24;
  // === Drag-to-paint ===
  let __dragPaintDown = false;
  grid.addEventListener('pointerdown', (e)=>{
    if (e.button!==0) return;
    __dragPaintDown = true;
    if (e.target && e.target.tagName==='BUTTON') e.target.click();
  });
  grid.addEventListener('pointerenter', (e)=>{
    if (!__dragPaintDown) return;
    if (e.buttons !== 1) return;
    if (e.target && e.target.tagName==='BUTTON') e.target.click();
  }, true);
  window.addEventListener('pointerup', ()=>{ __dragPaintDown=false; }, {once:false});
  grid.addEventListener('dragstart', (e)=> e.preventDefault());

  grid.style.gridTemplateColumns=`repeat(${E.w}, ${px}px)`; grid.style.gridTemplateRows=`repeat(${E.h}, ${px}px)`;
  
  // === Data preview box ===
  let prevBox = root.querySelector('#previewBox');
  if(!prevBox){
    prevBox = document.createElement('details');
    prevBox.id = 'previewBox';
    prevBox.style.maxWidth = '980px';
    prevBox.style.width = '96vw';
    prevBox.style.background = '#0a0a0a';
    prevBox.style.border = '1px solid #444';
    prevBox.style.borderRadius = '12px';
    prevBox.style.padding = '8px 12px';
    const sum = document.createElement('summary'); sum.textContent = 'データプレビュー';
    const pre = document.createElement('pre'); pre.id = 'previewJson'; pre.style.whiteSpace = 'pre-wrap'; pre.style.fontSize = '12px';
    prevBox.appendChild(sum); prevBox.appendChild(pre);
    root.querySelector('.editor-wrap').appendChild(prevBox);
  }
  const updatePreview = () => {
    const gridNum = toGrid(E);
    const gridStr = gridNum.map(row => row.join(''));
    const obj = buildPuzzle(E, gridNum, gridStr);
    obj.title = root.querySelector('#titleInput')?.value || obj.title;
    root.querySelector('#previewJson').textContent = JSON.stringify(obj, null, 2);
  };
  updatePreview();
  grid.addEventListener('click', updatePreview);
for(let y=0;y<E.h;y++){ for(let x=0;x<E.w;x++){ const k=`${x},${y}`; const v=E.cells[k]??0; const b=document.createElement('button'); b.dataset.k = k;
      b.style.width=b.style.height=`${px}px`; b.style.border='1px solid #555';
      if(x%5===0) b.style.borderLeft='2px solid #999'; if(y%5===0) b.style.borderTop='2px solid #999';
      if(x===E.w-1) b.style.borderRight='2px solid #999'; if(y===E.h-1) b.style.borderBottom='2px solid #999';
      b.style.background = E.mode==='mono' ? (v&&v!=='0'?'#e0e0e0':'#111') : (MC_COLOR_MAP[normalizeColorId(v)]?.hex||'#111');
      b.oncontextmenu = e=>e.preventDefault(); b.title=k;
      b.addEventListener('click', ()=>{ if(E.mode==='mono'){ E.cells[k]=E.cells[k]?undefined:'1'; } else { E.cells[k]=normalizeColorId(E.active); } if(!E.cells[k]) delete E.cells[k]; render(state, actions); });
      b.addEventListener('contextmenu', ()=>{ delete E.cells[k]; render(state, actions); });
      grid.appendChild(b);
  }}

  const getWH=()=>{ const [w,h]=root.querySelector('#boardSize').value.split('x').map(v=>clamp(parseInt(v,10),5,50)); return {w,h}; };
  root.querySelector('#resize').addEventListener('click', ()=>{ const {w,h}=getWH(); state.edit.w=w; state.edit.h=h; state.edit.cells={}; render(state, actions); });
  root.querySelector('#clear').addEventListener('click', ()=>{ E.cells={}; render(state, actions); });
  root.querySelector('#monoBtn').addEventListener('click', ()=>{ E.mode='mono'; render(state, actions); });
  root.querySelector('#colorBtn').addEventListener('click', ()=>{ E.mode=normalizeColorMode('color',E.difficulty); render(state, actions); });
  root.querySelector('#difficulty').addEventListener('change', e=>{ E.difficulty=normalizeDifficulty(e.target.value); E.mode=normalizeColorMode(E.mode,E.difficulty); const [w,h]=normalizeSizeForDifficulty(E.difficulty,E.w,E.h); E.w=w; E.h=h; E.cells={}; render(state, actions); });
  root.querySelector('#colorMode').addEventListener('change', e=>{ E.mode=normalizeColorMode(e.target.value,E.difficulty); render(state, actions); });
  root.querySelector('#stageNo').addEventListener('input', e=>{ E.stageNo=Math.max(1,parseInt(e.target.value,10)||1); updatePreview(); });
  root.querySelector('#titleInput').addEventListener('input', e=>{ E.title=e.target.value; updatePreview(); });
  root.querySelector('#importJson').addEventListener('click', async ()=>{ const file=root.querySelector('#importFile').files?.[0]; if(!file){ actions.notify(EDITOR_TEXT.importJson, EDITOR_TEXT.importInvalid); return; } try{ const text=await file.text(); const puzzle=normalizePuzzle(JSON.parse(text)); if(!puzzle) throw new Error(EDITOR_TEXT.importInvalid); applyPuzzle(E,puzzle); E.importMessage=EDITOR_TEXT.importOk; render(state, actions); }catch{ E.importMessage=EDITOR_TEXT.importError; actions.notify(EDITOR_TEXT.importJson, EDITOR_TEXT.importError); } });
  root.querySelector('#saveLocal').addEventListener('click', ()=>{ saveCurrent(E, actions, ()=>{ E.importMessage=EDITOR_TEXT.saveOk; render(state, actions); }); });
  root.querySelector('#loadSaved').addEventListener('click', ()=>{ const p=findSaved(root.querySelector('#savedList').value); if(!p){ actions.notify(EDITOR_TEXT.loadSaved, EDITOR_TEXT.noSaved); return; } applyPuzzle(E,p); E.importMessage=EDITOR_TEXT.loadOk; render(state, actions); });
  root.querySelector('#deleteSaved').addEventListener('click', ()=>{ deleteSaved(root.querySelector('#savedList').value); render(state, actions); });
  root.querySelector('#test').addEventListener('click', ()=>{ actions.playCustom({id:E.id||'editor', title:E.title||'エディタのパズル', difficulty:E.difficulty, w:E.w, h:E.h, mode:'EditPlay', returnTo:'editor', colorMode:E.mode||'mono', grid: toGrid(E)}); });
  root.querySelector('#export').addEventListener('click', ()=>{ const name=(root.querySelector('#fname').value||'puzzles.json').trim();
    const gridNum=toGrid(E); const gridStr=gridNum.map(row=>row.join(''));
    const data=[buildPuzzle(E, gridNum, gridStr)];
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download = name.endsWith('.json')? name : (name + '.json'); a.click(); URL.revokeObjectURL(a.href);
  });
  root.querySelector('#backTop').addEventListener('click', ()=> actions.goto('menu'));
  root.querySelector('#backBottom').addEventListener('click', ()=> actions.goto('menu'));
}
function toGrid(E){ return Array.from({length:E.h},(_,y)=>Array.from({length:E.w},(_,x)=>normalizeColorId(E.cells[`${x},${y}`]??'0'))); }
function escapeAttr(s){ return String(s).replace(/[&<>"']/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch])); }
function buildPuzzle(E, grid=toGrid(E), gridStr=grid.map(row=>row.join(''))){ const stageNo=Math.max(1,parseInt(E.stageNo,10)||1); const difficulty=normalizeDifficulty(E.difficulty); const mode=normalizeColorMode(E.mode,difficulty); return { id:E.id||`${difficulty}_${mode}_id${String(stageNo).padStart(8,'0')}`, stageNo, title:E.title||'エディタ作成', difficulty, mode, colorMode:mode, w:E.w, h:E.h, grid, grid_strings:gridStr, updatedAt:new Date().toISOString() }; }
export function normalizePuzzle(json){ const src=Array.isArray(json)?json[0]:(Array.isArray(json?.puzzles)?json.puzzles[0]:json); if(!src) return null; const grid=Array.isArray(src.grid)?src.grid:(Array.isArray(src.grid_strings)?src.grid_strings.map(row=>String(row).split('').map(ch=>normalizeColorId(ch))):null); if(!grid||!grid.length||!Array.isArray(grid[0])) return null; const h=parseInt(src.h||src.height||grid.length,10); const w=parseInt(src.w||src.width||grid[0].length,10); if(!w||!h) return null; const difficulty=normalizeDifficulty(src.difficulty||src.level||'beginner'); const mode=normalizeColorMode(src.colorMode||src.mode||'mono',difficulty); return { id:src.id, stageNo:Math.max(1,parseInt(src.stageNo||src.no||src.id,10)||1), title:src.title||src.name||'エディタ作成', difficulty, mode, w, h, grid:grid.map(row=>row.map(v=>normalizeColorId(v))) }; }
export function applyPuzzle(E,p){ E.id=p.id?String(p.id):undefined; E.stageNo=p.stageNo||1; E.title=p.title; E.difficulty=normalizeDifficulty(p.difficulty); E.mode=normalizeColorMode(p.mode,E.difficulty); E.active='1'; E.w=p.w; E.h=p.h; E.cells={}; for(let y=0;y<p.h;y++) for(let x=0;x<p.w;x++){ const v=normalizeColorId(p.grid[y]?.[x]); if(v!=='0') E.cells[`${x},${y}`]=v; } }
function loadSavedPuzzles(){ try{ const list=JSON.parse(localStorage.getItem(EDITOR_SAVE_KEY)||'[]'); return Array.isArray(list)?list:[]; }catch{ return []; } }
function saveSavedPuzzles(list){ localStorage.setItem(EDITOR_SAVE_KEY, JSON.stringify(list)); }
function savedKeyOf(p){ return `${p.difficulty}:${p.stageNo}`; }
function saveCurrent(E, actions, onSaved){ const puzzle=buildPuzzle(E); const list=loadSavedPuzzles(); const idx=list.findIndex(p=>savedKeyOf(p)===savedKeyOf(puzzle)); const commit=()=>{ if(idx>=0) list[idx]=puzzle; else list.push(puzzle); saveSavedPuzzles(list); onSaved?.(); return true; }; if(idx>=0){ actions.confirmModal(EDITOR_TEXT.overwriteTitle, EDITOR_TEXT.overwrite, commit, EDITOR_TEXT.overwriteAction); return false; } return commit(); }
function findSaved(key){ return loadSavedPuzzles().find(p=>savedKeyOf(p)===key); }
function deleteSaved(key){ const list=loadSavedPuzzles().filter(p=>savedKeyOf(p)!==key); saveSavedPuzzles(list); }
