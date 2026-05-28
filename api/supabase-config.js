module.exports = function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  const placeholders = new Set([
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY',
    'YOUR_SUPABASE_PUBLISHABLE_KEY',
  ]);
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const configured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !placeholders.has(supabaseUrl) &&
    !placeholders.has(supabaseAnonKey)
  );
  res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    configured,
  });
};
