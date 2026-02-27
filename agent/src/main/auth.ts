import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeStorage } from 'electron';
import fs from 'fs';
import { config, isDevMode } from './config';
import { getApiKey } from './tracker-config';

let supabase: SupabaseClient | null = null;
let accessToken: string | null = null;

/**
 * Initialize auth. In dev mode, creates a full Supabase auth client.
 * In normal mode, does nothing — auth comes from tracker-config API key.
 */
export function initAuth(): void {
  if (!isDevMode) return;

  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

/**
 * Returns Authorization headers for API calls.
 * Dev mode: Bearer <Supabase JWT>
 * Normal mode: Bearer <API key from config.json/safeStorage>
 */
export function getAuthHeaders(): Record<string, string> | null {
  if (isDevMode) {
    if (!accessToken) return null;
    return { Authorization: `Bearer ${accessToken}` };
  }

  const apiKey = getApiKey();
  if (!apiKey) return null;
  return { Authorization: `Bearer ${apiKey}` };
}

// --- Dev-mode Supabase Auth (unchanged, only active with --dev) ---

export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Auth not initialized (not in dev mode)' };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return { success: false, error: error?.message ?? 'Sign in failed' };
  }

  accessToken = data.session.access_token;

  // Store refresh token securely
  try {
    const encrypted = safeStorage.encryptString(data.session.refresh_token);
    fs.writeFileSync(config.tokenPath, encrypted);
  } catch {
    // safeStorage may not be available in all environments
  }

  return { success: true };
}

export async function restoreSession(): Promise<boolean> {
  if (!supabase) return false;

  try {
    if (!fs.existsSync(config.tokenPath)) return false;
    const encrypted = fs.readFileSync(config.tokenPath);
    const refreshToken = safeStorage.decryptString(encrypted);

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) return false;

    accessToken = data.session.access_token;

    // Update stored refresh token
    const newEncrypted = safeStorage.encryptString(data.session.refresh_token);
    fs.writeFileSync(config.tokenPath, newEncrypted);

    return true;
  } catch {
    return false;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
  accessToken = null;
  try {
    if (fs.existsSync(config.tokenPath)) {
      fs.unlinkSync(config.tokenPath);
    }
  } catch {
    // ignore
  }
}

export function isAuthenticated(): boolean {
  if (isDevMode) {
    return accessToken !== null;
  }
  return getApiKey() !== null;
}

// Refresh the token periodically (dev mode only)
export function startAutoRefresh(): void {
  if (!supabase) return;

  setInterval(async () => {
    if (!accessToken) return;
    const { data } = await supabase!.auth.getSession();
    if (data.session) {
      accessToken = data.session.access_token;
    }
  }, 10 * 60 * 1000); // Refresh every 10 minutes
}
