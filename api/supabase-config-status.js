const { renderConfigStatusHtml } = require('./_supabaseConfigStatus');

module.exports = function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderConfigStatusHtml());
};
