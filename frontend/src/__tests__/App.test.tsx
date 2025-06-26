import { render, screen, cleanup, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';

// Mock the API client to prevent network calls
vi.mock('../lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  }
}));

// Mock the payment service
vi.mock('../services/paymentService', () => ({
  createCheckoutSession: vi.fn()
}));

// Mock Stripe
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn()
}));

// Mock environment variables
vi.mock('../../../.env', () => ({}));

// Create a test wrapper component that provides all necessary contexts
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    {children}
  </AuthProvider>
);

describe('App Component', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

    // Mock environment variable
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_mock');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders the landing page by default', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );
    });

    // Look for content that actually exists on the landing page
    expect(screen.getAllByText(/Generative Engine Optimization/i).length).toBeGreaterThan(0);
  });

  it('loads without crashing when wrapped in providers', async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );
      container = result.container;
    });

    // Verify the app renders without throwing errors
    expect(container!.firstChild).toBeTruthy();
  });

  it('renders navbar on landing page', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );
    });

    // Check if navigation elements are present (these should exist in Navbar)
    expect(document.querySelector('nav') || document.querySelector('[role="navigation"]')).toBeTruthy();
  });
}); 