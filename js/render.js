import { getPack } from './packs.js';
import { loadPuzzles } from './data.js';
import { PLACEHOLDERS, createPuzzleThumb } from './thumbs.js';
import { makeClues, isSolved } from './engine.js';
import { renderEditor } from './editor.js';
import { AUTH_LIMITS, BACKGROUNDS, BUILD_INFO, MC_COLORS, MC_COLOR_MAP, evaluatePasswordStrength, isFilledValue, normalizeColorId } from './config.js';
import { exportCurrentUserPayload, formatDateTimeForDisplay } from './userData.js';
import { isAdminUser } from './admin.js';
const MODE_LABELS = { Beginner:'ビギナー', Easy:'イージー', Normal:'ノーマル', Hard:'ハード', Endless:'エンドレス' };
const MODE_EN_LABELS = { Beginner:'Beginner', Easy:'Easy', Normal:'Normal', Hard:'Hard', Endless:'Endless', Custom:'Custom', EditPlay:'EditPlay' };
const GAME_PANEL_COLLAPSED_KEY = 'web_picross_game_panel_collapsed';
const GAME_MINIMAP_VISIBLE_KEY = 'web_picross_endless_minimap_visible';
const GAME_MINIMAP_ZOOM_KEY = 'web_picross_endless_minimap_zoom';
const GAME_MINIMAP_POSITION_KEY = 'web_picross_endless_minimap_position';
const GAME_MINIMAP_ZOOMS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
const GAME_MINIMAP_POSITIONS = [
  { key:'top-left', label:'左上' },
  { key:'left-center', label:'左中央' },
  { key:'bottom-left', label:'左下' },
  { key:'top-center', label:'上中央' },
  { key:'top-right', label:'右上' },
];
const GAME_UI = { backSelect:'← セレクトに戻る', backEditor:'← エディタに戻る', backMenu:'メニューへ戻る', clear:'やりなおし', check:'判定', giveUp:'ギブアップ', hint:'ヒント', zoomOut:'縮小', zoomIn:'拡大', panelHide:'操作パネルを隠す', panelShow:'操作パネルを表示', minimapTitle:'ミニマップ', minimapHide:'ミニマップを隠す', minimapShow:'ミニマップを表示', minimapZoom:'倍率', minimapPosition:'位置', timeLabel:'残り時間', unlimited:'無制限', timePending:'--:--', inputHelp:'左クリック：塗る／解除　右クリック：×（マーク）', noPuzzle:'パズルが選択されていません。' };
const MENU_UI = { notice:'お知らせ', noticePending:'お知らせ機能は準備中です。', editor:'エディタ' };
const LOGIN_UI = { passwordReset:'パスワードを忘れた場合', resendConfirmation:'確認メールを再送する', loginHelp:'ログインはユーザー名とパスワードのみで行えます。', registerEmail:'ユーザー登録用メールアドレス', registerEmailHelp:'登録・確認メール用 / ログイン時は不要です', remember:'ユーザー名とパスワードを記録する', resetEmail:'パスワード再設定メールアドレス', resetSend:'再設定メールを送信', resendEmail:'確認メール再送先メールアドレス', resendSend:'確認メールを再送', closeSupport:'閉じる' };
const RECOVERY_UI = { title:'新しいパスワードの設定', newPassword:'新しいパスワード', confirmPassword:'新しいパスワード（確認）', update:'パスワードを更新する', cancel:'ログイン画面へ戻る' };
const USER_DATA_UI = { title:'ユーザーデータ', menuTitle:'メニュー画面', button:'ユーザーデータ', back:'← 戻る', reload:'ユーザーデータ再読込', empty:'まだプレイ記録がありません。ゲームをクリア、失敗、またはギブアップすると記録されます。', note:'現在ユーザーの進行状況を表示しています。', accountTitle:'アカウント管理', currentEmail:'現在のメールアドレス', newEmail:'新しいメールアドレス', confirmEmail:'新しいメールアドレス確認', requestEmailChange:'メールアドレス変更申請', emailChangeHelp:'確認メールの完了後に新しいメールアドレスへ反映されます。', newPassword:'新しいパスワード', confirmPassword:'新しいパスワード確認', changePassword:'パスワード変更', deleteRequest:'アカウント削除申請', localAccountNote:'Supabaseログイン時にパスワード変更と削除申請を利用できます。' };
const RANKING_UI = { title:'ランキング', back:'← 戻る', current:'現在の自分の順位', empty:'まだランキングデータがありません。パズルをクリアするとランキングに表示されます。', noUserRank:'まだこの難易度のクリア記録がありません。', sourceLocal:'Live Server環境では現在ユーザーのlocalStorage内データのみを表示します。' };
const ADMIN_UI = { title:'管理者ページ', back:'← メニューへ戻る', denied:'管理者権限がありません', reload:'再読込', users:'ユーザー管理', progress:'ユーザー進行状況', ranking:'ランキング管理', deleteRequests:'アカウント削除申請', debug:'デバッグ操作', system:'システム情報', supabaseConfigStatus:'Supabase設定確認', passwordClear:'管理者再設定メール送信', backToTop:'一番上へ戻る' };
const ADMIN_SECTIONS = [
  ['admin-section-users', ADMIN_UI.users],
  ['admin-section-progress', ADMIN_UI.progress],
  ['admin-section-rankings', ADMIN_UI.ranking],
  ['admin-section-delete-requests', ADMIN_UI.deleteRequests],
  ['admin-section-puzzles', 'パズル管理'],
  ['admin-section-debug', ADMIN_UI.debug],
  ['admin-section-system', ADMIN_UI.system],
];
const DELETE_REQUEST_STATUS_LABELS = { pending:'申請中', approved:'承認済み', rejected:'拒否済み', cancelled:'取消済み' };
const ACCOUNT_STATUS_LABELS = { active:'通常', disabled:'利用停止' };
const ACCOUNT_COUNTER_LABELS = [
  ['delete_request_count', '削除申請回数'],
  ['delete_approved_count', '申請承認回数'],
  ['delete_rejected_count', '申請拒否回数'],
  ['account_disabled_count', '利用停止回数'],
  ['account_reactivated_count', '利用停止解除回数'],
  ['last_delete_requested_at', '最終削除申請日時', 'date'],
  ['last_disabled_at', '最終利用停止日時', 'date'],
  ['last_reactivated_at', '最終復活日時', 'date'],
];
function setAlignTop(root, on){ root.classList[on?'add':'remove']('align-top'); }
function formatGameTime(timer){ const sec=timer?.remaining; if(sec==null) return GAME_UI.unlimited; const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(value){ return String(value||'').replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function passwordStrengthHtml(password, username='', email=''){
  const strength = evaluatePasswordStrength(password, { username, email });
  return `<div class="password-strength password-strength-${strength.level}" data-password-strength>
    <div class="password-strength-row"><span>パスワード強度: ${escapeHtml(strength.label)}</span><span class="password-strength-bar"><span style="width:${strength.level==='strong'?100:strength.level==='medium'?66:strength.level==='weak'?33:8}%"></span></span></div>
    <div class="password-strength-message">${escapeHtml(strength.message)}</div>
  </div>`;
}
function updatePasswordStrength(container, password, username='', email=''){
  const target = container?.querySelector('[data-password-strength]');
  if(target) target.outerHTML = passwordStrengthHtml(password, username, email);
}
function bindPasswordToggles(root){
  root.querySelectorAll('[data-toggle-password]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const input=root.querySelector(btn.dataset.togglePassword);
      if(!input) return;
      const start=input.selectionStart;
      const end=input.selectionEnd;
      const show=input.type==='password';
      input.type=show?'text':'password';
      btn.textContent=show?'非表示':'表示';
      btn.setAttribute('aria-label', show?'パスワードを非表示':'パスワードを表示');
      input.focus();
      if(typeof start==='number'&&typeof end==='number') input.setSelectionRange(start,end);
    });
  });
}
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
  else if(state.screen==='passwordRecovery') renderPasswordRecovery(state, actions);
  else if(state.screen==='menu') renderMenu(state, actions);
  else if(state.screen==='userData') renderUserData(state, actions);
  else if(state.screen==='ranking') renderRanking(state, actions);
  else if(state.screen==='admin') renderAdmin(state, actions);
  else if(state.screen==='options') renderOptions(state, actions);
  else if(state.screen==='help') renderHelp(state, actions);
  else if(state.screen==='credits') renderCredits(state, actions);
  else if(state.screen==='select') renderSelect(state, actions);
  else if(state.screen==='editor') renderEditor(state, actions);
  else renderGame(state, actions);
  renderAdminBadge(state);
  renderModal(state, actions);
}

