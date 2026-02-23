import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeStorage } from 'electron';
import fs from 'fs';
import { config } from './config';

let supabase: SupabaseClient;
let accessToken: string | null = null;

export function initAuth(): void {
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
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

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
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
  return accessToken !== null;
}

// Refresh the token periodically
export function startAutoRefresh(): void {
  setInterval(async () => {
    if (!accessToken) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      accessToken = data.session.access_token;
    }
  }, 10 * 60 * 1000); // Refresh every 10 minutes
}
