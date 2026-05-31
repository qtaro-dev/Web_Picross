const { guarded, json } = require('./_adminGuard');

module.exports = async function handler(req, res){
  if(req.method !== 'GET') return json(res, 405, { ok:false, message:'GETのみ対応しています' });
  return guarded(req, res, async ({ user }) => json(res, 200, {
    ok: true,
    admin: true,
    userId: user.id,
  }));
};