function renderAdminBadge(state){
  if(!isAdminUser(state.currentUser) || ['title','login','passwordRecovery'].includes(state.screen)) return;
  const badge=document.createElement('div');
  badge.className='admin-badge';
  badge.textContent='ADMIN';
  state.root.appendChild(badge);
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
      <div class="login-mode-note">${LOGIN_UI.loginHelp}</div>
      <label class="login-field">ユーザー名<input id="loginUser" class="text-input" autocomplete="username" maxlength="${AUTH_LIMITS.usernameMax}" value="${escapeHtml(form.username||'')}"><span class="input-help">10文字まで / 日本語OK / 記号は _ - のみ</span></label>
      <label class="login-field">パスワード<span class="password-input-wrap"><input id="loginPass" class="text-input" type="password" autocomplete="current-password" minlength="${AUTH_LIMITS.passwordMin}" maxlength="${AUTH_LIMITS.passwordMax}" value="${escapeHtml(form.password||'')}"><button class="password-toggle" type="button" data-toggle-password="#loginPass" aria-label="パスワードを表示">表示</button></span><span class="input-help">${AUTH_LIMITS.passwordMin}〜${AUTH_LIMITS.passwordMax}文字 / 半角英数字・記号</span></label>
      ${passwordStrengthHtml(form.password||'', form.username||'', form.email||'')}
      <label class="login-field register-email-field">${LOGIN_UI.registerEmail}<input id="loginEmail" class="text-input" type="email" autocomplete="email" maxlength="${AUTH_LIMITS.emailMax}" value="${escapeHtml(form.email||'')}"><span class="input-help">${AUTH_LIMITS.emailMax}文字まで / ${LOGIN_UI.registerEmailHelp}</span></label>
      <div class="login-support-actions">
        <button class="password-reset-action" type="button" id="passwordReset">${LOGIN_UI.passwordReset}</button>
        <button class="password-reset-action" type="button" id="resendConfirmation">${LOGIN_UI.resendConfirmation}</button>
      </div>
      <div class="login-support-panel" id="passwordResetPanel" hidden>
        <label class="login-field">${LOGIN_UI.resetEmail}<input id="passwordResetEmail" class="text-input" type="email" autocomplete="email" maxlength="${AUTH_LIMITS.emailMax}"><span class="input-help">${AUTH_LIMITS.emailMax}文字まで</span></label>
        <div class="login-support-panel-actions"><button class="btn btn-slim" id="sendPasswordReset">${LOGIN_UI.resetSend}</button><button class="btn btn-slim" type="button" data-close-support>${LOGIN_UI.closeSupport}</button></div>
      </div>
      <div class="login-support-panel" id="resendConfirmationPanel" hidden>
        <label class="login-field">${LOGIN_UI.resendEmail}<input id="resendConfirmationEmail" class="text-input" type="email" autocomplete="email" maxlength="${AUTH_LIMITS.emailMax}"><span class="input-help">${AUTH_LIMITS.emailMax}文字まで</span></label>
        <div class="login-support-panel-actions"><button class="btn btn-slim" id="sendResendConfirmation">${LOGIN_UI.resendSend}</button><button class="btn btn-slim" type="button" data-close-support>${LOGIN_UI.closeSupport}</button></div>
      </div>
      <div class="login-actions">
        <button class="btn" id="loginBtn">ログイン</button>
        <button class="btn" id="registerBtn">ユーザー登録</button>
      </div>
      <label class="remember-login"><input id="rememberLogin" type="checkbox" ${form.remember?'checked':''}>${LOGIN_UI.remember}</label>
      <div class="login-message ${state.authMessage?'is-error':''}" aria-live="polite">${escapeHtml(state.authMessage)}</div>
    </div>
  </div>`;
  const user=root.querySelector('#loginUser');
  const email=root.querySelector('#loginEmail');
  const pass=root.querySelector('#loginPass');
  const remember=root.querySelector('#rememberLogin');
  const loginBtn=root.querySelector('#loginBtn');
  const values=()=>[user.value, pass.value, remember.checked, email.value];
  const refreshLoginButton=()=>{ loginBtn.disabled=!(user.value.trim()&&pass.value); };
  const message=root.querySelector('.login-message');
  const syncForm=()=>{ actions.updateLoginForm({username:user.value, email:email.value, password:pass.value}); updatePasswordStrength(root, pass.value, user.value, email.value); if(message){ message.textContent=''; message.classList.remove('is-error'); } refreshLoginButton(); };
  refreshLoginButton();
  user.addEventListener('input', syncForm);
  email.addEventListener('input', syncForm);
  pass.addEventListener('input', syncForm);
  remember.addEventListener('change', ()=>actions.updateLoginForm({username:user.value, email:email.value, password:pass.value, remember:remember.checked}));
  root.querySelector('#loginBtn').addEventListener('click',()=>actions.login(...values()));
  root.querySelector('#registerBtn').addEventListener('click',()=>actions.registerUser(user.value, pass.value, email.value));
  const resetPanel=root.querySelector('#passwordResetPanel');
  const resendPanel=root.querySelector('#resendConfirmationPanel');
  const showSupport=panel=>{ resetPanel.hidden=panel!=='reset'; resendPanel.hidden=panel!=='resend'; };
  root.querySelector('#passwordReset').addEventListener('click',()=>{ showSupport('reset'); root.querySelector('#passwordResetEmail').focus(); });
  root.querySelector('#resendConfirmation').addEventListener('click',()=>{ showSupport('resend'); root.querySelector('#resendConfirmationEmail').focus(); });
  root.querySelectorAll('[data-close-support]').forEach(btn=>btn.addEventListener('click',()=>showSupport('')));
  root.querySelector('#sendPasswordReset').addEventListener('click',()=>actions.requestPasswordReset(root.querySelector('#passwordResetEmail').value));
  root.querySelector('#sendResendConfirmation').addEventListener('click',()=>actions.resendConfirmationEmail(root.querySelector('#resendConfirmationEmail').value));
  pass.addEventListener('keydown',e=>{ if(e.key==='Enter') actions.login(...values()); });
  bindPasswordToggles(root);
}

function renderPasswordRecovery(state, actions){
  const root=state.root; setAlignTop(root,false);
  const form=state.passwordRecovery||{};
  root.innerHTML = `<div class="screen login-screen has-bg">${renderBackgroundLayer('login')}
      <div class="login-panel password-recovery-panel">
      <div class="login-title">${RECOVERY_UI.title}</div>
      ${form.notice ? `<div class="password-recovery-notice">${escapeHtml(form.notice)}</div>` : ''}
      <label class="login-field">${RECOVERY_UI.newPassword}<span class="password-input-wrap"><input id="recoveryPassword" class="text-input" type="password" autocomplete="new-password" minlength="${AUTH_LIMITS.passwordMin}" maxlength="${AUTH_LIMITS.passwordMax}" value="${escapeHtml(form.password||'')}"><button class="password-toggle" type="button" data-toggle-password="#recoveryPassword" aria-label="パスワードを表示">表示</button></span><span class="input-help">${AUTH_LIMITS.passwordMin}〜${AUTH_LIMITS.passwordMax}文字 / 半角英数字・記号</span></label>
      ${passwordStrengthHtml(form.password||'')}
      <label class="login-field">${RECOVERY_UI.confirmPassword}<span class="password-input-wrap"><input id="recoveryConfirm" class="text-input" type="password" autocomplete="new-password" minlength="${AUTH_LIMITS.passwordMin}" maxlength="${AUTH_LIMITS.passwordMax}" value="${escapeHtml(form.confirmPassword||'')}"><button class="password-toggle" type="button" data-toggle-password="#recoveryConfirm" aria-label="パスワードを表示">表示</button></span></label>
      <div class="login-actions">
        <button class="btn" id="completeRecovery">${RECOVERY_UI.update}</button>
        <button class="btn" id="cancelRecovery">${RECOVERY_UI.cancel}</button>
      </div>
      <div class="login-message ${form.error?'is-error':''}" aria-live="polite">${escapeHtml(form.error||'')}</div>
    </div>
  </div>`;
  const password=root.querySelector('#recoveryPassword');
  const confirm=root.querySelector('#recoveryConfirm');
  password.addEventListener('input', ()=>updatePasswordStrength(root, password.value));
  root.querySelector('#completeRecovery').addEventListener('click', ()=>actions.completePasswordRecovery(password.value, confirm.value));
  root.querySelector('#cancelRecovery').addEventListener('click', ()=>actions.cancelPasswordRecovery());
  confirm.addEventListener('keydown', event=>{ if(event.key==='Enter') actions.completePasswordRecovery(password.value, confirm.value); });
  bindPasswordToggles(root);
}

function renderMenu(state, actions){
  const root=state.root; setAlignTop(root,false);
  const user=state.currentUser?.username ? `<div class="menu-account"><div class="menu-user">${escapeHtml(state.currentUser.username)}</div><button class="btn menu-user-data" data-act="userData">${USER_DATA_UI.button}</button></div>` : '';
  const adminShortcuts = isAdminUser(state.currentUser) ? `<aside class="admin-menu-shortcuts" aria-label="${ADMIN_UI.title}">
      <button class="btn" data-act="editor">${MENU_UI.editor}</button>
      <button class="btn" data-act="admin">${ADMIN_UI.title}</button>
    </aside>` : '';
  root.innerHTML = `<div class="screen menu-screen has-bg">${renderBackgroundLayer('menu')}<div class="menu-layout"><div class="menu">
    <div class="menu-title">${USER_DATA_UI.menuTitle}</div>
    ${user}
    <button class="btn" data-act="game">ゲームセレクト</button>
    <button class="btn" data-act="ranking">ランキング</button>
    <button class="btn" data-act="option">オプション</button>
    <button class="btn" data-act="help">ヘルプ</button>
    <button class="btn" data-act="credit">クレジット</button>
    <button class="btn" data-act="notice">${MENU_UI.notice}</button>
    <button class="btn" data-act="logout">ログアウト</button></div>
    ${adminShortcuts}
  </div></div>`;
  root.querySelector('[data-act="game"]').addEventListener('click', ()=>actions.goto('select'));
  root.querySelector('[data-act="userData"]')?.addEventListener('click', ()=>actions.goto('userData'));
  root.querySelector('[data-act="ranking"]').addEventListener('click', ()=>actions.goto('ranking'));
  root.querySelector('[data-act="option"]').addEventListener('click', ()=>actions.goto('options'));
  root.querySelector('[data-act="help"]').addEventListener('click', ()=>actions.goto('help'));
  root.querySelector('[data-act="credit"]').addEventListener('click', ()=>actions.goto('credits'));
  root.querySelector('[data-act="notice"]').addEventListener('click', ()=>actions.notify(MENU_UI.notice, MENU_UI.noticePending));
  root.querySelector('[data-act="editor"]')?.addEventListener('click', ()=>actions.goto('editor'));
  root.querySelector('[data-act="admin"]')?.addEventListener('click', ()=>actions.goto('admin'));
  root.querySelector('[data-act="logout"]').addEventListener('click', ()=>actions.logout());
}

function renderUserData(state, actions){
  const root=state.root; setAlignTop(root,true);
  const payload=exportCurrentUserPayload(state.currentUser);
  const account=state.currentUser||{};
  const isSupabase=account.source==='supabase';
  const status=state.userDataStatus||{};
  const deleteRequest=state.accountDeleteRequest||{};
  const rows=progressRows(payload.progress);
  const summary=difficultySummaries(payload.progress, payload.history);
  const hasRecords=rows.length>0 || (payload.history||[]).length>0;
  root.innerHTML = `<div class="screen user-data-screen has-bg">${renderBackgroundLayer('userData')}
    <div class="user-data-topbar">
      <button class="btn btn-slim" id="backUserData">${USER_DATA_UI.back}</button>
      <div class="user-data-title">${USER_DATA_UI.title}</div>
      <div class="user-data-actions">
        <button class="btn btn-debug" id="reloadUserData">${USER_DATA_UI.reload}</button>
      </div>
    </div>
    <div class="user-data-note">${USER_DATA_UI.note}</div>
    <section class="user-data-panel">
      <div class="user-data-section-title">基本情報</div>
      <div class="user-info-grid">
        <div><span>ユーザー名</span><strong>${escapeHtml(payload.user.username)}</strong></div>
        <div class="${account.account_status==='disabled'?'account-disabled-cell':''}"><span>アカウント状態</span><strong>${escapeHtml(ACCOUNT_STATUS_LABELS[account.account_status]||account.account_status||'通常')}</strong></div>
        <div><span>表示名</span><strong>${escapeHtml(account.display_name||payload.user.display_name||payload.user.username||'-')}</strong></div>
        <div><span>メールアドレス</span><strong>${escapeHtml(account.email||payload.user.email||'-')}</strong></div>
        <div><span>登録日時</span><strong>${escapeHtml(account.created_at ? formatDateTimeForDisplay(account.created_at) : dateText(payload.user, 'createdAt'))}</strong></div>
        <div><span>最終ログイン</span><strong>${escapeHtml(account.last_sign_in_at ? formatDateTimeForDisplay(account.last_sign_in_at) : '-')}</strong></div>
        <div><span>最終更新日時</span><strong>${escapeHtml(dateText(payload.user, 'updatedAt'))}</strong></div>
        ${account.account_status==='disabled'?`<div class="user-info-wide account-disabled-cell"><span>利用停止日時</span><strong>${escapeHtml(formatDateTimeForDisplay(account.disabled_at))}</strong></div><div class="user-info-wide account-disabled-cell"><span>理由</span><strong>${escapeHtml(account.disabled_reason||'アカウント削除申請承認')}</strong></div>`:''}
        <div><span>最終読込</span><strong>${escapeHtml(status.lastLoad||'-')}</strong></div>
        <div><span>最終保存</span><strong>${escapeHtml(status.lastSave||'-')}</strong></div>
      </div>
    </section>
    <section class="user-data-panel user-account-panel">
      <div class="user-data-section-title">${USER_DATA_UI.accountTitle}</div>
      ${isSupabase ? `<div class="account-email-section">
        <div class="login-field">${USER_DATA_UI.currentEmail}<input class="text-input" value="${escapeHtml(account.email||payload.user.email||'')}" disabled></div>
        <div class="login-field">${USER_DATA_UI.newEmail}<input id="newEmail" class="text-input" type="email" autocomplete="email" maxlength="${AUTH_LIMITS.emailChangeMax}" value="${escapeHtml(status.emailChangeNew||'')}"><span class="input-help">${AUTH_LIMITS.emailChangeMax}文字まで</span></div>
        <div class="login-field">${USER_DATA_UI.confirmEmail}<input id="confirmEmail" class="text-input" type="email" autocomplete="email" maxlength="${AUTH_LIMITS.emailChangeMax}" value="${escapeHtml(status.emailChangeConfirm||'')}"><span class="input-help">${AUTH_LIMITS.emailChangeMax}文字まで / ${USER_DATA_UI.emailChangeHelp}</span></div>
        <button class="btn btn-slim" id="requestEmailChange" ${status.emailChangeLoading?'disabled':''}>${USER_DATA_UI.requestEmailChange}</button>
        <div class="account-email-status ${status.emailChangeError?'is-error':''}" aria-live="polite">${escapeHtml(status.emailChangeResult||'')}</div>
      </div>
      <div class="login-field">${USER_DATA_UI.newPassword}<span class="password-input-wrap"><input id="newPassword" class="text-input" type="password" autocomplete="new-password" minlength="${AUTH_LIMITS.passwordMin}" maxlength="${AUTH_LIMITS.passwordMax}"><button class="password-toggle" type="button" data-toggle-password="#newPassword" aria-label="パスワードを表示">表示</button></span><span class="input-help">${AUTH_LIMITS.passwordMin}〜${AUTH_LIMITS.passwordMax}文字 / 半角英数字・記号</span></div>
      ${passwordStrengthHtml('', account.username||payload.user.username||'', account.email||payload.user.email||'')}
      <div class="login-field">${USER_DATA_UI.confirmPassword}<span class="password-input-wrap"><input id="confirmPassword" class="text-input" type="password" autocomplete="new-password" minlength="${AUTH_LIMITS.passwordMin}" maxlength="${AUTH_LIMITS.passwordMax}"><button class="password-toggle" type="button" data-toggle-password="#confirmPassword" aria-label="パスワードを表示">表示</button></span></div>
      ${accountDeleteRequestHtml(deleteRequest)}
      <div class="account-actions">
        <button class="btn btn-slim" id="changePassword">${USER_DATA_UI.changePassword}</button>
        <button class="btn btn-slim btn-danger" id="requestAccountDeletion">${USER_DATA_UI.deleteRequest}</button>
      </div>` : `<div class="user-data-note">${USER_DATA_UI.localAccountNote}</div>`}
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
  root.querySelector('#changePassword')?.addEventListener('click', ()=>{
    actions.changePassword(root.querySelector('#newPassword')?.value, root.querySelector('#confirmPassword')?.value);
  });
  root.querySelector('#requestEmailChange')?.addEventListener('click', ()=>{
    actions.requestEmailChange(root.querySelector('#newEmail')?.value, root.querySelector('#confirmEmail')?.value);
  });
  root.querySelector('#newPassword')?.addEventListener('input', e=>updatePasswordStrength(root, e.target.value, account.username||payload.user.username||'', account.email||payload.user.email||''));
  root.querySelector('#requestAccountDeletion')?.addEventListener('click', ()=>actions.requestAccountDeletion());
  bindPasswordToggles(root);
}

