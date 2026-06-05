// editor: numeric palette 0..9, 5-grid bold lines
import { render } from './render.js';
import { normalizePuzzles as normalizeLoadedPuzzles } from './data.js';
import { BACKGROUNDS, BOARD_SIZE_OPTIONS_BY_DIFFICULTY, COLOR_MODES, DIFFICULTY_RULES, EDITOR_SAVE_KEY, MC_COLORS, MC_COLOR_MAP, difficultyFromFileName, normalizeColorId, normalizeColorMode, normalizeDifficulty, normalizeSizeForDifficulty } from './config.js';
import { createPuzzleThumb } from './thumbs.js';
const MAX_LOADED_SLOTS = 100;
const EDITOR_SLOT_COLLAPSED_KEY = 'web_picross_editor_slot_panel_collapsed';
const EDITOR_ZOOM_KEY = 'web_picross_editor_zoom';
const EDITOR_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const DEFAULTS = { w:5, h:5, mode:'mono', difficulty:'beginner', stageNo:1, title:'エディタ作成', active:'1', cells:{}, importMessage:'', gridStringsText:'', gridStringsMessage:'', loadedPuzzles:[], loadedSelected:'1', loadedFileName:'', loadedFileDifficulty:'', slotPanelCollapsed:false, zoom:1, editorUiRestored:false };
const EDITOR_TEXT = { importJson:'JSON読込', importOk:'JSONを読み込みました', importLinked:'難易度と盤面サイズ候補を自動設定しました。', importInvalid:'読み込めるパズルデータではありません', importError:'JSONの読み込みに失敗しました', mixedDifficulty:'このJSONには複数の難易度が混在しているため読み込みできません。1つのJSONファイルには1つの難易度のみ含めてください。', fileDifficultyMismatch:'読み込んだファイル名とパズル難易度が一致しないため読み込みできません。', exportMixedDifficulty:'このファイルには複数の難易度が混在しているため保存できません。1つのJSONファイルには1つの難易度のみ含めてください。', loadedTitle:'読み込み済みJSONスロット', loadedFile:'読込中', notLoaded:'未読込', loadLoaded:'スロット読込', writeLoaded:'スロットへ保存', addLoaded:'空きへ追加', writeOk:'選択中スロットへ保存しました。PC上のJSONを更新するにはJSON出力してください。', addOk:'現在の盤面を空きスロットへ追加しました。', loadedEmpty:'空スロットです', slotOverwriteTitle:'スロット保存確認', slotOverwrite:'選択中スロットを上書きしますか？', slotLimit:'読み込みは最大100スロットまでです。101件目以降は無視しました。', saveNote:'スロット保存は画面内データへの反映です。\nPC上のJSONファイルを更新するにはJSON出力したファイルを保存してください。', editPlay:'エディットプレイ', exportSame:'読込ファイル名でJSON出力', exportAlias:'別名でJSON出力', filePlaceholder:'別名ファイル名', save:'保存', tempSaved:'一時保存', loadSaved:'一時保存読込', deleteSaved:'一時保存削除', saveOk:'保存しました', loadOk:'保存データを読み込みました', noSaved:'一時保存データがありません', overwriteTitle:'保存確認', overwrite:'同じ難易度・面数の保存があります。上書きしますか？', overwriteAction:'上書き' };
Object.assign(EDITOR_TEXT, { slotOpen:'開く', slotClose:'閉じる', zoomOut:'縮小', zoomReset:'100%', zoomIn:'拡大', zoomLabel:'表示倍率', previewTitle:'完成プレビュー' });
Object.assign(EDITOR_TEXT, { gridStringsTitle:'文字列から盤面作成', gridStringsHelp:'0〜Fの文字を、現在の盤面サイズに合わせて入力してください。1行が盤面の1行になります。小文字a〜fは自動で大文字に変換されます。', gridStringsSize:(w,h)=>`現在の盤面サイズ：${w}x${h} / ${h}行、各行${w}文字で入力してください。`, gridStringsPlaceholder:'0000EE0000\n000EBBE000\nEEEEBBEEEE', gridStringsApply:'盤面へ反映', gridStringsGenerate:'現在の盤面から文字列生成', gridStringsClear:'入力クリア', gridStringsApplied:'grid_stringsを盤面へ反映しました。', gridStringsGenerated:'現在の盤面からgrid_stringsを生成しました。', gridStringsCleared:'入力欄をクリアしました。', gridStringsRequired:'grid_stringsを入力してください。', gridStringsRows:h=>`${h}行で入力してください。`, gridStringsColumns:(line,w)=>`${line}行目は${w}文字で入力してください。`, gridStringsInvalid:(line,column)=>`${line}行目${column}文字目が不正です。使用できる文字は 0〜9 / A〜F のみです。` });
function renderEditorBackground(){
  const path=BACKGROUNDS.editor;
  return typeof path === 'string' ? `<div class="screen-bg" aria-hidden="true" style="background-image:url('${escapeAttr(path)}')"></div>` : '';
}

