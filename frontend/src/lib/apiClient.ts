/**
 * @file apiClient.ts
 * @description Axios-based API client for making HTTP requests to the backend.
 * Provides centralized API communication with interceptors for authentication and error handling.
 *
 * @dependencies
 * - axios: For HTTP requests.
 *
 * @exports
 * - default: The configured axios instance.
 */
import axios from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001/api',
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Helper to store and apply new access token universally
function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('token', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string | null) => void) {
  refreshSubscribers.push(callback);
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const {
      config,
      response: { status } = {},
    } = error;

    // Bail if we have no response or it's not 401
    if (!status || status !== 401) {
      return Promise.reject(error);
    }

    // Prevent infinite retry loops
    if (config._retry) {
      return Promise.reject(error);
    }
    config._retry = true;

    // Do not attempt refresh on auth endpoints themselves
    if (config.url?.startsWith('/auth/')) {
      return Promise.reject(error);
    }

    // If another refresh is in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        addRefreshSubscriber((token) => {
          if (token) {
            (config.headers = config.headers || {});
            config.headers['Authorization'] = `Bearer ${token}`;
            resolve(apiClient(config));
          } else {
            reject(error);
          }
        });
      });
    }

    // Start token refresh flow
    isRefreshing = true;
    try {
      const { data } = await apiClient.post('/auth/refresh');
      const newToken = data.accessToken as string;
      setAuthToken(newToken);
      onRefreshed(newToken);

      // Retry the original request with new token
      (config.headers = config.headers || {});
      config.headers['Authorization'] = `Bearer ${newToken}`;
      return apiClient(config);
    } catch (refreshErr) {
      onRefreshed(null);
      setAuthToken(null);
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient; 