function accountDeleteRequestHtml(state){
  if(state?.loading) return `<div class="account-delete-status">アカウント削除申請: 確認中...</div>`;
  if(state?.error) return `<div class="account-delete-status is-error">${escapeHtml(state.error)}</div>`;
  const req=state?.data;
  if(!req) return '';
  const label=DELETE_REQUEST_STATUS_LABELS[req.status]||req.status||'-';
  return `<div class="account-delete-status">アカウント削除申請: ${escapeHtml(label)}<br>申請日時: ${escapeHtml(formatDateTimeForDisplay(req.requested_at))}</div>`;
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

function renderAdmin(state, actions){
  const root=state.root; setAlignTop(root,true);
  const admin=state.admin||{};
  if(!isAdminUser(state.currentUser)){
    root.innerHTML = `<div class="screen info-screen has-bg">${renderBackgroundLayer('admin')}<button class="btn btn-slim info-back" id="backAdmin">${ADMIN_UI.back}</button><div class="info-title">${ADMIN_UI.title}</div><section class="info-panel admin-danger">${ADMIN_UI.denied}</section></div>`;
    root.querySelector('#backAdmin').addEventListener('click',()=>actions.goto('menu'));
    return;
  }
  const data=admin.data||{};
  const profiles=filterAdminProfiles(data.profiles||[], admin);
  const selectedUser=(data.profiles||[]).find(user=>user.id===admin.selectedUserId)||profiles[0]||null;
  const selectedProgress=(data.progress||[]).filter(row=>!selectedUser||row.user_id===selectedUser.id);
  const selectedHistory=(data.history||[]).filter(row=>!selectedUser||row.user_id===selectedUser.id).slice(0,20);
  const selectedUserRankings=(data.rankings||[]).filter(row=>selectedUser&&row.user_id===selectedUser.id);
  const rankings=filterAdminRankings(data.rankings||[], admin);
  const selectedRanking=(data.rankings||[]).find(row=>row.id===admin.selectedRankingId)||rankings[0]||null;
  const deleteRequests=filterAccountDeleteRequests(data.deleteRequests||[], admin);
  const pendingDeleteCount=(data.deleteRequests||[]).filter(row=>row.status==='pending').length;
  const selectedDeleteRequest=(data.deleteRequests||[]).find(row=>row.id===admin.selectedDeleteRequestId)||deleteRequests[0]||null;
  root.innerHTML = `<div class="screen admin-screen has-bg" id="admin-page-top">${renderBackgroundLayer('admin')}
    <div class="admin-topbar"><button class="btn btn-slim" id="backAdmin">${ADMIN_UI.back}</button><div class="admin-title">${ADMIN_UI.title}</div><button class="btn btn-debug" id="reloadAdmin">${ADMIN_UI.reload}</button></div>
    <div class="admin-status ${admin.error?'is-error':''}">${escapeHtml(admin.loading?'読み込み中...':(admin.error||admin.message||'profiles.role = admin のユーザーだけが利用できます'))}</div>
    ${pendingDeleteCount ? `<div class="admin-status admin-notice">アカウント削除申請が ${pendingDeleteCount} 件届いています</div>` : ''}
    <div class="admin-card-grid">
      ${ADMIN_SECTIONS.map(([id,label])=>`<button class="admin-entry-card" type="button" data-admin-scroll="${id}">${label}</button>`).join('')}
    </div>
    <section class="admin-panel admin-scroll-section" id="admin-section-users">
      <div class="admin-section-title">${ADMIN_UI.users}</div>
      <div class="admin-filters">
        <input id="adminUserQuery" class="text-input admin-input" placeholder="ユーザー名 / メール検索" value="${escapeHtml(admin.userQuery||'')}">
        <select id="adminRoleFilter" class="text-input admin-input"><option value="all" ${admin.roleFilter==='all'?'selected':''}>全権限</option><option value="admin" ${admin.roleFilter==='admin'?'selected':''}>admin</option><option value="user" ${admin.roleFilter==='user'?'selected':''}>user</option></select>
      </div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ユーザー名</th><th>表示名</th><th>メール</th><th>権限</th><th>状態</th><th>削除申請</th><th>停止</th><th>復活</th><th>登録日時</th><th>ユーザーID</th><th></th></tr></thead><tbody>${profiles.map(user=>`<tr class="${selectedUser?.id===user.id?'is-current-user':''} ${user.account_status==='disabled'?'is-disabled-user':''}"><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.display_name||'-')}</td><td>${escapeHtml(user.email||'-')}</td><td>${escapeHtml(user.role||'-')}</td><td>${escapeHtml(ACCOUNT_STATUS_LABELS[user.account_status]||user.account_status||'通常')}</td><td>${escapeHtml(countText(user.delete_request_count))}</td><td>${escapeHtml(countText(user.account_disabled_count))}</td><td>${escapeHtml(countText(user.account_reactivated_count))}</td><td>${escapeHtml(formatDateTimeForDisplay(user.created_at))}</td><td>${escapeHtml(user.id)}</td><td><button class="btn btn-debug" data-admin-user="${escapeHtml(user.id)}">詳細</button></td></tr>`).join('')||`<tr><td colspan="11">ユーザーがありません</td></tr>`}</tbody></table></div>
      ${selectedUser?adminUserDetailHtml(selectedUser, selectedProgress, selectedHistory, selectedUserRankings):''}
    </section>
    <section class="admin-panel admin-scroll-section" id="admin-section-rankings">
      <div class="admin-section-title">${ADMIN_UI.ranking}</div>
      <div class="admin-filters">
        <select id="adminRankingDifficulty" class="text-input admin-input">${['all','beginner','easy','normal','hard','endless'].map(key=>`<option value="${key}" ${admin.rankingDifficulty===key?'selected':''}>${key==='all'?'全難易度':key}</option>`).join('')}</select>
        <input id="adminRankingStage" class="text-input admin-input" placeholder="ステージ番号" value="${escapeHtml(admin.rankingStage||'')}">
        <input id="adminRankingQuery" class="text-input admin-input" placeholder="ユーザー検索" value="${escapeHtml(admin.rankingQuery||'')}">
        <select id="adminRankingSort" class="text-input admin-input"><option value="time" ${admin.rankingSort==='time'?'selected':''}>タイム順</option><option value="date" ${admin.rankingSort==='date'?'selected':''}>日付順</option></select>
      </div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>難易度</th><th>面</th><th>ユーザー名</th><th>表示名</th><th>メール</th><th>ベスト</th><th>クリア日時</th><th>記録ID</th><th></th></tr></thead><tbody>${rankings.map(row=>`<tr class="${selectedRanking?.id===row.id?'is-current-user':''}"><td>${escapeHtml(row.difficulty)}</td><td>#${escapeHtml(row.stage_no)}</td><td>${escapeHtml(row.profile?.username||'-')}</td><td>${escapeHtml(row.profile?.display_name||'-')}</td><td>${escapeHtml(row.profile?.email||'-')}</td><td>${formatMs(row.clear_time_ms)}</td><td>${escapeHtml(formatDateTimeForDisplay(row.created_at))}</td><td>${escapeHtml(row.id)}</td><td><button class="btn btn-debug" data-admin-ranking="${escapeHtml(row.id)}">詳細</button></td></tr>`).join('')||`<tr><td colspan="9">ランキング記録がありません</td></tr>`}</tbody></table></div>
      ${selectedRanking?adminRankingDetailHtml(selectedRanking):''}
    </section>
    <section class="admin-panel admin-scroll-section" id="admin-section-delete-requests">
      <div class="admin-section-title">${ADMIN_UI.deleteRequests}</div>
      <div class="admin-filters">
        <select id="adminDeleteRequestStatus" class="text-input admin-input">${['all','pending','approved','rejected'].map(key=>`<option value="${key}" ${admin.deleteRequestStatus===key?'selected':''}>${key==='all'?'全状態':DELETE_REQUEST_STATUS_LABELS[key]}</option>`).join('')}</select>
        <input id="adminDeleteRequestQuery" class="text-input admin-input" placeholder="ユーザー名 / メール検索" value="${escapeHtml(admin.deleteRequestQuery||'')}">
      </div>
      ${data.deleteRequestError?`<div class="admin-status is-error">${escapeHtml(data.deleteRequestError)}</div>`:''}
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>申請日時</th><th>ユーザー名</th><th>表示名</th><th>メール</th><th>状態</th><th>管理者メモ</th><th>ユーザーID</th><th>申請ID</th><th></th></tr></thead><tbody>${deleteRequests.map(row=>`<tr class="${selectedDeleteRequest?.id===row.id?'is-current-user':''} ${row.status==='pending'?'is-pending-request':''}"><td>${escapeHtml(formatDateTimeForDisplay(row.requested_at))}</td><td>${escapeHtml(row.username||row.profile?.username||'-')}</td><td>${escapeHtml(row.display_name||row.profile?.display_name||'-')}</td><td>${escapeHtml(row.email||row.profile?.email||'-')}</td><td>${escapeHtml(DELETE_REQUEST_STATUS_LABELS[row.status]||row.status||'-')}</td><td>${escapeHtml(row.admin_note||'-')}</td><td>${escapeHtml(row.user_id)}</td><td>${escapeHtml(row.id)}</td><td><button class="btn btn-debug" data-admin-delete-request="${escapeHtml(row.id)}">詳細</button></td></tr>`).join('')||`<tr><td colspan="9">現在、アカウント削除申請はありません</td></tr>`}</tbody></table></div>
      ${selectedDeleteRequest?adminDeleteRequestDetailHtml(selectedDeleteRequest):''}
    </section>
    <section class="admin-panel admin-scroll-section" id="admin-section-puzzles">
      <div class="admin-section-title">パズル管理</div>
      <div class="admin-note">難易度ごとのJSONだけをSupabaseへ反映します。puzzles.id のuuid主キーは変更せず、JSON側の id は管理用 puzzle_key として扱います。</div>
      <div class="admin-puzzle-upload-fields">
        <select id="adminPuzzleDifficulty" class="text-input admin-input admin-puzzle-difficulty">${['beginner','easy','normal','hard','endless'].map(key=>`<option value="${key}" ${admin.puzzleUpload?.difficulty===key?'selected':''}>${key}</option>`).join('')}</select>
        <div class="admin-puzzle-file-control">
          <label class="btn btn-slim admin-puzzle-file-button" for="adminPuzzleFile">ファイルを選択</label>
          <span class="admin-puzzle-file-name" id="adminPuzzleFileName">${escapeHtml(admin.puzzleUpload?.fileName||'ファイルを選択してください')}</span>
          <input id="adminPuzzleFile" class="admin-puzzle-file-input" type="file" accept=".json,application/json">
        </div>
      </div>
      <div class="admin-puzzle-upload-actions">
        <button class="btn btn-slim" id="checkAdminPuzzles">アップロード前チェック</button>
        <button class="btn btn-slim btn-danger" id="uploadAdminPuzzles" ${admin.puzzleUpload?.result?.ok?'':'disabled'}>反映実行</button>
      </div>
      ${adminPuzzleUploadHtml(admin.puzzleUpload)}
    </section>
    <section class="admin-panel admin-danger admin-scroll-section" id="admin-section-debug">
      <div class="admin-section-title">${ADMIN_UI.debug}</div>
      <div class="admin-debug-actions">
        <button class="btn btn-debug" id="adminExportAll">ユーザーデータJSON出力</button>
        <button class="btn btn-debug" id="adminExportCurrent">現在ユーザーJSON出力</button>
        <button class="btn btn-debug" id="adminResetClear">クリア状況リセット</button>
        <button class="btn btn-debug" id="adminResetUser">ユーザーデータ削除</button>
      </div>
      <div class="admin-note">F1デバッグクリアはSupabase管理者ユーザー専用です。実行時は現状、通常クリアとしてランキング対象です。debug_clear フラグ分離は後続チケットで扱います。</div>
    </section>
    <section class="admin-panel admin-scroll-section" id="admin-section-system">
      <div class="admin-section-title">${ADMIN_UI.system}</div>
      <div class="admin-system-actions"><a class="btn btn-slim" href="/api/supabase-config-status" target="_blank" rel="noopener">${ADMIN_UI.supabaseConfigStatus}</a></div>
      <div class="admin-detail-grid">
        <div><span>管理者サーバーAPI</span><strong>${escapeHtml(adminServerApiLabel(admin.serverApi))}</strong></div>
      </div>
      <div class="admin-note">secret keyはフロントでは使用しません。更新・削除はSupabase RLSで許可された範囲だけ実行します。</div>
    </section>
    <button class="btn admin-back-to-top" type="button" id="adminBackToTop" title="${ADMIN_UI.backToTop}" aria-label="${ADMIN_UI.backToTop}">↑</button>
  </div>`;
  bindAdminEvents(root, actions, selectedUser, selectedRanking, selectedDeleteRequest, selectedUserRankings.length);
}

function adminUserDetailHtml(user, progress, history, rankings=[]){
  const disabled = user.account_status === 'disabled';
  const passwordClearRequired = user.password_clear_required === true;
  const rankingCount = rankings.length;
  return `<div class="admin-detail"><div class="admin-section-title">ユーザー詳細</div>
    <div class="admin-edit-grid"><label>表示名<input id="adminDisplayName" class="text-input admin-input" value="${escapeHtml(user.display_name||'')}"></label><label>権限<select id="adminRole" class="text-input admin-input"><option value="user" ${user.role!=='admin'?'selected':''}>user</option><option value="admin" ${user.role==='admin'?'selected':''}>admin</option></select></label><div class="admin-status-label ${disabled?'is-disabled':''}">状態: ${escapeHtml(ACCOUNT_STATUS_LABELS[user.account_status]||user.account_status||'通常')}</div><button class="btn btn-slim" id="saveAdminProfile">ユーザー情報保存</button>${disabled?'<button class="btn btn-slim" id="reactivateAdminUser">利用停止解除</button>':''}<button class="btn btn-slim btn-danger admin-password-reset-btn" id="clearAdminPassword" ${String(user.email||'').trim()?'':'disabled'}>${ADMIN_UI.passwordClear}</button></div>
    <div class="admin-note">メールアドレス変更は通常、ユーザー本人のユーザーデータ画面から行います。</div>
    <div class="admin-subtitle">管理者メール修復</div>
    <div class="admin-note">この操作は、架空メールや不整合データを修復するための管理者専用操作です。通常のメールアドレス変更は、ユーザー本人のユーザーデータ画面から行ってください。</div>
    <div class="admin-edit-grid">
      <div class="admin-status-label">現在のメールアドレス: ${escapeHtml(user.email||'-')}</div>
      <label>修復後メールアドレス<input id="adminRepairEmail" class="text-input admin-input" type="email" maxlength="${AUTH_LIMITS.emailChangeMax}" placeholder="example+repair@gmail.com"></label>
      <button class="btn btn-slim btn-danger" id="repairAdminEmail">管理者メール修復を実行</button>
    </div>
    <div class="admin-account-status-grid">
      <div class="${disabled?'is-disabled':''}"><span>アカウント状態</span><strong>${escapeHtml(ACCOUNT_STATUS_LABELS[user.account_status]||user.account_status||'通常')}</strong></div>
      <div class="${disabled?'is-disabled':''}"><span>利用停止日時</span><strong>${escapeHtml(formatDateTimeForDisplay(user.disabled_at)||'-')}</strong></div>
      <div class="${disabled?'is-disabled':''}"><span>利用停止理由</span><strong>${escapeHtml(user.disabled_reason||'-')}</strong></div>
      <div class="${passwordClearRequired?'is-disabled':''}"><span>旧強制変更フラグ</span><strong>${passwordClearRequired?'残存':'なし'}</strong></div>
      <div><span>再設定メール送信日時</span><strong>${escapeHtml(formatDateTimeForDisplay(user.password_clear_requested_at)||'-')}</strong></div>
      <div><span>最終パスワード変更日時</span><strong>${escapeHtml(formatDateTimeForDisplay(user.last_password_changed_at)||'-')}</strong></div>
      <div><span>再設定メール送信回数</span><strong>${escapeHtml(countText(user.password_clear_count))}</strong></div>
    </div>
    <div class="admin-subtitle">削除申請・利用停止カウント</div>
    <div class="admin-account-counter-grid">
      ${ACCOUNT_COUNTER_LABELS.map(([key,label,type])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(type==='date' ? (formatDateTimeForDisplay(user[key])||'-') : countText(user[key]))}</strong></div>`).join('')}
    </div>
    <div class="admin-subtitle">ランキング記録</div>
    <div class="admin-detail-grid">
      <div><span>対象ユーザーのランキング件数</span><strong>${escapeHtml(countText(rankingCount))}</strong></div>
    </div>
    <div class="admin-edit-grid"><button class="btn btn-slim btn-danger" id="deleteAdminUserRankings" ${rankingCount?'':'disabled'}>このユーザーのランキング記録を削除</button></div>
    <div class="admin-subtitle admin-scroll-section" id="admin-section-progress">進行状況</div>
    <div class="admin-table-wrap admin-progress-table-wrap"><table class="admin-table admin-progress-table"><thead><tr><th>Progress Key</th><th class="admin-progress-clear-column">クリア</th><th>ベストms</th><th>最新ms</th><th>クリア数</th><th>失敗</th><th>ギブアップ</th><th>ヒント</th><th></th></tr></thead><tbody>${progress.slice(0,20).map(row=>{ const key=`${row.user_id}|${row.puzzle_id}`; return `<tr><td class="admin-progress-key-column">${escapeHtml(key)}</td><td class="admin-progress-clear-column admin-progress-clear-cell"><input type="checkbox" data-progress-cleared="${escapeHtml(key)}" ${row.cleared?'checked':''}></td><td><input class="admin-mini-input" data-progress-field="best_clear_time_ms" data-progress-id="${escapeHtml(key)}" value="${escapeHtml(row.best_clear_time_ms??'')}"></td><td><input class="admin-mini-input" data-progress-field="latest_clear_time_ms" data-progress-id="${escapeHtml(key)}" value="${escapeHtml(row.latest_clear_time_ms??'')}"></td><td><input class="admin-mini-input" data-progress-field="clear_count" data-progress-id="${escapeHtml(key)}" value="${escapeHtml(row.clear_count??0)}"></td><td><input class="admin-mini-input" data-progress-field="fail_count" data-progress-id="${escapeHtml(key)}" value="${escapeHtml(row.fail_count??0)}"></td><td><input class="admin-mini-input" data-progress-field="giveup_count" data-progress-id="${escapeHtml(key)}" value="${escapeHtml(row.giveup_count??0)}"></td><td><input class="admin-mini-input" data-progress-field="hint_used_count" data-progress-id="${escapeHtml(key)}" value="${escapeHtml(row.hint_used_count??0)}"></td><td><button class="btn btn-debug" data-save-progress="${escapeHtml(key)}">保存</button></td></tr>`; }).join('')||`<tr><td colspan="9">進行状況がありません</td></tr>`}</tbody></table></div>
    <div class="admin-subtitle">プレイ履歴</div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>結果</th><th>時間</th><th>ヒント</th><th>日時</th></tr></thead><tbody>${history.map(row=>`<tr><td>${escapeHtml(row.result)}</td><td>${formatMs(row.play_time_ms)}</td><td>${escapeHtml(row.hint_used_count??0)}</td><td>${escapeHtml(formatDateTimeForDisplay(row.created_at))}</td></tr>`).join('')||`<tr><td colspan="4">履歴がありません</td></tr>`}</tbody></table></div>
  </div>`;
}

