import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

class ApiClient {
  private client: AxiosInstance;
  private authTokens: AuthTokens = {
    accessToken: null,
    refreshToken: null,
  };
  private onAuthError?: () => void;

  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.authTokens.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.authTokens.accessToken}`;
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Trigger auth error callback (logout user)
          if (this.onAuthError) {
            this.onAuthError();
          }
        }

        return Promise.reject(error);
      },
    );
  }

  // Configuration methods
  setAuthTokens(tokens: AuthTokens) {
    this.authTokens = tokens;
  }

  clearAuthTokens() {
    this.authTokens = {
      accessToken: null,
      refreshToken: null,
    };
  }

  setOnAuthError(callback: () => void) {
    this.onAuthError = callback;
  }

  // HTTP methods
  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  // Get raw axios instance for custom requests
  getClient(): AxiosInstance {
    return this.client;
  }
}

let apiClientInstance: ApiClient | null = null;

export function initializeApiClient(config: ApiConfig): ApiClient {
  apiClientInstance = new ApiClient(config);
  return apiClientInstance;
}

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    throw new Error(
      "API Client not initialized. Call initializeApiClient() first with configuration.",
    );
  }
  return apiClientInstance;
}

export { ApiClient };
