import { render } from './render.js';
import { loadPuzzles, findPuzzle } from './data.js';
import { MODE_TO_DIFFICULTY, isFilledValue, normalizeColorId, normalizeColorMode } from './config.js';
const ACTION_TEXT = { noHint:'ヒントにできるマスがありません', hintTitle:'ヒントを使いますか？', hintMessage:'未入力のマスを1つ正しく埋めます。', giveUpTitle:'ギブアップしますか？', giveUpMessage:'この問題はクリア扱いになりません。', puzzleMissing:'このパズルのデータがありません', clearTitle:'クリア！', clearMessage:'パズルを完成しました。', solvedTitle:'判定', solvedMessage:'解けています', unsolvedTitle:'判定', unsolvedMessage:'まだ未完成です', pendingTitle:'準備中', cancel:'キャンセル', ok:'OK', use:'使う', giveUp:'ギブアップ', select:'セレクトへ戻る', retry:'リトライ' };
const TIMER_LIMITS = { Beginner:600, Easy:600, Normal:1800, Hard:1800, Endless:null, Custom:null };
const TIMER_TEXT = { unlimited:'無制限', timeoutTitle:'時間切れ', timeoutMessage:'制限時間が終了しました。' };
const LS_KEY='picross_v2_solved'; let stateRef; let actionsAPI;
export function initActions(state){ stateRef=state; loadSolved(); actionsAPI={ goto, setMode, setPage, setSelectedColor, toggleCell, toggleCross, beginDrag, applyDrag, endDrag, cancelDrag, clear, hint, giveUp, stopTimer, finishClear, showCheckResult, toggleSolved, play, playCustom, openModal, closeModal, notify, confirmModal, handleModalButton }; return actionsAPI; }
function goto(screen){ if(screen!=='game') stopTimer(); stateRef.modal=null; stateRef.screen=screen; render(stateRef, actionsAPI); }
function setMode(mode){ stateRef.mode=mode; stateRef.page=1; render(stateRef, actionsAPI); }
function setPage(p){ stateRef.page=p; render(stateRef, actionsAPI); }
function currentColor(){ return stateRef.game?.colorMode==='color' ? normalizeColorId(stateRef.selectedColor||'1') : '1'; }
function setSelectedColor(id){ stateRef.selectedColor=normalizeColorId(id); render(stateRef, actionsAPI); }
function inputBlocked(){ return !!stateRef.modal || !!stateRef.timer.expired; }
function toggleCell(k){ if(inputBlocked()) return false; const s=stateRef.filled; const color=currentColor(); stateRef.crossed.delete(k); if(s.has(k)&&normalizeColorId(stateRef.cellColors.get(k))===color){ s.delete(k); stateRef.cellColors.delete(k); } else { s.add(k); stateRef.cellColors.set(k,color); } render(stateRef, actionsAPI); return true; }
function toggleCross(k){ if(inputBlocked()) return false; const s=stateRef.crossed; stateRef.filled.delete(k); stateRef.cellColors.delete(k); s.has(k)?s.delete(k):s.add(k); render(stateRef, actionsAPI); return true; }
function setFilled(k,color=currentColor()){ if(inputBlocked()) return false; color=normalizeColorId(color); const changed=stateRef.crossed.delete(k)||!stateRef.filled.has(k)||normalizeColorId(stateRef.cellColors.get(k))!==color; stateRef.filled.add(k); stateRef.cellColors.set(k,color); if(changed) render(stateRef, actionsAPI); return changed; }
function setCrossed(k){ if(inputBlocked()) return false; const changed=stateRef.filled.delete(k)||stateRef.cellColors.delete(k)||!stateRef.crossed.has(k); stateRef.crossed.add(k); if(changed) render(stateRef, actionsAPI); return changed; }
function beginDrag(mode,k){ if(inputBlocked()) return false; stateRef.drag={active:true, mode, start:k, moved:false}; return true; }
function applyDrag(k){ if(inputBlocked()) return false; const d=stateRef.drag; if(!d.active) return false; if(k!==d.start&&!d.moved){ d.moved=true; const first=d.mode==='fill'?setFilled(d.start):setCrossed(d.start); const next=d.mode==='fill'?setFilled(k):setCrossed(k); return first||next; } if(!d.moved) return false; return d.mode==='fill'?setFilled(k):setCrossed(k); }
function endDrag(k){ if(inputBlocked()) return false; const d=stateRef.drag; if(!d.active) return false; stateRef.drag={active:false, mode:null, start:null, moved:false}; if(!k) return false; if(d.moved) return false; if(k!==d.start){ const first=d.mode==='fill'?setFilled(d.start):setCrossed(d.start); const last=d.mode==='fill'?setFilled(k):setCrossed(k); return first||last; } return d.mode==='fill'?toggleCell(k):toggleCross(k); }
function cancelDrag(){ stateRef.drag={active:false, mode:null, start:null, moved:false}; }
function clear(){ stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); cancelDrag(); render(stateRef, actionsAPI); }
function hint(){ if(!stateRef.game||inputBlocked()) return false; return confirmModal(ACTION_TEXT.hintTitle, ACTION_TEXT.hintMessage, applyHint, ACTION_TEXT.use); }
function applyHint(){ const G=stateRef.game; if(!G) return false; for(let y=0;y<G.h;y++) for(let x=0;x<G.w;x++){ const k=`${x},${y}`; if(stateRef.filled.has(k)||stateRef.crossed.has(k)) continue; isFilledValue(G.solution[y]?.[x])?setFilled(k, G.solution[y][x]):setCrossed(k); return true; } notify(ACTION_TEXT.hintTitle, ACTION_TEXT.noHint); return false; }
function giveUp(){ if(!stateRef.game||inputBlocked()) return; confirmModal(ACTION_TEXT.giveUpTitle, ACTION_TEXT.giveUpMessage, finishGiveUp, ACTION_TEXT.giveUp); }
function finishGiveUp(){ stopTimer(); stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); cancelDrag(); stateRef.game=null; stateRef.screen='select'; render(stateRef, actionsAPI); }
function formatTime(sec){ if(sec==null) return TIMER_TEXT.unlimited; const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function updateTimerNode(){ const el=stateRef.root?.querySelector?.('.timer-value'); if(el) el.textContent=formatTime(stateRef.timer.remaining); }
function stopTimer(){ if(stateRef.timer.intervalId) clearInterval(stateRef.timer.intervalId); stateRef.timer.intervalId=null; stateRef.timer.running=false; }
function finishClear(){ stopTimer(); notify(ACTION_TEXT.clearTitle, ACTION_TEXT.clearMessage, [{label:ACTION_TEXT.ok, action:'close'}, {label:ACTION_TEXT.select, action:'backToSelect'}]); }
function showCheckResult(solved){ if(solved) finishClear(); else notify(ACTION_TEXT.unsolvedTitle, ACTION_TEXT.unsolvedMessage); }
function startTimer(mode){ stopTimer(); const limit=TIMER_LIMITS[mode]??null; stateRef.timer={limit, remaining:limit, running:limit!=null, intervalId:null, expired:false}; if(limit==null) return; stateRef.timer.intervalId=setInterval(()=>{ if(!stateRef.timer.running) return; stateRef.timer.remaining=Math.max(0, stateRef.timer.remaining-1); updateTimerNode(); if(stateRef.timer.remaining<=0){ stopTimer(); stateRef.timer.expired=true; cancelDrag(); notify(TIMER_TEXT.timeoutTitle, TIMER_TEXT.timeoutMessage, [{label:ACTION_TEXT.select, action:'backToSelect'}, {label:ACTION_TEXT.retry, action:'retry'}]); } },1000); }
function toggleSolved(mode,id){ const S=stateRef.solved[mode]; S.has(id)?S.delete(id):S.add(id); persistSolved(); render(stateRef, actionsAPI); }
async function play(mode,id){ const list=await loadPuzzles(mode); const p=findPuzzle(list,id); if(!p){ notify(ACTION_TEXT.pendingTitle, ACTION_TEXT.puzzleMissing); return; }
  const difficulty=p.difficulty||MODE_TO_DIFFICULTY[mode]||'beginner'; const colorMode=normalizeColorMode(p.colorMode||p.mode||'mono',difficulty);
  stateRef.game={ mode, id:String(p.id??p.stageNo??id), stageNo:p.stageNo, title:p.title||`#${p.stageNo??p.id}`, w:p.w, h:p.h, difficulty, colorMode, solution:(p.grid||[]).map(r=>r.map(v=>normalizeColorId(v))) };
  stateRef.modal=null; stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); stateRef.selectedColor='1'; cancelDrag(); startTimer(mode); stateRef.screen='game'; render(stateRef, actionsAPI);
}
function playCustom(p){ const difficulty=p.difficulty||'normal'; const colorMode=normalizeColorMode(p.colorMode||p.solutionMode||p.modeType||'mono',difficulty);
  stateRef.game={ mode:p.mode||'Custom', id:String(p.id||'custom'), title:p.title||'カスタム', w:p.w, h:p.h, returnTo:p.returnTo||'select', difficulty, colorMode, solution:(p.grid||[]).map(r=>r.map(v=>normalizeColorId(v))) };
  stateRef.modal=null; stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); stateRef.selectedColor='1'; cancelDrag(); startTimer('Custom'); stateRef.screen='game'; render(stateRef, actionsAPI);
}
function openModal(modal){ cancelDrag(); stateRef.modal={ title:modal.title||'', message:modal.message||'', buttons:modal.buttons?.length?modal.buttons:[{label:ACTION_TEXT.ok, action:'close'}] }; render(stateRef, actionsAPI); return true; }
function closeModal(){ stateRef.modal=null; render(stateRef, actionsAPI); }
function notify(title,message,buttons){ return openModal({title,message,buttons}); }
function confirmModal(title,message,onConfirm,confirmLabel=ACTION_TEXT.ok){ return openModal({title,message,buttons:[{label:ACTION_TEXT.cancel, action:'close'}, {label:confirmLabel, run:onConfirm}]}); }
function handleModalButton(index){ const modal=stateRef.modal; const btn=modal?.buttons?.[index]; if(!btn){ closeModal(); return; } const run=btn.run; const action=btn.action||'close'; if(btn.close!==false) stateRef.modal=null; if(run){ run(); return; } if(action==='backToSelect'){ stopTimer(); stateRef.game=null; stateRef.screen='select'; render(stateRef, actionsAPI); return; } if(action==='retry'){ retryGame(); return; } render(stateRef, actionsAPI); }
function retryGame(){ if(!stateRef.game){ stateRef.screen='select'; render(stateRef, actionsAPI); return; } stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); stateRef.selectedColor='1'; cancelDrag(); startTimer(stateRef.game.mode||'Custom'); render(stateRef, actionsAPI); }
function loadSolved(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return; const obj=JSON.parse(raw); for(const k of Object.keys(stateRef.solved)){ stateRef.solved[k]=new Set(obj[k]||[]);} }catch{} }
function persistSolved(){ try{ const obj={}; for(const k of Object.keys(stateRef.solved)){ obj[k]=Array.from(stateRef.solved[k]); } localStorage.setItem(LS_KEY, JSON.stringify(obj)); }catch{} }
