const { createSecretClient, json } = require('./_authGuard');

const USERNAME_PATTERN = /^[\p{L}\p{N}_-]+$/u;

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, message:'POSTのみ対応しています' });
  const body = await readBody(req);
  const username = String(body?.username || '').trim();
  if(!username || username.length > 10 || !USERNAME_PATTERN.test(username)){
    return json(res, 400, { ok:false, message:'ログイン情報を確認できません' });
  }
  try{
    const client = createSecretClient();
    const { data:profile, error } = await client
      .from('profiles')
      .select('email')
      .eq('username', username)
      .maybeSingle();
    if(error) throw error;
    const email = String(profile?.email || '').trim().toLowerCase();
    if(!email) return json(res, 404, { ok:false, message:'ログイン情報を確認できません' });
    return json(res, 200, { ok:true, email });
  }catch(error){
    return json(res, Number(error.status || 500), { ok:false, message:'ログイン情報を確認できません' });
  }
};

async function readBody(req){
  if(req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}