function adminRankingDetailHtml(row){
  return `<div class="admin-detail"><div class="admin-section-title">ランキング詳細</div><div class="admin-edit-grid"><label>ベストタイムms<input id="adminRankingTime" class="text-input admin-input" value="${escapeHtml(row.clear_time_ms??0)}"></label><button class="btn btn-slim" id="saveAdminRanking">ランキング保存</button><button class="btn btn-slim btn-danger" id="deleteAdminRanking">削除</button></div><div class="admin-note">非表示フラグや備考欄は現スキーマに無いため未対応です。</div></div>`;
}

function adminDeleteRequestDetailHtml(row){
  const pending=row.status==='pending';
  return `<div class="admin-detail"><div class="admin-section-title">削除申請詳細</div>
    <div class="admin-detail-grid">
      <div><span>申請ID</span><strong>${escapeHtml(row.id)}</strong></div>
      <div><span>ユーザーID</span><strong>${escapeHtml(row.user_id)}</strong></div>
      <div><span>ユーザー名</span><strong>${escapeHtml(row.username||row.profile?.username||'-')}</strong></div>
      <div><span>表示名</span><strong>${escapeHtml(row.display_name||row.profile?.display_name||'-')}</strong></div>
      <div><span>メール</span><strong>${escapeHtml(row.email||row.profile?.email||'-')}</strong></div>
      <div><span>申請日時</span><strong>${escapeHtml(formatDateTimeForDisplay(row.requested_at))}</strong></div>
      <div><span>状態</span><strong>${escapeHtml(DELETE_REQUEST_STATUS_LABELS[row.status]||row.status||'-')}</strong></div>
      <div><span>確認日時</span><strong>${escapeHtml(formatDateTimeForDisplay(row.reviewed_at))}</strong></div>
      <div><span>確認者</span><strong>${escapeHtml(row.reviewed_by||'-')}</strong></div>
    </div>
    <label class="admin-subtitle">管理者メモ<textarea id="adminDeleteRequestNote" class="text-input admin-textarea">${escapeHtml(row.admin_note||'')}</textarea></label>
    ${pending ? `<div class="admin-edit-grid"><button class="btn btn-slim" id="approveDeleteRequest">申請許可</button><button class="btn btn-slim btn-danger" id="rejectDeleteRequest">申請拒否</button></div>` : `<div class="admin-note">この申請は処理済みです。Authユーザーの物理削除は行っていません。</div>`}
    <div class="admin-note">申請許可時は対象ユーザーを利用停止にします。Authユーザー、進行データ、ランキング記録は物理削除しません。</div>
  </div>`;
}

