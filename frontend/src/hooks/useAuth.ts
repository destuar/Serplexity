/**
 * @file useAuth.ts
 * @description Custom hook for accessing authentication context and user data.
 * Provides a convenient interface for authentication-related functionality.
 *
 * @dependencies
 * - react: For context access.
 * - ../contexts/AuthContext: For authentication context.
 *
 * @exports
 * - useAuth: Hook for authentication functionality.
 */
import { createContext, useContext } from 'react';
import { User } from '../types/schemas';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  handleOAuthToken: (token: string) => void;
  updateUser: (userData: Partial<User>) => void;
  isLoading: boolean;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 