import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OAuthCallbackPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { handleOAuthToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      handleOAuthToken(token);
      navigate('/overview');
    } else {
      navigate('/login?error=oauth-failed');
    }
  }, [location, navigate, handleOAuthToken]);

  return (
    <div className="min-h-screen">
      {/* Blank page during OAuth processing */}
    </div>
  );
};

export default OAuthCallbackPage; 