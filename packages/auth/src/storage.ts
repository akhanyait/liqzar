/**
 * Auth storage interface for different platforms
 * Web uses localStorage, Mobile uses SecureStore
 */
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

const AUTH_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  REFRESH_TOKEN: "auth_refresh_token",
  USER: "auth_user",
  EXPIRES_AT: "auth_expires_at",
} as const;

export class AuthStorageManager {
  constructor(private storage: AuthStorage) {}

  // Token management
  async saveTokens(
    accessToken: string,
    refreshToken: string,
    expiresAt: number,
  ): Promise<void> {
    await Promise.all([
      this.storage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken),
      this.storage.setItem(AUTH_KEYS.REFRESH_TOKEN, refreshToken),
      this.storage.setItem(AUTH_KEYS.EXPIRES_AT, expiresAt.toString()),
    ]);
  }

  async getAccessToken(): Promise<string | null> {
    return this.storage.getItem(AUTH_KEYS.ACCESS_TOKEN);
  }

  async getRefreshToken(): Promise<string | null> {
    return this.storage.getItem(AUTH_KEYS.REFRESH_TOKEN);
  }

  async getExpiresAt(): Promise<number | null> {
    const value = await this.storage.getItem(AUTH_KEYS.EXPIRES_AT);
    return value ? parseInt(value, 10) : null;
  }

  async isTokenExpired(): Promise<boolean> {
    const expiresAt = await this.getExpiresAt();
    if (!expiresAt) return true;
    return Date.now() >= expiresAt;
  }

  // User management
  async saveUser(user: any): Promise<void> {
    await this.storage.setItem(AUTH_KEYS.USER, JSON.stringify(user));
  }

  async getUser<T = any>(): Promise<T | null> {
    const value = await this.storage.getItem(AUTH_KEYS.USER);
    return value ? JSON.parse(value) : null;
  }

  // Clear all auth data
  async clearAuth(): Promise<void> {
    await Promise.all([
      this.storage.removeItem(AUTH_KEYS.ACCESS_TOKEN),
      this.storage.removeItem(AUTH_KEYS.REFRESH_TOKEN),
      this.storage.removeItem(AUTH_KEYS.USER),
      this.storage.removeItem(AUTH_KEYS.EXPIRES_AT),
    ]);
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    const isExpired = await this.isTokenExpired();
    return !!accessToken && !isExpired;
  }
}

// Web storage implementation using localStorage
export class WebAuthStorage implements AuthStorage {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}

// Factory function
export function createAuthStorage(storage: AuthStorage): AuthStorageManager {
  return new AuthStorageManager(storage);
}