export function renderEditor(state, actions){
  const root = state.root; if(!state.edit) state.edit = JSON.parse(JSON.stringify(DEFAULTS)); const E = state.edit;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  if(!E.editorUiRestored){
    E.slotPanelCollapsed=readStoredBoolean(EDITOR_SLOT_COLLAPSED_KEY, false);
    E.zoom=readStoredNumber(EDITOR_ZOOM_KEY, 1);
    E.editorUiRestored=true;
  }
  E.zoom=normalizeEditorZoom(E.zoom);
  const rule=DIFFICULTY_RULES[E.difficulty]||DIFFICULTY_RULES.beginner; if(!rule.color&&E.mode==='color') E.mode='mono';
  if(E.mode==='mono') E.active='1';
  const currentSize=`${E.w}x${E.h}`; const sizeList=BOARD_SIZE_OPTIONS_BY_DIFFICULTY[E.difficulty]||BOARD_SIZE_OPTIONS_BY_DIFFICULTY.beginner;
  const selectedSize=sizeList.some(size=>currentSize===`${size.w}x${size.h}`)?currentSize:`${sizeList[0].w}x${sizeList[0].h}`;
  const sizeOptions=sizeList.map(size=>`<option value="${size.w}x${size.h}" ${selectedSize===`${size.w}x${size.h}`?'selected':''}>${size.label}</option>`).join('');
  const makeOptions=(items,value)=>Object.entries(items).map(([k,label])=>`<option value="${k}" ${k===value?'selected':''}>${label}</option>`).join('');
  const saved=loadSavedPuzzles();
  const savedOptions=saved.map(p=>`<option value="${p.difficulty}:${p.stageNo}">${DIFFICULTY_RULES[p.difficulty]?.label||p.difficulty} #${p.stageNo} ${escapeAttr(p.title||'')}</option>`).join('');
  E.loadedPuzzles=normalizeSlotList(E.loadedPuzzles);
  const loadedBySlot=slotMap(E.loadedPuzzles);
  const selectedSlot=clamp(parseInt(E.loadedSelected,10)||1,1,MAX_LOADED_SLOTS);

  root.innerHTML = `
    <div class="screen editor-screen has-bg">${renderEditorBackground()}
      <button class="btn fixed-top-left" id="backTop">← メニューへ</button>
      <div class="editor-wrap">
        <div class="editor-topbar">
          <div class="editor-file-tools">
            <input class="filename editor-file-input" id="importFile" type="file" accept=".json,application/json" />
            <button class="btn editor-side-btn" id="importJson">${EDITOR_TEXT.importJson}</button>
            <div class="editor-file-name">${EDITOR_TEXT.loadedFile}: ${escapeAttr(E.loadedFileName||EDITOR_TEXT.notLoaded)}</div>
          </div>
          <div class="editor-save-note">${EDITOR_TEXT.saveNote}</div>
        </div>
        <div class="editor-body">
          <aside class="editor-side">
            <div class="editor-side-section editor-slot-section ${E.slotPanelCollapsed?'is-collapsed':''}">
              <div class="editor-side-title editor-side-title-row">
                <span>${EDITOR_TEXT.loadedTitle}</span>
                <button class="btn btn-slim editor-collapse-btn" id="toggleLoadedSlots" aria-expanded="${!E.slotPanelCollapsed}">${E.slotPanelCollapsed?EDITOR_TEXT.slotOpen:EDITOR_TEXT.slotClose}</button>
              </div>
              <div class="editor-slot-panel-body">
                <div id="loadedSlots" class="slot-list" role="listbox" aria-label="${EDITOR_TEXT.loadedTitle}"></div>
                <button class="btn editor-side-btn" id="loadLoaded">${EDITOR_TEXT.loadLoaded}</button>
                <button class="btn editor-side-btn" id="writeLoaded">${EDITOR_TEXT.writeLoaded}</button>
                <button class="btn editor-side-btn" id="addLoaded">${EDITOR_TEXT.addLoaded}</button>
              </div>
            </div>
            <div class="editor-side-section">
              <div class="editor-side-title">${EDITOR_TEXT.tempSaved}</div>
              <select id="savedList" class="select-input editor-list editor-list-saved" size="10">${savedOptions || `<option value="">${EDITOR_TEXT.noSaved}</option>`}</select>
              <button class="btn editor-side-btn" id="saveLocal">一時保存</button>
              <button class="btn editor-side-btn" id="loadSaved">${EDITOR_TEXT.loadSaved}</button>
              <button class="btn editor-side-btn" id="deleteSaved">${EDITOR_TEXT.deleteSaved}</button>
            </div>
          </aside>
          <div class="editor-main-panel">
            <div class="editor-bar">
              <div class="slot-current">選択スロット: #${selectedSlot}</div>
              <label>盤面サイズ：<select id="boardSize" class="select-input">${sizeOptions}</select></label>
              <input type="hidden" id="ew" value="${E.w}" />
              <input type="hidden" id="eh" value="${E.h}" />
              <button class="btn" id="resize">サイズ変更</button>
              <button class="btn" id="clear">全消去</button>
              <div class="mode-toggle" role="group" aria-label="モード">
                <span>モード：</span>
                <button class="btn toggle-btn ${E.mode==='mono'?'is-active':''}" id="monoBtn" aria-pressed="${E.mode==='mono'}">モノクロ</button>
                <button class="btn toggle-btn ${E.mode==='color'?'is-active':''}" id="colorBtn" aria-pressed="${E.mode==='color'}" ${rule.color?'':'disabled'}>カラー</button>
              </div>
            </div>
            <div class="editor-bar">
              <label>難易度：<select id="difficulty" class="select-input" ${E.loadedFileDifficulty?'disabled':''}>${Object.values(DIFFICULTY_RULES).map(r=>`<option value="${r.key}" ${r.key===E.difficulty?'selected':''}>${r.label}</option>`).join('')}</select></label>
              <label>種別：<select id="colorMode" class="select-input" ${rule.color?'':'disabled'}>${makeOptions(COLOR_MODES,E.mode||'mono')}</select></label>
              <label>面数：<input class="stage-input" id="stageNo" type="number" min="1" value="${E.stageNo||1}" /></label>
              <label>パズル名：<input class="filename" id="titleInput" value="${escapeAttr(E.title||'')}" /></label>
            </div>
            <div class="editor-message" id="importMessage">${E.importMessage||''}</div>
            <div class="editor-assist-row">
              <div class="editor-zoom-controls" role="group" aria-label="${EDITOR_TEXT.zoomLabel}">
                <button class="btn btn-slim" id="editorZoomOut">${EDITOR_TEXT.zoomOut}</button>
                <button class="btn btn-slim" id="editorZoomReset">${EDITOR_TEXT.zoomReset}</button>
                <div class="editor-zoom-label">${EDITOR_TEXT.zoomLabel}: ${Math.round(E.zoom*100)}%</div>
                <button class="btn btn-slim" id="editorZoomIn">${EDITOR_TEXT.zoomIn}</button>
              </div>
              <div class="editor-live-preview">
                <div class="editor-live-preview-title">${EDITOR_TEXT.previewTitle}</div>
                <canvas id="editorThumbPreview" class="editor-live-preview-canvas" width="160" height="160" aria-label="${EDITOR_TEXT.previewTitle}"></canvas>
              </div>
            </div>
            <div class="palette" id="palette"></div>
            <div class="editor-bar">
              <button class="btn" id="test">${EDITOR_TEXT.editPlay}</button>
              <button class="btn" id="exportSame">${EDITOR_TEXT.exportSame}</button>
              <input class="filename" id="fname" placeholder="${EDITOR_TEXT.filePlaceholder}" value="${escapeAttr(defaultAliasName())}" />
              <button class="btn" id="exportAlias">${EDITOR_TEXT.exportAlias}</button>
            </div>
            <div id="grid" class="editor-grid"></div>
            <button class="btn" id="backBottom">← メニューへ</button>
          </div>
        </div>
      </div>
    </div>`;

  // palette 0..9
  renderLoadedSlots(root.querySelector('#loadedSlots'), loadedBySlot, selectedSlot);

  // palette 0..9
  const pal = root.querySelector('#palette'); pal.innerHTML='';
  for(const color of MC_COLORS){ const enabled=E.mode==='color'||color.id==='1'; const sw=document.createElement('button'); sw.type='button'; sw.className='swatch color-'+color.id+(E.active===color.id?' active':'')+(enabled?'':' is-disabled'); sw.style.background=color.hex;
    sw.style.color=(color.id==='0'||color.id==='1'||color.id==='4'||color.id==='5'||color.id==='8')?'#fff':'#000';
    sw.disabled=!enabled;
    sw.setAttribute('aria-pressed', String(E.active===color.id));
    sw.textContent=color.id; sw.title=`${color.id} = ${color.label}`;
    sw.addEventListener('click', ()=>{ if(!enabled) return; E.active=color.id; render(state, actions); }); pal.appendChild(sw); }

  const grid=root.querySelector('#grid'); const px=Math.round(24*E.zoom);
  grid.style.gridTemplateColumns=`repeat(${E.w}, ${px}px)`; grid.style.gridTemplateRows=`repeat(${E.h}, ${px}px)`;
  
  let gridStringsBox = root.querySelector('#gridStringsBox');
  if(!gridStringsBox){
    gridStringsBox = document.createElement('details');
    gridStringsBox.id = 'gridStringsBox';
    gridStringsBox.className = 'editor-grid-strings-panel';
    const sum = document.createElement('summary'); sum.textContent = EDITOR_TEXT.gridStringsTitle;
    const body = document.createElement('div'); body.className = 'editor-grid-strings-body';
    body.innerHTML = `
      <div class="editor-grid-strings-help">${EDITOR_TEXT.gridStringsHelp}</div>
      <div class="editor-grid-strings-size">${EDITOR_TEXT.gridStringsSize(E.w,E.h)}</div>
      <textarea id="gridStringsInput" class="text-input editor-grid-strings-input" spellcheck="false" placeholder="${escapeAttr(EDITOR_TEXT.gridStringsPlaceholder)}">${escapeAttr(E.gridStringsText||'')}</textarea>
      <div class="editor-grid-strings-actions">
        <button class="btn btn-slim" id="applyGridStrings">${EDITOR_TEXT.gridStringsApply}</button>
        <button class="btn btn-slim" id="generateGridStrings">${EDITOR_TEXT.gridStringsGenerate}</button>
        <button class="btn btn-slim" id="clearGridStrings">${EDITOR_TEXT.gridStringsClear}</button>
      </div>
      <div class="editor-grid-strings-message ${E.gridStringsMessage?'':'is-empty'}" id="gridStringsMessage">${escapeAttr(E.gridStringsMessage||'')}</div>`;
    gridStringsBox.appendChild(sum); gridStringsBox.appendChild(body);
    root.querySelector('.editor-wrap').appendChild(gridStringsBox);
  }

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
    drawEditorThumbPreview(root.querySelector('#editorThumbPreview'), E, gridNum);
  };
  updatePreview();
  const gridStringsInput=root.querySelector('#gridStringsInput');
  const gridStringsMessage=root.querySelector('#gridStringsMessage');
  const setGridStringsMessage=(message, isError=false)=>{
    E.gridStringsMessage=message||'';
    if(gridStringsMessage){
      gridStringsMessage.textContent=E.gridStringsMessage;
      gridStringsMessage.classList.toggle('is-empty', !E.gridStringsMessage);
      gridStringsMessage.classList.toggle('is-error', !!isError);
    }
  };
  gridStringsInput?.addEventListener('input', e=>{ E.gridStringsText=e.target.value; if(E.gridStringsMessage) setGridStringsMessage(''); });
  root.querySelector('#applyGridStrings')?.addEventListener('click', ()=>{
    const parsed=parseGridStringsText(gridStringsInput?.value||'', E);
    if(!parsed.ok){ setGridStringsMessage(parsed.message, true); return; }
    const needsColor=parsed.lines.some(line=>/[2-9A-F]/.test(line));
    E.gridStringsText=parsed.lines.join('\n');
    E.cells=cellsFromGridStrings(parsed.lines);
    if(needsColor && E.mode!=='color'){
      E.mode=normalizeColorMode('color', E.difficulty);
      E.gridStringsMessage=EDITOR_TEXT.gridStringsApplied;
      render(state, actions);
      return;
    }
    if(gridStringsInput) gridStringsInput.value=E.gridStringsText;
    setGridStringsMessage(EDITOR_TEXT.gridStringsApplied);
    updateEditorGridButtons(grid, E);
    updatePreview();
  });
  root.querySelector('#generateGridStrings')?.addEventListener('click', ()=>{
    E.gridStringsText=gridStringsFromEditor(E);
    if(gridStringsInput) gridStringsInput.value=E.gridStringsText;
    setGridStringsMessage(EDITOR_TEXT.gridStringsGenerated);
  });
  root.querySelector('#clearGridStrings')?.addEventListener('click', ()=>{
    E.gridStringsText='';
    if(gridStringsInput) gridStringsInput.value='';
    setGridStringsMessage(EDITOR_TEXT.gridStringsCleared);
  });
  grid.addEventListener('click', updatePreview);
  const editorDrag={active:false, mode:null, start:null, moved:false};
  const styleCell=(button,k)=>{ const v=E.cells[k]??0; button.style.background = E.mode==='mono' ? (v&&v!=='0'?'#e0e0e0':'#111') : (MC_COLOR_MAP[normalizeColorId(v)]?.hex||'#111'); };
  const setCell=(button,k,mode)=>{ if(mode==='fill') E.cells[k]=E.mode==='mono'?'1':normalizeColorId(E.active); else delete E.cells[k]; styleCell(button,k); updatePreview(); };
  const toggleCell=(button,k)=>{ if(E.mode==='mono'){ E.cells[k]=E.cells[k]?undefined:'1'; } else { const next=normalizeColorId(E.active); E.cells[k]=normalizeColorId(E.cells[k])===next?undefined:next; } if(!E.cells[k]) delete E.cells[k]; styleCell(button,k); updatePreview(); };
  const cellButton=k=>grid.querySelector(`button[data-k="${k}"]`);
  const beginEditDrag=(e,button,k)=>{ if(e.button!==0&&e.button!==2) return; e.preventDefault(); editorDrag.active=true; editorDrag.mode=e.button===2?'erase':'fill'; editorDrag.start=k; editorDrag.moved=false; };
  const enterEditDrag=(button,k)=>{ if(!editorDrag.active) return; if(k!==editorDrag.start&&!editorDrag.moved){ editorDrag.moved=true; const first=cellButton(editorDrag.start); if(first) setCell(first,editorDrag.start,editorDrag.mode); } if(editorDrag.moved) setCell(button,k,editorDrag.mode); };
  const endEditDrag=(button,k)=>{ if(!editorDrag.active) return; const wasMoved=editorDrag.moved; const mode=editorDrag.mode; editorDrag.active=false; editorDrag.mode=null; editorDrag.start=null; editorDrag.moved=false; if(wasMoved) return; if(mode==='erase') setCell(button,k,'erase'); else toggleCell(button,k); };
  const cancelEditDrag=()=>{ editorDrag.active=false; editorDrag.mode=null; editorDrag.start=null; editorDrag.moved=false; };
  grid.addEventListener('dragstart', (e)=> e.preventDefault());
  grid.addEventListener('contextmenu', e=>e.preventDefault());
  grid.addEventListener('pointerleave', cancelEditDrag);
  grid.addEventListener('mouseleave', cancelEditDrag);
  window.addEventListener('pointerup', cancelEditDrag, {once:false});
  window.addEventListener('mouseup', cancelEditDrag, {once:false});
