import { render } from './render.js';
import { loadPuzzles, findPuzzle } from './data.js';
import { MC_COLORS, MODE_TO_DIFFICULTY, isFilledValue, normalizeColorId, normalizeColorMode } from './config.js';
import { authenticateLocalUser, downloadCurrentUserJson, downloadUserDataJson, ensureUserProgress, exportCurrentUserPayload, loadSolvedForUser, mergeServerUserProgress, persistSolvedForUser, recordGameResultForUser, registerLocalUser, resetProgressForUser, userIdFor } from './userData.js';
const ACTION_TEXT = { noHint:'ヒントにできる行・列がありません', hintTitle:'ヒントを使いますか？', hintMessage:'未完成の行または列を1つ選び、正解として塗るマスを表示します。', hintRow:index=>`${index + 1}行目の正解部分を表示しました。`, hintCol:index=>`${index + 1}列目の正解部分を表示しました。`, giveUpTitle:'ギブアップしますか？', giveUpMessage:'この問題はクリア扱いになりません。', puzzleMissing:'このパズルのデータがありません', clearTitle:'クリア！', clearMessage:'パズルを完成しました。', solvedTitle:'判定', solvedMessage:'解けています', unsolvedTitle:'判定', unsolvedMessage:'まだ未完成です', pendingTitle:'準備中', resetClearTitle:'クリア状況リセット', resetClearMessage:'現在保存されているクリア状態を削除します。パズルデータとエディタ一時保存は削除されません。', resetUserTitle:'ユーザーデータ削除', resetUserMessage:'ゲーム進行データを削除します。ログイン情報、固定ユーザー、エディタ一時保存、パズルJSONは削除されません。', resetDone:'削除しました', cancel:'キャンセル', ok:'OK', delete:'削除', use:'使う', giveUp:'ギブアップ', select:'セレクトへ戻る', retry:'リトライ' };
const AUTH_TEXT = { required:'ユーザー名とパスワードを入力してください', loginFailed:'ユーザー名またはパスワードが違います', registerOffline:'サーバ未接続のため登録できません', registered:'登録しました。ログインしてください', duplicate:'同じユーザー名は登録できません' };
const REGISTER_TEXT = { title:'ユーザー登録', message:'登録しました。\n登録したユーザでログインしますか？', yes:'はい', no:'いいえ' };
const DEV_USER = { username:'admin', password:'admin' };
const TIMER_LIMITS = { Beginner:600, Easy:600, Normal:1800, Hard:1800, Endless:null, Custom:null };
const TIMER_TEXT = { unlimited:'無制限', timeoutTitle:'時間切れ', timeoutMessage:'制限時間が終了しました。' };
const REMEMBER_LOGIN_KEY = 'picross_remember_login';
const SAVED_USERNAME_KEY = 'picross_saved_username';
const SAVED_PASSWORD_KEY = 'picross_saved_password';
const OPTIONS_KEY = 'web_picross_options';
const DEFAULT_OPTIONS = { crosshairColor:'#42a5f5', bgmVolume:50, seVolume:50, displayMode:'window' };
const LS_KEY='picross_v2_solved'; let stateRef; let actionsAPI;
export function initActions(state){ stateRef=state; loadRememberedLogin(); loadOptions(); loadSolved(); actionsAPI={ goto, login, registerUser, updateLoginForm, logout, exportUserDataJson, exportCurrentUserJson, reloadUserData, setMode, setPage, setRankingMode, loadRanking, setOption, resetOptions, setSelectedColor, setHoverCell, clearHoverCell, toggleCell, toggleCross, beginDrag, applyDrag, endDrag, cancelDrag, clear, hint, giveUp, stopTimer, finishClear, showCheckResult, toggleSolved, resetClearFlags, resetUserData, play, playCustom, openModal, closeModal, notify, confirmModal, handleModalButton }; return actionsAPI; }
function goto(screen){ if(screen!=='game') stopTimer(); stateRef.modal=null; stateRef.hoverCell=null; stateRef.authMessage=''; stateRef.screen=screen; render(stateRef, actionsAPI); if(screen==='ranking') loadRanking(); }
async function apiPost(path,payload){
  const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let body={}; try{ body=await res.json(); }catch{}
  if(!res.ok||body.ok===false){ const err=new Error(body.message||AUTH_TEXT.loginFailed); err.status=res.status; throw err; }
  return body;
}
function updateLoginForm(patch){
  stateRef.loginForm={...(stateRef.loginForm||{}), ...(patch||{})};
  if(Object.prototype.hasOwnProperty.call(patch||{}, 'remember')) persistRememberPreference(stateRef.loginForm.remember);
  if(Object.prototype.hasOwnProperty.call(patch||{}, 'remember')) render(stateRef, actionsAPI);
}
async function login(username,password,remember=stateRef.loginForm?.remember){
  username=String(username||'').trim(); password=String(password||'');
  stateRef.loginForm={username, password, remember:!!remember};
  if(!username||!password){ stateRef.authMessage=AUTH_TEXT.required; render(stateRef, actionsAPI); return false; }
  try{
    const result=await apiPost('/api/login',{username,password});
    stateRef.currentUser={username:result.user?.username||username, id:result.user?.id||userIdFor(result.user?.username||username), source:'server'};
    mergeServerUserProgress(stateRef.currentUser, {progress:result.progress, stats:result.stats, history:result.history, user:result.user});
    prepareUserData('server users.json', true);
    saveRememberedLogin(username, password, remember);
    stateRef.authMessage='';
    goto('menu');
    return true;
  }catch(err){
    if(username===DEV_USER.username&&password===DEV_USER.password){
      stateRef.currentUser={username:DEV_USER.username, id:userIdFor(DEV_USER.username), source:'built-in'};
      prepareUserData('localStorage', false);
      saveRememberedLogin(username, password, remember);
      stateRef.authMessage='';
      goto('menu');
      return true;
    }
    const localUser=authenticateLocalUser(username,password);
    if(localUser){
      stateRef.currentUser=localUser;
      prepareUserData('localStorage', false);
      saveRememberedLogin(username, password, remember);
      stateRef.authMessage='';
      goto('menu');
      return true;
    }
    stateRef.authMessage=err.status ? (err.message||AUTH_TEXT.loginFailed) : AUTH_TEXT.loginFailed;
    render(stateRef, actionsAPI);
    return false;
  }
}
async function registerUser(username,password){
  username=String(username||'').trim(); password=String(password||'');
  if(!username||!password){ stateRef.authMessage=AUTH_TEXT.required; render(stateRef, actionsAPI); return false; }
  try{
    await apiPost('/api/register',{username,password});
    showRegisterLoginAssist(username,password);
    return true;
  }catch(err){
    if(err.status===409){
      stateRef.authMessage=AUTH_TEXT.duplicate;
      render(stateRef, actionsAPI);
      return false;
    }
    const local=registerLocalUser(username,password);
    if(local.ok) showRegisterLoginAssist(username,password);
    else { stateRef.authMessage=local.message==='duplicate' ? AUTH_TEXT.duplicate : AUTH_TEXT.required; render(stateRef, actionsAPI); }
    return local.ok;
  }
}
function logout(){ stateRef.currentUser=null; goto('title'); }
function exportUserDataJson(){ downloadUserDataJson(); return true; }
function exportCurrentUserJson(){ downloadCurrentUserJson(stateRef.currentUser); return true; }
function showRegisterLoginAssist(username,password){
  stateRef.authMessage=AUTH_TEXT.registered;
  stateRef.loginForm={...(stateRef.loginForm||{}), username:'', password:''};
  openModal({title:REGISTER_TEXT.title, message:REGISTER_TEXT.message, buttons:[
    {label:REGISTER_TEXT.yes, run:()=>fillRegisteredLogin(username,password)},
    {label:REGISTER_TEXT.no, run:()=>clearRegisteredLogin()}
  ]});
}
function fillRegisteredLogin(username,password){
  stateRef.loginForm={username, password, remember:!!stateRef.loginForm?.remember};
  stateRef.authMessage=AUTH_TEXT.registered;
  stateRef.screen='login';
  render(stateRef, actionsAPI);
}
function clearRegisteredLogin(){
  const remember=!!stateRef.loginForm?.remember;
  stateRef.loginForm={username:'', password:'', remember};
  if(!remember) clearRememberedLogin();
  stateRef.authMessage='';
  stateRef.screen='login';
  render(stateRef, actionsAPI);
}
function loadRememberedLogin(){
  let remember=false, username='', password='';
  try{
    remember=localStorage.getItem(REMEMBER_LOGIN_KEY)==='true';
    if(remember){
      username=localStorage.getItem(SAVED_USERNAME_KEY)||'';
      password=localStorage.getItem(SAVED_PASSWORD_KEY)||'';
    }
  }catch{}
  stateRef.loginForm={username, password, remember};
}
function persistRememberPreference(remember){
  try{
    localStorage.setItem(REMEMBER_LOGIN_KEY, remember?'true':'false');
    if(!remember) clearRememberedLogin();
  }catch{}
}
function saveRememberedLogin(username,password,remember){
  try{
    localStorage.setItem(REMEMBER_LOGIN_KEY, remember?'true':'false');
    if(remember){
      localStorage.setItem(SAVED_USERNAME_KEY, username);
      localStorage.setItem(SAVED_PASSWORD_KEY, password);
    }else{
      localStorage.removeItem(SAVED_USERNAME_KEY);
      localStorage.removeItem(SAVED_PASSWORD_KEY);
      if(stateRef?.loginForm) stateRef.loginForm={username:'', password:'', remember:false};
    }
  }catch{}
}
function clearRememberedLogin(){
  try{
    localStorage.setItem(REMEMBER_LOGIN_KEY, 'false');
    localStorage.removeItem(SAVED_USERNAME_KEY);
    localStorage.removeItem(SAVED_PASSWORD_KEY);
  }catch{}
}
async function reloadUserData(){
  if(stateRef.currentUser?.source==='server'){
    try{
      const res=await fetch('/api/user-data');
      const body=await res.json();
      const id=stateRef.currentUser.id||userIdFor(stateRef.currentUser.username);
      const record=body.progress?.[id]||body.progress?.[stateRef.currentUser.username];
      if(record) mergeServerUserProgress(stateRef.currentUser, record);
      stateRef.userDataStatus={storage:body.storage||'server users.json', fileSave:true, filePath:`user/${stateRef.currentUser.username}.json`, lastLoad:new Date().toLocaleTimeString(), lastSave:stateRef.userDataStatus?.lastSave||null, lastResult:'再読込しました'};
      loadSolved();
      render(stateRef, actionsAPI);
      return true;
    }catch{
      stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastResult:'再読込に失敗しました'};
      render(stateRef, actionsAPI);
      return false;
    }
  }
  prepareUserData('localStorage', false, '再読込しました');
  render(stateRef, actionsAPI);
  return true;
}
function prepareUserData(storage, fileSave, result='読込しました'){
  ensureUserProgress(stateRef.currentUser);
  stateRef.userDataStatus={
    storage,
    fileSave,
    filePath:fileSave&&stateRef.currentUser?.username?`user/${stateRef.currentUser.username}.json`:null,
    lastLoad:new Date().toLocaleTimeString(),
    lastSave:stateRef.userDataStatus?.lastSave||null,
    lastResult:result
  };
  loadSolved();
}
function setMode(mode){ stateRef.mode=mode; stateRef.page=1; render(stateRef, actionsAPI); }
function setPage(p){ stateRef.page=p; render(stateRef, actionsAPI); }
function setRankingMode(mode){ stateRef.ranking={...(stateRef.ranking||{}), mode, data:null, error:''}; render(stateRef, actionsAPI); loadRanking(); }
async function loadRanking(){
  const mode=stateRef.ranking?.mode||'Beginner';
  stateRef.ranking={...(stateRef.ranking||{}), mode, loading:true, error:''};
  render(stateRef, actionsAPI);
  try{
    const params=new URLSearchParams({difficulty:String(mode).toLowerCase(), username:stateRef.currentUser?.username||''});
    const res=await fetch(`/api/ranking?${params.toString()}`);
    if(!res.ok) throw new Error('ranking api unavailable');
    const body=await res.json();
    if(body.ok===false) throw new Error(body.message||'ranking api failed');
    stateRef.ranking={mode, loading:false, error:'', data:body};
  }catch{
    stateRef.ranking={mode, loading:false, error:'', data:buildLocalRanking(mode)};
  }
  render(stateRef, actionsAPI);
}
function buildLocalRanking(mode){
  const key=String(mode||'Beginner').toLowerCase();
  const payload=exportCurrentUserPayload(stateRef.currentUser);
  const entries=Object.values(payload.progress?.[key]||{}).map(entry=>{
    const clearTimeMs=entry.bestClearTimeMs??entry.latestClearTimeMs??entry.clearTimeMs??entry.bestTimeMs;
    if(typeof clearTimeMs!=='number') return null;
    return {rank:1, username:payload.user.username, puzzleId:entry.puzzleId, stageNo:entry.stageNo, title:entry.title||'', clearTimeMs, clearTimeText:entry.bestClearTimeText||entry.latestClearTimeText||entry.clearTimeText, clearedAt:entry.clearedAt, clearedAtText:entry.clearedAtText||entry.lastPlayedAtText};
  }).filter(Boolean).sort((a,b)=>a.clearTimeMs-b.clearTimeMs).slice(0,100).map((entry,index)=>({...entry, rank:index+1}));
  return {ok:true, source:'localStorage', difficulty:key, rankings:entries, currentUserRanks:entries.map(entry=>({stageNo:entry.stageNo, title:entry.title, rank:entry.rank, total:1, clearTimeMs:entry.clearTimeMs, clearTimeText:entry.clearTimeText}))};
}
function setOption(key,value){
  const next={...(stateRef.options||DEFAULT_OPTIONS)};
  if(key==='crosshairColor') next.crosshairColor=normalizeHexColor(value, DEFAULT_OPTIONS.crosshairColor);
  if(key==='bgmVolume') next.bgmVolume=clampVolume(value);
  if(key==='seVolume') next.seVolume=clampVolume(value);
  if(key==='displayMode') next.displayMode=['fullscreen','borderless','window'].includes(value)?value:'window';
  stateRef.options=next;
  saveOptions();
  applyDisplayMode(next.displayMode);
  render(stateRef, actionsAPI);
}
function resetOptions(){
  stateRef.options={...DEFAULT_OPTIONS};
  saveOptions();
  applyDisplayMode(stateRef.options.displayMode);
  render(stateRef, actionsAPI);
}
function loadOptions(){
  try{
    const raw=JSON.parse(localStorage.getItem(OPTIONS_KEY)||'{}');
    stateRef.options={
      crosshairColor:normalizeHexColor(raw.crosshairColor, DEFAULT_OPTIONS.crosshairColor),
      bgmVolume:clampVolume(raw.bgmVolume??DEFAULT_OPTIONS.bgmVolume),
      seVolume:clampVolume(raw.seVolume??DEFAULT_OPTIONS.seVolume),
      displayMode:['fullscreen','borderless','window'].includes(raw.displayMode)?raw.displayMode:DEFAULT_OPTIONS.displayMode
    };
  }catch{
    stateRef.options={...DEFAULT_OPTIONS};
  }
  applyDisplayMode(stateRef.options.displayMode);
}
function saveOptions(){ try{ localStorage.setItem(OPTIONS_KEY, JSON.stringify(stateRef.options)); }catch{} }
function normalizeHexColor(value,fallback){
  const text=String(value||'').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}
