const SUPABASE_ESM_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const DEFAULT_CONFIG_ENDPOINT = '/api/supabase-config';

let configPromise = null;
let clientPromise = null;

function readGlobalConfig(){
  const root = globalThis.PICROSS_SUPABASE_CONFIG || {};
  return {
    url: root.url || globalThis.SUPABASE_URL || '',
    anonKey: root.anonKey || root.anon_key || globalThis.SUPABASE_ANON_KEY || '',
  };
}

async function fetchRuntimeConfig(){
  if(typeof fetch !== 'function') return {};
  const endpoint = globalThis.PICROSS_SUPABASE_CONFIG_ENDPOINT || DEFAULT_CONFIG_ENDPOINT;
  try{
    const response = await fetch(endpoint, { cache: 'no-store' });
    if(!response.ok) return {};
    const data = await response.json();
    return {
      url: data.url || data.supabaseUrl || '',
      anonKey: data.anonKey || data.supabaseAnonKey || '',
    };
  }catch{
    return {};
  }
}

function normalizeConfig(config){
  const url = String(config?.url || '').trim();
  const anonKey = String(config?.anonKey || '').trim();
  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}

export async function getSupabaseConfig(){
  if(!configPromise){
    configPromise = (async()=>{
      const globalConfig = normalizeConfig(readGlobalConfig());
      if(globalConfig.isConfigured) return globalConfig;
      return normalizeConfig(await fetchRuntimeConfig());
    })();
  }
  return configPromise;
}

export async function getSupabaseClient(){
  if(!clientPromise){
    clientPromise = (async()=>{
      const config = await getSupabaseConfig();
      if(!config.isConfigured) return null;
      const { createClient } = await import(SUPABASE_ESM_URL);
      return createClient(config.url, config.anonKey);
    })();
  }
  return clientPromise;
}

export async function isSupabaseConfigured(){
  const config = await getSupabaseConfig();
  return config.isConfigured;
}
