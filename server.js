require('dotenv').config();

const http = require('node:http');
const { readFile, writeFile, access, mkdir, readdir } = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { publicConfigJson, renderConfigStatusHtml } = require('./api/_supabaseConfigStatus');
const adminAuthCheckHandler = require('./api/admin-auth-check');
const adminDeleteAuthUserHandler = require('./api/admin-delete-auth-user');
const adminUpdateAuthEmailHandler = require('./api/admin-update-auth-email');
const adminUploadPuzzlesHandler = require('./api/admin-upload-puzzles');
const adminResetAuthUserHandler = require('./api/admin-reset-auth-user');
const userChangeEmailHandler = require('./api/user-change-email');
const resolveLoginEmailHandler = require('./api/resolve-login-email');
const saveRankingRecordHandler = require('./api/save-ranking-record');

const rootDir = __dirname;
const port = Number(process.env.PORT || 8000);
const usersFile = process.env.USERS_FILE || path.join(rootDir, 'users.json');
const userDir = process.env.USER_DIR || path.join(rootDir, 'user');
const devAdmin = { id:'user_admin', username: 'admin', password: 'admin', createdAt: '2026-05-17T00:00:00.000Z', source:'built-in' };
const modeKeys = ['beginner', 'easy', 'normal', 'hard', 'endless', 'custom'];
const historyLimit = 300;
const localSessions = new Map();
const localSessionMaxAgeMs = 12 * 60 * 60 * 1000;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

async function ensureUsersFile(){
  await mkdir(userDir, { recursive:true });
  try{
    await access(usersFile);
  }catch{
    await mkdir(path.dirname(usersFile), { recursive:true });
    await writeFile(usersFile, JSON.stringify([devAdmin], null, 2), 'utf8');
  }
}

async function readUsers(){
  await ensureUsersFile();
  try{
    const data = JSON.parse(await readFile(usersFile, 'utf8'));
    return Array.isArray(data) ? data : (Array.isArray(data.users) ? data.users : [devAdmin]);
  }catch{
    return [devAdmin];
  }
}

async function writeUsers(users){
  await mkdir(path.dirname(usersFile), { recursive:true });
  await writeFile(usersFile, JSON.stringify({ version:1, updatedAt:new Date().toISOString(), users, progress:{} }, null, 2), 'utf8');
}

function safeUsername(username){
  return String(username||'guest').trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_') || 'guest';
}

function userJsonPath(username){
  return path.join(userDir, `${safeUsername(username)}.json`);
}

function emptyProgress(){
  return Object.fromEntries(modeKeys.map(mode => [mode, {}]));
}

function emptyStats(){
  return { totalPlayCount:0, totalClearCount:0, totalFailCount:0, totalGiveupCount:0, totalPlayTimeMs:0 };
}

function modeKeyFor(mode){
  const key=String(mode||'custom').toLowerCase();
  return modeKeys.includes(key) ? key : 'custom';
}

