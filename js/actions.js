import { render, updateGameMinimap } from './render.js';
import { loadPuzzles, findPuzzle } from './data.js';
import { ADMIN_DEBUG_CONFIG, ADMIN_NEWS_PAGE_SIZE, AUTH_LIMITS, BOARD_ZOOM_LEVELS, HINT_LIMITS_BY_DIFFICULTY, MC_COLORS, MC_COLOR_MAP, MODE_TO_DIFFICULTY, NEWS_IMAGE_STORAGE, isFilledValue, normalizeColorId, normalizeColorMode, validateEmail, validatePassword, validateUsername } from './config.js';
import { authenticateLocalUser, downloadCurrentUserJson, downloadUserDataJson, ensureUserProgress, exportCurrentUserPayload, loadSolvedForUser, mergeServerUserProgress, persistSolvedForUser, recordGameResultForUser, registerLocalUser, resetProgressForUser, userIdFor } from './userData.js';
import { beginSupabasePasswordRecovery, isSupabaseAuthAvailable, loadAccountDeleteRequest, loginSupabaseUserByUsername, logoutSupabaseUser, registerSupabaseUser, requestSupabasePasswordReset, resendSupabaseConfirmationEmail, submitAccountDeleteRequest, updateSupabaseEmail, updateSupabasePassword } from './supabaseAuth.js';
import { loadSupabaseRanking, saveSupabaseGameResult } from './supabaseProgress.js';
import { checkAdminServerApi, deleteAdminNewsImageByPath, deleteAdminNewsPost, deleteAdminRanking, deleteAdminRankingsForUser, isAdminUser, loadAdminSnapshot, loadPublishedNewsPosts, newsImagePathFromUrl, reactivateAdminUser, repairAdminAuthEmail, requestAdminPasswordClearReset, saveAdminNewsPost, updateAccountDeleteRequest, updateAdminProfile, updateAdminProgress, updateAdminRanking, uploadAdminNewsImage, uploadAdminPuzzles } from './admin.js';
import { supabaseNotConfiguredMessage } from './supabaseClient.js';
const ACTION_TEXT = { noHint:'ヒントにできる行・列がありません', noHintLeft:'ヒントを使い切りました。', hintTitle:'ヒントを使いますか？', hintMessage:'未完成の行または列を1つ選び、正解セルと×を表示します。', hintRow:index=>`${index + 1}行目の正解セルと×を表示しました。`, hintCol:index=>`${index + 1}列目の正解セルと×を表示しました。`, giveUpTitle:'ギブアップしますか？', giveUpMessage:'記録はクリアされます。よろしいですか？', exitTitle:'確認', exitMessage:'記録はクリアされます。よろしいですか？', retryTitle:'やりなおし', retryMessage:'この面を最初からやりなおしますか？', puzzleMissing:'このパズルのデータがありません', clearTitle:'クリア！', clearMessage:'正解です！\nパズルを完成しました。', solvedTitle:'判定', solvedMessage:'正解です！', checkIncompleteMessage:'まだ完成していません', checkProgressLowMessage:'もう少し塗ってみましょう', checkProgressMiddleMessage:'まだ見直しが必要です', checkProgressGoodMessage:'いい感じに進んでいます', checkProgressAlmostMessage:'あと少しです', checkMistakeMessage:'塗ったマスを少し見直してみましょう', pendingTitle:'準備中', resetClearTitle:'クリア状況リセット', resetClearMessage:'現在保存されているクリア状態を削除します。パズルデータとエディタ一時保存は削除されません。', resetUserTitle:'ユーザーデータ削除', resetUserMessage:'ゲーム進行データを削除します。ログイン情報、固定ユーザー、エディタ一時保存、パズルJSONは削除されません。', resetDone:'削除しました', cancel:'キャンセル', ok:'OK', delete:'削除', use:'使う', giveUp:'ギブアップ', select:'セレクトへ戻る', retry:'リトライ', restart:'やりなおし' };
const NEWS_TEXT = { loadFailed:'お知らせを読み込めませんでした', saved:'お知らせ記事を保存しました', draftSaved:'下書き保存しました', published:'公開しました', deleted:'お知らせ記事を削除しました', deleteTitle:'お知らせ記事を削除', deleteConfirm:'この記事を削除します。よろしいですか？', noImageFile:'画像ファイルを選択してください', imageUploaded:'画像をアップロードしました。保存すると記事に反映されます。', imageUploadFailed:'画像アップロードに失敗しました', imageCleared:'画像URLを解除しました。保存すると記事から画像が外れます。', imageDeleteTitle:'Storage画像を削除', imageDeleteConfirm:'Storage上の画像ファイルを削除します。他の記事で同じ画像を使っている場合も表示できなくなります。よろしいですか？', imageDeleted:'Storage画像を削除しました。記事保存で画像なしにできます。', imagePathMissing:'Storage画像パスを取得できません', imageTypeError:'PNG / JPG / WebP 画像を選択してください。SVGはアップロードできません。', imageSizeError:`画像サイズは${Math.floor(NEWS_IMAGE_STORAGE.maxBytes/1024/1024)}MB以内にしてください`, copyImageMissing:'コピーする画像URLがありません', copyImageDone:'画像URLをコピーしました', copyImageFailed:'画像URLをコピーできませんでした。URL欄から手動でコピーしてください。' };
const AUTH_TEXT = { required:'ユーザー名またはメールアドレスとパスワードを入力してください', registerRequired:'ユーザー名、パスワード、メールアドレスを入力してください', emailRequired:'メールアドレスを入力してください', loginFailed:'ユーザー名、メールアドレス、またはパスワードが違います', registerOffline:'サーバ未接続のため登録できません', registered:'登録しました。', duplicate:'同じユーザー名は登録できません', passwordMismatch:'新しいパスワードが一致しません', passwordShort:`パスワードは${AUTH_LIMITS.passwordMin}文字以上で入力してください`, passwordChanged:'パスワードを変更しました', supabaseOnly:'この操作はSupabaseログイン時のみ利用できます', deleteTitle:'アカウント削除申請', deleteMessage:'この画面ではアカウントを直接削除しません。\n削除申請として受け付け、管理者確認後に対応します。\n\nアカウント削除はAuthユーザー、プロフィール、進行データ、ランキング記録に影響します。安全のため、この画面では直接削除しません。', deleteRequestConfirm:'削除申請する', deleteRequested:'アカウント削除申請を受け付けました。\n管理者確認後に対応します。', deleteDuplicate:'すでにアカウント削除申請済みです。\n管理者確認後に対応します。', deleteFailed:'アカウント削除申請の保存に失敗しました。\n時間をおいて再度お試しください。' };
const REGISTER_TEXT = { title:'ユーザー登録', message:'登録しました。\n登録したユーザでログインしますか？', yes:'はい', no:'いいえ' };
const DEV_USER = { username:'admin', password:'admin' };
const DISABLED_ACCOUNT_TEXT = { title:'アカウント利用停止', message:'このアカウントは停止されています。\n管理者にお問い合わせください。' };
const ADMIN_ACCESS_TEXT = { editorTitle:'エディタ', editorDenied:'エディタは管理者専用です。' };
const EMAIL_VERIFICATION_TEXT = { registered:'確認メールを送信しました。\nメール内のリンクを開いて登録を完了してください。', required:'メールアドレスの確認が完了していません。\n確認メールを開いて登録を完了してください。', resent:'確認メールを再送しました。\nメールをご確認ください。', resendFailed:'確認メールの再送に失敗しました。\n時間をおいて再度お試しください。', unavailable:'Supabase未設定のため確認メールを送信できません。' };
const PASSWORD_RESET_TEXT = { title:'パスワード再設定', success:'入力されたメールアドレスに一致するアカウントがある場合、再設定メールを送信します。', failed:'パスワード再設定メールの送信に失敗しました。\n時間をおいて再度お試しください。', unavailable:supabaseNotConfiguredMessage(), invalid:'パスワード再設定リンクが無効、または期限切れです。\n再度メールを送信してください。', updated:'パスワードを更新しました。\n新しいパスワードでログインしてください。' };
const EMAIL_CHANGE_TEXT = { title:'メールアドレス変更', required:'新しいメールアドレスを入力してください', invalid:'メールアドレスの形式を確認してください', mismatch:'新しいメールアドレスと確認欄が一致しません', same:'現在のメールアドレスと同じです', sending:'メールアドレス変更申請を送信しています...', sent:'メールアドレス変更確認メールを送信しました。\n現在のメールアドレスと新しいメールアドレスに届く確認メールを確認してください。\n確認完了後、新しいメールアドレスでログインできるようになります。', unavailable:supabaseNotConfiguredMessage() };
const ADMIN_EMAIL_REPAIR_TEXT = { title:'管理者メール修復', denied:'管理者権限がありません。', required:'修復後メールアドレスを入力してください。', invalid:'メールアドレスの形式を確認してください。', same:'現在のメールアドレスと同じです。', completed:'メールアドレスを修復しました。ユーザー情報を再読み込みしてください。', confirm:(user,email)=>`対象ユーザー:\nユーザー名: ${user?.username||'-'}\nユーザーID: ${user?.id||'-'}\n現在のメールアドレス: ${user?.email||'-'}\n修復後メールアドレス: ${email}\n\nこの操作はSupabase Auth email と profiles.email を同時に更新します。\n実行してよろしいですか？` };
const ADMIN_PUZZLE_UPLOAD_TEXT = { title:'パズルJSONアップロード', noFile:'JSONファイルを選択してください。', checked:'検証OKです。反映実行前に内容を確認してください。', uploaded:'パズルJSONをSupabaseへ反映しました。', confirm:'選択した難易度のパズルデータをSupabaseへ反映します。\nアップロードJSONに含まれない既存パズルは非公開になります。\n実行してよろしいですか？' };
const ADMIN_PASSWORD_CLEAR_TEXT = { title:'パスワード再設定メール送信', denied:'この操作は管理者専用です。', missingEmail:'このユーザーにはメールアドレスが登録されていないため、パスワード再設定メールを送信できません。先にメールアドレスを登録してください。', confirm:(user,isSelf)=>`${isSelf?'注意: 現在ログイン中の管理者自身が対象です。\n\n':''}対象ユーザーへパスワード再設定メールを送信します。\nユーザーはメール内リンクから新しいパスワードを設定します。\nログイン後の追加パスワード変更画面は表示しません。\n\nユーザー名: ${user.username||'-'}\n表示名: ${user.display_name||'-'}\nメールアドレス: ${user.email||'-'}\nユーザーID: ${user.id||'-'}\nアカウント状態: ${user.account_status||'active'}\n\n実行しますか？`, completed:'パスワード再設定メールを送信しました。\n対象ユーザーはメール内リンクから新しいパスワードを設定してください。' };
const ADMIN_RANKING_DELETE_TEXT = { title:'ユーザー別ランキング削除', confirm:(user,count)=>`このユーザーのランキング記録を削除します。\nこの操作は元に戻せません。\n\nユーザー名: ${user.username||'-'}\n表示名: ${user.display_name||'-'}\nユーザーID: ${user.id||'-'}\n削除対象件数: ${count}件\n\n実行しますか？`, completed:'対象ユーザーのランキング記録を削除しました。' };
const TIMER_LIMITS = { Beginner:600, Easy:600, Normal:1800, Hard:1800, Endless:null, Custom:null };
const TIMER_TEXT = { unlimited:'無制限', timeoutTitle:'時間切れ', timeoutMessage:'制限時間が終了しました。' };
const REMEMBER_LOGIN_KEY = 'picross_remember_login';
const SAVED_USERNAME_KEY = 'picross_saved_username';
const SAVED_EMAIL_KEY = 'picross_saved_email';
const SAVED_PASSWORD_KEY = 'picross_saved_password';
const OPTIONS_KEY = 'web_picross_options';
const DEFAULT_OPTIONS = { crosshairColor:'#42a5f5', bgmVolume:50, seVolume:50, displayMode:'window' };
const LS_KEY='picross_v2_solved'; let stateRef; let actionsAPI;
export function initActions(state){ stateRef=state; loadRememberedLogin(); loadOptions(); loadSolved(); actionsAPI={ initializeAuthFlow, goto, login, registerUser, requestPasswordReset, resendConfirmationEmail, completePasswordRecovery, cancelPasswordRecovery, requestAdminPasswordClear, requestAdminEmailRepair, checkAdminPuzzleUpload, executeAdminPuzzleUpload, requestDeleteAdminUserRankings, updateLoginForm, logout, exportUserDataJson, exportCurrentUserJson, reloadUserData, changePassword, requestEmailChange, requestAccountDeletion, loadAccountDeleteRequestStatus, loadAdminData, setAdminFilter, selectAdminUser, selectAdminRanking, selectAdminDeleteRequest, selectAdminNews, previewAdminNewsImage, uploadSelectedAdminNewsImage, clearAdminNewsImage, deleteAdminNewsImage, saveAdminNews, saveAdminNewsDraft, publishAdminNewsNow, copyAdminNewsImageUrl, deleteAdminNews, saveAdminDeleteRequestReview, reactivateAdminAccount, saveAdminProfile, saveAdminProgress, saveAdminRanking, deleteAdminRankingRecord, setMode, setPage, setRankingMode, loadRanking, selectNews, setOption, resetOptions, setSelectedColor, setHoverCell, clearHoverCell, toggleCell, toggleCross, beginDrag, applyDrag, endDrag, cancelDrag, clear, hint, giveUp, requestGameExit, zoomBoard, debugInstantClear, stopTimer, finishClear, showCheckResult, toggleSolved, resetClearFlags, resetUserData, play, playCustom, openModal, closeModal, notify, confirmModal, handleModalButton }; return actionsAPI; }
function initializeAuthFlow(){
  const params = new URLSearchParams((globalThis.location?.hash || '').replace(/^#/, ''));
  if(params.get('type')!=='recovery'){
    goto('title');
    return;
  }
  completeRecoveryInitialization();
}
async function completeRecoveryInitialization(){
  try{
    const recovery = await beginSupabasePasswordRecovery();
    if(!recovery.detected || !recovery.valid){
      showRecoveryLoginMessage(PASSWORD_RESET_TEXT.invalid);
      return;
    }
    stateRef.currentUser=null;
    stateRef.modal=null;
    stateRef.passwordRecovery={active:true, forced:false, password:'', confirmPassword:'', error:''};
    stateRef.screen='passwordRecovery';
    render(stateRef, actionsAPI);
  }catch{
    showRecoveryLoginMessage(PASSWORD_RESET_TEXT.invalid);
  }
}
function showRecoveryLoginMessage(message){
  stateRef.currentUser=null;
  stateRef.modal=null;
  stateRef.passwordRecovery={active:false, forced:false, password:'', confirmPassword:'', error:''};
  stateRef.screen='login';
  stateRef.authMessage=message;
  render(stateRef, actionsAPI);
}
function goto(screen){ if(screen!=='game') stopTimer(); stateRef.modal=null; stateRef.hoverCell=null; if(accountDisabled()&&!['title','login'].includes(screen)){ endDisabledSession(); return; } stateRef.authMessage=''; if(screen==='admin'&&!isAdminUser(stateRef.currentUser)){ stateRef.screen=stateRef.currentUser?'menu':'title'; render(stateRef, actionsAPI); notify('管理者ページ', '管理者権限がありません'); return; } if(screen==='editor'&&!isAdminUser(stateRef.currentUser)){ stateRef.screen=stateRef.currentUser?'menu':'title'; render(stateRef, actionsAPI); notify(ADMIN_ACCESS_TEXT.editorTitle, ADMIN_ACCESS_TEXT.editorDenied); return; } stateRef.screen=screen; render(stateRef, actionsAPI); if(screen==='ranking') loadRanking(); if(screen==='admin') loadAdminData(); if(screen==='userData') loadAccountDeleteRequestStatus(); if(screen==='news') loadNews(); }
async function apiPost(path,payload){
  const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let body={}; try{ body=await res.json(); }catch{}
  if(!res.ok||body.ok===false){ const err=new Error(body.message||AUTH_TEXT.loginFailed); err.status=res.status; throw err; }
  return body;
}
function updateLoginForm(patch){
  stateRef.loginForm={...(stateRef.loginForm||{}), ...(patch||{})};
  if(!Object.prototype.hasOwnProperty.call(patch||{}, 'remember')) stateRef.authMessage='';
  if(Object.prototype.hasOwnProperty.call(patch||{}, 'remember')) persistRememberPreference(stateRef.loginForm.remember);
  if(Object.prototype.hasOwnProperty.call(patch||{}, 'remember')) render(stateRef, actionsAPI);
}
function authValidationMessage(results){
  return results.flatMap(result=>result.errors||[]).filter(Boolean).join('\n');
}
async function login(username,password,remember=stateRef.loginForm?.remember,email=stateRef.loginForm?.email){
  username=String(username||'').trim(); email=String(email||'').trim(); password=String(password||'');
  stateRef.loginForm={username, email, password, remember:!!remember};
  if(!username||!password){ stateRef.authMessage=AUTH_TEXT.required; render(stateRef, actionsAPI); return false; }
  const validation = authValidationMessage([validateUsername(username)]);
  if(validation){ stateRef.authMessage=validation; render(stateRef, actionsAPI); return false; }
  const supabaseAvailable=await isSupabaseAuthAvailable();
  try{
    const supabase=supabaseAvailable&&!(username===DEV_USER.username&&password===DEV_USER.password)
      ? await loginSupabaseUserByUsername(username,password)
      : {available:false};
    if(supabase.available){
      if(supabase.emailUnconfirmed){
        stateRef.authMessage=EMAIL_VERIFICATION_TEXT.required;
        stateRef.loginForm={...stateRef.loginForm, password:''};
        render(stateRef, actionsAPI);
        return false;
      }
      if(accountDisabled(supabase.user)){
        await logoutSupabaseUser();
        endDisabledSession(false);
        return false;
      }
      stateRef.currentUser=supabase.user;
      prepareUserData('Supabase Auth', false);
      saveRememberedLogin(username, remember);
      stateRef.authMessage='';
      goto('menu');
      return true;
    }
  }catch(err){
    if(username!==DEV_USER.username||password!==DEV_USER.password){
      stateRef.authMessage=err.message||AUTH_TEXT.loginFailed;
      render(stateRef, actionsAPI);
      return false;
    }
  }
  try{
    const result=await apiPost('/api/login',{username,password});
    stateRef.currentUser={username:result.user?.username||username, id:result.user?.id||userIdFor(result.user?.username||username), source:'server'};
    mergeServerUserProgress(stateRef.currentUser, {progress:result.progress, stats:result.stats, history:result.history, user:result.user});
    prepareUserData('server users.json', true);
    saveRememberedLogin(username, remember);
    stateRef.authMessage='';
    goto('menu');
    return true;
  }catch(err){
    if(username===DEV_USER.username&&password===DEV_USER.password){
      stateRef.currentUser={username:DEV_USER.username, id:userIdFor(DEV_USER.username), source:'built-in'};
      prepareUserData('localStorage', false);
      saveRememberedLogin(username, remember);
      stateRef.authMessage='';
      goto('menu');
      return true;
    }
    const localUser=authenticateLocalUser(username,password);
    if(localUser){
      stateRef.currentUser=localUser;
      prepareUserData('localStorage', false);
      saveRememberedLogin(username, remember);
      stateRef.authMessage='';
      goto('menu');
      return true;
    }
    stateRef.authMessage=err.status ? (err.message||AUTH_TEXT.loginFailed) : AUTH_TEXT.loginFailed;
    render(stateRef, actionsAPI);
    return false;
  }
}
async function registerUser(username,password,email=stateRef.loginForm?.email){
  username=String(username||'').trim(); email=String(email||'').trim(); password=String(password||'');
  if(!username||!password){ stateRef.authMessage=AUTH_TEXT.registerRequired; render(stateRef, actionsAPI); return false; }
  const validation = authValidationMessage([validateUsername(username), validateEmail(email), validatePassword(password)]);
  if(validation){ stateRef.authMessage=validation; render(stateRef, actionsAPI); return false; }
  const supabaseAvailable=await isSupabaseAuthAvailable();
  if(supabaseAvailable&&!email){
    stateRef.authMessage=AUTH_TEXT.emailRequired;
    render(stateRef, actionsAPI);
    return false;
  }
  try{
    const supabase=supabaseAvailable&&email ? await registerSupabaseUser(username,email,password) : {available:false};
    if(supabase.available){
      if(supabase.confirmationRequired){
        stateRef.authMessage=EMAIL_VERIFICATION_TEXT.registered;
        stateRef.loginForm={username:'', email, password:'', remember:!!stateRef.loginForm?.remember};
        render(stateRef, actionsAPI);
        return true;
      }
      showRegisterLoginAssist(username,email,password);
      return true;
    }
  }catch(err){
    stateRef.authMessage=err.message||AUTH_TEXT.loginFailed;
    render(stateRef, actionsAPI);
    return false;
  }
  try{
    await apiPost('/api/register',{username,password});
    showRegisterLoginAssist(username,email,password);
    return true;
  }catch(err){
    if(err.status===409){
      stateRef.authMessage=AUTH_TEXT.duplicate;
      render(stateRef, actionsAPI);
      return false;
    }
    const local=registerLocalUser(username,password);
    if(local.ok) showRegisterLoginAssist(username,email,password);
    else { stateRef.authMessage=local.message==='duplicate' ? AUTH_TEXT.duplicate : AUTH_TEXT.required; render(stateRef, actionsAPI); }
    return local.ok;
  }
}
function logout(){ if(stateRef.currentUser?.source==='supabase') logoutSupabaseUser(); stateRef.currentUser=null; goto('title'); }
function exportUserDataJson(){ downloadUserDataJson(); return true; }
function exportCurrentUserJson(){ downloadCurrentUserJson(stateRef.currentUser); return true; }
async function changePassword(newPassword, confirmPassword){
  const password=String(newPassword||'');
  const confirm=String(confirmPassword||'');
  if(stateRef.currentUser?.source!=='supabase'){
    notify('アカウント管理', AUTH_TEXT.supabaseOnly);
    return false;
  }
  const validation = authValidationMessage([validatePassword(password)]);
  if(validation){
    notify('アカウント管理', validation);
    return false;
  }
  if(password!==confirm){
    notify('アカウント管理', AUTH_TEXT.passwordMismatch);
    return false;
  }
  try{
    const result=await updateSupabasePassword(password);
    notify('アカウント管理', result?.available ? AUTH_TEXT.passwordChanged : AUTH_TEXT.supabaseOnly);
    return !!result?.available;
  }catch(err){
    notify('アカウント管理', err.message||AUTH_TEXT.loginFailed);
    return false;
  }
}
async function requestEmailChange(newEmail, confirmEmail){
  const currentEmail=String(stateRef.currentUser?.email||'').trim().toLowerCase();
  const email=String(newEmail||'').trim().toLowerCase();
  const confirm=String(confirmEmail||'').trim().toLowerCase();
  stateRef.userDataStatus={...(stateRef.userDataStatus||{}), emailChangeNew:email, emailChangeConfirm:confirm};
  if(stateRef.currentUser?.source!=='supabase'){
    notify(EMAIL_CHANGE_TEXT.title, AUTH_TEXT.supabaseOnly);
    return false;
  }
  if(!email){
    setEmailChangeStatus(EMAIL_CHANGE_TEXT.required, true, false);
    return false;
  }
  const validation = authValidationMessage([validateEmail(email, { max:AUTH_LIMITS.emailChangeMax })]);
  if(validation){
    setEmailChangeStatus(validation.includes('形式') ? EMAIL_CHANGE_TEXT.invalid : validation, true, false);
    return false;
  }
  if(email!==confirm){
    setEmailChangeStatus(EMAIL_CHANGE_TEXT.mismatch, true, false);
    return false;
  }
  if(currentEmail&&email===currentEmail){
    setEmailChangeStatus(EMAIL_CHANGE_TEXT.same, true, false);
    return false;
  }
  setEmailChangeStatus(EMAIL_CHANGE_TEXT.sending, false, true);
  try{
    const result=await updateSupabaseEmail(email);
    setEmailChangeStatus(result?.available ? (result.message || EMAIL_CHANGE_TEXT.sent) : EMAIL_CHANGE_TEXT.unavailable, !result?.available, false);
    return !!result?.available;
  }catch(err){
    setEmailChangeStatus(err.message||AUTH_TEXT.loginFailed, true, false);
    return false;
  }
}
function setEmailChangeStatus(message, isError=false, loading=false){
  stateRef.userDataStatus={...(stateRef.userDataStatus||{}), emailChangeResult:message, emailChangeError:!!isError, emailChangeLoading:!!loading};
  render(stateRef, actionsAPI);
}
async function requestPasswordReset(email){
  const validation = authValidationMessage([validateEmail(email)]);
  if(validation){
    stateRef.authMessage=validation;
    render(stateRef, actionsAPI);
    return false;
  }
  try{
    const result=await requestSupabasePasswordReset(email);
    notify(PASSWORD_RESET_TEXT.title, result?.available ? PASSWORD_RESET_TEXT.success : PASSWORD_RESET_TEXT.unavailable);
    return !!result?.available;
  }catch(err){
    notify(PASSWORD_RESET_TEXT.title, err.message||PASSWORD_RESET_TEXT.failed);
    return false;
  }
}
async function resendConfirmationEmail(email){
  const validation = authValidationMessage([validateEmail(email)]);
  if(validation){
    stateRef.authMessage=validation;
    render(stateRef, actionsAPI);
    return false;
  }
  try{
    const result=await resendSupabaseConfirmationEmail(email);
    notify('メールアドレス確認', result?.available ? EMAIL_VERIFICATION_TEXT.resent : EMAIL_VERIFICATION_TEXT.unavailable);
    return !!result?.available;
  }catch(err){
    notify('メールアドレス確認', err.message||EMAIL_VERIFICATION_TEXT.resendFailed);
    return false;
  }
}
async function completePasswordRecovery(newPassword, confirmPassword){
  const password=String(newPassword||'');
  const confirm=String(confirmPassword||'');
  const error=authValidationMessage([validatePassword(password)]) || (password!==confirm ? AUTH_TEXT.passwordMismatch : '');
  stateRef.passwordRecovery={active:true, forced:false, password, confirmPassword:confirm, error};
  if(error){
    render(stateRef, actionsAPI);
    return false;
  }
  try{
    const result=await updateSupabasePassword(password);
    if(!result?.available){
      stateRef.passwordRecovery={...stateRef.passwordRecovery, error:PASSWORD_RESET_TEXT.invalid};
      render(stateRef, actionsAPI);
      return false;
    }
    await logoutSupabaseUser();
    stateRef.currentUser=null;
    stateRef.loginForm={...(stateRef.loginForm||{}), password:''};
    showRecoveryLoginMessage(PASSWORD_RESET_TEXT.updated);
    return true;
  }catch{
    stateRef.passwordRecovery={...stateRef.passwordRecovery, error:PASSWORD_RESET_TEXT.invalid};
    render(stateRef, actionsAPI);
    return false;
  }
}
async function cancelPasswordRecovery(){
  await logoutSupabaseUser();
  stateRef.currentUser=null;
  showRecoveryLoginMessage('');
}
function requestAccountDeletion(){
  if(stateRef.currentUser?.source!=='supabase'){
    notify(AUTH_TEXT.deleteTitle, AUTH_TEXT.supabaseOnly);
    return false;
  }
  confirmModal(AUTH_TEXT.deleteTitle, AUTH_TEXT.deleteMessage, submitAccountDeletion, AUTH_TEXT.deleteRequestConfirm);
  return true;
}
async function submitAccountDeletion(){
  try{
    const result=await submitAccountDeleteRequest(stateRef.currentUser);
    if(result?.request) stateRef.accountDeleteRequest={loading:false, data:result.request, error:''};
    render(stateRef, actionsAPI);
    notify(AUTH_TEXT.deleteTitle, result?.duplicate ? AUTH_TEXT.deleteDuplicate : AUTH_TEXT.deleteRequested);
  }catch(err){
    stateRef.accountDeleteRequest={...(stateRef.accountDeleteRequest||{}), loading:false, error:err.message||AUTH_TEXT.deleteFailed};
    render(stateRef, actionsAPI);
    notify(AUTH_TEXT.deleteTitle, err.message||AUTH_TEXT.deleteFailed);
  }
}
function accountDisabled(user=stateRef.currentUser){ return user?.source==='supabase' && user?.account_status === 'disabled'; }
function endDisabledSession(signOut=true){
  if(signOut) logoutSupabaseUser();
  stateRef.currentUser=null;
  stateRef.accountDeleteRequest={loading:false, data:null, error:''};
  stateRef.modal=null;
  stateRef.screen='login';
  stateRef.authMessage=DISABLED_ACCOUNT_TEXT.message;
  stateRef.loginForm={...(stateRef.loginForm||{}), password:''};
  render(stateRef, actionsAPI);
}
async function loadAccountDeleteRequestStatus(){
  if(stateRef.currentUser?.source!=='supabase'){
    stateRef.accountDeleteRequest={loading:false, data:null, error:''};
    return false;
  }
  stateRef.accountDeleteRequest={...(stateRef.accountDeleteRequest||{}), loading:true, error:''};
  render(stateRef, actionsAPI);
  try{
    const result=await loadAccountDeleteRequest(stateRef.currentUser);
    stateRef.accountDeleteRequest={loading:false, data:result?.request||null, error:''};
    render(stateRef, actionsAPI);
    return true;
  }catch(err){
    stateRef.accountDeleteRequest={...(stateRef.accountDeleteRequest||{}), loading:false, error:err.message||'アカウント削除申請の状態取得に失敗しました'};
    render(stateRef, actionsAPI);
    return false;
  }
}
async function loadAdminData(){
  if(!isAdminUser(stateRef.currentUser)){ notify('管理者ページ', '管理者権限がありません'); return false; }
  stateRef.admin={...(stateRef.admin||{}), loading:true, error:'', message:''};
  render(stateRef, actionsAPI);
  try{
    const [data, serverApi]=await Promise.all([loadAdminSnapshot(), checkAdminServerApi()]);
    stateRef.admin={...(stateRef.admin||{}), loading:false, error:'', data, serverApi, message:data.message||'管理データを読み込みました'};
    render(stateRef, actionsAPI);
    return true;
  }catch(err){
    stateRef.admin={...(stateRef.admin||{}), loading:false, error:err.message||'管理データの読み込みに失敗しました', message:'RLSまたは権限設定を確認してください'};
    render(stateRef, actionsAPI);
    return false;
  }
}
function setAdminFilter(key,value){ stateRef.admin={...(stateRef.admin||{}), [key]:value}; render(stateRef, actionsAPI); }
function selectAdminUser(id){ stateRef.admin={...(stateRef.admin||{}), selectedUserId:id}; render(stateRef, actionsAPI); }
function selectAdminRanking(id){ stateRef.admin={...(stateRef.admin||{}), selectedRankingId:id}; render(stateRef, actionsAPI); }
function selectAdminDeleteRequest(id){ stateRef.admin={...(stateRef.admin||{}), selectedDeleteRequestId:id}; render(stateRef, actionsAPI); }
function selectAdminNews(id){ stateRef.admin={...(stateRef.admin||{}), selectedNewsId:id, newsImageUpload:null, newsDraft:null}; render(stateRef, actionsAPI); }
function saveAdminProfile(id,patch){ confirmModal('ユーザー情報を保存', '表示名と権限を変更します。よろしいですか？', async()=>{ await runAdminMutation(()=>updateAdminProfile(id, patch), 'ユーザー情報を保存しました'); }); }
function saveAdminProgress(id,patch){ confirmModal('進行状況を保存', 'このユーザーの進行状況を変更します。よろしいですか？', async()=>{ await runAdminMutation(()=>updateAdminProgress(id, patch), '進行状況を保存しました'); }); }
function saveAdminRanking(id,patch){ confirmModal('ランキングを保存', 'ランキング記録を変更します。よろしいですか？', async()=>{ await runAdminMutation(()=>updateAdminRanking(id, patch), 'ランキング記録を保存しました'); }); }
function deleteAdminRankingRecord(id){ confirmModal('ランキング記録を削除', 'このランキング記録を削除します。よろしいですか？', async()=>{ await runAdminMutation(()=>deleteAdminRanking(id), 'ランキング記録を削除しました'); }, ACTION_TEXT.delete); }
function saveAdminNews(id, patch){
  const newsId=String(id||'').trim();
  confirmModal('お知らせ記事を保存', 'お知らせ記事を保存します。よろしいですか？', async()=>{
    try{
      const result=await saveAdminNewsPost(newsId, patch);
      if(result?.available===false){
        stateRef.admin={...(stateRef.admin||{}), message:supabaseNotConfiguredMessage(), error:''};
        render(stateRef, actionsAPI);
        return;
      }
      await refreshAdminNewsData({
        message:NEWS_TEXT.saved,
        selectedNewsId:result.id,
        newsPage:result.created ? 1 : stateRef.admin?.newsPage
      });
      stateRef.news={...(stateRef.news||{}), loaded:false};
    }catch(err){
      stateRef.admin={...(stateRef.admin||{}), message:'', error:`操作できませんでした: ${err.message||'RLSまたは権限設定を確認してください'}`};
      render(stateRef, actionsAPI);
    }
  });
}
function saveAdminNewsDraft(id, patch){
  saveAdminNewsWithPatch(id, {...(patch||{}), is_published:false}, NEWS_TEXT.draftSaved, '下書き保存', '下書きとして保存します。よろしいですか？');
}
function publishAdminNewsNow(id, patch){
  saveAdminNewsWithPatch(id, {...(patch||{}), is_published:true, published_at:datetimeLocalNow()}, NEWS_TEXT.published, '今すぐ公開', '現在日時で公開します。よろしいですか？');
}
function saveAdminNewsWithPatch(id, patch, successMessage, title, message){
  const newsId=String(id||'').trim();
  confirmModal(title, message, async()=>{
    try{
      const result=await saveAdminNewsPost(newsId, patch);
      if(result?.available===false){
        stateRef.admin={...(stateRef.admin||{}), message:supabaseNotConfiguredMessage(), error:''};
        render(stateRef, actionsAPI);
        return;
      }
      await refreshAdminNewsData({
        message:successMessage,
        selectedNewsId:result.id,
        newsPage:result.created ? 1 : stateRef.admin?.newsPage
      });
      stateRef.news={...(stateRef.news||{}), loaded:false};
    }catch(err){
      stateRef.admin={...(stateRef.admin||{}), message:'', error:`保存に失敗しました: ${err.message||'RLSまたは権限設定を確認してください'}`};
      render(stateRef, actionsAPI);
    }
  });
}
async function copyAdminNewsImageUrl(url){
  const value=String(url||'').trim();
  if(!value){
    stateRef.admin={...(stateRef.admin||{}), message:'', error:NEWS_TEXT.copyImageMissing};
    render(stateRef, actionsAPI);
    return false;
  }
  try{
    await navigator.clipboard.writeText(value);
    stateRef.admin={...(stateRef.admin||{}), message:NEWS_TEXT.copyImageDone, error:''};
    render(stateRef, actionsAPI);
    return true;
  }catch{
    stateRef.admin={...(stateRef.admin||{}), message:'', error:NEWS_TEXT.copyImageFailed};
    render(stateRef, actionsAPI);
    return false;
  }
}
function deleteAdminNews(id){
  const newsId=String(id||'').trim();
  if(!newsId) return false;
  confirmModal(NEWS_TEXT.deleteTitle, NEWS_TEXT.deleteConfirm, async()=>{
    try{
      const result=await deleteAdminNewsPost(newsId);
      if(result?.available===false){
        stateRef.admin={...(stateRef.admin||{}), message:supabaseNotConfiguredMessage(), error:''};
        render(stateRef, actionsAPI);
        return;
      }
      await refreshAdminNewsData({ message:NEWS_TEXT.deleted, selectedNewsId:'', newsPage:stateRef.admin?.newsPage });
      stateRef.news={...(stateRef.news||{}), loaded:false};
    }catch(err){
      stateRef.admin={...(stateRef.admin||{}), message:'', error:`操作できませんでした: ${err.message||'RLSまたは権限設定を確認してください'}`};
      render(stateRef, actionsAPI);
    }
  }, ACTION_TEXT.delete);
  return true;
}
function previewAdminNewsImage(file, draft=null){
  if(!file){
    stateRef.admin={...(stateRef.admin||{}), newsDraft:draft, newsImageUpload:{...(stateRef.admin?.newsImageUpload||{}), file:null, fileName:'', previewUrl:'', error:NEWS_TEXT.noImageFile}};
    render(stateRef, actionsAPI);
    return false;
  }
  const validation=validateAdminNewsImage(file);
  if(!validation.ok){
    stateRef.admin={...(stateRef.admin||{}), newsDraft:draft, newsImageUpload:{file:null, fileName:file.name||'', previewUrl:'', error:validation.message}};
    render(stateRef, actionsAPI);
    return false;
  }
  const current=stateRef.admin?.newsImageUpload||{};
  if(current.previewUrl?.startsWith?.('blob:')){
    try{ URL.revokeObjectURL(current.previewUrl); }catch{}
  }
  stateRef.admin={...(stateRef.admin||{}), newsDraft:draft, newsImageUpload:{file, fileName:file.name||'', previewUrl:URL.createObjectURL(file), publicUrl:'', path:'', error:''}};
  render(stateRef, actionsAPI);
  return true;
}
async function uploadSelectedAdminNewsImage(newsId, draft=null){
  const upload=stateRef.admin?.newsImageUpload||{};
  if(!upload.file){
    stateRef.admin={...(stateRef.admin||{}), newsDraft:draft, newsImageUpload:{...upload, error:NEWS_TEXT.noImageFile}};
    render(stateRef, actionsAPI);
    return false;
  }
  stateRef.admin={...(stateRef.admin||{}), newsDraft:draft, newsImageUpload:{...upload, loading:true, error:''}};
  render(stateRef, actionsAPI);
  try{
    const result=await uploadAdminNewsImage(upload.file, newsId);
    const publicUrl=result.publicUrl||'';
    stateRef.admin={...(stateRef.admin||{}), newsDraft:{...(draft||{}), image_url:publicUrl}, newsImageUpload:{...upload, loading:false, file:null, publicUrl, path:result.path||'', previewUrl:publicUrl||upload.previewUrl, error:''}, message:result?.available===false?supabaseNotConfiguredMessage():NEWS_TEXT.imageUploaded, error:''};
    render(stateRef, actionsAPI);
    return true;
  }catch(err){
    stateRef.admin={...(stateRef.admin||{}), newsDraft:draft, newsImageUpload:{...upload, loading:false, error:err.message||NEWS_TEXT.imageUploadFailed}, message:'', error:err.message||NEWS_TEXT.imageUploadFailed};
    render(stateRef, actionsAPI);
    return false;
  }
}
function clearAdminNewsImage(draft=null){
  const upload=stateRef.admin?.newsImageUpload||{};
  if(upload.previewUrl?.startsWith?.('blob:')){
    try{ URL.revokeObjectURL(upload.previewUrl); }catch{}
  }
  stateRef.admin={...(stateRef.admin||{}), newsDraft:{...(draft||{}), image_url:''}, newsImageUpload:{file:null, fileName:'', previewUrl:'', publicUrl:'', path:'', cleared:true, error:''}, message:NEWS_TEXT.imageCleared, error:''};
  render(stateRef, actionsAPI);
  return true;
}
function deleteAdminNewsImage(imageUrl, draft=null){
  const upload=stateRef.admin?.newsImageUpload||{};
  const path=upload.path || newsImagePathFromUrl(imageUrl);
  if(!path){
    stateRef.admin={...(stateRef.admin||{}), newsDraft:draft, newsImageUpload:{...upload, error:NEWS_TEXT.imagePathMissing}, message:'', error:NEWS_TEXT.imagePathMissing};
    render(stateRef, actionsAPI);
    return false;
  }
  confirmModal(NEWS_TEXT.imageDeleteTitle, NEWS_TEXT.imageDeleteConfirm, async()=>{
    await runAdminMutation(()=>deleteAdminNewsImageByPath(path), NEWS_TEXT.imageDeleted);
    stateRef.admin={...(stateRef.admin||{}), newsDraft:{...(draft||{}), image_url:''}, newsImageUpload:{file:null, fileName:'', previewUrl:'', publicUrl:'', path:'', cleared:true, error:''}};
    render(stateRef, actionsAPI);
  }, ACTION_TEXT.delete);
  return true;
}
function requestAdminEmailRepair(user, newEmail){
  if(!isAdminUser(stateRef.currentUser)){
    notify(ADMIN_EMAIL_REPAIR_TEXT.title, ADMIN_EMAIL_REPAIR_TEXT.denied);
    return false;
  }
  if(!user?.id){
    notify(ADMIN_EMAIL_REPAIR_TEXT.title, '対象ユーザーが見つかりません。');
    return false;
  }
  const email=String(newEmail||'').trim().toLowerCase();
  if(!email){
    notify(ADMIN_EMAIL_REPAIR_TEXT.title, ADMIN_EMAIL_REPAIR_TEXT.required);
    return false;
  }
  const validation=authValidationMessage([validateEmail(email, { max:AUTH_LIMITS.emailChangeMax })]);
  if(validation){
    notify(ADMIN_EMAIL_REPAIR_TEXT.title, validation.includes('形式') ? ADMIN_EMAIL_REPAIR_TEXT.invalid : validation);
    return false;
  }
  if(String(user.email||'').trim().toLowerCase()===email){
    notify(ADMIN_EMAIL_REPAIR_TEXT.title, ADMIN_EMAIL_REPAIR_TEXT.same);
    return false;
  }
  confirmModal(ADMIN_EMAIL_REPAIR_TEXT.title, ADMIN_EMAIL_REPAIR_TEXT.confirm(user, email), async()=>{
    try{
      const result=await repairAdminAuthEmail(user.id, email);
      if(result?.available===false){
        stateRef.admin={...(stateRef.admin||{}), message:'', error:'管理者サーバーAPIを利用できません。'};
        render(stateRef, actionsAPI);
        return;
      }
      await loadAdminData();
      stateRef.admin={...(stateRef.admin||{}), selectedUserId:user.id, message:result.message||ADMIN_EMAIL_REPAIR_TEXT.completed, error:''};
      render(stateRef, actionsAPI);
    }catch(err){
      stateRef.admin={...(stateRef.admin||{}), message:'', error:err.message||'メールアドレス修復に失敗しました。'};
      render(stateRef, actionsAPI);
    }
  }, '修復する');
  return true;
}
async function checkAdminPuzzleUpload(difficulty, file){
  if(!isAdminUser(stateRef.currentUser)){
    notify(ADMIN_PUZZLE_UPLOAD_TEXT.title, ADMIN_EMAIL_REPAIR_TEXT.denied);
    return false;
  }
  if(!file){
    notify(ADMIN_PUZZLE_UPLOAD_TEXT.title, ADMIN_PUZZLE_UPLOAD_TEXT.noFile);
    return false;
  }
  stateRef.admin={...(stateRef.admin||{}), puzzleUpload:{loading:true, difficulty, fileName:file.name, result:null, payload:null, error:''}};
  render(stateRef, actionsAPI);
  try{
    const payload=JSON.parse(await file.text());
    const result=await uploadAdminPuzzles({ difficulty, puzzles:payload, dryRun:true });
    stateRef.admin={...(stateRef.admin||{}), puzzleUpload:{loading:false, difficulty, fileName:file.name, result, payload, error:''}, message:ADMIN_PUZZLE_UPLOAD_TEXT.checked, error:''};
    render(stateRef, actionsAPI);
    return true;
  }catch(err){
    stateRef.admin={...(stateRef.admin||{}), puzzleUpload:{loading:false, difficulty, fileName:file.name, result:null, payload:null, error:err.message||'JSONの検証に失敗しました。'}, message:'', error:err.message||'JSONの検証に失敗しました。'};
    render(stateRef, actionsAPI);
    return false;
  }
}
function executeAdminPuzzleUpload(){
  const upload=stateRef.admin?.puzzleUpload;
  if(!upload?.payload || !upload?.difficulty){
    notify(ADMIN_PUZZLE_UPLOAD_TEXT.title, '先にアップロード前チェックを実行してください。');
    return false;
  }
  confirmModal(ADMIN_PUZZLE_UPLOAD_TEXT.title, ADMIN_PUZZLE_UPLOAD_TEXT.confirm, async()=>{
    stateRef.admin={...(stateRef.admin||{}), puzzleUpload:{...upload, loading:true}, message:'', error:''};
    render(stateRef, actionsAPI);
    try{
      const result=await uploadAdminPuzzles({ difficulty:upload.difficulty, puzzles:upload.payload, dryRun:false });
      stateRef.selectLoaded={};
      stateRef.selectPuzzles={};
      stateRef.admin={...(stateRef.admin||{}), puzzleUpload:{...upload, loading:false, result, error:''}, message:result.message||ADMIN_PUZZLE_UPLOAD_TEXT.uploaded, error:''};
      render(stateRef, actionsAPI);
    }catch(err){
      stateRef.admin={...(stateRef.admin||{}), puzzleUpload:{...upload, loading:false, error:err.message||'パズルJSONの反映に失敗しました。'}, message:'', error:err.message||'パズルJSONの反映に失敗しました。'};
      render(stateRef, actionsAPI);
    }
  }, '反映する');
  return true;
}
function requestDeleteAdminUserRankings(user, count){
  if(!isAdminUser(stateRef.currentUser)){
    notify(ADMIN_RANKING_DELETE_TEXT.title, ADMIN_PASSWORD_CLEAR_TEXT.denied);
    return false;
  }
  if(!user?.id){
    notify(ADMIN_RANKING_DELETE_TEXT.title, '対象ユーザーが見つかりません。');
    return false;
  }
  confirmModal(ADMIN_RANKING_DELETE_TEXT.title, ADMIN_RANKING_DELETE_TEXT.confirm(user, count || 0), async()=>{
    await runAdminMutation(()=>deleteAdminRankingsForUser(user.id), ADMIN_RANKING_DELETE_TEXT.completed);
    if(stateRef.ranking?.data) loadRanking();
  }, 'ランキング記録を削除する');
  return true;
}
function saveAdminDeleteRequestReview(id,patch){ const label=patch.status==='approved'?'承認':'拒否'; const message=patch.status==='approved'?'この削除申請を許可します。\n対象ユーザーは利用停止状態になり、ゲームを利用できなくなります。\nよろしいですか？':'この削除申請を拒否します。\n対象ユーザーは引き続きゲームを利用できます。\nよろしいですか？'; confirmModal(`削除申請を${label}`, message, async()=>{ await runAdminMutation(()=>updateAccountDeleteRequest(id, patch, stateRef.currentUser?.id), `削除申請を${label}しました`); }, label); }
function reactivateAdminAccount(id){ confirmModal('利用停止解除', 'このユーザーの利用停止を解除します。\n対象ユーザーは再びゲームを利用できるようになります。\nよろしいですか？', async()=>{ await runAdminMutation(()=>reactivateAdminUser(id), '利用停止を解除しました'); }, '解除する'); }
function requestAdminPasswordClear(user){
  if(!isAdminUser(stateRef.currentUser)){
    notify(ADMIN_PASSWORD_CLEAR_TEXT.title, ADMIN_PASSWORD_CLEAR_TEXT.denied);
    return false;
  }
  if(!user?.id){
    notify(ADMIN_PASSWORD_CLEAR_TEXT.title, '対象ユーザーが見つかりません。');
    return false;
  }
  if(!String(user.email||'').trim()){
    notify(ADMIN_PASSWORD_CLEAR_TEXT.title, ADMIN_PASSWORD_CLEAR_TEXT.missingEmail);
    return false;
  }
  confirmModal(ADMIN_PASSWORD_CLEAR_TEXT.title, ADMIN_PASSWORD_CLEAR_TEXT.confirm(user, user.id===stateRef.currentUser.id), async()=>{
    try{
      const result = await requestAdminPasswordClearReset(user.id);
      if(result?.available===false){
        stateRef.admin={...(stateRef.admin||{}), message:'', error:'管理者サーバーAPIを利用できません。'};
        render(stateRef, actionsAPI);
        return;
      }
      const message=result.message||ADMIN_PASSWORD_CLEAR_TEXT.completed;
      await loadAdminData();
      stateRef.admin={...(stateRef.admin||{}), message, error:''};
      render(stateRef, actionsAPI);
    }catch(err){
      stateRef.admin={...(stateRef.admin||{}), message:'', error:err.message||'再設定メールの送信に失敗しました。送信回数と送信日時は更新していません。'};
      render(stateRef, actionsAPI);
    }
  }, '実行する');
  return true;
}
async function runAdminMutation(task, successMessage){
  try{
    const result=await task();
    stateRef.admin={...(stateRef.admin||{}), message:result?.available===false?supabaseNotConfiguredMessage():successMessage, error:''};
    await loadAdminData();
  }catch(err){
    stateRef.admin={...(stateRef.admin||{}), message:'', error:`操作できませんでした: ${err.message||'RLSまたは権限設定を確認してください'}`};
    render(stateRef, actionsAPI);
  }
}
async function refreshAdminNewsData({ message='', selectedNewsId='', newsPage=1 }={}){
  const [data, serverApi]=await Promise.all([loadAdminSnapshot(), checkAdminServerApi()]);
  const total=data.newsPosts?.length || 0;
  const pageCount=Math.max(1, Math.ceil(total / ADMIN_NEWS_PAGE_SIZE));
  const page=Math.min(Math.max(1, Number(newsPage)||1), pageCount);
  stateRef.admin={
    ...(stateRef.admin||{}),
    loading:false,
    error:'',
    message:message||data.message||'管理データを読み込みました',
    data,
    serverApi,
    selectedNewsId,
    newsPage:selectedNewsId ? pageForNewsId(data.newsPosts||[], selectedNewsId, page) : page,
    newsDraft:null,
    newsImageUpload:null,
  };
  render(stateRef, actionsAPI);
}
function pageForNewsId(posts, id, fallbackPage=1){
  const index=(posts||[]).findIndex(row=>row.id===id);
  if(index < 0) return fallbackPage;
  return Math.floor(index / ADMIN_NEWS_PAGE_SIZE) + 1;
}
function datetimeLocalNow(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function showRegisterLoginAssist(username,email,password){
  stateRef.authMessage=AUTH_TEXT.registered;
  stateRef.loginForm={...(stateRef.loginForm||{}), username:'', email:'', password:''};
  openModal({title:REGISTER_TEXT.title, message:REGISTER_TEXT.message, buttons:[
    {label:REGISTER_TEXT.yes, run:()=>fillRegisteredLogin(username,email,password)},
    {label:REGISTER_TEXT.no, run:()=>clearRegisteredLogin()}
  ]});
}
function fillRegisteredLogin(username,email,password){
  stateRef.loginForm={username, email, password, remember:!!stateRef.loginForm?.remember};
  stateRef.authMessage=AUTH_TEXT.registered;
  stateRef.screen='login';
  render(stateRef, actionsAPI);
}
function clearRegisteredLogin(){
  const remember=!!stateRef.loginForm?.remember;
  stateRef.loginForm={username:'', email:'', password:'', remember};
  if(!remember) clearRememberedLogin();
  stateRef.authMessage='';
  stateRef.screen='login';
  render(stateRef, actionsAPI);
}
function loadRememberedLogin(){
  let remember=false, username='', email='', password='';
  try{
    remember=localStorage.getItem(REMEMBER_LOGIN_KEY)==='true';
    localStorage.removeItem(SAVED_PASSWORD_KEY);
    localStorage.removeItem(SAVED_EMAIL_KEY);
    if(remember){
      username=localStorage.getItem(SAVED_USERNAME_KEY)||'';
    }
  }catch{}
  stateRef.loginForm={username, email, password, remember};
}
function persistRememberPreference(remember){
  try{
    localStorage.setItem(REMEMBER_LOGIN_KEY, remember?'true':'false');
    if(!remember) clearRememberedLogin();
  }catch{}
}
function saveRememberedLogin(username, remember){
  try{
    localStorage.setItem(REMEMBER_LOGIN_KEY, remember?'true':'false');
    if(remember){
      localStorage.setItem(SAVED_USERNAME_KEY, username);
      localStorage.removeItem(SAVED_EMAIL_KEY);
      localStorage.removeItem(SAVED_PASSWORD_KEY);
    }else{
      localStorage.removeItem(SAVED_USERNAME_KEY);
      localStorage.removeItem(SAVED_EMAIL_KEY);
      localStorage.removeItem(SAVED_PASSWORD_KEY);
      if(stateRef?.loginForm) stateRef.loginForm={username:'', email:'', password:'', remember:false};
    }
  }catch{}
}
function clearRememberedLogin(){
  try{
    localStorage.setItem(REMEMBER_LOGIN_KEY, 'false');
    localStorage.removeItem(SAVED_USERNAME_KEY);
    localStorage.removeItem(SAVED_EMAIL_KEY);
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
function selectNews(id){ stateRef.news={...(stateRef.news||{}), selectedId:String(id||'')}; render(stateRef, actionsAPI); }
async function loadNews(){
  stateRef.news={...(stateRef.news||{}), loading:true, loaded:false, error:''};
  render(stateRef, actionsAPI);
  try{
    const supabaseNews=await loadPublishedNewsPosts();
    if(supabaseNews.available){
      const items=normalizeNewsItems(supabaseNews.posts.map(newsPostToItem));
      const selectedId=items.some(item=>item.id===stateRef.news?.selectedId) ? stateRef.news.selectedId : (items[0]?.id||'');
      stateRef.news={loading:false, loaded:true, error:'', items, selectedId};
      render(stateRef, actionsAPI);
      return true;
    }
    const res=await fetch('./data/news.json', {cache:'no-store'});
    if(!res.ok) throw new Error('news unavailable');
    const body=await res.json();
    const items=normalizeNewsItems(body);
    const selectedId=items.some(item=>item.id===stateRef.news?.selectedId) ? stateRef.news.selectedId : (items[0]?.id||'');
    stateRef.news={loading:false, loaded:true, error:'', items, selectedId};
  }catch{
    stateRef.news={loading:false, loaded:true, error:NEWS_TEXT.loadFailed, items:[], selectedId:''};
  }
  render(stateRef, actionsAPI);
}
function newsPostToItem(post){
  const images = post?.image_url ? [{ src:post.image_url, alt:post.image_alt||'', caption:post.image_caption||'' }] : [];
  return { id:post?.id, date:String(post?.published_at||post?.created_at||'').slice(0,10), title:post?.title, body:post?.body, order:post?.display_order, images };
}
function validateAdminNewsImage(file){
  const type=String(file?.type||'').toLowerCase();
  const extension=String(file?.name||'').toLowerCase().split('.').pop();
  if(!NEWS_IMAGE_STORAGE.allowedTypes.includes(type) || !NEWS_IMAGE_STORAGE.allowedExtensions.includes(extension)) return { ok:false, message:NEWS_TEXT.imageTypeError };
  if(Number(file?.size||0)>NEWS_IMAGE_STORAGE.maxBytes) return { ok:false, message:NEWS_TEXT.imageSizeError };
  return { ok:true };
}
function normalizeNewsItems(body){
  const list=Array.isArray(body) ? body : [];
  return list.map((item,index)=>({
    id:String(item?.id||`news-${index + 1}`),
    date:String(item?.date||''),
    title:String(item?.title||''),
    body:String(item?.body||''),
    order:Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
    images:Array.isArray(item?.images) ? item.images.map(image=>({
      src:String(image?.src||''),
      alt:String(image?.alt||''),
      caption:String(image?.caption||'')
    })).filter(image=>image.src) : []
  })).sort((a,b)=>{
    const dateDiff=Date.parse(b.date||'')-Date.parse(a.date||'');
    if(Number.isFinite(dateDiff)&&dateDiff!==0) return dateDiff;
    return a.order-b.order;
  });
}
async function loadRanking(){
  const mode=stateRef.ranking?.mode||'Beginner';
  stateRef.ranking={...(stateRef.ranking||{}), mode, loading:true, error:''};
  render(stateRef, actionsAPI);
  try{
    const supabase = await loadSupabaseRanking({ difficulty:String(mode).toLowerCase(), currentUser:stateRef.currentUser });
    if(supabase.available){
      stateRef.ranking={mode, loading:false, error:'', data:supabase};
      render(stateRef, actionsAPI);
      return;
    }
  }catch(err){
    console.info(`Supabase ranking fallback: ${err.message}`);
  }
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
function cellSelector(k){ return `.cell[data-k="${String(k).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"]`; }
function updateGameCellDom(k){
  const cell=stateRef.root?.querySelector?.(cellSelector(k));
  if(!cell) return false;
  const filled=stateRef.filled.has(k);
  const crossed=stateRef.crossed.has(k);
  cell.classList.toggle('filled', filled);
  cell.classList.toggle('cross', crossed);
  if(stateRef.game?.colorMode==='color' && filled){
    cell.style.background=MC_COLOR_MAP[normalizeColorId(stateRef.cellColors.get(k))]?.hex||'#e0e0e0';
  }else{
    cell.style.background='';
  }
  updateGameMinimap(stateRef);
  return true;
}
function updateHoverDom(previous, next){
  const root=stateRef.root;
  if(!root?.querySelectorAll) return false;
  const touched=new Set();
  const collect=hover=>{
    if(!hover) return;
    root.querySelectorAll(`.cell[data-row="${hover.row}"], .cell[data-col="${hover.col}"]`).forEach(cell=>touched.add(cell));
  };
  collect(previous);
  collect(next);
  touched.forEach(cell=>{
    const row=Number(cell.dataset.row);
    const col=Number(cell.dataset.col);
    const isHover=!!next && row===next.row && col===next.col;
    const isLine=!!next && !isHover && (row===next.row || col===next.col);
    cell.classList.toggle('is-hover', isHover);
    cell.classList.toggle('is-crosshair', isLine);
  });
  return true;
}
function setSelectedColor(id){ stateRef.selectedColor=normalizeColorId(id); render(stateRef, actionsAPI); }
function setHoverCell(row,col){ if(stateRef.modal) return; if(stateRef.hoverCell?.row===row&&stateRef.hoverCell?.col===col) return; const previous=stateRef.hoverCell; stateRef.hoverCell={row, col}; updateHoverDom(previous, stateRef.hoverCell); }
function clearHoverCell(){ if(!stateRef.hoverCell) return; const previous=stateRef.hoverCell; stateRef.hoverCell=null; updateHoverDom(previous, null); }
function gameLocked(){ return stateRef.gameStatus==='cleared'||stateRef.gameStatus==='timeout'||stateRef.gameStatus==='giveup'; }
function inputBlocked(){ return !!stateRef.modal || !!stateRef.timer.expired || gameLocked(); }
function toggleCell(k){ if(inputBlocked()) return false; const s=stateRef.filled; const color=currentColor(); stateRef.crossed.delete(k); if(s.has(k)&&normalizeColorId(stateRef.cellColors.get(k))===color){ s.delete(k); stateRef.cellColors.delete(k); } else { s.add(k); stateRef.cellColors.set(k,color); } updateGameCellDom(k); return true; }
function toggleCross(k){ if(inputBlocked()) return false; const s=stateRef.crossed; stateRef.filled.delete(k); stateRef.cellColors.delete(k); s.has(k)?s.delete(k):s.add(k); updateGameCellDom(k); return true; }
function setFilled(k,color=currentColor()){ if(inputBlocked()) return false; color=normalizeColorId(color); const changed=stateRef.crossed.delete(k)||!stateRef.filled.has(k)||normalizeColorId(stateRef.cellColors.get(k))!==color; stateRef.filled.add(k); stateRef.cellColors.set(k,color); if(changed) updateGameCellDom(k); return changed; }
function setCrossed(k){ if(inputBlocked()) return false; const changed=stateRef.filled.delete(k)||stateRef.cellColors.delete(k)||!stateRef.crossed.has(k); stateRef.crossed.add(k); if(changed) updateGameCellDom(k); return changed; }
function beginDrag(mode,k){ if(inputBlocked()) return false; stateRef.drag={active:true, mode, start:k, moved:false}; return true; }
function applyDrag(k){ if(inputBlocked()) return false; const d=stateRef.drag; if(!d.active) return false; if(k!==d.start&&!d.moved){ d.moved=true; const first=d.mode==='fill'?setFilled(d.start):setCrossed(d.start); const next=d.mode==='fill'?setFilled(k):setCrossed(k); return first||next; } if(!d.moved) return false; return d.mode==='fill'?setFilled(k):setCrossed(k); }
function endDrag(k){ if(inputBlocked()) return false; const d=stateRef.drag; if(!d.active) return false; stateRef.drag={active:false, mode:null, start:null, moved:false}; if(!k) return false; if(d.moved) return false; if(k!==d.start){ const first=d.mode==='fill'?setFilled(d.start):setCrossed(d.start); const last=d.mode==='fill'?setFilled(k):setCrossed(k); return first||last; } return d.mode==='fill'?toggleCell(k):toggleCross(k); }
function cancelDrag(){ stateRef.drag={active:false, mode:null, start:null, moved:false}; }
function clear(){ if(!stateRef.game||inputBlocked()) return false; return confirmModal(ACTION_TEXT.retryTitle, ACTION_TEXT.retryMessage, retryGame, ACTION_TEXT.restart); }
function hint(){ if(!stateRef.game||inputBlocked()) return false; if((stateRef.hints?.remaining||0)<=0){ notify(ACTION_TEXT.hintTitle, ACTION_TEXT.noHintLeft); return false; } return confirmModal(ACTION_TEXT.hintTitle, ACTION_TEXT.hintMessage, applyHint, ACTION_TEXT.use); }
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
    const k=`${x},${y}`;
    if(isFilledValue(value)){
      stateRef.crossed.delete(k);
      stateRef.filled.add(k);
      stateRef.cellColors.set(k, normalizeColorId(value));
    }else{
      stateRef.filled.delete(k);
      stateRef.cellColors.delete(k);
      stateRef.crossed.add(k);
    }
  }
  stateRef.hints.remaining=Math.max(0, (stateRef.hints.remaining||0)-1);
  render(stateRef, actionsAPI);
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
    const k=`${x},${y}`;
    if(isFilledValue(value)){
      if(!stateRef.filled.has(k)) return true;
      if(stateRef.crossed.has(k)) return true;
      if(G.colorMode==='color'&&normalizeColorId(stateRef.cellColors.get(k))!==normalizeColorId(value)) return true;
    }else if(stateRef.filled.has(k)||!stateRef.crossed.has(k)) return true;
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
function finishClear(){ if(stateRef.gameStatus==='cleared') return false; if(accountDisabled()){ notify(DISABLED_ACCOUNT_TEXT.title, DISABLED_ACCOUNT_TEXT.message); return false; } stateRef.gameStatus='cleared'; markCurrentPuzzleSolved(); const entry=recordResult('clear'); saveServerProgress(entry,'clear'); stopTimer(); cancelDrag(); notify(ACTION_TEXT.clearTitle, ACTION_TEXT.clearMessage, [{label:ACTION_TEXT.ok, action:'close'}, {label:ACTION_TEXT.select, action:'backToSelect'}]); return true; }
function showCheckResult(solved){ if(stateRef.gameStatus==='cleared') return false; if(solved) return finishClear(); notify(ACTION_TEXT.solvedTitle, checkResultMessage(checkBoardState())); return false; }
function checkBoardState(){
  const G=stateRef.game; const result={mistakes:0, incomplete:0, correctFilled:0, totalFilled:0}; if(!G) return result;
  for(let y=0;y<G.h;y++) for(let x=0;x<G.w;x++){
    const k=`${x},${y}`; const value=G.solution[y]?.[x]; const shouldFill=isFilledValue(value); const filled=stateRef.filled.has(k);
    if(shouldFill){
      result.totalFilled++;
      if(!filled) result.incomplete++;
      else if(G.colorMode==='color'&&normalizeColorId(stateRef.cellColors.get(k))!==normalizeColorId(value)) result.mistakes++;
      else result.correctFilled++;
    }else{
      if(filled) result.mistakes++;
    }
  }
  return result;
}
function checkResultMessage(result){
  if(result.mistakes>0) return ACTION_TEXT.checkMistakeMessage;
  const ratio=result.totalFilled>0 ? result.correctFilled/result.totalFilled : 0;
  if(ratio>=0.9) return ACTION_TEXT.checkProgressAlmostMessage;
  if(ratio>=0.7) return ACTION_TEXT.checkProgressGoodMessage;
  if(ratio>=0.4) return ACTION_TEXT.checkProgressMiddleMessage;
  if(ratio>0) return ACTION_TEXT.checkProgressLowMessage;
  return ACTION_TEXT.checkIncompleteMessage;
}
function startTimer(mode){ stopTimer(); const limit=TIMER_LIMITS[mode]??null; stateRef.timer={limit, remaining:limit, running:limit!=null, intervalId:null, expired:false, paused:false, pauseReason:null}; if(limit==null) return; stateRef.timer.intervalId=setInterval(()=>{ if(!stateRef.timer.running) return; stateRef.timer.remaining=Math.max(0, stateRef.timer.remaining-1); updateTimerNode(); if(stateRef.timer.remaining<=0){ stopTimer(); stateRef.timer.expired=true; stateRef.gameStatus='timeout'; const entry=recordResult('fail'); saveServerProgress(entry,'fail'); cancelDrag(); notify(TIMER_TEXT.timeoutTitle, TIMER_TEXT.timeoutMessage, [{label:ACTION_TEXT.select, action:'backToSelect'}, {label:ACTION_TEXT.retry, action:'retry'}]); } },1000); }
function initHintCount(game){ const key=String(game?.difficulty||MODE_TO_DIFFICULTY[game?.mode]||'beginner').toLowerCase(); const limit=HINT_LIMITS_BY_DIFFICULTY[key]??0; stateRef.hints={limit, remaining:limit}; }
function resetGameInput(){
  stateRef.gameStatus='playing';
  stateRef.playSession=makePlaySession(stateRef.game);
  stateRef.filled.clear();
  stateRef.cellColors.clear();
  stateRef.crossed.clear();
  stateRef.selectedColor=firstUsedColor(stateRef.game?.solution);
  stateRef.boardScroll={left:0, top:0};
  initHintCount(stateRef.game);
  cancelDrag();
}
function requestGameExit(target){
  if(!stateRef.game||stateRef.modal) return false;
  if(stateRef.gameStatus==='cleared'||stateRef.gameStatus==='timeout'||stateRef.gameStatus==='giveup') return exitGame(target);
  return confirmModal(ACTION_TEXT.exitTitle, ACTION_TEXT.exitMessage, ()=>exitGame(target), ACTION_TEXT.ok);
}
function exitGame(target){ stopTimer(); stateRef.gameStatus='idle'; stateRef.playSession=null; stateRef.game=null; stateRef.screen=target||'select'; render(stateRef, actionsAPI); }
function zoomBoard(delta){ const current=Number(stateRef.boardZoom||1); const idx=Math.max(0, BOARD_ZOOM_LEVELS.findIndex(v=>v===current)); const base=idx>=0?idx:BOARD_ZOOM_LEVELS.indexOf(1); const next=BOARD_ZOOM_LEVELS[Math.max(0, Math.min(BOARD_ZOOM_LEVELS.length-1, base+delta))]; stateRef.boardZoom=next||1; render(stateRef, actionsAPI); }
function debugInstantClear(){
  if(!ADMIN_DEBUG_CONFIG.enableF1InstantClear || stateRef.screen!=='game' || !stateRef.game || stateRef.modal || stateRef.gameStatus!=='playing') return false;
  if(accountDisabled()) return false;
  if(!isAdminUser(stateRef.currentUser)) return false;
  const G=stateRef.game;
  stateRef.filled.clear();
  stateRef.cellColors.clear();
  stateRef.crossed.clear();
  for(let y=0;y<G.h;y++) for(let x=0;x<G.w;x++){
    const k=`${x},${y}`;
    const value=G.solution[y]?.[x];
    if(isFilledValue(value)){
      stateRef.filled.add(k);
      stateRef.cellColors.set(k, normalizeColorId(value));
    }else{
      stateRef.crossed.add(k);
    }
  }
  cancelDrag();
  return finishClear();
}
function toggleSolved(mode,id){ const S=stateRef.solved[mode]; S.has(id)?S.delete(id):S.add(String(id)); persistSolved(); render(stateRef, actionsAPI); }
function resetClearFlags(){ confirmModal(ACTION_TEXT.resetClearTitle, ACTION_TEXT.resetClearMessage, ()=>resetSolvedData(ACTION_TEXT.resetClearTitle), ACTION_TEXT.delete); }
function resetUserData(){ confirmModal(ACTION_TEXT.resetUserTitle, ACTION_TEXT.resetUserMessage, ()=>resetSolvedData(ACTION_TEXT.resetUserTitle), ACTION_TEXT.delete); }
function resetSolvedData(title){ for(const k of Object.keys(stateRef.solved)){ stateRef.solved[k]=new Set(); } resetProgressForUser(stateRef.currentUser); notify(title, ACTION_TEXT.resetDone); }
async function play(mode,id){ const list=await loadPuzzles(mode); const p=findPuzzle(list,id); if(!p){ notify(ACTION_TEXT.pendingTitle, ACTION_TEXT.puzzleMissing); return; }
  if(accountDisabled()){ endDisabledSession(); return; }
  const difficulty=p.difficulty||MODE_TO_DIFFICULTY[mode]||'beginner'; const colorMode=normalizeColorMode(p.colorMode||p.mode||'mono',difficulty);
  stateRef.game={ mode, id:String(p.id??p.stageNo??id), stageNo:p.stageNo, title:p.title||`#${p.stageNo??p.id}`, w:p.w, h:p.h, difficulty, colorMode, solution:(p.grid||[]).map(r=>r.map(v=>normalizeColorId(v))) };
  stateRef.modal=null; stateRef.hoverCell=null; stateRef.boardZoom=1; resetGameInput(); startTimer(mode); stateRef.screen='game'; render(stateRef, actionsAPI);
}
function playCustom(p){ if(accountDisabled()){ endDisabledSession(); return; } const difficulty=p.difficulty||'normal'; const colorMode=normalizeColorMode(p.colorMode||p.solutionMode||p.modeType||'mono',difficulty);
  stateRef.game={ mode:p.mode||'Custom', id:String(p.id||'custom'), title:p.title||'カスタム', w:p.w, h:p.h, returnTo:p.returnTo||'select', difficulty, colorMode, solution:(p.grid||[]).map(r=>r.map(v=>normalizeColorId(v))) };
  stateRef.modal=null; stateRef.hoverCell=null; stateRef.boardZoom=1; resetGameInput(); startTimer('Custom'); stateRef.screen='game'; render(stateRef, actionsAPI);
}
function firstUsedColor(solution){ const used=new Set(); for(const row of solution||[]) for(const v of row||[]){ const id=normalizeColorId(v); if(isFilledValue(id)) used.add(id); } return MC_COLORS.find(c=>used.has(c.id))?.id || '1'; }
function openModal(modal){ cancelDrag(); pauseTimer('modal'); stateRef.modal={ title:modal.title||'', message:modal.message||'', buttons:modal.buttons?.length?modal.buttons:[{label:ACTION_TEXT.ok, action:'close'}] }; render(stateRef, actionsAPI); return true; }
function closeModal(){ stateRef.modal=null; resumeTimer(); render(stateRef, actionsAPI); }
function notify(title,message,buttons){ return openModal({title,message,buttons}); }
function confirmModal(title,message,onConfirm,confirmLabel=ACTION_TEXT.ok){ return openModal({title,message,buttons:[{label:ACTION_TEXT.cancel, action:'close'}, {label:confirmLabel, run:onConfirm}]}); }
function handleModalButton(index){ const modal=stateRef.modal; const btn=modal?.buttons?.[index]; if(!btn){ closeModal(); return; } const run=btn.run; const action=btn.action||'close'; if(btn.close!==false) stateRef.modal=null; if(run){ run(); return; } if(action==='backToSelect'){ stopTimer(); stateRef.gameStatus='idle'; stateRef.playSession=null; stateRef.game=null; stateRef.screen='select'; render(stateRef, actionsAPI); return; } if(action==='retry'){ retryGame(); return; } resumeTimer(); render(stateRef, actionsAPI); }
function retryGame(){ if(!stateRef.game){ stateRef.gameStatus='idle'; stateRef.screen='select'; render(stateRef, actionsAPI); return; } resetGameInput(); startTimer(stateRef.game.mode||'Custom'); render(stateRef, actionsAPI); }
function markCurrentPuzzleSolved(){ const G=stateRef.game; if(!G||!stateRef.solved[G.mode]) return; stateRef.solved[G.mode].add(String(G.stageNo??G.id)); persistSolved(); }
function loadSolved(){ stateRef.solved=loadSolvedForUser(stateRef.currentUser, stateRef.solved); }
function persistSolved(){ persistSolvedForUser(stateRef.currentUser, stateRef.solved); try{ localStorage.removeItem(LS_KEY); }catch{} }
function makePlaySession(game){
  const now=new Date();
  return {currentUserId:stateRef.currentUser?.id||userIdFor(stateRef.currentUser?.username||'guest'), username:stateRef.currentUser?.username||'guest', difficulty:game?.difficulty, puzzleId:String(game?.stageNo??game?.id??'unknown'), stageNo:game?.stageNo??game?.id, startedAt:now.toISOString(), startedTimeMs:now.getTime()};
}
function recordResult(type){
  if(accountDisabled()){
    stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastResult:'利用停止中のため保存しません'};
    return null;
  }
  const entry=recordGameResultForUser(stateRef.currentUser, stateRef.game, stateRef.timer, type, stateRef.playSession);
  stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:entry ? `${type}を保存しました` : '保存対象がありません'};
  return entry;
}
function usedHintCount(){ return Math.max(0, Number(stateRef.hints?.limit||0) - Number(stateRef.hints?.remaining||0)); }
function saveServerProgress(entry,type='clear'){
  if(!entry || accountDisabled()) return;
  const game=stateRef.game;
  const hintUsedCount=usedHintCount();
  if(stateRef.currentUser?.source==='supabase'){
    saveSupabaseGameResult({user:stateRef.currentUser, game, entry, type, hintUsedCount}).then(result=>{
      const message=result?.saved ? 'Supabaseへ保存しました' : (result?.reason==='puzzle_not_found' ? 'Supabase保存対象のパズルが見つかりません' : 'Supabase未設定のためローカル保存のみ');
      stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:message};
    }).catch((error)=>{
      stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:error?.message||'Supabase保存に失敗しました'};
    });
    return;
  }
  if(stateRef.currentUser?.source!=='server') return;
  apiPost('/api/user-progress',{username:stateRef.currentUser.username, mode:String(game?.mode||'Custom').toLowerCase(), type, entry}).then(()=>{ stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:'userフォルダJSONへ保存しました'}; }).catch(()=>{ stateRef.userDataStatus={...(stateRef.userDataStatus||{}), lastSave:new Date().toLocaleTimeString(), lastResult:'server保存に失敗しました'}; });
}
