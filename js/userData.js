const USERS_KEY = 'picross_v2_users';
const USER_DATA_KEY = 'picross_v2_user_data';
const LEGACY_SOLVED_KEY = 'picross_v2_solved';
const DEV_ADMIN = { id:'user_admin', username:'admin', password:'admin', createdAt:'2026-05-18T00:00:00.000Z', source:'built-in' };
const MODE_KEYS = ['beginner', 'easy', 'normal', 'hard', 'endless', 'custom'];
const HISTORY_LIMIT = 300;

export const USER_DATA_KEYS = { users:USERS_KEY, data:USER_DATA_KEY, legacySolved:LEGACY_SOLVED_KEY };

export function formatDateTimeForDisplay(value){
  if(!value) return '-';
  const date=value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return '-';
  const pad=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function userIdFor(username){
  return `user_${String(username||'guest').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'_')}`;
}

export function loadUsers(){
  const stored=readJson(USERS_KEY, {users:[]});
  const users=Array.isArray(stored.users)?stored.users:[];
  if(!users.some(u=>u.username===DEV_ADMIN.username)) users.unshift(DEV_ADMIN);
  return {users};
}

export function registerLocalUser(username,password){
  username=String(username||'').trim(); password=String(password||'');
  if(!username||!password) return {ok:false, message:'required'};
  const data=loadUsers();
  if(data.users.some(u=>u.username===username)) return {ok:false, message:'duplicate'};
  const user={id:userIdFor(username), username, password, createdAt:new Date().toISOString(), source:'local'};
  data.users.push(user);
  writeJson(USERS_KEY, data);
  ensureUserProgress(user);
  return {ok:true, user:{username, id:user.id}};
}

export function authenticateLocalUser(username,password){
  username=String(username||'').trim(); password=String(password||'');
  const user=loadUsers().users.find(u=>u.username===username&&u.password===password);
  return user ? {username:user.username, id:user.id||userIdFor(user.username), source:user.source||'local'} : null;
}

export function ensureUserProgress(user){
  const data=loadUserData();
  const id=currentUserId(user);
  const record=normalizeUserRecord(data.users[id], user);
  data.users[id]=record;
  writeJson(USER_DATA_KEY, data);
  return record;
}

export function getUserRecord(user){
  return ensureUserProgress(user);
}

export function loadSolvedForUser(user, modes){
  const solved=emptySolved(modes);
  const id=currentUserId(user);
  const data=loadUserData();
  const existing=data.users[id];
  if(existing){
    const record=normalizeUserRecord(existing, user);
    data.users[id]=record;
    writeJson(USER_DATA_KEY, data);
    for(const mode of Object.keys(solved)){
      const key=mode.toLowerCase();
      for(const [puzzleId, entry] of Object.entries(record.progress[key]||{})){
        if(entry?.cleared) solved[mode].add(String(puzzleId));
      }
    }
    return solved;
  }
  const record=ensureUserProgress(user);
  const legacy=readJson(LEGACY_SOLVED_KEY, null);
  if(legacy){
    for(const mode of Object.keys(solved)){
      const key=mode.toLowerCase();
      record.progress[key]=record.progress[key]||{};
      for(const puzzleId of legacy[mode]||[]){
        const idText=String(puzzleId);
        solved[mode].add(idText);
        record.progress[key][idText]={...(record.progress[key][idText]||{}), difficulty:key, puzzleId:idText, stageNo:puzzleId, cleared:true};
      }
    }
    const userData=loadUserData();
    userData.users[id]=record;
    writeJson(USER_DATA_KEY, userData);
  }
  return solved;
}

export function persistSolvedForUser(user, solved){
  const data=loadUserData();
  const id=currentUserId(user);
  const record=normalizeUserRecord(data.users[id], user);
  for(const mode of Object.keys(solved)){
    const key=mode.toLowerCase();
    const old=record.progress[key]||{};
    const next={};
    for(const puzzleId of solved[mode]||[]){
      const idText=String(puzzleId);
      next[idText]={...(old[idText]||{}), difficulty:key, puzzleId:idText, stageNo:puzzleId, cleared:true};
    }
    record.progress[key]=next;
  }
  record.user.updatedAt=new Date().toISOString();
  record.user.updatedAtText=formatDateTimeForDisplay(record.user.updatedAt);
  data.users[id]=record;
  writeJson(USER_DATA_KEY, data);
}

export function recordClearForUser(user, game, timer, session){
  return recordGameResultForUser(user, game, timer, 'clear', session);
}

export function recordGameResultForUser(user, game, timer, type='clear', session){
  if(!game) return null;
  type=normalizeResultType(type);
  const data=loadUserData();
  const id=currentUserId(user);
  const record=normalizeUserRecord(data.users[id], user);
  const modeKey=modeKeyFor(game.mode||game.difficulty||'custom');
  const puzzleId=String(game.stageNo??game.id??'unknown');
  const now=new Date().toISOString();
  const nowText=formatDateTimeForDisplay(now);
  const playTimeMs=playTimeMsFromTimer(timer, session);
  const playTimeText=formatTimeMs(playTimeMs);
  const old=record.progress[modeKey]?.[puzzleId]||{};
  const entry={
    ...old,
    type,
    difficulty:game.difficulty||modeKey,
    puzzleId,
    stageNo:game.stageNo??game.id,
    lastPlayedAt:now,
    lastPlayedAtText:nowText,
    latestPlayTimeMs:playTimeMs,
    latestPlayTimeText:playTimeText,
    updatedAt:now,
    updatedAtText:nowText
  };
  if(type==='clear'){
    const clearCount=(old.clearCount||0)+1;
    const bestClearTimeMs=typeof playTimeMs==='number' ? (typeof old.bestClearTimeMs==='number'?Math.min(old.bestClearTimeMs, playTimeMs):playTimeMs) : old.bestClearTimeMs;
    Object.assign(entry, {
      cleared:true,
      clearCount,
      latestClearTimeMs:playTimeMs,
      latestClearTimeText:playTimeText,
      bestClearTimeMs,
      bestClearTimeText:formatTimeMs(bestClearTimeMs),
      bestTimeMs:bestClearTimeMs,
      clearTimeMs:playTimeMs,
      clearTimeText:playTimeText,
      clearedAt:now,
      clearedAtText:nowText
    });
  }else if(type==='fail'){
    Object.assign(entry, {
      failed:true,
      failCount:(old.failCount||0)+1,
      latestFailTimeMs:playTimeMs,
      latestFailTimeText:playTimeText,
      failedAt:now,
      failedAtText:nowText
    });
  }else{
    Object.assign(entry, {
      giveupCount:(old.giveupCount||0)+1,
      latestGiveupTimeMs:playTimeMs,
      latestGiveupTimeText:playTimeText,
      gaveUpAt:now,
      gaveUpAtText:nowText
    });
  }
  record.progress[modeKey]={...(record.progress[modeKey]||{}), [puzzleId]:entry};
  record.stats.totalPlayCount+=1;
  if(type==='clear') record.stats.totalClearCount+=1;
  if(type==='fail') record.stats.totalFailCount+=1;
  if(type==='giveup') record.stats.totalGiveupCount+=1;
  if(typeof playTimeMs==='number') record.stats.totalPlayTimeMs+=playTimeMs;
  record.history.push({type, difficulty:modeKey, puzzleId, stageNo:entry.stageNo, playTimeMs, playTimeText, createdAt:now, createdAtText:nowText});
  if(record.history.length>HISTORY_LIMIT) record.history=record.history.slice(-HISTORY_LIMIT);
  record.user.updatedAt=now;
  record.user.updatedAtText=nowText;
  data.users[id]=record;
  writeJson(USER_DATA_KEY, data);
  return entry;
}

export function mergeServerUserProgress(user, progress={}){
  const data=loadUserData();
  const id=currentUserId(user);
  data.users[id]=normalizeUserRecord(progress.progress?progress:{progress}, user);
  writeJson(USER_DATA_KEY, data);
}

export function resetProgressForUser(user){
  const data=loadUserData();
  const id=currentUserId(user);
  const record=normalizeUserRecord(data.users[id], user);
  record.stats=emptyStats();
  record.progress=emptyProgress();
  record.history=[];
  record.user.updatedAt=new Date().toISOString();
  record.user.updatedAtText=formatDateTimeForDisplay(record.user.updatedAt);
  data.users[id]=record;
  writeJson(USER_DATA_KEY, data);
  try{ localStorage.removeItem(LEGACY_SOLVED_KEY); }catch{}
}

export function exportUserDataPayload(){
  const users=loadUsers().users.map(({password, ...safe})=>safe);
  const data=loadUserData();
  const progress={};
  for(const [id, record] of Object.entries(data.users||{})) progress[id]=normalizeUserRecord(record, {id, username:record?.username});
  return {version:1, exportedAt:new Date().toISOString(), storage:'localStorage', storageKeys:USER_DATA_KEYS, users, progress};
}

export function exportCurrentUserPayload(user){
  const id=currentUserId(user);
  const record=ensureUserProgress(user);
  return {
    version:1,
    exportedAt:new Date().toISOString(),
    storage:'localStorage',
    storageKey:USER_DATA_KEY,
    user:{...record.user, id, username:record.user.username||user?.username||'guest', source:user?.source||record.user.source||'local'},
    stats:record.stats,
    progress:record.progress,
    history:record.history
  };
}

export function downloadUserDataJson(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const name=`picross_user_data_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
  downloadJson(name, exportUserDataPayload());
}

export function downloadCurrentUserJson(user){
  const payload=exportCurrentUserPayload(user);
  downloadJson(`${safeFilename(payload.user.username)}.json`, payload);
}

function normalizeUserRecord(record, user){
  const now=new Date().toISOString();
  const username=user?.username||record?.user?.username||record?.username||'guest';
  const id=user?.id||record?.user?.id||userIdFor(username);
  const createdAt=user?.createdAt||record?.user?.createdAt||now;
  const updatedAt=record?.user?.updatedAt||now;
  return {
    version:1,
    user:{
      id,
      username,
      createdAt,
      createdAtText:record?.user?.createdAtText||formatDateTimeForDisplay(createdAt),
      updatedAt,
      updatedAtText:record?.user?.updatedAtText||formatDateTimeForDisplay(updatedAt),
      source:user?.source||record?.user?.source||'local'
    },
    stats:{...emptyStats(), ...(record?.stats||{})},
    progress:normalizeProgress(record?.progress),
    history:Array.isArray(record?.history)?record.history:[]
  };
}

function normalizeProgress(progress){
  const normalized=emptyProgress();
  for(const [mode, entries] of Object.entries(progress||{})){
    const key=modeKeyFor(mode);
    normalized[key]={...(normalized[key]||{})};
    for(const [puzzleId, entry] of Object.entries(entries||{})) normalized[key][puzzleId]=withDateTexts(entry);
  }
  return normalized;
}

function withDateTexts(entry){
  if(!entry||typeof entry!=='object') return entry;
  const next={...entry};
  for(const key of ['createdAt','updatedAt','clearedAt','failedAt','gaveUpAt','lastPlayedAt']){
    if(next[key]&&!next[`${key}Text`]) next[`${key}Text`]=formatDateTimeForDisplay(next[key]);
  }
  return next;
}

function emptyStats(){ return {totalPlayCount:0, totalClearCount:0, totalFailCount:0, totalGiveupCount:0, totalPlayTimeMs:0}; }
function emptyProgress(){ return Object.fromEntries(MODE_KEYS.map(mode=>[mode, {}])); }
function currentUserId(user){ return user?.id || userIdFor(user?.username||'guest'); }
function loadUserData(){ return readJson(USER_DATA_KEY, {version:1, users:{}}); }
function modeKeyFor(mode){ const key=String(mode||'custom').toLowerCase(); return MODE_KEYS.includes(key)?key:'custom'; }
function normalizeResultType(type){ return ['clear','fail','giveup'].includes(type)?type:'clear'; }
function safeFilename(value){ return String(value||'guest').trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g,'_')||'guest'; }
function emptySolved(modes){ return Object.fromEntries(Object.keys(modes).map(mode=>[mode,new Set()])); }
function playTimeMsFromTimer(timer, session){
  if(typeof timer?.limit==='number'&&typeof timer?.remaining==='number') return Math.max(0, timer.limit-timer.remaining)*1000;
  if(typeof session?.startedTimeMs==='number') return Math.max(0, Date.now()-session.startedTimeMs);
  return null;
}
function formatTimeMs(ms){
  if(typeof ms!=='number') return null;
  const total=Math.floor(ms/1000);
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const s=total%60;
  return h>0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function downloadJson(filename, payload){
  const blob=new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function readJson(key,fallback){ try{ const raw=localStorage.getItem(key); return raw?JSON.parse(raw):fallback; }catch{ return fallback; } }
function writeJson(key,value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch{} }