function formatTimeMs(ms){
  if(typeof ms !== 'number') return null;
  const total=Math.floor(ms/1000);
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const s=total%60;
  return h>0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatDateTimeForDisplay(value){
  if(!value) return '-';
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return '-';
  const pad=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
  if(!entry || typeof entry !== 'object') return entry;
  const next={...entry};
  for(const key of ['createdAt','updatedAt','clearedAt','failedAt','gaveUpAt','lastPlayedAt']){
    if(next[key]&&!next[`${key}Text`]) next[`${key}Text`]=formatDateTimeForDisplay(next[key]);
  }
  return next;
}

function normalizeUserData(data, user){
  const now=new Date().toISOString();
  const createdAt=user.createdAt||data?.user?.createdAt||now;
  const updatedAt=data?.user?.updatedAt||now;
  return {
    version:1,
    user:{ id:user.id||data?.user?.id||`user_${safeUsername(user.username).toLowerCase()}`, username:user.username, createdAt, createdAtText:data?.user?.createdAtText||formatDateTimeForDisplay(createdAt), updatedAt, updatedAtText:data?.user?.updatedAtText||formatDateTimeForDisplay(updatedAt), source:user.source||data?.user?.source||'local-server' },
    stats:{...emptyStats(), ...(data?.stats||{})},
    progress:normalizeProgress(data?.progress),
    history:Array.isArray(data?.history)?data.history:[]
  };
}

async function ensureUserJson(user){
  await mkdir(userDir, { recursive:true });
  const file=userJsonPath(user.username);
  try{
    const data=JSON.parse(await readFile(file, 'utf8'));
    const next=normalizeUserData(data, user);
    next.user.updatedAt=new Date().toISOString();
    next.user.updatedAtText=formatDateTimeForDisplay(next.user.updatedAt);
    await writeFile(file, JSON.stringify(next, null, 2), 'utf8');
    return next;
  }catch{
    const now=new Date().toISOString();
    const initial={ version:1, user:{ id:user.id||`user_${safeUsername(user.username).toLowerCase()}`, username:user.username, createdAt:user.createdAt||now, createdAtText:formatDateTimeForDisplay(user.createdAt||now), updatedAt:now, updatedAtText:formatDateTimeForDisplay(now), source:user.source||'local-server' }, stats:emptyStats(), progress:emptyProgress(), history:[] };
    await writeFile(file, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

async function saveUserProgress(username, mode, entry, type){
  const users=await readUsers();
  const user=users.find(u=>u.username===username);
  if(!user) return null;
  const data=await ensureUserJson(user);
  const key=modeKeyFor(mode);
  const puzzleId=String(entry?.stageNo??entry?.puzzleId??'unknown');
  type=['clear','fail','giveup'].includes(type||entry?.type) ? (type||entry?.type) : 'clear';
  const now=new Date().toISOString();
  const nowText=formatDateTimeForDisplay(now);
  const playTimeMs=entry?.latestPlayTimeMs??entry?.playTimeMs??entry?.clearTimeMs??entry?.latestFailTimeMs??entry?.latestGiveupTimeMs??null;
  const playTimeText=entry?.latestPlayTimeText??entry?.playTimeText??entry?.clearTimeText??formatTimeMs(playTimeMs);
  const old=data.progress[key]?.[puzzleId]||{};
  const latest={...old, ...entry, type, difficulty:entry?.difficulty||key, puzzleId, lastPlayedAt:now, lastPlayedAtText:nowText, latestPlayTimeMs:playTimeMs, latestPlayTimeText:playTimeText, updatedAt:now, updatedAtText:nowText};
  if(type==='clear'){
    const bestClearTimeMs=typeof playTimeMs==='number' ? (typeof old.bestClearTimeMs==='number'?Math.min(old.bestClearTimeMs, playTimeMs):playTimeMs) : old.bestClearTimeMs;
    Object.assign(latest, {cleared:true, clearCount:(old.clearCount||0)+1, latestClearTimeMs:playTimeMs, latestClearTimeText:playTimeText, bestClearTimeMs, bestClearTimeText:formatTimeMs(bestClearTimeMs), bestTimeMs:bestClearTimeMs, clearTimeMs:playTimeMs, clearTimeText:playTimeText, clearedAt:now, clearedAtText:nowText});
  }else if(type==='fail'){
    Object.assign(latest, {failed:true, failCount:(old.failCount||0)+1, latestFailTimeMs:playTimeMs, latestFailTimeText:playTimeText, failedAt:now, failedAtText:nowText});
  }else{
    Object.assign(latest, {giveupCount:(old.giveupCount||0)+1, latestGiveupTimeMs:playTimeMs, latestGiveupTimeText:playTimeText, gaveUpAt:now, gaveUpAtText:nowText});
  }
  data.progress[key]={...(data.progress[key]||{}), [puzzleId]:latest};
  data.stats={...emptyStats(), ...(data.stats||{})};
  data.stats.totalPlayCount+=1;
  if(type==='clear') data.stats.totalClearCount+=1;
  if(type==='fail') data.stats.totalFailCount+=1;
  if(type==='giveup') data.stats.totalGiveupCount+=1;
  if(typeof playTimeMs==='number') data.stats.totalPlayTimeMs+=playTimeMs;
  data.history=Array.isArray(data.history)?data.history:[];
  data.history.push({type, difficulty:key, puzzleId, stageNo:latest.stageNo, playTimeMs, playTimeText, createdAt:now, createdAtText:nowText});
  if(data.history.length>historyLimit) data.history=data.history.slice(-historyLimit);
  data.user.updatedAt=now;
  data.user.updatedAtText=nowText;
  await writeFile(userJsonPath(username), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

async function buildRanking(difficulty='beginner', currentUsername=''){
  const key=modeKeyFor(difficulty);
  const titleMap=await loadPuzzleTitleMap(key);
  const files=await listUserJsonFiles();
  const rows=[];
  for(const file of files){
    let data;
    try{ data=JSON.parse(await readFile(path.join(userDir, file), 'utf8')); }catch{ continue; }
    const username=data.user?.username||path.basename(file,'.json');
    for(const [puzzleId, entry] of Object.entries(data.progress?.[key]||{})){
      const clearTimeMs=entry.bestClearTimeMs??entry.latestClearTimeMs??entry.clearTimeMs??entry.bestTimeMs;
      if(typeof clearTimeMs!=='number') continue;
      const stageNo=entry.stageNo??entry.puzzleId??puzzleId;
      rows.push({
        username,
        puzzleId:String(entry.puzzleId??puzzleId),
        stageNo,
        title:entry.title||titleMap.get(String(stageNo))||titleMap.get(String(puzzleId))||'',
        clearTimeMs,
        clearTimeText:entry.bestClearTimeText||entry.latestClearTimeText||entry.clearTimeText||formatTimeMs(clearTimeMs),
        clearedAt:entry.clearedAt||entry.lastPlayedAt||entry.updatedAt,
        clearedAtText:entry.clearedAtText||entry.lastPlayedAtText||entry.updatedAtText||formatDateTimeForDisplay(entry.clearedAt||entry.lastPlayedAt||entry.updatedAt)
      });
    }
  }
  rows.sort((a,b)=>a.clearTimeMs-b.clearTimeMs || Date.parse(a.clearedAt||0)-Date.parse(b.clearedAt||0) || String(a.username).localeCompare(String(b.username)));
  const ranked=rows.map((row,index)=>({...row, rank:index+1}));
  const rankings=ranked.slice(0,100);
  const currentUserRanks=ranked.filter(row=>row.username===currentUsername).slice(0,20).map(row=>({stageNo:row.stageNo, title:row.title, rank:row.rank, total:ranked.length, clearTimeMs:row.clearTimeMs, clearTimeText:row.clearTimeText}));
  return {ok:true, source:'user folder', difficulty:key, rankings, currentUserRanks};
}

async function listUserJsonFiles(){
  try{
    await mkdir(userDir, {recursive:true});
    return (await readdir(userDir)).filter(file=>file.toLowerCase().endsWith('.json'));
  }catch{
    return [];
  }
}

async function loadPuzzleTitleMap(difficulty){
  const map=new Map();
  try{
    const raw=JSON.parse(await readFile(path.join(rootDir, 'data', `${difficulty}.json`), 'utf8'));
    const list=Array.isArray(raw)?raw:(Array.isArray(raw.puzzles)?raw.puzzles:[]);
    list.forEach((p,index)=>{
      const stageNo=String(p.stageNo??p.no??index+1);
      if(p.title||p.name) map.set(stageNo, p.title||p.name);
      if(p.id!=null && (p.title||p.name)) map.set(String(p.id), p.title||p.name);
    });
  }catch{}
  return map;
}

function sendJson(res, status, body){
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function issueLocalSession(user){
  const token = crypto.randomBytes(32).toString('base64url');
  localSessions.set(token, {
    username: user.username,
    userId: user.id || `user_${safeUsername(user.username).toLowerCase()}`,
    createdAt: Date.now(),
  });
  return token;
}

function verifyLocalSession(token, username){
  const cleanToken = String(token || '').trim();
  const cleanUsername = String(username || '').trim();
  const session = cleanToken ? localSessions.get(cleanToken) : null;
  if(!session) return false;
  if(Date.now() - Number(session.createdAt || 0) > localSessionMaxAgeMs){
    localSessions.delete(cleanToken);
    return false;
  }
  return session.username === cleanUsername;
}

async function invokeApiHandler(handler, req, res){
  const headers = {};
  const wrapper = {
    setHeader(name, value){ headers[name] = value; },
    statusCode: 200,
    status(status){ this.statusCode = status; return this; },
    json(body){
      res.writeHead(this.statusCode || 200, { 'Content-Type':'application/json; charset=utf-8', ...headers });
      res.end(JSON.stringify(body));
    },
    send(body){
      res.writeHead(this.statusCode || 200, headers);
      res.end(body);
    },
  };
  await handler(req, wrapper);
}

async function readBody(req){
  let body = '';
  for await (const chunk of req){
    body += chunk;
    if(body.length > 65536) throw new Error('body too large');
  }
  return body ? JSON.parse(body) : {};
}

async function handleApi(req, res){
  if(req.method === 'GET' && req.url === '/api/supabase-config'){
    sendJson(res, 200, publicConfigJson());
    return;
  }
  if(req.method === 'GET' && req.url === '/api/supabase-config-status'){
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
    res.end(renderConfigStatusHtml());
    return;
  }
  if(req.method === 'GET' && req.url === '/api/admin-auth-check'){
    await invokeApiHandler(adminAuthCheckHandler, req, res);
    return;
  }
  if(req.method === 'POST' && req.url === '/api/admin-delete-auth-user'){
    await invokeApiHandler(adminDeleteAuthUserHandler, req, res);
    return;
  }
  if(req.method === 'POST' && req.url === '/api/admin-update-auth-email'){
    await invokeApiHandler(adminUpdateAuthEmailHandler, req, res);
    return;
  }
  if(req.method === 'POST' && req.url === '/api/admin-upload-puzzles'){
    await invokeApiHandler(adminUploadPuzzlesHandler, req, res);
    return;
  }
  if(req.method === 'POST' && req.url === '/api/admin-reset-auth-user'){
    await invokeApiHandler(adminResetAuthUserHandler, req, res);
    return;
  }
  if(req.method === 'POST' && req.url === '/api/user-change-email'){
    await invokeApiHandler(userChangeEmailHandler, req, res);
    return;
  }
  if(req.method === 'POST' && req.url === '/api/resolve-login-email'){
    await invokeApiHandler(resolveLoginEmailHandler, req, res);
    return;
  }
  if(req.method === 'POST' && req.url === '/api/save-ranking-record'){
    await invokeApiHandler(saveRankingRecordHandler, req, res);
    return;
  }
  if(req.method === 'GET' && req.url?.startsWith('/api/ranking')){
    const url=new URL(req.url, `http://${req.headers.host||'127.0.0.1'}`);
    const data=await buildRanking(url.searchParams.get('difficulty')||'beginner', url.searchParams.get('username')||'');
    sendJson(res, 200, data);
    return;
  }
  if(req.method === 'GET' && req.url === '/api/user-data'){
    const users = await readUsers();
    const progress={};
    for(const user of users){
      const file=await ensureUserJson(user);
      progress[user.id||safeUsername(user.username)]={user:file.user, username:user.username, stats:file.stats, progress:file.progress, history:file.history};
    }
    sendJson(res, 200, { ok:true, version:1, storage:'server users.json', userDir, users:users.map(({password, ...safe})=>safe), progress });
    return;
  }
  if(req.method !== 'POST'){
    sendJson(res, 405, { ok:false, message:'POSTのみ対応しています' });
    return;
  }
  let body;
  try{
    body = await readBody(req);
  }catch{
    sendJson(res, 400, { ok:false, message:'JSONを読み込めません' });
    return;
  }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if(!username){
    sendJson(res, 400, { ok:false, message:'ユーザー名とパスワードを入力してください' });
    return;
  }
  const users = await readUsers();
  if(req.url === '/api/login'){
    if(!password){
      sendJson(res, 400, { ok:false, message:'ユーザー名とパスワードを入力してください' });
      return;
    }
    const user = users.find(u => u.username === username && u.password === password);
    if(!user){
      sendJson(res, 401, { ok:false, message:'ユーザー名またはパスワードが違います' });
      return;
    }
    const data=await ensureUserJson(user);
    sendJson(res, 200, { ok:true, user:{ id:user.id||data.user.id, username:user.username, source:user.source||'server' }, sessionToken:issueLocalSession(user), stats:data.stats, progress:data.progress, history:data.history, storage:'server users.json' });
    return;
  }
  if(req.url === '/api/register'){
    if(!password){
      sendJson(res, 400, { ok:false, message:'ユーザー名とパスワードを入力してください' });
      return;
    }
    if(users.some(u => u.username === username)){
      sendJson(res, 409, { ok:false, message:'同じユーザー名は登録できません' });
      return;
    }
    // 開発用の簡易保存です。本番用途ではパスワードを必ずハッシュ化してください。
    const user={ id:`user_${username.toLowerCase().replace(/[^a-z0-9_-]+/g,'_')}`, username, password, createdAt:new Date().toISOString(), source:'server' };
    users.push(user);
    await writeUsers(users);
    await ensureUserJson(user);
    sendJson(res, 201, { ok:true, user:{ id:user.id, username }, sessionToken:issueLocalSession(user), storage:'server users.json' });
    return;
  }
  if(req.url === '/api/user-progress'){
    if(!verifyLocalSession(body.sessionToken, username)){
      sendJson(res, 401, { ok:false, message:'ログイン状態を確認できません' });
      return;
    }
    const saved=await saveUserProgress(username, body.mode, body.entry, body.type);
    if(!saved){
      sendJson(res, 404, { ok:false, message:'ユーザーが見つかりません' });
      return;
    }
    sendJson(res, 200, { ok:true, user:saved.user, progress:saved.progress });
    return;
  }
  sendJson(res, 404, { ok:false, message:'APIが見つかりません' });
}

async function serveStatic(req, res){
  let url;
  let decoded;
  try{
    const rawPath = String(req.url || '').split('?')[0];
    const decodedRawPath = decodeURIComponent(rawPath);
    if(decodedRawPath.split(/[\\/]/).includes('..')){
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    decoded = decodeURIComponent(url.pathname);
  }catch{
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  const requestPath = decoded === '/' ? '/index.html' : decoded;
  const filePath = path.resolve(rootDir, `.${requestPath}`);
  const relativePath = path.relative(rootDir, filePath);
  if(relativePath.startsWith('..') || path.isAbsolute(relativePath)){
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try{
    const data = await readFile(filePath);
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  }catch{
    res.writeHead(404);
    res.end('Not Found');
  }
}

const server = http.createServer((req, res) => {
  if(req.url?.startsWith('/api/')){
    handleApi(req, res).catch(() => sendJson(res, 500, { ok:false, message:'サーバエラー' }));
    return;
  }
  serveStatic(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Web Picross server: http://127.0.0.1:${port}/`);
});
