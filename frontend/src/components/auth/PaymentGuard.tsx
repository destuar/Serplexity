/**
 * @file PaymentGuard.tsx
 * @description This component acts as a guard for routes, ensuring that the authentication context is fully loaded
 * before rendering its children. It displays a loading spinner while the authentication status is being determined.
 * This is a crucial component for preventing UI flickering and ensuring that authenticated routes are only rendered
 * when the user's authentication state is known.
 *
 * @dependencies
 * - react: The core React library.
 * - ../../contexts/AuthContext: Provides authentication context.
 *
 * @exports
 * - PaymentGuard: React functional component that guards routes based on authentication loading status.
 */
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface PaymentGuardProps {
  children: React.ReactNode;
}

const PaymentGuard: React.FC<PaymentGuardProps> = ({ children }) => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default PaymentGuard; 