function adminPuzzleUploadHtml(upload){
  if(!upload) return `<div class="admin-note">JSONを選択してアップロード前チェックを実行してください。</div>`;
  if(upload.loading) return `<div class="admin-status">パズルJSONを確認しています...</div>`;
  if(upload.error) return `<div class="admin-status is-error">${escapeHtml(upload.error)}</div>`;
  const result=upload.result;
  if(!result) return `<div class="admin-note">対象ファイル: ${escapeHtml(upload.fileName||'-')}</div>`;
  const previewRows=result.preview||[];
  const preview=previewRows.map(row=>`<tr><td>${escapeHtml(row.puzzle_key)}</td><td>#${escapeHtml(row.stage_no)}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.size)}</td><td>${escapeHtml(row.color_mode)}</td></tr>`).join('');
  return `<div class="admin-detail">
    <div class="admin-detail-grid">
      <div><span>対象難易度</span><strong>${escapeHtml(result.difficulty||upload.difficulty||'-')}</strong></div>
      <div><span>読み込んだ件数</span><strong>${escapeHtml(result.count??0)}</strong></div>
      <div><span>追加</span><strong>${escapeHtml(result.inserted??'-')}</strong></div>
      <div><span>更新</span><strong>${escapeHtml(result.updated??'-')}</strong></div>
      <div><span>非公開</span><strong>${escapeHtml(result.unpublished??'-')}</strong></div>
    </div>
    <div class="admin-note">検証結果一覧: ${escapeHtml(previewRows.length)} 件</div>
    <div class="admin-table-wrap admin-puzzle-preview-wrap"><table class="admin-table admin-puzzle-preview-table"><thead><tr><th>puzzle_key</th><th>面</th><th>タイトル</th><th>サイズ</th><th>種別</th></tr></thead><tbody>${preview||`<tr><td colspan="5">プレビューがありません</td></tr>`}</tbody></table></div>
  </div>`;
}

