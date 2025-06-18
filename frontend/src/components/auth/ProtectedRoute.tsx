import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen"></div>; // Blank screen during auth check
  }

  return user ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute; 