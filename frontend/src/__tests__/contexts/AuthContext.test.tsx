import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import apiClient from '../../lib/apiClient';

// Mock the API client
vi.mock('../../lib/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Test component to access auth context
const TestComponent = () => {
  const { user, isLoading, error, login, logout, register } = useAuth();
  
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => register('test@example.com', 'password', 'Test User')}>Register</button>
    </div>
  );
};

describe('AuthContext', () => {
  const mockApiClient = apiClient as typeof apiClient & {
    post: Mock;
    get: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with no user and loading state', async () => {
      mockApiClient.get.mockRejectedValue(new Error('No token'));
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user').textContent).toBe('no-user');
      expect(screen.getByTestId('loading').textContent).toBe('loading');
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
    });

    it('should restore user session from localStorage token', async () => {
      const mockToken = 'valid-token';
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      
      localStorageMock.getItem.mockReturnValue(mockToken);
      mockApiClient.get.mockResolvedValue({ data: { user: mockUser } });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('token');
      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(mockApiClient.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`);
    });

    it('should handle invalid stored token by attempting refresh', async () => {
      const mockToken = 'invalid-token';
      
      localStorageMock.getItem.mockReturnValue(mockToken);
      mockApiClient.get.mockRejectedValue(new Error('Invalid token'));
      mockApiClient.post.mockRejectedValue(new Error('Refresh failed'));
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('no-user');
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });

      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh');
    });
  });

  describe('Login', () => {
    it('should successfully login user', async () => {
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      const mockToken = 'new-access-token';
      
      mockApiClient.post.mockResolvedValue({
        data: { user: mockUser, accessToken: mockToken }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });

      const loginButton = screen.getByText('Login');
      
      await act(async () => {
        loginButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
        expect(screen.getByTestId('error').textContent).toBe('no-error');
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password'
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', mockToken);
      expect(mockApiClient.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`);
    });

    it('should handle login errors', async () => {
      const mockError = { response: { data: { error: 'Invalid credentials' } } };
      mockApiClient.post.mockRejectedValue(mockError);
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });

      const loginButton = screen.getByText('Login');
      
      await act(async () => {
        loginButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Invalid credentials');
        expect(screen.getByTestId('user').textContent).toBe('no-user');
      });
    });
  });

  describe('Register', () => {
    it('should successfully register user', async () => {
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      const mockToken = 'new-access-token';
      
      mockApiClient.post.mockResolvedValue({
        data: { user: mockUser, accessToken: mockToken }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });

      const registerButton = screen.getByText('Register');
      
      await act(async () => {
        registerButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
        expect(screen.getByTestId('error').textContent).toBe('no-error');
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'test@example.com',
        password: 'password',
        name: 'Test User'
      });
    });
  });

  describe('Logout', () => {
    it('should successfully logout user', async () => {
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      const mockToken = 'valid-token';
      
      // Setup initial authenticated state
      localStorageMock.getItem.mockReturnValue(mockToken);
      mockApiClient.get.mockResolvedValue({ data: { user: mockUser } });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
      });

      const logoutButton = screen.getByText('Logout');
      
      await act(async () => {
        logoutButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('no-user');
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(mockApiClient.defaults.headers.common['Authorization']).toBeUndefined();
    });

    it('should logout even if API call fails', async () => {
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      const mockToken = 'valid-token';
      
      // Setup initial authenticated state
      localStorageMock.getItem.mockReturnValue(mockToken);
      mockApiClient.get.mockResolvedValue({ data: { user: mockUser } });
      mockApiClient.post.mockRejectedValue(new Error('Network error'));
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
      });

      const logoutButton = screen.getByText('Logout');
      
      await act(async () => {
        logoutButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('no-user');
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('Token Management', () => {
    it('should set Authorization header when token is available', async () => {
      const mockToken = 'valid-token';
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      
      localStorageMock.getItem.mockReturnValue(mockToken);
      mockApiClient.get.mockResolvedValue({ data: { user: mockUser } });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockApiClient.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`);
      });
    });

    it('should remove Authorization header when token is cleared', async () => {
      const mockToken = 'valid-token';
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      
      localStorageMock.getItem.mockReturnValue(mockToken);
      mockApiClient.get.mockResolvedValue({ data: { user: mockUser } });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockApiClient.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`);
      });

      const logoutButton = screen.getByText('Logout');
      
      await act(async () => {
        logoutButton.click();
      });

      await waitFor(() => {
        expect(mockApiClient.defaults.headers.common['Authorization']).toBeUndefined();
      });
    });
  });
}); 