/**
 * @file ProtectedRoute.tsx
 * @description This component serves as a protected route wrapper. It checks the user's authentication status
 * using the `useAuth` hook. If the user is authenticated, it renders the child routes (`Outlet`); otherwise,
 * it redirects them to the login page. During the authentication check, it renders a blank screen to prevent
 * content flickering. This is a fundamental component for implementing authentication-based routing.
 *
 * @dependencies
 * - react: The core React library.
 * - react-router-dom: For navigation and routing (`Navigate`, `Outlet`).
 * - ../../contexts/AuthContext: Provides authentication context.
 *
 * @exports
 * - ProtectedRoute: React functional component that protects routes based on user authentication.
 */
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { InlineSpinner } from "../ui/InlineSpinner";

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <InlineSpinner size={20} />
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;