function bindAdminEvents(root, actions, selectedUser, selectedRanking, selectedDeleteRequest, selectedUserRankingCount=0){
  root.querySelector('#backAdmin').addEventListener('click',()=>actions.goto('menu'));
  root.querySelector('#reloadAdmin').addEventListener('click',()=>actions.loadAdminData());
  root.querySelector('#adminUserQuery').addEventListener('input',e=>actions.setAdminFilter('userQuery', e.target.value));
  root.querySelector('#adminRoleFilter').addEventListener('change',e=>actions.setAdminFilter('roleFilter', e.target.value));
  root.querySelectorAll('[data-admin-user]').forEach(btn=>btn.addEventListener('click',()=>actions.selectAdminUser(btn.dataset.adminUser)));
  root.querySelector('#saveAdminProfile')?.addEventListener('click',()=>actions.saveAdminProfile(selectedUser.id,{display_name:root.querySelector('#adminDisplayName').value,role:root.querySelector('#adminRole').value}));
  root.querySelector('#reactivateAdminUser')?.addEventListener('click',()=>actions.reactivateAdminAccount(selectedUser.id));
  root.querySelector('#clearAdminPassword')?.addEventListener('click',()=>actions.requestAdminPasswordClear(selectedUser));
  root.querySelector('#repairAdminEmail')?.addEventListener('click',()=>actions.requestAdminEmailRepair(selectedUser, root.querySelector('#adminRepairEmail')?.value));
  root.querySelector('#deleteAdminUserRankings')?.addEventListener('click',()=>actions.requestDeleteAdminUserRankings(selectedUser, selectedUserRankingCount));
  root.querySelectorAll('[data-save-progress]').forEach(btn=>btn.addEventListener('click',()=>actions.saveAdminProgress(btn.dataset.saveProgress, collectProgressPatch(root, btn.dataset.saveProgress))));
  root.querySelector('#adminRankingDifficulty').addEventListener('change',e=>actions.setAdminFilter('rankingDifficulty', e.target.value));
  root.querySelector('#adminRankingStage').addEventListener('input',e=>actions.setAdminFilter('rankingStage', e.target.value));
  root.querySelector('#adminRankingQuery').addEventListener('input',e=>actions.setAdminFilter('rankingQuery', e.target.value));
  root.querySelector('#adminRankingSort').addEventListener('change',e=>actions.setAdminFilter('rankingSort', e.target.value));
  root.querySelectorAll('[data-admin-ranking]').forEach(btn=>btn.addEventListener('click',()=>actions.selectAdminRanking(btn.dataset.adminRanking)));
  root.querySelector('#saveAdminRanking')?.addEventListener('click',()=>actions.saveAdminRanking(selectedRanking.id,{clear_time_ms:root.querySelector('#adminRankingTime').value}));
  root.querySelector('#deleteAdminRanking')?.addEventListener('click',()=>actions.deleteAdminRankingRecord(selectedRanking.id));
  root.querySelector('#adminDeleteRequestStatus').addEventListener('change',e=>actions.setAdminFilter('deleteRequestStatus', e.target.value));
  root.querySelector('#adminDeleteRequestQuery').addEventListener('input',e=>actions.setAdminFilter('deleteRequestQuery', e.target.value));
  root.querySelectorAll('[data-admin-delete-request]').forEach(btn=>btn.addEventListener('click',()=>actions.selectAdminDeleteRequest(btn.dataset.adminDeleteRequest)));
  root.querySelector('#approveDeleteRequest')?.addEventListener('click',()=>actions.saveAdminDeleteRequestReview(selectedDeleteRequest.id,{status:'approved',user_id:selectedDeleteRequest.user_id,admin_note:root.querySelector('#adminDeleteRequestNote')?.value}));
  root.querySelector('#rejectDeleteRequest')?.addEventListener('click',()=>actions.saveAdminDeleteRequestReview(selectedDeleteRequest.id,{status:'rejected',user_id:selectedDeleteRequest.user_id,admin_note:root.querySelector('#adminDeleteRequestNote')?.value}));
  root.querySelector('#adminPuzzleFile')?.addEventListener('change',e=>{
    const name=e.target.files?.[0]?.name||'ファイルを選択してください';
    const label=root.querySelector('#adminPuzzleFileName');
    if(label) label.textContent=name;
  });
  root.querySelector('#checkAdminPuzzles')?.addEventListener('click',()=>actions.checkAdminPuzzleUpload(root.querySelector('#adminPuzzleDifficulty')?.value, root.querySelector('#adminPuzzleFile')?.files?.[0]));
  root.querySelector('#uploadAdminPuzzles')?.addEventListener('click',()=>actions.executeAdminPuzzleUpload());
  root.querySelector('#adminExportAll').addEventListener('click',()=>actions.exportUserDataJson());
  root.querySelector('#adminExportCurrent').addEventListener('click',()=>actions.exportCurrentUserJson());
  root.querySelector('#adminResetClear').addEventListener('click',()=>actions.resetClearFlags());
  root.querySelector('#adminResetUser').addEventListener('click',()=>actions.resetUserData());
  root.querySelectorAll('[data-admin-scroll]').forEach(button=>button.addEventListener('click',()=>{
    root.querySelector(`#${button.dataset.adminScroll}`)?.scrollIntoView({behavior:'smooth', block:'start'});
  }));
  root.querySelector('#adminBackToTop').addEventListener('click',()=>root.querySelector('#admin-page-top')?.scrollIntoView({behavior:'smooth', block:'start'}));
}

function collectProgressPatch(root, id){
  const patch={cleared:!!root.querySelector(`[data-progress-cleared="${cssEscape(id)}"]`)?.checked};
  root.querySelectorAll(`[data-progress-id="${cssEscape(id)}"]`).forEach(input=>{ patch[input.dataset.progressField]=input.value; });
  return patch;
}

