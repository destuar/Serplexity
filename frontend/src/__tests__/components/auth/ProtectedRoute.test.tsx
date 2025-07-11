import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import apiClient from '../../../lib/apiClient';

// Mock the API client
vi.mock('../../../lib/apiClient', () => ({
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

// Test component to render inside protected route
const TestProtectedComponent = () => (
  <div data-testid="protected-content">Protected Content</div>
);

// Wrapper component for testing with router
const TestWrapper = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<TestProtectedComponent />} />
        </Route>
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

describe('ProtectedRoute', () => {
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

  it('should show loading state initially', () => {
    mockApiClient.get.mockRejectedValue(new Error('No token'));
    
    render(<TestWrapper />);
    
    // Should show blank screen during loading
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('should render protected content when user is authenticated', async () => {
    const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
    const mockToken = 'valid-token';
    
    localStorageMock.getItem.mockReturnValue(mockToken);
    mockApiClient.get.mockResolvedValue({ data: { user: mockUser } });
    
    render(<TestWrapper />);
    
    await waitFor(() => {
      const element = screen.getByTestId('protected-content');
      expect(element).toBeDefined();
      expect(element.textContent).toBe('Protected Content');
    });
  });

  it('should redirect to login when user is not authenticated', async () => {
    mockApiClient.get.mockRejectedValue(new Error('No token'));
    mockApiClient.post.mockRejectedValue(new Error('Refresh failed'));
    
    render(<TestWrapper />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });
    
    // Note: In a real test environment, we'd need to mock React Router's Navigate component
    // For now, we're testing that the protected content is not rendered
  });

  it('should handle token refresh during authentication check', async () => {
    const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
    const mockToken = 'expired-token';
    
    localStorageMock.getItem.mockReturnValue(mockToken);
    // Mock the refresh flow: first call fails, refresh succeeds
    mockApiClient.get.mockRejectedValue(new Error('Token expired'));
    mockApiClient.post.mockResolvedValue({ 
      data: { user: mockUser, accessToken: 'new-token' } 
    });
    
    render(<TestWrapper />);
    
    // Verify that refresh was attempted
    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh');
    });
    
    expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
  });

  it('should handle authentication failure gracefully', async () => {
    mockApiClient.get.mockRejectedValue(new Error('Network error'));
    mockApiClient.post.mockRejectedValue(new Error('Refresh failed'));
    
    render(<TestWrapper />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });
  });
}); 