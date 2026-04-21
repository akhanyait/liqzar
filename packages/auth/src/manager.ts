import {
  authApi,
  getApiClient,
  type LoginCredentials,
  type RegisterData,
} from "@liqzar/api-client";
import type { User, Profile } from "@liqzar/types";
import { AuthStorageManager } from "./storage";

export interface AuthState {
  user: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export class AuthManager {
  private currentUser: Profile | null = null;
  private listeners: Set<(state: AuthState) => void> = new Set();

  constructor(private storage: AuthStorageManager) {}

  /**
   * Initialize auth - check for existing session
   */
  async initialize(): Promise<void> {
    try {
      const isAuth = await this.storage.isAuthenticated();

      if (isAuth) {
        const accessToken = await this.storage.getAccessToken();
        const refreshToken = await this.storage.getRefreshToken();
        const user = await this.storage.getUser<Profile>();

        if (accessToken && refreshToken) {
          // Set tokens in API client
          const client = getApiClient();
          client.setAuthTokens({
            accessToken,
            refreshToken,
          });

          // Check if token is expired
          const isExpired = await this.storage.isTokenExpired();
          if (isExpired && refreshToken) {
            // Try to refresh token
            await this.refreshSession(refreshToken);
          } else {
            this.currentUser = user;
            this.notifyListeners();
          }
        }
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      await this.logout();
    }
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<Profile> {
    const response = await authApi.login(credentials);

    // Save tokens
    await this.storage.saveTokens(
      response.session.access_token,
      response.session.refresh_token,
      response.session.expires_at,
    );

    // Set tokens in API client
    const client = getApiClient();
    client.setAuthTokens({
      accessToken: response.session.access_token,
      refreshToken: response.session.refresh_token,
    });

    // Get full user profile
    const profile = await authApi.getCurrentUser();

    // Save user
    await this.storage.saveUser(profile);
    this.currentUser = profile;

    this.notifyListeners();

    return profile;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<Profile> {
    const response = await authApi.register(data);

    // Save tokens
    await this.storage.saveTokens(
      response.session.access_token,
      response.session.refresh_token,
      response.session.expires_at,
    );

    // Set tokens in API client
    const client = getApiClient();
    client.setAuthTokens({
      accessToken: response.session.access_token,
      refreshToken: response.session.refresh_token,
    });

    // Get full user profile
    const profile = await authApi.getCurrentUser();

    // Save user
    await this.storage.saveUser(profile);
    this.currentUser = profile;

    this.notifyListeners();

    return profile;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }

    // Clear storage
    await this.storage.clearAuth();

    // Clear API client tokens
    const client = getApiClient();
    client.clearAuthTokens();

    this.currentUser = null;
    this.notifyListeners();
  }

  /**
   * Refresh session
   */
  async refreshSession(refreshToken?: string): Promise<void> {
    const token = refreshToken || (await this.storage.getRefreshToken());

    if (!token) {
      throw new Error("No refresh token available");
    }

    const response = await authApi.refreshToken(token);

    // Save new tokens
    await this.storage.saveTokens(
      response.session.access_token,
      response.session.refresh_token,
      response.session.expires_at,
    );

    // Update API client
    const client = getApiClient();
    client.setAuthTokens({
      accessToken: response.session.access_token,
      refreshToken: response.session.refresh_token,
    });

    // Get updated user profile
    const profile = await authApi.getCurrentUser();
    await this.storage.saveUser(profile);
    this.currentUser = profile;

    this.notifyListeners();
  }

  /**
   * Get current user
   */
  getCurrentUser(): Profile | null {
    return this.currentUser;
  }

  /**
   * Check if authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return this.storage.isAuthenticated();
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current auth state
   */
  async getState(): Promise<AuthState> {
    const isAuthenticated = await this.isAuthenticated();
    return {
      user: this.currentUser,
      isAuthenticated,
      isLoading: false,
    };
  }

  /**
   * Notify all listeners of state change
   */
  private async notifyListeners(): Promise<void> {
    const state = await this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}
