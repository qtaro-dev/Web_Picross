import { getPack } from './packs.js';
import { PLACEHOLDERS, solvedThumbPath } from './thumbs.js';
import { makeClues, isSolved } from './engine.js';
import { renderEditor } from './editor.js';
import { DIFFICULTY_RULES, MC_COLORS, MC_COLOR_MAP, normalizeColorId } from './config.js';
const MODE_LABELS = { Beginner:'ビギナー', Easy:'イージー', Normal:'ノーマル', Hard:'ハード', Endless:'エンドレス' };
const GAME_UI = { backSelect:'← セレクトに戻る', backEditor:'← エディタに戻る', backMenu:'メニューへ戻る', clear:'全消去', check:'判定', giveUp:'ギブアップ', hint:'ヒント', timeLabel:'残り時間', unlimited:'無制限', timePending:'--:--', inputHelp:'左クリック：塗る／解除　右クリック：×（マーク）', noPuzzle:'パズルが選択されていません。' };
const MENU_PENDING = { title:'準備中', message:name=>`${name} は準備中です` };
function setAlignTop(root, on){ root.classList[on?'add':'remove']('align-top'); }
function formatGameTime(timer){ const sec=timer?.remaining; if(sec==null) return GAME_UI.unlimited; const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

export function render(state, actions){
  if(state.screen==='title') renderTitle(state, actions);
  else if(state.screen==='menu') renderMenu(state, actions);
  else if(state.screen==='select') renderSelect(state, actions);
  else if(state.screen==='editor') renderEditor(state, actions);
  else renderGame(state, actions);
  renderModal(state, actions);
}

function renderTitle(state, actions){
  const root=state.root; setAlignTop(root,false);
  root.innerHTML = `<div class="screen"><img id="titleimg" class="title-img" src="./image/title.png" alt="Title"></div>`;
  root.querySelector('#titleimg').addEventListener('click', ()=>actions.goto('menu'));
}

function renderMenu(state, actions){
  const root=state.root; setAlignTop(root,false);
  root.innerHTML = `<div class="screen"><div class="menu">
    <button class="btn" data-act="game">ゲームセレクト</button>
    <button class="btn" data-act="ranking">ランキング</button>
    <button class="btn" data-act="option">オプション</button>
    <button class="btn" data-act="help">ヘルプ</button>
    <button class="btn" data-act="credit">クレジット</button>
    <button class="btn" data-act="editor">エディタ</button></div></div>`;
  root.querySelector('[data-act="game"]').addEventListener('click', ()=>actions.goto('select'));
  const p = act => () => actions.notify(MENU_PENDING.title, MENU_PENDING.message(act));
  root.querySelector('[data-act="ranking"]').addEventListener('click', p('ランキング'));
  root.querySelector('[data-act="option"]').addEventListener('click', p('オプション'));
  root.querySelector('[data-act="help"]').addEventListener('click', p('ヘルプ'));
  root.querySelector('[data-act="credit"]').addEventListener('click', p('クレジット'));
  root.querySelector('[data-act="editor"]').addEventListener('click', ()=>actions.goto('editor'));
}

function renderSelect(state, actions){
  const root=state.root; setAlignTop(root,true);
  const mode=state.mode; const isLarge=(mode==='Hard'||mode==='Endless'); const per=isLarge?10:20; const cols=isLarge?5:4;
  const pack=getPack(mode); const total=pack.puzzles.length; const pages=Math.max(1, Math.ceil(total/per));
  const solvedCount=pack.puzzles.reduce((sum,p)=>sum+(state.solved[mode].has(p.id)?1:0),0);
  const page=Math.min(Math.max(1,state.page),pages); const start=(page-1)*per; const items=pack.puzzles.slice(start,start+per);
  const thumbSize=isLarge?'var(--thumb-lg)':'var(--thumb)'; const rowGap=isLarge?32:24;
  root.innerHTML = `<div class="screen select-padding-top">
      <button class="btn fixed-top-left" id="back">← メニューに戻る</button>
      <div class="fixed-top-center">
        <div class="mode-tabs" id="modes"></div>
        <div class="pager-bar">
          <button class="btn btn-slim" id="prev" ${page<=1?'disabled':''}>◀</button>
          <div class="page-label">${page} / ${pages}</div>
          <button class="btn btn-slim" id="next" ${page>=pages?'disabled':''}>▶</button>
        </div>
        <div class="progress-status">クリア数 ${solvedCount} / ${total}</div>
      </div>
      <div class="thumb-grid" id="grid" style="--thumb-size:${thumbSize}; grid-template-columns: repeat(${cols}, var(--thumb-size)); row-gap:${rowGap}px;"></div>
    </div>`;
  root.querySelector('#back').addEventListener('click', ()=>actions.goto('menu'));
  const goPage = d => { const n=Math.min(Math.max(1,page+d),pages); if(n!==page) actions.setPage(n); };
  root.querySelector('#prev').addEventListener('click', ()=>goPage(-1));
  root.querySelector('#next').addEventListener('click', ()=>goPage(1));
  const modes=['Beginner','Easy','Normal','Hard','Endless']; const tabs=root.querySelector('#modes');
  modes.forEach(m=>{ const b=document.createElement('button'); b.className='btn'+(m===mode?' is-active':''); b.textContent=MODE_LABELS[m]; b.onclick=()=>{ if(m!==mode) actions.setMode(m); }; tabs.appendChild(b); });
  const grid=root.querySelector('#grid');
  for(const p of items){ const id=p.id; const solved=state.solved[mode].has(id);
    const tile=document.createElement('div'); tile.className='tile';
    const div=document.createElement('div'); div.className='thumb'+(solved?' solved':'');
    const img=document.createElement('img'); img.alt=`${MODE_LABELS[mode]} #${id}`; img.loading='lazy'; const __ph=PLACEHOLDERS[mode]; img.src=__ph; img.onerror=()=>{img.src=__ph;}; div.appendChild(img);
    if(solved){ const badge=document.createElement('div'); badge.className='badge'; badge.textContent='CLEAR'; div.appendChild(badge); }
    const cap=document.createElement('div'); cap.className='caption'; cap.textContent=`#${id}`;
    tile.appendChild(div); tile.appendChild(cap);
    div.addEventListener('click', ev=>{ if(ev.shiftKey) actions.toggleSolved(mode,id); else actions.play(mode,id); });
    grid.appendChild(tile);
  }
}

function renderGame(state, actions){
  const root=state.root; setAlignTop(root,false);
  const G=state.game; if(!G){ root.innerHTML=`<div class="screen"><div class="menu"><button class="btn" id="back">${GAME_UI.backSelect}</button><p>${GAME_UI.noPuzzle}</p></div></div>`; root.querySelector('#back').onclick=()=>actions.goto('select'); return; }
  const {w,h,solution}=G; const {rows,cols}=makeClues(solution,w,h); const maxRowLen=Math.max(...rows.map(r=>r.length)); const maxColLen=Math.max(...cols.map(c=>c.length));
  const boardSize=Math.max(w,h); const cellSize=Math.max(18, Math.min(34, Math.floor(280/boardSize))); const clueSize=Math.max(18, Math.min(24, cellSize));
  const timerText=formatGameTime(state.timer);
  const backTarget=G.returnTo==='editor'?'editor':'select';
  const backLabel=G.returnTo==='editor'?GAME_UI.backEditor:GAME_UI.backSelect;
  const showPalette=G.colorMode==='color'&&DIFFICULTY_RULES[G.difficulty||'beginner']?.color;
  root.innerHTML = `<div class="screen game-screen">
    <div class="game-layout">
      <aside class="game-panel">
        <div class="timer-box">
          <div class="timer-label">${GAME_UI.timeLabel}</div>
          <div class="timer-value">${timerText}</div>
        </div>
        <div class="game-actions">
          <button class="btn" id="clear">${GAME_UI.clear}</button>
          <button class="btn" id="check">${GAME_UI.check}</button>
          <button class="btn" id="hint">${GAME_UI.hint}</button>
          <button class="btn" id="giveup">${GAME_UI.giveUp}</button>
          <button class="btn" id="menu">${GAME_UI.backMenu}</button>
          <button class="btn" id="back">${backLabel}</button>
        </div>
      </aside>
      <div class="game-main">
        <div class="game-title">${G.title} (${w}×${h})</div>
        <div id="gamewrap" class="game-board" style="--cell-size:${cellSize}px; --clue-size:${clueSize}px; display:grid; gap:0;
          grid-template-columns: repeat(${maxRowLen}, var(--clue-size)) repeat(${w}, var(--cell-size));
          grid-template-rows: repeat(${maxColLen}, var(--clue-size)) repeat(${h}, var(--cell-size));"></div>
        <p class="game-help">${GAME_UI.inputHelp}</p>
      </div>
      <aside class="game-palette-panel">
        ${showPalette ? `<div class="palette-title">パレット</div><div class="game-palette">${MC_COLORS.map(c=>`<button class="palette-btn ${state.selectedColor===c.id?'is-active':''}" data-color="${c.id}" style="background:${c.hex}; color:${['0','1','4','5','8'].includes(c.id)?'#fff':'#000'}">${c.id}</button>`).join('')}</div>` : `<div class="palette-title">モノクロ</div><div class="mono-palette-note">■ 塗り</div>`}
      </aside>
    </div></div>`;
  const wrap=root.querySelector('#gamewrap');
  const solvedState=()=>({w,h,solution,filled:state.filled,cellColors:state.cellColors,colorMode:G.colorMode});
  const checkClear=changed=>{ if(changed&&isSolved(solvedState())) actions.finishClear(); };
  for(let y=0;y<maxColLen;y++) for(let x=0;x<maxRowLen;x++){
    const corner=document.createElement('div'); corner.className='clue-cell clue-corner';
    corner.style.gridColumn=`${x + 1}`; corner.style.gridRow=`${y + 1}`;
    wrap.appendChild(corner);
  }
  for(let x=0;x<w;x++){
    const seq=cols[x];
    for(let i=0;i<maxColLen;i++){
      const d=document.createElement('div'); d.className='clue-cell clue-cell-col';
      const num=seq[seq.length-maxColLen+i]; d.textContent=num?num:'';
      d.style.gridColumn=`${maxRowLen + x + 1}`; d.style.gridRow=`${i + 1}`;
      wrap.appendChild(d);
    }
  }
  for(let y=0;y<h;y++){
    for(let i=0;i<maxRowLen;i++){ const d=document.createElement('div'); d.className='clue-cell clue-cell-row';
      const seq=rows[y]; const num=seq[seq.length-maxRowLen+i]; d.textContent=num?num:'';
      d.style.gridColumn=`${i + 1}`; d.style.gridRow=`${maxColLen + y + 1}`;
      wrap.appendChild(d); }
    for(let x=0;x<w;x++){ const k=`${x},${y}`; const b=document.createElement('button'); b.dataset.k=k; b.className='cell'+(state.filled.has(k)?' filled':'')+(state.crossed.has(k)?' cross':'');
      b.style.gridColumn=`${maxRowLen + x + 1}`; b.style.gridRow=`${maxColLen + y + 1}`;
      if(G.colorMode==='color'&&state.filled.has(k)){ b.style.background=MC_COLOR_MAP[normalizeColorId(state.cellColors.get(k))]?.hex||'#e0e0e0'; }
      const startInput=e=>{ if(state.modal) return; if(e.button===0){ e.preventDefault(); actions.beginDrag('fill',k); } else if(e.button===2){ e.preventDefault(); actions.beginDrag('cross',k); } };
      const moveInput=()=>checkClear(actions.applyDrag(k));
      const endInput=()=>checkClear(actions.endDrag(k));
      b.oncontextmenu=e=>e.preventDefault();
      b.ondragstart=e=>e.preventDefault();
      b.addEventListener('pointerdown',startInput);
      b.addEventListener('pointerenter',moveInput);
      b.addEventListener('pointerover',moveInput);
      b.addEventListener('pointerup',endInput);
      b.addEventListener('mousedown',startInput);
      b.addEventListener('mouseenter',moveInput);
      b.addEventListener('mouseover',moveInput);
      b.addEventListener('mouseup',endInput);
      wrap.appendChild(b);
    }
  }
  const moveOverCell=e=>{ const cell=e.target.closest?.('.cell'); if(cell) checkClear(actions.applyDrag(cell.dataset.k)); };
  wrap.addEventListener('pointermove',moveOverCell);
  wrap.addEventListener('mousemove',moveOverCell);
  wrap.addEventListener('pointerleave',()=>actions.cancelDrag());
  wrap.addEventListener('mouseleave',()=>actions.cancelDrag());
  window.addEventListener('pointerup',()=>actions.cancelDrag(),{once:true});
  window.addEventListener('mouseup',()=>actions.cancelDrag(),{once:true});
  root.querySelector('#back').onclick=()=>actions.goto(backTarget);
  root.querySelector('#menu').onclick=()=>actions.goto('menu');
  root.querySelector('#clear').onclick=()=>actions.clear();
  root.querySelector('#check').onclick=()=>actions.showCheckResult(isSolved(solvedState()));
  root.querySelector('#hint').onclick=()=>actions.hint();
  root.querySelector('#giveup').onclick=()=>actions.giveUp();
  root.querySelectorAll('.palette-btn').forEach(btn=>btn.addEventListener('click',()=>actions.setSelectedColor(btn.dataset.color)));
}

function renderModal(state, actions){
  if(!state.modal) return;
  const overlay=document.createElement('div');
  overlay.className='modal-overlay';
  const panel=document.createElement('div');
  panel.className='modal-panel';
  const title=document.createElement('div');
  title.className='modal-title';
  title.textContent=state.modal.title||'';
  const message=document.createElement('div');
  message.className='modal-message';
  message.textContent=state.modal.message||'';
  const buttons=document.createElement('div');
  buttons.className='modal-actions';
  (state.modal.buttons||[]).forEach((btn,index)=>{
    const b=document.createElement('button');
    b.className='btn modal-btn';
    b.textContent=btn.label;
    b.addEventListener('click',()=>actions.handleModalButton(index));
    buttons.appendChild(b);
  });
  panel.appendChild(title);
  panel.appendChild(message);
  panel.appendChild(buttons);
  overlay.appendChild(panel);
  overlay.addEventListener('contextmenu', e=>e.preventDefault());
  state.root.appendChild(overlay);
}
