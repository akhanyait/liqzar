import { getApiClient } from "./client";
import type { User, Profile, AppRole } from "@liqzar/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export const authApi = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const client = getApiClient();
    return client.post("/auth/login", credentials);
  },

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const client = getApiClient();
    return client.post("/auth/register", data);
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    const client = getApiClient();
    await client.post("/auth/logout");
    client.clearAuthTokens();
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<Profile> {
    const client = getApiClient();
    return client.get("/auth/me");
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const client = getApiClient();
    return client.post("/auth/refresh", { refresh_token: refreshToken });
  },

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    const client = getApiClient();
    return client.patch(`/users/${userId}`, data);
  },

  /**
   * Change password
   */
  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const client = getApiClient();
    return client.post("/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const client = getApiClient();
    return client.post("/auth/forgot-password", { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const client = getApiClient();
    return client.post("/auth/reset-password", {
      token,
      password: newPassword,
    });
  },

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<AppRole[]> {
    const client = getApiClient();
    return client.get(`/users/${userId}/roles`);
  },
};