function cssEscape(value){ return String(value).replace(/["\\]/g, '\\$&'); }
function filterAdminProfiles(profiles, admin){
  const q=String(admin.userQuery||'').toLowerCase();
  return profiles.filter(user=>(admin.roleFilter==='all'||!admin.roleFilter||user.role===admin.roleFilter)&&(!q||[user.username,user.display_name,user.email].some(v=>String(v||'').toLowerCase().includes(q))));
}
function filterAdminRankings(rankings, admin){
  const q=String(admin.rankingQuery||'').toLowerCase();
  const stage=String(admin.rankingStage||'').trim();
  const rows=rankings.filter(row=>(admin.rankingDifficulty==='all'||!admin.rankingDifficulty||row.difficulty===admin.rankingDifficulty)&&(!stage||String(row.stage_no)===stage)&&(!q||[row.profile?.username,row.profile?.display_name,row.profile?.email].some(v=>String(v||'').toLowerCase().includes(q))));
  return rows.sort((a,b)=>admin.rankingSort==='date'?String(b.created_at||'').localeCompare(String(a.created_at||'')):(Number(a.clear_time_ms||0)-Number(b.clear_time_ms||0)));
}
function filterAccountDeleteRequests(requests, admin){
  const q=String(admin.deleteRequestQuery||'').toLowerCase();
  const status=admin.deleteRequestStatus||'all';
  return (requests||[]).filter(row=>(status==='all'||row.status===status)&&(!q||[row.username,row.display_name,row.email,row.profile?.username,row.profile?.display_name,row.profile?.email].some(v=>String(v||'').toLowerCase().includes(q))));
}

function adminServerApiLabel(serverApi){
  if(!serverApi) return '確認中';
  if(serverApi.status==='ok') return '利用可能';
  if(serverApi.status==='unconfigured') return '未設定';
  if(serverApi.status==='unauthorized') return '未ログイン';
  if(serverApi.status==='forbidden') return '権限エラー';
  return serverApi.message || '確認できません';
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
  const hasLoaded=!!state.selectLoaded?.[mode];
  const loadedPuzzles=state.selectPuzzles?.[mode]||[];
  const pack=hasLoaded ? {mode, puzzles:loadedPuzzles.map(p=>({id:String(p.stageNo??p.id), title:p.title, stageNo:p.stageNo}))} : getPack(mode);
  const total=pack.puzzles.length; const pages=Math.max(1, Math.ceil(total/per));
  const isSolvedId=id=>state.solved[mode].has(id)||state.solved[mode].has(String(id));
  const solvedCount=pack.puzzles.reduce((sum,p)=>sum+(isSolvedId(p.id)?1:0),0);
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
      <div class="thumb-grid" id="grid" style="--thumb-size:${thumbSize}; --select-cols:${cols}; --select-row-gap:${rowGap}px; max-width:calc((var(--thumb-size) * ${cols}) + (24px * ${cols - 1}));"></div>
    </div>`;
  root.querySelector('#back').addEventListener('click', ()=>actions.goto('menu'));
  const goPage = d => { const n=Math.min(Math.max(1,page+d),pages); if(n!==page) actions.setPage(n); };
  root.querySelector('#prev').addEventListener('click', ()=>goPage(-1));
  root.querySelector('#next').addEventListener('click', ()=>goPage(1));
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
  if(!state.selectLoaded?.[mode]&&!state.selectLoading?.[mode]){
    state.selectLoading={...(state.selectLoading||{}), [mode]:true};
    loadPuzzles(mode).then(puzzles=>{
      if(state.screen!=='select'||state.mode!==mode) return;
      state.selectPuzzles={...(state.selectPuzzles||{}), [mode]:puzzles};
      state.selectLoaded={...(state.selectLoaded||{}), [mode]:true};
      state.selectLoading={...(state.selectLoading||{}), [mode]:false};
      render(state, actions);
    }).catch(()=>{
      state.selectLoaded={...(state.selectLoaded||{}), [mode]:true};
      state.selectLoading={...(state.selectLoading||{}), [mode]:false};
    });
  }
  const puzzleMap=new Map();
  for(const puzzle of loadedPuzzles||[]){ puzzleMap.set(String(puzzle.id), puzzle); puzzleMap.set(String(puzzle.stageNo), puzzle); }
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
}

function renderGame(state, actions){
  const root=state.root; setAlignTop(root,false);
  const G=state.game; if(!G){ root.innerHTML=`<div class="screen"><div class="menu"><button class="btn" id="back">${GAME_UI.backSelect}</button><p>${GAME_UI.noPuzzle}</p></div></div>`; root.querySelector('#back').onclick=()=>actions.goto('select'); return; }
  state.boardScroll=captureBoardScroll(root, state.boardScroll);
  const {w,h,solution}=G; const {rows,cols}=makeClues(solution,w,h,G.colorMode); const maxRowLen=Math.max(...rows.map(r=>r.length)); const maxColLen=Math.max(...cols.map(c=>c.length));
  const boardSize=Math.max(w,h); const zoom=Number(state.boardZoom||1); const baseCellSize=Math.max(18, Math.min(34, Math.floor(280/boardSize))); const cellSize=Math.round(baseCellSize*zoom); const clueSize=Math.max(14, Math.round(Math.max(18, Math.min(24, baseCellSize))*zoom));
  const timerText=formatGameTime(state.timer);
  const gameTitle=gameStageTitle(G);
  const backTarget=G.returnTo==='editor'?'editor':'select';
  const backLabel=G.returnTo==='editor'?GAME_UI.backEditor:GAME_UI.backSelect;
  const showPalette=G.colorMode==='color';
  const gameColors=showPalette?usedPaletteColors(solution):MC_COLORS;
  const gameLocked=state.gameStatus==='cleared'||state.gameStatus==='timeout'||state.gameStatus==='giveup';
  if(typeof state.gamePanelCollapsed !== 'boolean') state.gamePanelCollapsed=readStoredBoolean(GAME_PANEL_COLLAPSED_KEY, false);
  const showMinimap=String(G.mode||'').toLowerCase()==='endless'||String(G.difficulty||'').toLowerCase()==='endless';
  if(typeof state.minimapVisible !== 'boolean') state.minimapVisible=readStoredBoolean(GAME_MINIMAP_VISIBLE_KEY, true);
  state.minimapZoom=normalizeMinimapZoom(state.minimapZoom ?? readStoredNumber(GAME_MINIMAP_ZOOM_KEY, 1.5));
  state.minimapPosition=normalizeMinimapPosition(state.minimapPosition ?? readStoredText(GAME_MINIMAP_POSITION_KEY, 'top-right'));
  const panelCollapsed=state.gamePanelCollapsed;
  const largeBoard=boardSize>=20;
  const minimapSize=Math.round(96*state.minimapZoom);
  const minimapZoomOptions=GAME_MINIMAP_ZOOMS.map(value=>`<option value="${value}" ${value===state.minimapZoom?'selected':''}>${value}倍</option>`).join('');
  const minimapPositionOptions=GAME_MINIMAP_POSITIONS.map(pos=>`<option value="${pos.key}" ${pos.key===state.minimapPosition?'selected':''}>${pos.label}</option>`).join('');
  const minimapHtml=showMinimap ? `<div class="game-minimap-panel is-fixed pos-${state.minimapPosition} ${state.minimapVisible?'':'is-hidden'}">
          <div class="game-minimap-head">
            <div class="palette-title">${GAME_UI.minimapTitle}</div>
            <button class="btn btn-slim game-minimap-toggle" id="toggleMinimap">${state.minimapVisible?GAME_UI.minimapHide:GAME_UI.minimapShow}</button>
          </div>
          ${state.minimapVisible?`<div class="game-minimap-controls"><label>${GAME_UI.minimapZoom}<select id="minimapZoom" class="minimap-select">${minimapZoomOptions}</select></label><label>${GAME_UI.minimapPosition}<select id="minimapPosition" class="minimap-select">${minimapPositionOptions}</select></label></div><canvas id="gameMinimap" class="game-minimap-canvas" width="${minimapSize}" height="${minimapSize}" aria-label="${GAME_UI.minimapTitle}"></canvas>`:''}
        </div>` : '';
  const paletteHtml=showPalette ? `<div class="game-palette-panel">
          <div class="palette-title">パレット</div>
          <div class="game-palette">${gameColors.map(c=>`<button class="palette-btn ${state.selectedColor===c.id?'is-active':''}" data-color="${c.id}" title="${c.id} ${escapeHtml(c.label)}" aria-label="${c.id} ${escapeHtml(c.label)}" style="background:${c.hex}; color:${textColorFor(c.id)}"></button>`).join('')}</div>
        </div>` : '';
  root.innerHTML = `<div class="screen game-screen has-bg" style="--crosshair-color:${escapeHtml(state.options?.crosshairColor||'#42a5f5')}">${renderBackgroundLayer('game')}
    <div class="game-layout ${panelCollapsed?'is-panel-collapsed':''} ${largeBoard?'is-large-board':''} ${showMinimap?'is-endless-board':''}">
      <aside class="game-panel">
        <button class="btn btn-slim game-panel-toggle" id="toggleGamePanel" aria-expanded="${!panelCollapsed}">${panelCollapsed?GAME_UI.panelShow:GAME_UI.panelHide}</button>
        <div class="game-panel-content">
          ${paletteHtml}
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
        </div>
      </aside>
      <div class="game-main">
        <div class="game-title">${escapeHtml(gameTitle)}</div>
        <div class="zoom-controls">
          <button class="btn btn-slim" id="zoomOut">${GAME_UI.zoomOut}</button>
          <div class="zoom-label">${Math.round(zoom*100)}%</div>
          <button class="btn btn-slim" id="zoomIn">${GAME_UI.zoomIn}</button>
        </div>
        ${minimapHtml}
        <div id="gamewrap" class="game-board" style="--cell-size:${cellSize}px; --clue-size:${clueSize}px; display:grid; gap:0;
          grid-template-columns: repeat(${maxRowLen}, var(--clue-size)) repeat(${w}, var(--cell-size));
          grid-template-rows: repeat(${maxColLen}, var(--clue-size)) repeat(${h}, var(--cell-size));"></div>
        <p class="game-help">${GAME_UI.inputHelp}</p>
      </div>
    </div></div>`;
  const wrap=root.querySelector('#gamewrap');
  const boardScrollToRestore=state.boardScroll;
  let minimapFramePending=false;
  const scheduleMinimapDraw=()=>{ if(minimapFramePending) return; minimapFramePending=true; requestAnimationFrame(()=>{ minimapFramePending=false; updateGameMinimap(state); }); };
  wrap.addEventListener('scroll',()=>{ state.boardScroll={left:wrap.scrollLeft, top:wrap.scrollTop}; scheduleMinimapDraw(); }, {passive:true});
  root.querySelector('.game-screen').addEventListener('contextmenu', e=>e.preventDefault());
  const solvedState=()=>({w,h,solution,filled:state.filled,cellColors:state.cellColors,colorMode:G.colorMode});
  const checkClear=changed=>{ if(changed&&isSolved(solvedState())) actions.finishClear(); };
  for(let y=0;y<maxColLen;y++) for(let x=0;x<maxRowLen;x++){
    const corner=document.createElement('div'); corner.className='clue-cell clue-corner'+(x===maxRowLen-1?' clue-boundary-right':'')+(y===maxColLen-1?' clue-boundary-bottom':'');
    corner.style.gridColumn=`${x + 1}`; corner.style.gridRow=`${y + 1}`;
    corner.style.left=`${x*clueSize}px`; corner.style.top=`${y*clueSize}px`;
    wrap.appendChild(corner);
  }
  for(let x=0;x<w;x++){
    const seq=cols[x];
    for(let i=0;i<maxColLen;i++){
      const d=document.createElement('div'); d.className='clue-cell clue-cell-col'+(i===maxColLen-1?' clue-boundary-bottom':'');
      const num=seq[seq.length-maxColLen+i]; applyClue(d,num,G.colorMode);
      d.style.gridColumn=`${maxRowLen + x + 1}`; d.style.gridRow=`${i + 1}`;
      d.style.top=`${i*clueSize}px`;
      wrap.appendChild(d);
    }
  }
  for(let y=0;y<h;y++){
    for(let i=0;i<maxRowLen;i++){ const d=document.createElement('div'); d.className='clue-cell clue-cell-row'+(i===maxRowLen-1?' clue-boundary-right':'');
      const seq=rows[y]; const num=seq[seq.length-maxRowLen+i]; applyClue(d,num,G.colorMode);
      d.style.gridColumn=`${i + 1}`; d.style.gridRow=`${maxColLen + y + 1}`;
      d.style.left=`${i*clueSize}px`;
      wrap.appendChild(d); }
    for(let x=0;x<w;x++){ const k=`${x},${y}`; const isHover=state.hoverCell?.row===y&&state.hoverCell?.col===x; const isHoverRow=state.hoverCell?.row===y; const isHoverCol=state.hoverCell?.col===x; const b=document.createElement('button'); b.dataset.k=k; b.dataset.row=String(y); b.dataset.col=String(x); b.className='cell'+(state.filled.has(k)?' filled':'')+(state.crossed.has(k)?' cross':'')+(x>0&&x%5===0?' guide-left':'')+(y>0&&y%5===0?' guide-top':'')+(isHover?' is-hover':'')+(!isHover&&(isHoverRow||isHoverCol)?' is-crosshair':'');
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
  restoreBoardScroll(wrap, boardScrollToRestore);
  updateGameMinimap(state);
  const moveOverCell=e=>{ const cell=e.target.closest?.('.cell'); if(cell) checkClear(actions.applyDrag(cell.dataset.k)); };
  wrap.addEventListener('pointermove',moveOverCell);
  wrap.addEventListener('mousemove',moveOverCell);
  wrap.addEventListener('pointerleave',()=>{ actions.cancelDrag(); actions.clearHoverCell(); });
  wrap.addEventListener('mouseleave',()=>{ actions.cancelDrag(); actions.clearHoverCell(); });
  window.addEventListener('pointerup',()=>actions.cancelDrag(),{once:true});
  window.addEventListener('mouseup',()=>actions.cancelDrag(),{once:true});
  root.querySelector('#toggleGamePanel').onclick=()=>{ state.gamePanelCollapsed=!state.gamePanelCollapsed; writeStoredValue(GAME_PANEL_COLLAPSED_KEY, state.gamePanelCollapsed?'1':'0'); render(state, actions); };
  root.querySelector('#toggleMinimap')?.addEventListener('click',()=>{ state.minimapVisible=!state.minimapVisible; writeStoredValue(GAME_MINIMAP_VISIBLE_KEY, state.minimapVisible?'1':'0'); render(state, actions); });
  root.querySelector('#minimapZoom')?.addEventListener('change',e=>{ state.minimapZoom=normalizeMinimapZoom(e.target.value); writeStoredValue(GAME_MINIMAP_ZOOM_KEY, String(state.minimapZoom)); render(state, actions); });
  root.querySelector('#minimapPosition')?.addEventListener('change',e=>{ state.minimapPosition=normalizeMinimapPosition(e.target.value); writeStoredValue(GAME_MINIMAP_POSITION_KEY, state.minimapPosition); render(state, actions); });
  root.querySelector('#gameMinimap')?.addEventListener('click',e=>moveBoardByMinimapClick(e, state));
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
function countText(value){
  const n=Number(value);
  return Number.isFinite(n) ? String(Math.max(0, Math.floor(n))) : '0';
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
function readStoredBoolean(key, fallback){
  try{ const value=localStorage.getItem(key); return value===null?fallback:value==='1'; }catch{ return fallback; }
}
function writeStoredValue(key, value){
  try{ localStorage.setItem(key, value); }catch{}
}
function readStoredNumber(key, fallback){
  try{ const value=Number(localStorage.getItem(key)); return Number.isFinite(value)&&value>0?value:fallback; }catch{ return fallback; }
}
function readStoredText(key, fallback){
  try{ const value=localStorage.getItem(key); return value===null?fallback:value; }catch{ return fallback; }
}
function normalizeMinimapZoom(value){
  const numeric=Number(value)||1.5;
  return GAME_MINIMAP_ZOOMS.reduce((best,level)=>Math.abs(level-numeric)<Math.abs(best-numeric)?level:best, 1.5);
}
function normalizeMinimapPosition(value){
  const key=String(value||'top-right').trim();
  return GAME_MINIMAP_POSITIONS.some(pos=>pos.key===key) ? key : 'top-right';
}
function captureBoardScroll(root, fallback={left:0, top:0}){
  const wrap=root?.querySelector?.('#gamewrap');
  if(!wrap) return fallback||{left:0, top:0};
  return {left:wrap.scrollLeft||0, top:wrap.scrollTop||0};
}
function restoreBoardScroll(wrap, scroll){
  if(!wrap||!scroll) return;
  const left=Math.max(0, Number(scroll.left)||0);
  const top=Math.max(0, Number(scroll.top)||0);
  requestAnimationFrame(()=>{ wrap.scrollLeft=left; wrap.scrollTop=top; });
}
export function updateGameMinimap(state){
  const root=state.root;
  const canvas=root?.querySelector?.('#gameMinimap');
  const wrap=root?.querySelector?.('#gamewrap');
  const G=state.game;
  if(!canvas||!wrap||!G) return false;
  const ctx=canvas.getContext?.('2d');
  if(!ctx) return false;
  const w=Math.max(1, Number(G.w)||1);
  const h=Math.max(1, Number(G.h)||1);
  const size=Math.min(canvas.width, canvas.height);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0a0a0a';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const cell=Math.max(1, Math.floor((size-12)/Math.max(w,h)));
  const drawW=w*cell;
  const drawH=h*cell;
  const offsetX=Math.floor((canvas.width-drawW)/2);
  const offsetY=Math.floor((canvas.height-drawH)/2);
  ctx.fillStyle='#222';
  ctx.fillRect(offsetX-1, offsetY-1, drawW+2, drawH+2);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const key=`${x},${y}`;
      if(state.filled?.has(key)){
        const color=G.colorMode==='color' ? (MC_COLOR_MAP[normalizeColorId(state.cellColors?.get(key))]?.hex||'#e0e0e0') : '#e0e0e0';
        ctx.fillStyle=color;
      }else if(state.crossed?.has(key)){
        ctx.fillStyle='#343434';
      }else{
        ctx.fillStyle='#080808';
      }
      ctx.fillRect(offsetX+x*cell, offsetY+y*cell, cell, cell);
    }
  }
  drawMinimapViewport(ctx, canvas, wrap, offsetX, offsetY, drawW, drawH);
  return true;
}
function drawMinimapViewport(ctx, canvas, wrap, offsetX, offsetY, drawW, drawH){
  const maxLeft=Math.max(1, wrap.scrollWidth-wrap.clientWidth);
  const maxTop=Math.max(1, wrap.scrollHeight-wrap.clientHeight);
  const x=offsetX+(wrap.scrollLeft/maxLeft)*Math.max(0, drawW);
  const y=offsetY+(wrap.scrollTop/maxTop)*Math.max(0, drawH);
  const width=Math.max(6, (wrap.clientWidth/Math.max(wrap.scrollWidth, 1))*drawW);
  const height=Math.max(6, (wrap.clientHeight/Math.max(wrap.scrollHeight, 1))*drawH);
  ctx.strokeStyle='#42a5f5';
  ctx.lineWidth=Math.max(2, Math.round(canvas.width/120));
  ctx.strokeRect(Math.min(offsetX+drawW-width, x), Math.min(offsetY+drawH-height, y), Math.min(drawW, width), Math.min(drawH, height));
}
function moveBoardByMinimapClick(e, state){
  const canvas=e.currentTarget;
  const wrap=state.root?.querySelector?.('#gamewrap');
  const G=state.game;
  if(!canvas||!wrap||!G) return;
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(canvas.width/Math.max(rect.width, 1));
  const y=(e.clientY-rect.top)*(canvas.height/Math.max(rect.height, 1));
  const w=Math.max(1, Number(G.w)||1);
  const h=Math.max(1, Number(G.h)||1);
  const size=Math.min(canvas.width, canvas.height);
  const cell=Math.max(1, Math.floor((size-12)/Math.max(w,h)));
  const drawW=w*cell;
  const drawH=h*cell;
  const offsetX=Math.floor((canvas.width-drawW)/2);
  const offsetY=Math.floor((canvas.height-drawH)/2);
  const ratioX=Math.max(0, Math.min(1, (x-offsetX)/Math.max(drawW, 1)));
  const ratioY=Math.max(0, Math.min(1, (y-offsetY)/Math.max(drawH, 1)));
  wrap.scrollLeft=ratioX*Math.max(0, wrap.scrollWidth-wrap.clientWidth);
  wrap.scrollTop=ratioY*Math.max(0, wrap.scrollHeight-wrap.clientHeight);
  state.boardScroll={left:wrap.scrollLeft, top:wrap.scrollTop};
  updateGameMinimap(state);
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
