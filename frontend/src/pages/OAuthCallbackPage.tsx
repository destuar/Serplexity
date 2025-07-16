/**
 * @file OAuthCallbackPage.tsx
 * @description OAuth callback page for handling authentication redirects from OAuth providers.
 * Processes OAuth authentication responses and redirects users appropriately.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - ../contexts/AuthContext: For authentication state.
 *
 * @exports
 * - OAuthCallbackPage: The main OAuth callback page component.
 */
import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const OAuthCallbackPage: React.FC = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { handleOAuthToken, user } = useAuth();
  const tokenHandled = useRef(false);

  useEffect(() => {
    // This effect should only run once to process the token.
    if (tokenHandled.current) return;

    const params = new URLSearchParams(search);
    const token = params.get('token');

    if (token) {
      tokenHandled.current = true;
      handleOAuthToken(token);
    } else {
      // If there's no token, something went wrong.
      navigate('/login?error=oauth-failed', { replace: true });
    }
  }, [search, navigate, handleOAuthToken]);

  useEffect(() => {
    // This effect triggers once the user object is populated by handleOAuthToken.
    if (user) {
      navigate('/overview', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </div>
  );
};

export default OAuthCallbackPage; 