function clampVolume(value){ const n=Math.round(Number(value)); return Math.max(0, Math.min(100, Number.isFinite(n)?n:50)); }
function applyDisplayMode(mode){
  try{
    document.body.classList.toggle('pseudo-borderless', mode==='borderless');
    if(mode==='fullscreen' && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(()=>{});
    if(mode!=='fullscreen' && document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
  }catch{}
}
function currentColor(){ return stateRef.game?.colorMode==='color' ? normalizeColorId(stateRef.selectedColor||'1') : '1'; }
function setSelectedColor(id){ stateRef.selectedColor=normalizeColorId(id); render(stateRef, actionsAPI); }
function setHoverCell(row,col){ if(stateRef.modal) return; if(stateRef.hoverCell?.row===row&&stateRef.hoverCell?.col===col) return; stateRef.hoverCell={row, col}; render(stateRef, actionsAPI); }
function clearHoverCell(){ if(!stateRef.hoverCell) return; stateRef.hoverCell=null; render(stateRef, actionsAPI); }
function gameLocked(){ return stateRef.gameStatus==='cleared'||stateRef.gameStatus==='timeout'||stateRef.gameStatus==='giveup'; }
function inputBlocked(){ return !!stateRef.modal || !!stateRef.timer.expired || gameLocked(); }
function toggleCell(k){ if(inputBlocked()) return false; const s=stateRef.filled; const color=currentColor(); stateRef.crossed.delete(k); if(s.has(k)&&normalizeColorId(stateRef.cellColors.get(k))===color){ s.delete(k); stateRef.cellColors.delete(k); } else { s.add(k); stateRef.cellColors.set(k,color); } render(stateRef, actionsAPI); return true; }
function toggleCross(k){ if(inputBlocked()) return false; const s=stateRef.crossed; stateRef.filled.delete(k); stateRef.cellColors.delete(k); s.has(k)?s.delete(k):s.add(k); render(stateRef, actionsAPI); return true; }
function setFilled(k,color=currentColor()){ if(inputBlocked()) return false; color=normalizeColorId(color); const changed=stateRef.crossed.delete(k)||!stateRef.filled.has(k)||normalizeColorId(stateRef.cellColors.get(k))!==color; stateRef.filled.add(k); stateRef.cellColors.set(k,color); if(changed) render(stateRef, actionsAPI); return changed; }
function setCrossed(k){ if(inputBlocked()) return false; const changed=stateRef.filled.delete(k)||stateRef.cellColors.delete(k)||!stateRef.crossed.has(k); stateRef.crossed.add(k); if(changed) render(stateRef, actionsAPI); return changed; }
function beginDrag(mode,k){ if(inputBlocked()) return false; stateRef.drag={active:true, mode, start:k, moved:false}; return true; }
function applyDrag(k){ if(inputBlocked()) return false; const d=stateRef.drag; if(!d.active) return false; if(k!==d.start&&!d.moved){ d.moved=true; const first=d.mode==='fill'?setFilled(d.start):setCrossed(d.start); const next=d.mode==='fill'?setFilled(k):setCrossed(k); return first||next; } if(!d.moved) return false; return d.mode==='fill'?setFilled(k):setCrossed(k); }
function endDrag(k){ if(inputBlocked()) return false; const d=stateRef.drag; if(!d.active) return false; stateRef.drag={active:false, mode:null, start:null, moved:false}; if(!k) return false; if(d.moved) return false; if(k!==d.start){ const first=d.mode==='fill'?setFilled(d.start):setCrossed(d.start); const last=d.mode==='fill'?setFilled(k):setCrossed(k); return first||last; } return d.mode==='fill'?toggleCell(k):toggleCross(k); }
function cancelDrag(){ stateRef.drag={active:false, mode:null, start:null, moved:false}; }
function clear(){ if(inputBlocked()) return false; stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); cancelDrag(); render(stateRef, actionsAPI); return true; }
function hint(){ if(!stateRef.game||inputBlocked()) return false; return confirmModal(ACTION_TEXT.hintTitle, ACTION_TEXT.hintMessage, applyHint, ACTION_TEXT.use); }
function applyHint(){
  const G=stateRef.game; if(!G) return false;
  const candidates=hintCandidates(G);
  if(!candidates.length){ notify(ACTION_TEXT.hintTitle, ACTION_TEXT.noHint); return false; }
  const target=candidates[Math.floor(Math.random()*candidates.length)];
  const len=target.type==='row'?G.w:G.h;
  for(let i=0;i<len;i++){
    const x=target.type==='row'?i:target.index;
    const y=target.type==='row'?target.index:i;
    const value=G.solution[y]?.[x];
    if(isFilledValue(value)) setFilled(`${x},${y}`, value);
  }
  notify(ACTION_TEXT.hintTitle, target.type==='row'?ACTION_TEXT.hintRow(target.index):ACTION_TEXT.hintCol(target.index));
  return true;
}
function hintCandidates(G){
  const list=[];
  for(let y=0;y<G.h;y++) if(lineNeedsHint(G,'row',y)) list.push({type:'row',index:y});
  for(let x=0;x<G.w;x++) if(lineNeedsHint(G,'col',x)) list.push({type:'col',index:x});
  return list;
}
function lineNeedsHint(G,type,index){
  const len=type==='row'?G.w:G.h;
  for(let i=0;i<len;i++){
    const x=type==='row'?i:index;
    const y=type==='row'?index:i;
    const value=G.solution[y]?.[x];
    if(!isFilledValue(value)) continue;
    const k=`${x},${y}`;
    if(!stateRef.filled.has(k)) return true;
    if(G.colorMode==='color'&&normalizeColorId(stateRef.cellColors.get(k))!==normalizeColorId(value)) return true;
  }
  return false;
}
function giveUp(){ if(!stateRef.game||inputBlocked()) return; confirmModal(ACTION_TEXT.giveUpTitle, ACTION_TEXT.giveUpMessage, finishGiveUp, ACTION_TEXT.giveUp); }
function finishGiveUp(){ const entry=recordResult('giveup'); saveServerProgress(entry,'giveup'); stopTimer(); stateRef.gameStatus='giveup'; stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); cancelDrag(); stateRef.playSession=null; stateRef.game=null; stateRef.screen='select'; render(stateRef, actionsAPI); }
function formatTime(sec){ if(sec==null) return TIMER_TEXT.unlimited; const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function updateTimerNode(){ const el=stateRef.root?.querySelector?.('.timer-value'); if(el) el.textContent=formatTime(stateRef.timer.remaining); }
function pauseTimer(reason='modal'){ if(stateRef.screen!=='game'||stateRef.gameStatus!=='playing'||stateRef.timer.limit==null) return; stateRef.timer.running=false; stateRef.timer.paused=true; stateRef.timer.pauseReason=reason; }
function resumeTimer(){ if(stateRef.screen!=='game'||stateRef.gameStatus!=='playing'||!stateRef.timer.paused||stateRef.modal) return; stateRef.timer.running=stateRef.timer.limit!=null; stateRef.timer.paused=false; stateRef.timer.pauseReason=null; }
function stopTimer(){ if(stateRef.timer.intervalId) clearInterval(stateRef.timer.intervalId); stateRef.timer.intervalId=null; stateRef.timer.running=false; stateRef.timer.paused=false; stateRef.timer.pauseReason=null; }
function finishClear(){ if(stateRef.gameStatus==='cleared') return false; stateRef.gameStatus='cleared'; markCurrentPuzzleSolved(); const entry=recordResult('clear'); saveServerProgress(entry,'clear'); stopTimer(); cancelDrag(); notify(ACTION_TEXT.clearTitle, ACTION_TEXT.clearMessage, [{label:ACTION_TEXT.ok, action:'close'}, {label:ACTION_TEXT.select, action:'backToSelect'}]); return true; }
function showCheckResult(solved){ if(stateRef.gameStatus==='cleared') return false; if(solved) return finishClear(); notify(ACTION_TEXT.unsolvedTitle, ACTION_TEXT.unsolvedMessage); return false; }
function startTimer(mode){ stopTimer(); const limit=TIMER_LIMITS[mode]??null; stateRef.timer={limit, remaining:limit, running:limit!=null, intervalId:null, expired:false, paused:false, pauseReason:null}; if(limit==null) return; stateRef.timer.intervalId=setInterval(()=>{ if(!stateRef.timer.running) return; stateRef.timer.remaining=Math.max(0, stateRef.timer.remaining-1); updateTimerNode(); if(stateRef.timer.remaining<=0){ stopTimer(); stateRef.timer.expired=true; stateRef.gameStatus='timeout'; const entry=recordResult('fail'); saveServerProgress(entry,'fail'); cancelDrag(); notify(TIMER_TEXT.timeoutTitle, TIMER_TEXT.timeoutMessage, [{label:ACTION_TEXT.select, action:'backToSelect'}, {label:ACTION_TEXT.retry, action:'retry'}]); } },1000); }
function toggleSolved(mode,id){ const S=stateRef.solved[mode]; S.has(id)?S.delete(id):S.add(String(id)); persistSolved(); render(stateRef, actionsAPI); }
function resetClearFlags(){ confirmModal(ACTION_TEXT.resetClearTitle, ACTION_TEXT.resetClearMessage, ()=>resetSolvedData(ACTION_TEXT.resetClearTitle), ACTION_TEXT.delete); }
function resetUserData(){ confirmModal(ACTION_TEXT.resetUserTitle, ACTION_TEXT.resetUserMessage, ()=>resetSolvedData(ACTION_TEXT.resetUserTitle), ACTION_TEXT.delete); }
function resetSolvedData(title){ for(const k of Object.keys(stateRef.solved)){ stateRef.solved[k]=new Set(); } resetProgressForUser(stateRef.currentUser); notify(title, ACTION_TEXT.resetDone); }
async function play(mode,id){ const list=await loadPuzzles(mode); const p=findPuzzle(list,id); if(!p){ notify(ACTION_TEXT.pendingTitle, ACTION_TEXT.puzzleMissing); return; }
  const difficulty=p.difficulty||MODE_TO_DIFFICULTY[mode]||'beginner'; const colorMode=normalizeColorMode(p.colorMode||p.mode||'mono',difficulty);
  stateRef.game={ mode, id:String(p.id??p.stageNo??id), stageNo:p.stageNo, title:p.title||`#${p.stageNo??p.id}`, w:p.w, h:p.h, difficulty, colorMode, solution:(p.grid||[]).map(r=>r.map(v=>normalizeColorId(v))) };
  stateRef.playSession=makePlaySession(stateRef.game); stateRef.modal=null; stateRef.hoverCell=null; stateRef.gameStatus='playing'; stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); stateRef.selectedColor=firstUsedColor(stateRef.game.solution); cancelDrag(); startTimer(mode); stateRef.screen='game'; render(stateRef, actionsAPI);
}
function playCustom(p){ const difficulty=p.difficulty||'normal'; const colorMode=normalizeColorMode(p.colorMode||p.solutionMode||p.modeType||'mono',difficulty);
  stateRef.game={ mode:p.mode||'Custom', id:String(p.id||'custom'), title:p.title||'カスタム', w:p.w, h:p.h, returnTo:p.returnTo||'select', difficulty, colorMode, solution:(p.grid||[]).map(r=>r.map(v=>normalizeColorId(v))) };
  stateRef.playSession=makePlaySession(stateRef.game); stateRef.modal=null; stateRef.hoverCell=null; stateRef.gameStatus='playing'; stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); stateRef.selectedColor=firstUsedColor(stateRef.game.solution); cancelDrag(); startTimer('Custom'); stateRef.screen='game'; render(stateRef, actionsAPI);
}
function firstUsedColor(solution){ const used=new Set(); for(const row of solution||[]) for(const v of row||[]){ const id=normalizeColorId(v); if(isFilledValue(id)) used.add(id); } return MC_COLORS.find(c=>used.has(c.id))?.id || '1'; }
function openModal(modal){ cancelDrag(); pauseTimer('modal'); stateRef.modal={ title:modal.title||'', message:modal.message||'', buttons:modal.buttons?.length?modal.buttons:[{label:ACTION_TEXT.ok, action:'close'}] }; render(stateRef, actionsAPI); return true; }
function closeModal(){ stateRef.modal=null; resumeTimer(); render(stateRef, actionsAPI); }
function notify(title,message,buttons){ return openModal({title,message,buttons}); }
function confirmModal(title,message,onConfirm,confirmLabel=ACTION_TEXT.ok){ return openModal({title,message,buttons:[{label:ACTION_TEXT.cancel, action:'close'}, {label:confirmLabel, run:onConfirm}]}); }
function handleModalButton(index){ const modal=stateRef.modal; const btn=modal?.buttons?.[index]; if(!btn){ closeModal(); return; } const run=btn.run; const action=btn.action||'close'; if(btn.close!==false) stateRef.modal=null; if(run){ run(); return; } if(action==='backToSelect'){ stopTimer(); stateRef.gameStatus='idle'; stateRef.playSession=null; stateRef.game=null; stateRef.screen='select'; render(stateRef, actionsAPI); return; } if(action==='retry'){ retryGame(); return; } resumeTimer(); render(stateRef, actionsAPI); }
function retryGame(){ if(!stateRef.game){ stateRef.gameStatus='idle'; stateRef.screen='select'; render(stateRef, actionsAPI); return; } stateRef.gameStatus='playing'; stateRef.playSession=makePlaySession(stateRef.game); stateRef.filled.clear(); stateRef.cellColors.clear(); stateRef.crossed.clear(); stateRef.selectedColor=firstUsedColor(stateRef.game.solution); cancelDrag(); startTimer(stateRef.game.mode||'Custom'); render(stateRef, actionsAPI); }
function markCurrentPuzzleSolved(){ const G=stateRef.game; if(!G||!stateRef.solved[G.mode]) return; stateRef.solved[G.mode].add(String(G.stageNo??G.id)); persistSolved(); }
function loadSolved(){ stateRef.solved=loadSolvedForUser(stateRef.currentUser, stateRef.solved); }
function persistSolved(){ persistSolvedForUser(stateRef.currentUser, stateRef.solved); try{ localStorage.removeItem(LS_KEY); }catch{} }
function makePlaySession(game){
  const now=new Date();
  return {currentUserId:stateRef.currentUser?.id||userIdFor(stateRef.currentUser?.username||'guest'), username:stateRef.currentUser?.username||'guest', difficulty:game?.difficulty, puzzleId:String(game?.stageNo??game?.id??'unknown'), stageNo:game?.stageNo??game?.id, startedAt:now.toISOString(), startedTimeMs:now.getTime()};
}
function recordResult(type){
  const entry=recordGameResultForUser(stateRef.currentUser, stateRef.game, stateRef.timer, type, stateRef.playSession);
  stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:entry ? `${type}を保存しました` : '保存対象がありません'};
  return entry;
}
function saveServerProgress(entry,type='clear'){ if(stateRef.currentUser?.source!=='server'||!entry) return; apiPost('/api/user-progress',{username:stateRef.currentUser.username, mode:String(stateRef.game?.mode||'Custom').toLowerCase(), type, entry}).then(()=>{ stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:'userフォルダJSONへ保存しました'}; }).catch(()=>{ stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:'server保存に失敗しました'}; }); }
