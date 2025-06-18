import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import axios from 'axios';
import { z } from 'zod';
import { jwtDecode } from 'jwt-decode';

const API_URL = '/api/auth';

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
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

const apiClient = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('accessToken');
    delete apiClient.defaults.headers.common['Authorization'];
    apiClient.post('/api/auth/logout');
  }, []);

  const getMe = useCallback(async () => {
    try {
        const { data } = await apiClient.get('/me');
        setUser(data.user);
    } catch (error) {
        console.error("Failed to fetch user", error);
        logout(); // Token is likely invalid or expired
    }
  }, [logout]);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await getMe();
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, [getMe]);

  const refreshToken = useCallback(async () => {
    try {
        const response = await apiClient.post('/refresh');
        const { accessToken, user } = response.data;
        localStorage.setItem('accessToken', accessToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        setUser(user);
        return accessToken;
    } catch (err) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/login', { email, password });
      const { user, accessToken } = response.data;
      setUser(user);
      localStorage.setItem('accessToken', accessToken);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/register', { email, password, name });
      const { user, accessToken } = response.data;
      setUser(user);
      localStorage.setItem('accessToken', accessToken);
       apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/google/url');
      window.location.href = data.url;
    } catch (err: any) {
       setError(err.response?.data?.error || 'Google login failed');
       throw err;
    }
  }, []);

  const handleOAuthToken = useCallback((token: string) => {
    try {
      const decoded: any = jwtDecode(token);
      localStorage.setItem('accessToken', token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const user = {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
      };
      
      setUser(user);
    } catch (error) {
      console.error("Failed to handle OAuth token", error);
      logout();
    }
  }, [logout]);

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