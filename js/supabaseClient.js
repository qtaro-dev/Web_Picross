import { ONLINE_FEATURE_TEXT, SUPABASE_PUBLIC_CONFIG } from './config.js';

const SUPABASE_ESM_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const DEFAULT_CONFIG_ENDPOINT = '/api/supabase-config';
const PLACEHOLDER_VALUES = new Set([
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY',
  'YOUR_SUPABASE_PUBLISHABLE_KEY',
]);

let configPromise = null;
let clientPromise = null;

function readGlobalConfig(){
  const root = globalThis.PICROSS_SUPABASE_CONFIG || {};
  return {
    url: SUPABASE_PUBLIC_CONFIG.url || root.url || globalThis.SUPABASE_URL || '',
    publishableKey: SUPABASE_PUBLIC_CONFIG.publishableKey || SUPABASE_PUBLIC_CONFIG.anonKey || root.publishableKey || root.supabasePublishableKey || root.anonKey || root.anon_key || globalThis.SUPABASE_PUBLISHABLE_KEY || globalThis.SUPABASE_ANON_KEY || '',
  };
}

async function fetchRuntimeConfig(){
  if(typeof fetch !== 'function') return {};
  const endpoint = globalThis.PICROSS_SUPABASE_CONFIG_ENDPOINT || DEFAULT_CONFIG_ENDPOINT;
  try{
    const response = await fetch(endpoint, { cache: 'no-store' });
    if(!response.ok){
      console.info(`Supabase config fetch failed (${response.status}). Falling back to local mode.`);
      return {};
    }
    const data = await response.json();
    if(data.configured === false){
      console.info('Supabase config is not configured. Falling back to local mode.');
    }
    return {
      url: data.url || data.supabaseUrl || '',
      publishableKey: data.publishableKey || data.supabasePublishableKey || data.anonKey || data.supabaseAnonKey || '',
    };
  }catch{
    console.info('Supabase config fetch failed. Falling back to local mode.');
    return {};
  }
}

function normalizeConfig(config){
  const url = String(config?.url || '').trim();
  const publishableKey = String(config?.publishableKey || config?.anonKey || '').trim();
  const placeholder = PLACEHOLDER_VALUES.has(url) || PLACEHOLDER_VALUES.has(publishableKey);
  return {
    url: placeholder ? '' : url,
    publishableKey: placeholder ? '' : publishableKey,
    anonKey: placeholder ? '' : publishableKey,
    isConfigured: Boolean(url && publishableKey && !placeholder),
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
      return createClient(config.url, config.publishableKey);
    })();
  }
  return clientPromise;
}

export async function isSupabaseConfigured(){
  const config = await getSupabaseConfig();
  return config.isConfigured;
}

export function supabaseNotConfiguredMessage(detail=false){
  return detail ? ONLINE_FEATURE_TEXT.supabaseSetupDetail : ONLINE_FEATURE_TEXT.supabaseNotConfigured;
}
