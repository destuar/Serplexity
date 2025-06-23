import React, { useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import apiClient from '../lib/apiClient';
import { User } from '../types/schemas';
import { AuthContext } from '../hooks/useAuth';

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const isAuthenticated = useRef(false);

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('token', accessToken);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } else {
      localStorage.removeItem('token');
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, [accessToken]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('token');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (logoutError) {
      // It's okay if this fails, user might already be logged out.
      console.error("Logout API call failed, proceeding to clear client state.", logoutError);
    } finally {
      clearAuth();
    }
  }, [clearAuth]);
  
  const refreshToken = useCallback(async () => {
    try {
        const response = await apiClient.post('/auth/refresh');
        const { accessToken: newAccessToken, user: newUser } = response.data;
        setAccessToken(newAccessToken);
        setUser(newUser);
        return true;
    } catch {
        // This is expected if the user has no valid refresh token
        clearAuth();
        return false;
    }
  }, [clearAuth]);


  useEffect(() => {
    const initializeAuth = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      
      setIsLoading(true);
      
      // Check for existing token in localStorage
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setAccessToken(storedToken);
        try {
          // Try to get user info with the stored token
          const response = await apiClient.get('/auth/me');
          setUser(response.data.user);
          isAuthenticated.current = true;
        } catch {
          // Token is invalid, try to refresh
          await refreshToken();
        }
      } else {
        await refreshToken();
      }
      
      setIsLoading(false);
    };
    initializeAuth();
  }, [refreshToken]);


  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { user: newUser, accessToken: newAccessToken } = response.data;
      setUser(newUser);
      setAccessToken(newAccessToken);
      isAuthenticated.current = true;
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.response?.data?.error || 'Login failed');
      throw apiErr;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password:string, name?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', { email, password, name });
      const { user: newUser, accessToken: newAccessToken } = response.data;
      setUser(newUser);
      setAccessToken(newAccessToken);
      isAuthenticated.current = true;
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.response?.data?.error || 'Registration failed');
      throw apiErr;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/auth/google/url');
      window.location.href = data.url;
    } catch (err) {
       const apiErr = err as ApiError;
       setError(apiErr.response?.data?.error || 'Google login failed');
       throw apiErr;
    }
  }, []);
  
  const handleOAuthToken = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      setAccessToken(token);
      
      const response = await apiClient.get('/auth/me');
      setUser(response.data.user);
      
      isAuthenticated.current = true;
    } catch (error) {
      console.error("Failed to handle OAuth token", error);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [clearAuth]);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  }, []);

  const value = useMemo(() => ({
    user,
    login,
    register,
    loginWithGoogle,
    logout,
    handleOAuthToken,
    updateUser,
    isLoading,
    error,
  }), [user, login, register, loginWithGoogle, logout, handleOAuthToken, updateUser, isLoading, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Re-export the useAuth hook for convenience
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth } from '../hooks/useAuth'; 