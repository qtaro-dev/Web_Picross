import { getPack } from './packs.js';
import { loadPuzzles } from './data.js';
import { PLACEHOLDERS, createPuzzleThumb } from './thumbs.js';
import { makeClues, isSolved } from './engine.js';
import { renderEditor } from './editor.js';
import { BACKGROUNDS, BUILD_INFO, MC_COLORS, MC_COLOR_MAP, isFilledValue, normalizeColorId } from './config.js';
import { exportCurrentUserPayload, formatDateTimeForDisplay, USER_DATA_KEYS } from './userData.js';
const MODE_LABELS = { Beginner:'ビギナー', Easy:'イージー', Normal:'ノーマル', Hard:'ハード', Endless:'エンドレス' };
const MODE_EN_LABELS = { Beginner:'Beginner', Easy:'Easy', Normal:'Normal', Hard:'Hard', Endless:'Endless', Custom:'Custom', EditPlay:'EditPlay' };
const GAME_UI = { backSelect:'← セレクトに戻る', backEditor:'← エディタに戻る', backMenu:'メニューへ戻る', clear:'やりなおし', check:'判定', giveUp:'ギブアップ', hint:'ヒント', zoomOut:'縮小', zoomIn:'拡大', timeLabel:'残り時間', unlimited:'無制限', timePending:'--:--', inputHelp:'左クリック：塗る／解除　右クリック：×（マーク）', noPuzzle:'パズルが選択されていません。' };
const SELECT_DEBUG = { title:'開発データ', clearState:'クリアフラグ', storageKey:'保存キー', storage:'保存方式', fileSave:'ファイル直接保存', enabled:'有効', disabled:'無効', userData:'対象', none:'なし', resetClear:'クリア状況リセット', resetUser:'ユーザーデータ削除', exportJson:'ユーザーデータJSON出力', exportCurrent:'現在ユーザーJSON出力' };
const USER_DATA_UI = { title:'ユーザーデータ', menuTitle:'メニュー画面', button:'ユーザーデータ', back:'← 戻る', reload:'ユーザーデータ再読込', exportCurrent:'現在ユーザーJSON出力', empty:'まだプレイ記録がありません。ゲームをクリア、失敗、またはギブアップすると記録されます。', note:'現在ユーザーの進行状況を表示しています。' };
const RANKING_UI = { title:'ランキング', back:'← 戻る', current:'現在の自分の順位', empty:'まだランキングデータがありません。パズルをクリアするとランキングに表示されます。', noUserRank:'まだこの難易度のクリア記録がありません。', sourceLocal:'Live Server環境では現在ユーザーのlocalStorage内データのみを表示します。' };
function setAlignTop(root, on){ root.classList[on?'add':'remove']('align-top'); }
function formatGameTime(timer){ const sec=timer?.remaining; if(sec==null) return GAME_UI.unlimited; const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(value){ return String(value||'').replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function renderBackgroundLayer(name){
  const path=BACKGROUNDS[name];
  return typeof path === 'string' ? `<div class="screen-bg" aria-hidden="true" style="background-image:url('${escapeHtml(path)}')"></div>` : '';
}
function renderCreditsBackgroundLayers(){
  const paths=Array.isArray(BACKGROUNDS.credits) ? BACKGROUNDS.credits : [BACKGROUNDS.credits].filter(Boolean);
  if(!paths.length) return '';
  const slides=paths.map((path,i)=>`<div class="credits-bg-slide" style="--slide-index:${i}; background-image:url('${escapeHtml(path)}')"></div>`).join('');
  return `<div class="screen-bg credits-bg-stack" aria-hidden="true">${slides}</div>`;
}

export function render(state, actions){
  if(state.screen==='title') renderTitle(state, actions);
  else if(state.screen==='login') renderLogin(state, actions);
  else if(state.screen==='menu') renderMenu(state, actions);
  else if(state.screen==='userData') renderUserData(state, actions);
  else if(state.screen==='ranking') renderRanking(state, actions);
  else if(state.screen==='options') renderOptions(state, actions);
  else if(state.screen==='help') renderHelp(state, actions);
  else if(state.screen==='credits') renderCredits(state, actions);
  else if(state.screen==='select') renderSelect(state, actions);
  else if(state.screen==='editor') renderEditor(state, actions);
  else renderGame(state, actions);
  renderModal(state, actions);
}

function renderTitle(state, actions){
  const root=state.root; setAlignTop(root,false);
  root.innerHTML = `<div class="screen"><img id="titleimg" class="title-img" src="./image/title.png" alt="Title"><div class="build-number">${escapeHtml(BUILD_INFO.label)}</div></div>`;
  root.querySelector('#titleimg').addEventListener('click', ()=>actions.goto('login'));
}

function renderLogin(state, actions){
  const root=state.root; setAlignTop(root,false);
  const form=state.loginForm||{};
  root.innerHTML = `<div class="screen login-screen has-bg">${renderBackgroundLayer('login')}
    <div class="login-panel">
      <div class="login-title">ログイン / ユーザー登録</div>
      <label class="login-field">ユーザー名<input id="loginUser" class="text-input" autocomplete="username" value="${escapeHtml(form.username||'')}"></label>
      <label class="login-field">パスワード<input id="loginPass" class="text-input" type="password" autocomplete="current-password" value="${escapeHtml(form.password||'')}"></label>
      <div class="login-actions">
        <button class="btn" id="loginBtn">ログイン</button>
        <button class="btn" id="registerBtn">ユーザー登録</button>
      </div>
      <label class="remember-login"><input id="rememberLogin" type="checkbox" ${form.remember?'checked':''}>ユーザー名とパスワードを記録する</label>
      <div class="login-message" aria-live="polite">${escapeHtml(state.authMessage)}</div>
    </div>
  </div>`;
  const user=root.querySelector('#loginUser');
  const pass=root.querySelector('#loginPass');
  const remember=root.querySelector('#rememberLogin');
  const loginBtn=root.querySelector('#loginBtn');
  const values=()=>[user.value, pass.value, remember.checked];
  const refreshLoginButton=()=>{ loginBtn.disabled=!(user.value.trim()&&pass.value); };
  const syncForm=()=>{ actions.updateLoginForm({username:user.value, password:pass.value}); refreshLoginButton(); };
  refreshLoginButton();
  user.addEventListener('input', syncForm);
  pass.addEventListener('input', syncForm);
  remember.addEventListener('change', ()=>actions.updateLoginForm({username:user.value, password:pass.value, remember:remember.checked}));
  root.querySelector('#loginBtn').addEventListener('click',()=>actions.login(...values()));
  root.querySelector('#registerBtn').addEventListener('click',()=>actions.registerUser(user.value, pass.value));
  pass.addEventListener('keydown',e=>{ if(e.key==='Enter') actions.login(...values()); });
}

function renderMenu(state, actions){
  const root=state.root; setAlignTop(root,false);
  const user=state.currentUser?.username ? `<div class="menu-account"><div class="menu-user">${escapeHtml(state.currentUser.username)}</div><button class="btn menu-user-data" data-act="userData">${USER_DATA_UI.button}</button></div>` : '';
  root.innerHTML = `<div class="screen has-bg">${renderBackgroundLayer('menu')}<div class="menu">
    <div class="menu-title">${USER_DATA_UI.menuTitle}</div>
    ${user}
    <button class="btn" data-act="game">ゲームセレクト</button>
    <button class="btn" data-act="ranking">ランキング</button>
    <button class="btn" data-act="option">オプション</button>
    <button class="btn" data-act="help">ヘルプ</button>
    <button class="btn" data-act="credit">クレジット</button>
    <button class="btn" data-act="editor">エディタ</button>
    <button class="btn" data-act="logout">ログアウト</button></div></div>`;
  root.querySelector('[data-act="game"]').addEventListener('click', ()=>actions.goto('select'));
  root.querySelector('[data-act="userData"]')?.addEventListener('click', ()=>actions.goto('userData'));
  root.querySelector('[data-act="ranking"]').addEventListener('click', ()=>actions.goto('ranking'));
  root.querySelector('[data-act="option"]').addEventListener('click', ()=>actions.goto('options'));
  root.querySelector('[data-act="help"]').addEventListener('click', ()=>actions.goto('help'));
  root.querySelector('[data-act="credit"]').addEventListener('click', ()=>actions.goto('credits'));
  root.querySelector('[data-act="editor"]').addEventListener('click', ()=>actions.goto('editor'));
  root.querySelector('[data-act="logout"]').addEventListener('click', ()=>actions.logout());
}

function renderUserData(state, actions){
  const root=state.root; setAlignTop(root,true);
  const payload=exportCurrentUserPayload(state.currentUser);
  const status=state.userDataStatus||{};
  const rows=progressRows(payload.progress);
  const summary=difficultySummaries(payload.progress, payload.history);
  const hasRecords=rows.length>0 || (payload.history||[]).length>0;
  const fileLine=status.fileSave ? `<div><span>ユーザーファイル</span><strong>${escapeHtml(status.filePath||`user/${payload.user.username}.json`)}</strong></div>` : `<div><span>保存キー</span><strong>${USER_DATA_KEYS.data}</strong></div>`;
  root.innerHTML = `<div class="screen user-data-screen has-bg">${renderBackgroundLayer('userData')}
    <div class="user-data-topbar">
      <button class="btn btn-slim" id="backUserData">${USER_DATA_UI.back}</button>
      <div class="user-data-title">${USER_DATA_UI.title}</div>
      <div class="user-data-actions">
        <button class="btn btn-debug" id="reloadUserData">${USER_DATA_UI.reload}</button>
        <button class="btn btn-debug" id="exportCurrentUser">${USER_DATA_UI.exportCurrent}</button>
      </div>
    </div>
    <div class="user-data-note">${USER_DATA_UI.note}</div>
    <section class="user-data-panel">
      <div class="user-data-section-title">基本情報</div>
      <div class="user-info-grid">
        <div><span>ユーザー名</span><strong>${escapeHtml(payload.user.username)}</strong></div>
        <div><span>ユーザーID</span><strong>${escapeHtml(payload.user.id)}</strong></div>
        <div><span>作成日時</span><strong>${escapeHtml(dateText(payload.user, 'createdAt'))}</strong></div>
        <div><span>最終更新日時</span><strong>${escapeHtml(dateText(payload.user, 'updatedAt'))}</strong></div>
        <div><span>保存方式</span><strong>${escapeHtml(status.storage||payload.storage||'localStorage')}</strong></div>
        ${fileLine}
        <div><span>最終読込</span><strong>${escapeHtml(status.lastLoad||'-')}</strong></div>
        <div><span>最終保存</span><strong>${escapeHtml(status.lastSave||'-')}</strong></div>
        <div class="user-info-wide"><span>最終結果</span><strong>${escapeHtml(status.lastResult||'-')}</strong></div>
      </div>
    </section>
    <section class="user-data-panel">
      <div class="user-data-section-title">全体集計</div>
      <div class="stats-grid">
        <div><span>プレイ数</span><strong>${payload.stats.totalPlayCount||0}</strong></div>
        <div><span>クリア数</span><strong>${payload.stats.totalClearCount||0}</strong></div>
        <div><span>失敗数</span><strong>${payload.stats.totalFailCount||0}</strong></div>
        <div><span>ギブアップ</span><strong>${payload.stats.totalGiveupCount||0}</strong></div>
        <div><span>合計時間</span><strong>${formatMs(payload.stats.totalPlayTimeMs)}</strong></div>
      </div>
    </section>
    <section class="user-data-panel">
      <div class="user-data-section-title">難易度別</div>
      <div class="difficulty-summary">${summary.map(item=>`<div class="difficulty-card"><div class="difficulty-card-title">${item.label}</div><div>クリア ${item.clear}</div><div>プレイ ${item.play}</div><div>失敗 ${item.fail}</div><div>ギブアップ ${item.giveup}</div><div>合計 ${formatMs(item.timeMs)}</div><div>ベスト ${item.best}</div></div>`).join('')}</div>
    </section>
    <section class="user-data-panel user-data-table-panel">
      <div class="user-data-section-title">各面データ</div>
      ${hasRecords ? `<div class="user-data-table-wrap"><table class="user-data-table"><thead><tr><th>難易度</th><th>面</th><th>状態</th><th>ベスト</th><th>最新</th><th>クリア日時</th><th>最終プレイ</th><th>ギブアップ</th><th>失敗</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.label}</td><td>#${escapeHtml(row.stage)}</td><td>${row.status}</td><td>${row.best}</td><td>${row.latest}</td><td>${escapeHtml(row.clearedAt)}</td><td>${escapeHtml(row.lastPlayedAt)}</td><td>${row.giveup}</td><td>${row.fail}</td></tr>`).join('')}</tbody></table></div>` : `<div class="user-data-empty">${USER_DATA_UI.empty}</div>`}
    </section>
  </div>`;
  root.querySelector('#backUserData').addEventListener('click', ()=>actions.goto('menu'));
  root.querySelector('#reloadUserData').addEventListener('click', ()=>actions.reloadUserData());
  root.querySelector('#exportCurrentUser').addEventListener('click', ()=>actions.exportCurrentUserJson());
}

function renderRanking(state, actions){
  const root=state.root; setAlignTop(root,true);
  const mode=state.ranking?.mode||'Beginner';
  const data=state.ranking?.data;
  const rows=data?.rankings||[];
  const userRanks=data?.currentUserRanks||[];
  root.innerHTML = `<div class="screen ranking-screen has-bg">${renderBackgroundLayer('ranking')}
    <div class="ranking-topbar">
      <button class="btn btn-slim" id="backRanking">${RANKING_UI.back}</button>
      <div class="ranking-title">${RANKING_UI.title}</div>
      <div></div>
    </div>
    <div class="ranking-tabs">${['Beginner','Easy','Normal','Hard','Endless'].map(m=>`<button class="btn btn-slim ${m===mode?'is-active':''}" data-ranking-mode="${m}">${MODE_LABELS[m]}</button>`).join('')}</div>
    ${data?.source==='localStorage'?`<div class="ranking-note">${RANKING_UI.sourceLocal}</div>`:''}
    <section class="ranking-panel">
      <div class="ranking-section-title">${RANKING_UI.current}</div>
      ${state.ranking?.loading ? `<div class="ranking-empty">読み込み中...</div>` : userRanks.length ? `<div class="ranking-current-list">${userRanks.map(rank=>`<div class="ranking-current-item">${MODE_LABELS[mode]} ${stageLabel(rank.stageNo)}　${rank.rank}位 / ${rank.total}人中　${escapeHtml(rank.clearTimeText||formatMs(rank.clearTimeMs))}</div>`).join('')}</div>` : `<div class="ranking-empty">${RANKING_UI.noUserRank}</div>`}
    </section>
    <section class="ranking-panel">
      <div class="ranking-section-title">ランキング一覧</div>
      ${state.ranking?.loading ? `<div class="ranking-empty">読み込み中...</div>` : rows.length ? `<div class="ranking-table-wrap"><table class="ranking-table"><thead><tr><th>順位</th><th>難易度</th><th>面</th><th>クリア時間</th><th>ユーザー名</th><th>クリア日時</th></tr></thead><tbody>${rows.map(row=>`<tr class="${row.username===state.currentUser?.username?'is-current-user':''}"><td>${row.rank}</td><td>${MODE_LABELS[mode]}</td><td>${stageLabel(row.stageNo)}</td><td>${escapeHtml(row.clearTimeText||formatMs(row.clearTimeMs))}</td><td>${escapeHtml(row.username||'-')}</td><td>${escapeHtml(row.clearedAtText||formatDateTimeForDisplay(row.clearedAt))}</td></tr>`).join('')}</tbody></table></div>` : `<div class="ranking-empty">${RANKING_UI.empty}</div>`}
    </section>
  </div>`;
  root.querySelector('#backRanking').addEventListener('click', ()=>actions.goto('menu'));
  root.querySelectorAll('[data-ranking-mode]').forEach(btn=>btn.addEventListener('click',()=>actions.setRankingMode(btn.dataset.rankingMode)));
}

function renderOptions(state, actions){
  const root=state.root; setAlignTop(root,true);
  const opt=state.options||{};
  root.innerHTML = `<div class="screen info-screen has-bg">${renderBackgroundLayer('options')}
    <button class="btn btn-slim info-back" id="backOptions">← メニューへ戻る</button>
    <div class="info-title">オプション</div>
    <section class="info-panel option-panel">
      <label class="option-row"><span>クロスヘア色</span><input id="crosshairColor" type="color" value="${escapeHtml(opt.crosshairColor||'#42a5f5')}"></label>
      <label class="option-row"><span>BGM音量</span><input id="bgmVolume" type="range" min="0" max="100" value="${opt.bgmVolume??50}"><strong id="bgmValue">${opt.bgmVolume??50}</strong></label>
      <div class="option-note">BGM未実装</div>
      <label class="option-row"><span>SE音量</span><input id="seVolume" type="range" min="0" max="100" value="${opt.seVolume??50}"><strong id="seValue">${opt.seVolume??50}</strong></label>
      <div class="option-note">SE未実装</div>
      <div class="option-mode">
        <div class="option-label">表示モード</div>
        <div class="option-mode-buttons">
          <button class="btn btn-slim ${opt.displayMode==='fullscreen'?'is-active':''}" data-display-mode="fullscreen">フルスクリーン</button>
          <button class="btn btn-slim ${opt.displayMode==='borderless'?'is-active':''}" data-display-mode="borderless">ボーダーレス</button>
          <button class="btn btn-slim ${!opt.displayMode||opt.displayMode==='window'?'is-active':''}" data-display-mode="window">ウィンドウ</button>
        </div>
      </div>
      <button class="btn btn-slim option-reset" id="resetOptions">初期値に戻す</button>
    </section>
  </div>`;
  root.querySelector('#backOptions').addEventListener('click', ()=>actions.goto('menu'));
  root.querySelector('#crosshairColor').addEventListener('input', e=>actions.setOption('crosshairColor', e.target.value));
  root.querySelector('#bgmVolume').addEventListener('input', e=>actions.setOption('bgmVolume', e.target.value));
  root.querySelector('#seVolume').addEventListener('input', e=>actions.setOption('seVolume', e.target.value));
  root.querySelectorAll('[data-display-mode]').forEach(btn=>btn.addEventListener('click',()=>actions.setOption('displayMode', btn.dataset.displayMode)));
  root.querySelector('#resetOptions').addEventListener('click', ()=>actions.resetOptions());
}

function renderHelp(state, actions){
  const root=state.root; setAlignTop(root,true);
  root.innerHTML = `<div class="screen info-screen has-bg">${renderBackgroundLayer('help')}
    <button class="btn btn-slim info-back" id="backHelp">← メニューへ戻る</button>
    <div class="info-title">ヘルプ</div>
    <section class="info-panel"><h2>ピクロスの基本ルール</h2><ul><li>数字は、その行または列に連続して塗るマス数を表します。</li><li>複数の数字がある場合は、塗るかたまりが複数あります。</li><li>数字と数字のかたまりの間には、最低1マス以上の空白が入ります。</li><li>正しいマスをすべて塗るとクリアです。</li><li>塗らないと分かったマスには×を付けられます。</li></ul></section>
    <section class="info-panel"><h2>操作方法</h2><ul><li>ゲームセレクトから難易度を選び、パズルを選んで開始します。</li><li>左クリックで塗る / 解除、右クリックで×を付ける / 解除を行います。</li><li>左ドラッグで連続塗り、右ドラッグで連続×ができます。</li><li>判定ボタンで正解判定、全消去で入力リセット、ヒントで一部の正解表示、ギブアップで終了します。</li></ul></section>
    <section class="info-panel"><h2>カラーピクロス</h2><ul><li>カラー問題では、右側のパレットから色を選んで塗ります。</li><li>数字の背景色が、その列や行で使う色を表します。</li><li>右クリックの×は色に関係なくマークとして使います。</li></ul></section>
    <section class="info-panel"><h2>ユーザーデータ</h2><ul><li>クリアするとユーザーデータに記録されます。</li><li>ランキングは保存されたクリアタイムをもとに表示します。</li></ul></section>
  </div>`;
  root.querySelector('#backHelp').addEventListener('click', ()=>actions.goto('menu'));
}

function renderCredits(state, actions){
  const root=state.root; setAlignTop(root,false);
  root.innerHTML = `<div class="screen credits-screen has-bg">${renderCreditsBackgroundLayers()}
    <button class="btn btn-slim info-back credits-back" id="backCredits">← メニューへ戻る</button>
    <div class="credits-viewport">
      <div class="credits-roll">
        <div class="credits-main">Web Picross</div>
        <div class="credits-block"><span>制作</span><strong>Qtaro</strong></div>
        <div class="credits-block"><span>コーディング</span><strong>CODEX</strong></div>
        <div class="credits-block"><span>要件定義</span><strong>ChatGPT</strong></div>
        <div class="credits-block"><span>仕様作成</span><strong>ChatGPT</strong></div>
        <div class="credits-block"><span>開発支援</span><strong>ChatGPT</strong></div>
        <div class="credits-block"><span>テスト・確認</span><strong>Qtaro</strong></div>
        <div class="credits-block"><span>Special Thanks</span><strong>AI Development Tools</strong></div>
      </div>
    </div>
  </div>`;
  root.querySelector('#backCredits').addEventListener('click', ()=>actions.goto('menu'));
}

function renderSelect(state, actions){
  const root=state.root; setAlignTop(root,true);
  const mode=state.mode; const isLarge=(mode==='Hard'||mode==='Endless'); const per=isLarge?10:20; const cols=isLarge?5:4;
  const pack=getPack(mode); const total=pack.puzzles.length; const pages=Math.max(1, Math.ceil(total/per));
  const isSolvedId=id=>state.solved[mode].has(id)||state.solved[mode].has(String(id));
  const solvedCount=pack.puzzles.reduce((sum,p)=>sum+(isSolvedId(p.id)?1:0),0);
  const allSolvedCount=Object.values(state.solved).reduce((sum,set)=>sum+(set?.size||0),0);
  const solvedIds=pack.puzzles.filter(p=>isSolvedId(p.id)).map(p=>`#${p.id}`).join(', ');
  const currentUser=state.currentUser?.username||'guest';
  const status=state.userDataStatus||{};
  const storageLabel=status.storage || (state.currentUser?.source==='server'?'server users.json':'localStorage');
  const fileSaveLabel=status.fileSave?`${SELECT_DEBUG.enabled} ${escapeHtml(status.filePath||`user/${currentUser}.json`)}`:`${SELECT_DEBUG.disabled} JSON出力で確認`;
  const page=Math.min(Math.max(1,state.page),pages); const start=(page-1)*per; const items=pack.puzzles.slice(start,start+per);
  const thumbSize=isLarge?'var(--thumb-lg)':'var(--thumb)'; const rowGap=isLarge?32:24;
  root.innerHTML = `<div class="screen select-screen has-bg">${renderBackgroundLayer('select')}
      <button class="btn fixed-top-left" id="back">← メニューに戻る</button>
      <div class="select-controls">
        <div class="mode-tabs" id="modes"></div>
        <div class="pager-bar">
          <button class="btn btn-slim" id="prev" ${page<=1?'disabled':''}>◀</button>
          <div class="page-label">${page} / ${pages}</div>
          <button class="btn btn-slim" id="next" ${page>=pages?'disabled':''}>▶</button>
        </div>
        <div class="progress-status">クリア数 ${solvedCount} / ${total}</div>
      </div>
      <details class="select-debug">
        <summary>${SELECT_DEBUG.title}</summary>
        <div class="select-debug-body">
          <div>${SELECT_DEBUG.clearState}: ${solvedIds || SELECT_DEBUG.none}</div>
          <div>${SELECT_DEBUG.storage}: ${storageLabel}</div>
          <div>${SELECT_DEBUG.fileSave}: ${fileSaveLabel}</div>
          <div>${SELECT_DEBUG.storageKey}: picross_v2_user_data</div>
          <div>${SELECT_DEBUG.userData}: ${escapeHtml(currentUser)}</div>
          <div>最終読込: ${escapeHtml(status.lastLoad||'-')}</div>
          <div>最終保存: ${escapeHtml(status.lastSave||'-')}</div>
          <div>保存結果: ${escapeHtml(status.lastResult||'-')}</div>
          <div>全件: ${allSolvedCount}</div>
          <div class="select-debug-actions">
            <button class="btn btn-debug" id="exportUserData">${SELECT_DEBUG.exportJson}</button>
            <button class="btn btn-debug" id="exportCurrentUser">${SELECT_DEBUG.exportCurrent}</button>
            <button class="btn btn-debug" id="resetClear">${SELECT_DEBUG.resetClear}</button>
            <button class="btn btn-debug" id="resetUserData">${SELECT_DEBUG.resetUser}</button>
          </div>
        </div>
      </details>
      <div class="thumb-grid" id="grid" style="--thumb-size:${thumbSize}; --select-cols:${cols}; --select-row-gap:${rowGap}px; max-width:calc((var(--thumb-size) * ${cols}) + (24px * ${cols - 1}));"></div>
    </div>`;
  root.querySelector('#back').addEventListener('click', ()=>actions.goto('menu'));
  const goPage = d => { const n=Math.min(Math.max(1,page+d),pages); if(n!==page) actions.setPage(n); };
  root.querySelector('#prev').addEventListener('click', ()=>goPage(-1));
  root.querySelector('#next').addEventListener('click', ()=>goPage(1));
  root.querySelector('#exportUserData').addEventListener('click', ()=>actions.exportUserDataJson());
  root.querySelector('#exportCurrentUser').addEventListener('click', ()=>actions.exportCurrentUserJson());
  root.querySelector('#resetClear').addEventListener('click', ()=>actions.resetClearFlags());
  root.querySelector('#resetUserData').addEventListener('click', ()=>actions.resetUserData());
  const modes=['Beginner','Easy','Normal','Hard','Endless']; const tabs=root.querySelector('#modes');
  modes.forEach(m=>{ const b=document.createElement('button'); b.className='btn'+(m===mode?' is-active':''); b.textContent=MODE_LABELS[m]; b.onclick=()=>{ if(m!==mode) actions.setMode(m); }; tabs.appendChild(b); });
  const grid=root.querySelector('#grid');
  for(const p of items){ const id=p.id; const solved=isSolvedId(id);
    const tile=document.createElement('div'); tile.className='tile';
    const div=document.createElement('div'); div.className='thumb'+(solved?' solved':'');
    div.dataset.puzzleId=String(id);
    const img=document.createElement('img'); img.alt=`${MODE_LABELS[mode]} #${id}`; img.loading='lazy'; const __ph=PLACEHOLDERS[mode]; img.src=__ph; img.onerror=()=>{img.src=__ph;}; div.appendChild(img);
    if(solved){ const badge=document.createElement('div'); badge.className='badge'; badge.textContent='CLEAR'; div.appendChild(badge); }
    const cap=document.createElement('div'); cap.className='caption'; cap.dataset.puzzleId=String(id); cap.textContent=stageLabel(id);
    tile.appendChild(div); tile.appendChild(cap);
    div.addEventListener('click', ev=>{ if(ev.shiftKey) actions.toggleSolved(mode,id); else actions.play(mode,id); });
    grid.appendChild(tile);
  }
  loadPuzzles(mode).then(puzzles=>{
    if(state.screen!=='select'||state.mode!==mode) return;
    const puzzleMap=new Map();
    for(const puzzle of puzzles){ puzzleMap.set(String(puzzle.id), puzzle); puzzleMap.set(String(puzzle.stageNo), puzzle); }
    root.querySelectorAll('.thumb[data-puzzle-id]').forEach(thumb=>{
      if(!thumb.classList.contains('solved')) return;
      const puzzle=puzzleMap.get(String(thumb.dataset.puzzleId));
      if(!puzzle) return;
      const badge=thumb.querySelector('.badge');
      thumb.replaceChildren(createPuzzleThumb(puzzle, {className:'select-thumb-generated', maxCells:50}));
      if(badge) thumb.appendChild(badge);
      const caption=thumb.closest('.tile')?.querySelector('.caption');
      if(caption) caption.textContent=selectCaption(puzzle, true);
    });
  });
}

function renderGame(state, actions){
  const root=state.root; setAlignTop(root,false);
  const G=state.game; if(!G){ root.innerHTML=`<div class="screen"><div class="menu"><button class="btn" id="back">${GAME_UI.backSelect}</button><p>${GAME_UI.noPuzzle}</p></div></div>`; root.querySelector('#back').onclick=()=>actions.goto('select'); return; }
  const {w,h,solution}=G; const {rows,cols}=makeClues(solution,w,h,G.colorMode); const maxRowLen=Math.max(...rows.map(r=>r.length)); const maxColLen=Math.max(...cols.map(c=>c.length));
  const boardSize=Math.max(w,h); const zoom=Number(state.boardZoom||1); const baseCellSize=Math.max(18, Math.min(34, Math.floor(280/boardSize))); const cellSize=Math.round(baseCellSize*zoom); const clueSize=Math.max(14, Math.round(Math.max(18, Math.min(24, baseCellSize))*zoom));
  const timerText=formatGameTime(state.timer);
  const gameTitle=gameStageTitle(G);
  const backTarget=G.returnTo==='editor'?'editor':'select';
  const backLabel=G.returnTo==='editor'?GAME_UI.backEditor:GAME_UI.backSelect;
  const showPalette=G.colorMode==='color';
  const gameColors=showPalette?usedPaletteColors(solution):MC_COLORS;
  const gameLocked=state.gameStatus==='cleared'||state.gameStatus==='timeout'||state.gameStatus==='giveup';
  root.innerHTML = `<div class="screen game-screen has-bg" style="--crosshair-color:${escapeHtml(state.options?.crosshairColor||'#42a5f5')}">${renderBackgroundLayer('game')}
    <div class="game-layout">
      <aside class="game-panel">
        <div class="timer-box">
          <div class="timer-label">${GAME_UI.timeLabel}</div>
          <div class="timer-value">${timerText}</div>
        </div>
        <div class="game-actions">
          <button class="btn" id="clear" ${gameLocked?'disabled':''}>${GAME_UI.clear}</button>
          <button class="btn" id="check" ${gameLocked?'disabled':''}>${GAME_UI.check}</button>
          <button class="btn" id="hint" ${gameLocked||state.hints?.remaining<=0?'disabled':''}>${GAME_UI.hint} ${state.hints?.remaining??0}</button>
          <button class="btn" id="giveup" ${gameLocked?'disabled':''}>${GAME_UI.giveUp}</button>
          <button class="btn" id="menu">${GAME_UI.backMenu}</button>
          <button class="btn" id="back">${backLabel}</button>
        </div>
      </aside>
      <div class="game-main">
        <div class="game-title">${escapeHtml(gameTitle)}</div>
        <div class="zoom-controls">
          <button class="btn btn-slim" id="zoomOut">${GAME_UI.zoomOut}</button>
          <div class="zoom-label">${Math.round(zoom*100)}%</div>
          <button class="btn btn-slim" id="zoomIn">${GAME_UI.zoomIn}</button>
        </div>
        <div id="gamewrap" class="game-board" style="--cell-size:${cellSize}px; --clue-size:${clueSize}px; display:grid; gap:0;
          grid-template-columns: repeat(${maxRowLen}, var(--clue-size)) repeat(${w}, var(--cell-size));
          grid-template-rows: repeat(${maxColLen}, var(--clue-size)) repeat(${h}, var(--cell-size));"></div>
        <p class="game-help">${GAME_UI.inputHelp}</p>
      </div>
      <aside class="game-palette-panel">
        ${showPalette ? `<div class="palette-title">パレット</div><div class="game-palette">${gameColors.map(c=>`<button class="palette-btn ${state.selectedColor===c.id?'is-active':''}" data-color="${c.id}" title="${c.id} ${escapeHtml(c.label)}" aria-label="${c.id} ${escapeHtml(c.label)}" style="background:${c.hex}; color:${textColorFor(c.id)}"></button>`).join('')}</div>` : `<div class="palette-title">モノクロ</div><div class="mono-palette-note">■ 塗り</div>`}
      </aside>
    </div></div>`;
  const wrap=root.querySelector('#gamewrap');
  root.querySelector('.game-screen').addEventListener('contextmenu', e=>e.preventDefault());
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
      const num=seq[seq.length-maxColLen+i]; applyClue(d,num,G.colorMode);
      d.style.gridColumn=`${maxRowLen + x + 1}`; d.style.gridRow=`${i + 1}`;
      wrap.appendChild(d);
    }
  }
  for(let y=0;y<h;y++){
    for(let i=0;i<maxRowLen;i++){ const d=document.createElement('div'); d.className='clue-cell clue-cell-row';
      const seq=rows[y]; const num=seq[seq.length-maxRowLen+i]; applyClue(d,num,G.colorMode);
      d.style.gridColumn=`${i + 1}`; d.style.gridRow=`${maxColLen + y + 1}`;
      wrap.appendChild(d); }
    for(let x=0;x<w;x++){ const k=`${x},${y}`; const isHover=state.hoverCell?.row===y&&state.hoverCell?.col===x; const isHoverRow=state.hoverCell?.row===y; const isHoverCol=state.hoverCell?.col===x; const b=document.createElement('button'); b.dataset.k=k; b.className='cell'+(state.filled.has(k)?' filled':'')+(state.crossed.has(k)?' cross':'')+(isHover?' is-hover':'')+(!isHover&&(isHoverRow||isHoverCol)?' is-crosshair':'');
      b.style.gridColumn=`${maxRowLen + x + 1}`; b.style.gridRow=`${maxColLen + y + 1}`;
      if(G.colorMode==='color'&&state.filled.has(k)){ b.style.background=MC_COLOR_MAP[normalizeColorId(state.cellColors.get(k))]?.hex||'#e0e0e0'; }
      const startInput=e=>{ if(state.modal) return; if(e.button===0){ e.preventDefault(); actions.beginDrag('fill',k); } else if(e.button===2){ e.preventDefault(); actions.beginDrag('cross',k); } };
      const enterInput=()=>{ actions.setHoverCell(y,x); checkClear(actions.applyDrag(k)); };
      const moveInput=()=>checkClear(actions.applyDrag(k));
      const endInput=()=>checkClear(actions.endDrag(k));
      b.oncontextmenu=e=>e.preventDefault();
      b.ondragstart=e=>e.preventDefault();
      b.addEventListener('pointerdown',startInput);
      b.addEventListener('pointerenter',enterInput);
      b.addEventListener('pointerover',moveInput);
      b.addEventListener('pointerup',endInput);
      b.addEventListener('mousedown',startInput);
      b.addEventListener('mouseenter',enterInput);
      b.addEventListener('mouseover',moveInput);
      b.addEventListener('mouseup',endInput);
      wrap.appendChild(b);
    }
  }
  const moveOverCell=e=>{ const cell=e.target.closest?.('.cell'); if(cell) checkClear(actions.applyDrag(cell.dataset.k)); };
  wrap.addEventListener('pointermove',moveOverCell);
  wrap.addEventListener('mousemove',moveOverCell);
  wrap.addEventListener('pointerleave',()=>{ actions.cancelDrag(); actions.clearHoverCell(); });
  wrap.addEventListener('mouseleave',()=>{ actions.cancelDrag(); actions.clearHoverCell(); });
  window.addEventListener('pointerup',()=>actions.cancelDrag(),{once:true});
  window.addEventListener('mouseup',()=>actions.cancelDrag(),{once:true});
  root.querySelector('#back').onclick=()=>actions.requestGameExit(backTarget);
  root.querySelector('#menu').onclick=()=>actions.requestGameExit('menu');
  root.querySelector('#clear').onclick=()=>actions.clear();
  root.querySelector('#check').onclick=()=>actions.showCheckResult(isSolved(solvedState()));
  root.querySelector('#hint').onclick=()=>actions.hint();
  root.querySelector('#giveup').onclick=()=>actions.giveUp();
  root.querySelector('#zoomOut').onclick=()=>actions.zoomBoard(-1);
  root.querySelector('#zoomIn').onclick=()=>actions.zoomBoard(1);
  root.querySelectorAll('.palette-btn').forEach(btn=>btn.addEventListener('click',()=>actions.setSelectedColor(btn.dataset.color)));
}

