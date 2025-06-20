import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import { jwtDecode } from 'jwt-decode';
import apiClient from '../lib/apiClient';

const CompetitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  competitors: z.array(CompetitorSchema),
});

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  subscriptionStatus: z.string().nullable().optional(),
  stripeCustomerId: z.string().nullable().optional(),
  companies: z.array(CompanySchema).optional(),
});

type User = z.infer<typeof UserSchema>;

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  handleOAuthToken: (token: string) => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, [accessToken]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // It's okay if this fails, user might already be logged out.
      console.error("Logout API call failed, proceeding to clear client state.", error);
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
    } catch (err) {
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
      await refreshToken();
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
      throw err;
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/auth/google/url');
      window.location.href = data.url;
    } catch (err: any) {
       setError(err.response?.data?.error || 'Google login failed');
       throw err;
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


  const value = useMemo(() => ({
    user,
    login,
    register,
    loginWithGoogle,
    logout,
    handleOAuthToken,
    isLoading,
    error,
  }), [user, login, register, loginWithGoogle, logout, handleOAuthToken, isLoading, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 