for(let y=0;y<E.h;y++){ for(let x=0;x<E.w;x++){ const k=`${x},${y}`; const v=E.cells[k]??0; const b=document.createElement('button'); b.dataset.k = k;
      b.style.width=b.style.height=`${px}px`; b.style.border='1px solid #555';
      if(x%5===0) b.style.borderLeft='2px solid #999'; if(y%5===0) b.style.borderTop='2px solid #999';
      if(x===E.w-1) b.style.borderRight='2px solid #999'; if(y===E.h-1) b.style.borderBottom='2px solid #999';
      b.style.background = E.mode==='mono' ? (v&&v!=='0'?'#e0e0e0':'#111') : (MC_COLOR_MAP[normalizeColorId(v)]?.hex||'#111');
      b.oncontextmenu = e=>e.preventDefault(); b.title=k;
      b.addEventListener('pointerdown', e=>beginEditDrag(e,b,k));
      b.addEventListener('pointerenter', ()=>enterEditDrag(b,k));
      b.addEventListener('pointerup', ()=>endEditDrag(b,k));
      b.addEventListener('mousedown', e=>beginEditDrag(e,b,k));
      b.addEventListener('mouseenter', ()=>enterEditDrag(b,k));
      b.addEventListener('mouseup', ()=>endEditDrag(b,k));
      b.addEventListener('contextmenu', e=>{ e.preventDefault(); });
      grid.appendChild(b);
  }}

  const getWH=()=>{ const [w,h]=root.querySelector('#boardSize').value.split('x').map(v=>clamp(parseInt(v,10),5,50)); return {w,h}; };
  root.querySelector('#resize').addEventListener('click', ()=>{ const {w,h}=getWH(); state.edit.w=w; state.edit.h=h; state.edit.cells={}; render(state, actions); });
  root.querySelector('#clear').addEventListener('click', ()=>{ E.cells={}; render(state, actions); });
  root.querySelector('#monoBtn').addEventListener('click', ()=>{ E.mode='mono'; E.active='1'; normalizeMonoCells(E); render(state, actions); });
  root.querySelector('#colorBtn').addEventListener('click', ()=>{ E.mode=normalizeColorMode('color',E.difficulty); E.active=normalizeColorId(E.active||'1'); render(state, actions); });
  root.querySelector('#difficulty').addEventListener('change', e=>{ E.difficulty=normalizeDifficulty(e.target.value); E.mode=normalizeColorMode(E.mode,E.difficulty); const [w,h]=normalizeSizeForDifficulty(E.difficulty,E.w,E.h); E.w=w; E.h=h; E.cells={}; render(state, actions); });
  root.querySelector('#colorMode').addEventListener('change', e=>{ E.mode=normalizeColorMode(e.target.value,E.difficulty); if(E.mode==='mono'){ E.active='1'; normalizeMonoCells(E); } render(state, actions); });
  root.querySelector('#stageNo').addEventListener('input', e=>{ E.stageNo=clamp(parseInt(e.target.value,10)||1,1,MAX_LOADED_SLOTS); E.loadedSelected=String(E.stageNo); updatePreview(); });
  root.querySelector('#titleInput').addEventListener('input', e=>{ E.title=e.target.value; updatePreview(); });
  root.querySelector('#toggleLoadedSlots').addEventListener('click', ()=>{ E.slotPanelCollapsed=!E.slotPanelCollapsed; writeStoredValue(EDITOR_SLOT_COLLAPSED_KEY, E.slotPanelCollapsed?'1':'0'); render(state, actions); });
  root.querySelector('#editorZoomOut').addEventListener('click', ()=>changeEditorZoom(E, -1, state, actions));
  root.querySelector('#editorZoomReset').addEventListener('click', ()=>{ E.zoom=1; writeStoredValue(EDITOR_ZOOM_KEY, String(E.zoom)); render(state, actions); });
  root.querySelector('#editorZoomIn').addEventListener('click', ()=>changeEditorZoom(E, 1, state, actions));
  root.querySelector('#importJson').addEventListener('click', async ()=>{ const file=root.querySelector('#importFile').files?.[0]; if(!file){ actions.notify(EDITOR_TEXT.importJson, EDITOR_TEXT.importInvalid); return; } try{ const text=await file.text(); const json=JSON.parse(text); const inferred=difficultyFromFileName(file.name); const check=validateImportDifficulty(json, inferred, E.difficulty); if(!check.ok){ E.importMessage=check.message; actions.notify(EDITOR_TEXT.importJson, check.message); return; } const puzzles=normalizeSlotList(normalizeLoadedPuzzles(json, {mode:DIFFICULTY_RULES[check.difficulty]?.modeKey})).map(p=>normalizePuzzleDifficulty(p, check.difficulty)); if(!puzzles.length) throw new Error(EDITOR_TEXT.importInvalid); E.loadedFileName=file.name||''; E.loadedFileDifficulty=check.difficulty; E.loadedPuzzles=puzzles; E.loadedSelected=String(puzzles[0].stageNo||1); applyPuzzle(E,puzzles[0], check.difficulty); E.importMessage=`${EDITOR_TEXT.importOk}（${puzzles.length}件）${inferred?' '+EDITOR_TEXT.importLinked:''}${puzzles.length>=MAX_LOADED_SLOTS?' / '+EDITOR_TEXT.slotLimit:''}`; render(state, actions); }catch{ E.importMessage=EDITOR_TEXT.importError; actions.notify(EDITOR_TEXT.importJson, EDITOR_TEXT.importError); } });
  root.querySelector('#loadedSlots').addEventListener('click', e=>{ const card=e.target.closest?.('.slot-card'); if(!card) return; E.loadedSelected=card.dataset.slot; E.stageNo=getSelectedSlot(E); render(state, actions); });
  root.querySelector('#loadLoaded').addEventListener('click', ()=>{ const slot=getSelectedSlot(E); const p=findSlotPuzzle(E.loadedPuzzles, slot); if(!p){ loadEmptySlot(E, slot); E.importMessage=EDITOR_TEXT.loadedEmpty; render(state, actions); return; } applyPuzzle(E,p,E.loadedFileDifficulty); E.loadedSelected=String(slot); E.importMessage=EDITOR_TEXT.loadOk; render(state, actions); });
  root.querySelector('#writeLoaded').addEventListener('click', ()=>{ const slot=getSelectedSlot(E); const old=findSlotPuzzle(E.loadedPuzzles, slot); const commit=()=>{ writeSlot(E, slot); E.importMessage=EDITOR_TEXT.writeOk; render(state, actions); }; if(old) actions.confirmModal(EDITOR_TEXT.slotOverwriteTitle, EDITOR_TEXT.slotOverwrite, commit, EDITOR_TEXT.overwriteAction); else commit(); });
  root.querySelector('#addLoaded').addEventListener('click', ()=>{ const slot=firstEmptySlot(E.loadedPuzzles); if(!slot){ actions.notify(EDITOR_TEXT.loadedTitle, EDITOR_TEXT.slotLimit); return; } writeSlot(E, slot); E.loadedSelected=String(slot); E.importMessage=EDITOR_TEXT.addOk; render(state, actions); });
  root.querySelector('#saveLocal').addEventListener('click', ()=>{ saveCurrent(E, actions, ()=>{ E.importMessage=EDITOR_TEXT.saveOk; render(state, actions); }); });
  root.querySelector('#loadSaved').addEventListener('click', ()=>{ const p=findSaved(root.querySelector('#savedList').value); if(!p){ actions.notify(EDITOR_TEXT.loadSaved, EDITOR_TEXT.noSaved); return; } E.loadedFileName=''; E.loadedFileDifficulty=''; E.loadedPuzzles=[]; applyPuzzle(E,p); E.importMessage=EDITOR_TEXT.loadOk; render(state, actions); });
  root.querySelector('#deleteSaved').addEventListener('click', ()=>{ deleteSaved(root.querySelector('#savedList').value); render(state, actions); });
  root.querySelector('#test').addEventListener('click', ()=>{ actions.playCustom({id:E.id||'editor', title:E.title||'エディタのパズル', difficulty:E.difficulty, w:E.w, h:E.h, mode:'EditPlay', returnTo:'editor', colorMode:E.mode||'mono', grid: toGrid(E)}); });
  root.querySelector('#exportSame').addEventListener('click', ()=>downloadJson(E, E.loadedFileName||'puzzles.json'));
  root.querySelector('#exportAlias').addEventListener('click', ()=>downloadJson(E, (root.querySelector('#fname').value||defaultAliasName()).trim()));
  root.querySelector('#backTop').addEventListener('click', ()=> actions.goto('menu'));
  root.querySelector('#backBottom').addEventListener('click', ()=> actions.goto('menu'));
}
function normalizeEditorZoom(value){
  const numeric=Number(value)||1;
  return EDITOR_ZOOM_LEVELS.reduce((best,level)=>Math.abs(level-numeric)<Math.abs(best-numeric)?level:best, 1);
}
function changeEditorZoom(E, delta, state, actions){
  const current=normalizeEditorZoom(E.zoom);
  const index=Math.max(0, EDITOR_ZOOM_LEVELS.indexOf(current));
  E.zoom=EDITOR_ZOOM_LEVELS[Math.max(0, Math.min(EDITOR_ZOOM_LEVELS.length-1, index+delta))] || 1;
  writeStoredValue(EDITOR_ZOOM_KEY, String(E.zoom));
  render(state, actions);
}
function readStoredBoolean(key, fallback){
  try{ const value=localStorage.getItem(key); return value===null?fallback:value==='1'; }catch{ return fallback; }
}
function readStoredNumber(key, fallback){
  try{ const value=Number(localStorage.getItem(key)); return Number.isFinite(value)&&value>0?value:fallback; }catch{ return fallback; }
}
function writeStoredValue(key, value){
  try{ localStorage.setItem(key, value); }catch{}
}
function drawEditorThumbPreview(canvas, E, grid=toGrid(E)){
  if(!canvas) return;
  const ctx=canvas.getContext?.('2d');
  if(!ctx) return;
  const size=Math.min(canvas.width, canvas.height);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#111';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const w=Math.max(1, Number(E.w)||1);
  const h=Math.max(1, Number(E.h)||1);
  const scale=Math.max(1, Math.floor((size-12)/Math.max(w,h)));
  const drawW=w*scale;
  const drawH=h*scale;
  const offsetX=Math.floor((canvas.width-drawW)/2);
  const offsetY=Math.floor((canvas.height-drawH)/2);
  ctx.fillStyle='#222';
  ctx.fillRect(offsetX-1, offsetY-1, drawW+2, drawH+2);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const value=normalizeColorId(grid[y]?.[x]);
      ctx.fillStyle=value==='0'?'#080808':((E.mode||'mono')==='color'?(MC_COLOR_MAP[value]?.hex||'#e0e0e0'):'#e0e0e0');
      ctx.fillRect(offsetX+x*scale, offsetY+y*scale, scale, scale);
    }
  }
}
function toGrid(E){ return Array.from({length:E.h},(_,y)=>Array.from({length:E.w},(_,x)=>normalizeColorId(E.cells[`${x},${y}`]??'0'))); }
function gridStringsFromEditor(E){ return toGrid(E).map(row=>row.join('')).join('\n'); }
function parseGridStringsText(text, E){
  const raw=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  if(!raw.trim()) return {ok:false, message:EDITOR_TEXT.gridStringsRequired};
  const lines=raw.split('\n').map(line=>line.trim().toUpperCase());
  if(lines.some(line=>line==='')) return {ok:false, message:EDITOR_TEXT.gridStringsRows(E.h)};
  if(lines.length!==Number(E.h)) return {ok:false, message:EDITOR_TEXT.gridStringsRows(E.h)};
  for(let y=0;y<lines.length;y++){
    if(lines[y].length!==Number(E.w)) return {ok:false, message:EDITOR_TEXT.gridStringsColumns(y+1,E.w)};
    for(let x=0;x<lines[y].length;x++){
      if(!MC_COLOR_MAP[lines[y][x]]) return {ok:false, message:EDITOR_TEXT.gridStringsInvalid(y+1,x+1)};
    }
  }
  return {ok:true, lines};
}
function cellsFromGridStrings(lines){
  const cells={};
  lines.forEach((line,y)=>line.split('').forEach((ch,x)=>{ const id=normalizeColorId(ch); if(id!=='0') cells[`${x},${y}`]=id; }));
  return cells;
}
function updateEditorGridButtons(grid, E){
  grid?.querySelectorAll('button[data-k]').forEach(button=>{
    const v=E.cells[button.dataset.k]??'0';
    button.style.background = E.mode==='mono' ? (v&&v!=='0'?'#e0e0e0':'#111') : (MC_COLOR_MAP[normalizeColorId(v)]?.hex||'#111');
  });
}
function escapeAttr(s){ return String(s).replace(/[&<>"']/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch])); }
function rawPuzzleList(json){ return Array.isArray(json)?json:(Array.isArray(json?.puzzles)?json.puzzles:[]); }
function explicitDifficulty(raw){
  const value=raw?.difficulty ?? raw?.level ?? raw?.meta?.difficulty;
  if(value==null || value==='') return '';
  const key=String(value).toLowerCase();
  return DIFFICULTY_RULES[key] ? key : '';
}
function validateImportDifficulty(json, inferred, fallback){
  const explicit=rawPuzzleList(json).map(explicitDifficulty).filter(Boolean);
  const unique=[...new Set(explicit)];
  if(unique.length>1) return {ok:false, message:EDITOR_TEXT.mixedDifficulty};
  if(inferred && unique.length===1 && unique[0]!==inferred) return {ok:false, message:EDITOR_TEXT.fileDifficultyMismatch};
  return {ok:true, difficulty:inferred || unique[0] || normalizeDifficulty(fallback)};
}
function normalizePuzzleDifficulty(puzzle, difficulty){
  const key=normalizeDifficulty(difficulty);
  const mode=normalizeColorMode(puzzle.mode||puzzle.colorMode, key);
  return {...puzzle, difficulty:key, mode, colorMode:mode};
}
function validatePuzzleDifficulties(puzzles, filename=''){
  const list=normalizeSlotList(puzzles);
  const unique=[...new Set(list.map(p=>normalizeDifficulty(p.difficulty)).filter(Boolean))];
  if(unique.length>1) return {ok:false, message:EDITOR_TEXT.exportMixedDifficulty};
  const inferred=difficultyFromFileName(filename);
  if(inferred && unique.length===1 && unique[0]!==inferred) return {ok:false, message:EDITOR_TEXT.fileDifficultyMismatch};
  return {ok:true, difficulty:inferred || unique[0] || ''};
}
function buildPuzzle(E, grid=toGrid(E), gridStr=grid.map(row=>row.join(''))){ const stageNo=Math.max(1,parseInt(E.stageNo,10)||1); const difficulty=normalizeDifficulty(E.difficulty); const mode=normalizeColorMode(E.mode,difficulty); return { id:E.id||`${difficulty}_${mode}_id${String(stageNo).padStart(8,'0')}`, stageNo, title:E.title||'エディタ作成', difficulty, mode, colorMode:mode, w:E.w, h:E.h, grid, grid_strings:gridStr, updatedAt:new Date().toISOString() }; }
function exportPuzzles(E){
  const gridNum=toGrid(E);
  const gridStr=gridNum.map(row=>row.join(''));
  const current=buildPuzzle(E, gridNum, gridStr);
  if(!(Array.isArray(E.loadedPuzzles)&&E.loadedPuzzles.length)) return [current];
  const slot=getSelectedSlot(E);
  const list=normalizeSlotList(E.loadedPuzzles);
  const idx=list.findIndex(p=>Number(p.stageNo)===Number(slot));
  const exported={...current, stageNo:slot};
  if(idx>=0 && list[idx].id) exported.id=list[idx].id;
  else exported.id=`${exported.difficulty}_${exported.mode}_id${String(slot).padStart(8,'0')}`;
  if(idx>=0) list[idx]=exported; else list.push(exported);
  return normalizeSlotList(list);
}
function downloadJson(E, name){ const filename=(name||'puzzles.json').endsWith('.json')?name:(name+'.json'); const puzzles=exportPuzzles(E); const check=validatePuzzleDifficulties(puzzles, filename); if(!check.ok){ E.importMessage=check.message; alert(check.message); return; } const blob=new Blob([JSON.stringify(puzzles.map(p=>normalizePuzzleDifficulty(p, check.difficulty||p.difficulty)),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
function defaultAliasName(){ const d=new Date(); const pad=n=>String(n).padStart(2,'0'); return `edit_puzzles_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`; }
export function normalizePuzzle(json){ const src=Array.isArray(json)?json[0]:(Array.isArray(json?.puzzles)?json.puzzles[0]:json); if(!src) return null; const grid=Array.isArray(src.grid)?src.grid:(Array.isArray(src.grid_strings)?src.grid_strings.map(row=>String(row).split('').map(ch=>normalizeColorId(ch))):null); if(!grid||!grid.length||!Array.isArray(grid[0])) return null; const h=parseInt(src.h||src.height||grid.length,10); const w=parseInt(src.w||src.width||grid[0].length,10); if(!w||!h) return null; const difficulty=normalizeDifficulty(src.difficulty||src.level||'beginner'); const mode=normalizeColorMode(src.colorMode||src.mode||'mono',difficulty); return { id:src.id, stageNo:Math.max(1,parseInt(src.stageNo||src.no||src.id,10)||1), title:src.title||src.name||'エディタ作成', difficulty, mode, w, h, grid:grid.map(row=>row.map(v=>normalizeColorId(v))) }; }
export function applyPuzzle(E,p,forcedDifficulty=''){ E.id=p.id?String(p.id):undefined; E.stageNo=p.stageNo||1; E.title=p.title; E.difficulty=normalizeDifficulty(forcedDifficulty||p.difficulty); E.mode=normalizeColorMode(p.mode,E.difficulty); E.active='1'; E.w=p.w; E.h=p.h; E.cells={}; for(let y=0;y<p.h;y++) for(let x=0;x<p.w;x++){ const v=normalizeColorId(p.grid[y]?.[x]); if(v!=='0') E.cells[`${x},${y}`]=v; } }
function normalizeMonoCells(E){ for(const key of Object.keys(E.cells)){ if(normalizeColorId(E.cells[key])!=='0') E.cells[key]='1'; else delete E.cells[key]; } }
function normalizeSlotList(list){
  const bySlot=new Map();
  (Array.isArray(list)?list:[]).slice(0,MAX_LOADED_SLOTS).forEach((p,index)=>{
    const slot=Math.max(1,Math.min(MAX_LOADED_SLOTS,parseInt(p.stageNo,10)||index+1));
    bySlot.set(slot, {...p, stageNo:slot});
  });
  return Array.from(bySlot.entries()).sort((a,b)=>a[0]-b[0]).map(([,p])=>p);
}
function slotMap(list){ return new Map(normalizeSlotList(list).map(p=>[Number(p.stageNo),p])); }
function getSelectedSlot(E){ return Math.max(1,Math.min(MAX_LOADED_SLOTS,parseInt(E.loadedSelected,10)||1)); }
function findSlotPuzzle(list, slot){ return normalizeSlotList(list).find(p=>Number(p.stageNo)===Number(slot)); }
function firstEmptySlot(list){ const used=new Set(normalizeSlotList(list).map(p=>Number(p.stageNo))); for(let i=1;i<=MAX_LOADED_SLOTS;i++) if(!used.has(i)) return i; return null; }
function loadEmptySlot(E, slot){ E.id=undefined; E.stageNo=slot; E.title=`スロット #${slot}`; E.cells={}; }
function writeSlot(E, slot){
  if(E.loadedFileDifficulty) E.difficulty=E.loadedFileDifficulty;
  const puzzle={...buildPuzzle(E), stageNo:slot};
  const list=normalizeSlotList(E.loadedPuzzles);
  const idx=list.findIndex(p=>Number(p.stageNo)===Number(slot));
  if(idx>=0 && list[idx].id) puzzle.id=list[idx].id;
  else puzzle.id=`${puzzle.difficulty}_${puzzle.mode}_id${String(slot).padStart(8,'0')}`;
  if(idx>=0) list[idx]=puzzle; else list.push(puzzle);
  E.loadedPuzzles=normalizeSlotList(list);
}
function renderLoadedSlots(container, bySlot, selectedSlot){
  container.innerHTML='';
  for(let slot=1; slot<=MAX_LOADED_SLOTS; slot++){
    const puzzle=bySlot.get(slot);
    const card=document.createElement('button');
    card.type='button';
    card.className='slot-card'+(slot===selectedSlot?' is-active':'')+(puzzle?'':' is-empty');
    card.dataset.slot=String(slot);
    card.setAttribute('role','option');
    card.setAttribute('aria-selected', String(slot===selectedSlot));
    const meta=document.createElement('div');
    meta.className='slot-meta';
    const title=document.createElement('div');
    title.className='slot-title';
    title.textContent=puzzle?`#${slot} ${puzzle.title||'無題'}`:`#${slot} 空`;
    const sub=document.createElement('div');
    sub.className='slot-sub';
    sub.textContent=puzzle?`${COLOR_MODES[puzzle.mode||puzzle.colorMode]||puzzle.mode||puzzle.colorMode} / ${puzzle.w}x${puzzle.h}`:'未登録';
    meta.appendChild(title); meta.appendChild(sub);
    card.appendChild(renderThumb(puzzle));
    card.appendChild(meta);
    container.appendChild(card);
  }
}
function renderThumb(puzzle){
  return createPuzzleThumb(puzzle, {className:'slot-thumb'+(puzzle?'':' is-empty'), maxCells:24});
}
function loadSavedPuzzles(){ try{ const list=JSON.parse(localStorage.getItem(EDITOR_SAVE_KEY)||'[]'); return Array.isArray(list)?list:[]; }catch{ return []; } }
function saveSavedPuzzles(list){ localStorage.setItem(EDITOR_SAVE_KEY, JSON.stringify(list)); }
function savedKeyOf(p){ return `${p.difficulty}:${p.stageNo}`; }
function nextStageNo(list){ return Math.max(0,...list.map(p=>parseInt(p.stageNo,10)||0))+1; }
function saveCurrent(E, actions, onSaved){ const puzzle=buildPuzzle(E); const list=loadSavedPuzzles(); const idx=list.findIndex(p=>savedKeyOf(p)===savedKeyOf(puzzle)); const commit=()=>{ if(idx>=0) list[idx]=puzzle; else list.push(puzzle); saveSavedPuzzles(list); onSaved?.(); return true; }; if(idx>=0){ actions.confirmModal(EDITOR_TEXT.overwriteTitle, EDITOR_TEXT.overwrite, commit, EDITOR_TEXT.overwriteAction); return false; } return commit(); }
function findSaved(key){ return loadSavedPuzzles().find(p=>savedKeyOf(p)===key); }
function deleteSaved(key){ const list=loadSavedPuzzles().filter(p=>savedKeyOf(p)!==key); saveSavedPuzzles(list); }