function usedPaletteColors(solution){
  const used=new Set();
  for(const row of solution||[]) for(const v of row||[]){ const id=normalizeColorId(v); if(isFilledValue(id)) used.add(id); }
  const colors=MC_COLORS.filter(c=>used.has(c.id));
  return colors.length?colors:MC_COLORS.filter(c=>c.id==='1');
}
function stageLabel(value){
  const n=Number(value);
  return Number.isFinite(n) ? `#${String(n).padStart(2,'0')}` : `#${String(value||'')}`;
}
function selectCaption(puzzle, solved){
  const stage=stageLabel(puzzle?.stageNo??puzzle?.id);
  if(!solved) return stage;
  const title=String(puzzle?.title||'').trim();
  return title ? `${stage} ${title}` : stage;
}
function gameStageTitle(game){
  const mode=game?.mode&&MODE_EN_LABELS[game.mode] ? game.mode : modeNameForKey(game?.difficulty||game?.mode);
  const label=MODE_EN_LABELS[mode]||mode||'Custom';
  return `${label} ${stageLabel(game?.stageNo??game?.id)}`;
}
function progressRows(progress){
  const rows=[];
  for(const [mode, entries] of Object.entries(progress||{})){
    const label=MODE_LABELS[modeNameForKey(mode)]||mode;
    for(const [puzzleId, entry] of Object.entries(entries||{})){
      rows.push({
        label,
        stage:entry.stageNo??entry.puzzleId??puzzleId,
        status:entry.cleared?'クリア':(entry.failed?'失敗':'未クリア'),
        best:formatMs(entry.bestClearTimeMs??entry.bestTimeMs),
        latest:formatMs(entry.latestPlayTimeMs??entry.clearTimeMs??entry.latestFailTimeMs??entry.latestGiveupTimeMs),
        clearedAt:dateText(entry, 'clearedAt'),
        lastPlayedAt:dateText(entry, 'lastPlayedAt'),
        giveup:entry.giveupCount||0,
        fail:entry.failCount||0
      });
    }
  }
  return rows.sort((a,b)=>String(a.label).localeCompare(String(b.label),'ja') || Number(a.stage)-Number(b.stage));
}
function difficultySummaries(progress, history=[]){
  return ['beginner','easy','normal','hard','endless'].map(mode=>{
    const entries=Object.values(progress?.[mode]||{});
    const related=(history||[]).filter(item=>String(item.difficulty||'').toLowerCase()===mode);
    const bestEntry=entries.filter(e=>typeof (e.bestClearTimeMs??e.bestTimeMs)==='number').sort((a,b)=>(a.bestClearTimeMs??a.bestTimeMs)-(b.bestClearTimeMs??b.bestTimeMs))[0];
    return {
      label:MODE_LABELS[modeNameForKey(mode)]||mode,
      clear:entries.filter(e=>e.cleared).length,
      play:related.length||entries.reduce((sum,e)=>sum+(e.clearCount||0)+(e.failCount||0)+(e.giveupCount||0),0),
      fail:entries.reduce((sum,e)=>sum+(e.failCount||0),0),
      giveup:entries.reduce((sum,e)=>sum+(e.giveupCount||0),0),
      timeMs:related.reduce((sum,e)=>sum+(typeof e.playTimeMs==='number'?e.playTimeMs:0),0),
      best:bestEntry ? `#${bestEntry.stageNo??bestEntry.puzzleId} ${formatMs(bestEntry.bestClearTimeMs??bestEntry.bestTimeMs)}` : '-'
    };
  });
}
function modeNameForKey(key){
  return ({beginner:'Beginner', easy:'Easy', normal:'Normal', hard:'Hard', endless:'Endless', custom:'Custom'})[String(key||'').toLowerCase()]||key;
}
function dateText(record, key){
  return record?.[`${key}Text`] || formatDateTimeForDisplay(record?.[key]);
}
function formatMs(ms){
  if(typeof ms!=='number') return '-';
  const total=Math.floor(ms/1000);
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const s=total%60;
  return h>0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function clueText(clue){ return typeof clue==='object' ? clue.count : clue; }
function clueColor(clue){ return typeof clue==='object' ? normalizeColorId(clue.colorId) : null; }
function textColorFor(id){
  const hex=MC_COLOR_MAP[normalizeColorId(id)]?.hex||'#000000';
  const n=parseInt(hex.slice(1),16);
  const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  return (r*299+g*587+b*114)/1000 < 150 ? '#fff' : '#000';
}
function applyClue(el, clue, colorMode){
  const text=clueText(clue);
  el.textContent=(text||text===0)?text:'';
  const color=clueColor(clue);
  if(colorMode==='color'&&color&&text){
    el.classList.add('clue-color');
    el.style.background=MC_COLOR_MAP[color]?.hex||'#111';
    el.style.color=textColorFor(color);
  }
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
