const { createSecretClient, guarded, json } = require('./_adminGuard');

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  return guarded(req, res, async () => {
    createSecretClient();
    return json(res, 501, { ok:false, message:'Authユーザー削除APIは未実装です。チケット104では管理者ガードとsecret key利用箇所の土台だけを用意しています。' });
  });
};
