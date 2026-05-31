module.exports = function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  const placeholders = new Set([
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY',
    'YOUR_SUPABASE_PUBLISHABLE_KEY',
    'YOUR_SUPABASE_SECRET_KEY',
  ]);
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabasePublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const configured = Boolean(
    supabaseUrl &&
    supabasePublishableKey &&
    !placeholders.has(supabaseUrl) &&
    !placeholders.has(supabasePublishableKey)
  );
  res.status(200).json({
    supabaseUrl,
    supabasePublishableKey,
    supabaseAnonKey: supabasePublishableKey,
    configured,
  });
};
