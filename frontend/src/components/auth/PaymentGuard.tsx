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