import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const { login, loginWithGoogle, error, isLoading } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      navigate('/overview');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Google login failed', err);
    }
  };

  const starContainerRef = useRef<HTMLDivElement>(null);
  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const createStar = () => {
      if (!starContainerRef.current) return;

      const starEl = document.createElement('div');
      starEl.className = "absolute h-px bg-gradient-to-r from-transparent via-white to-transparent";
      starEl.style.width = '120px';
      
      const duration = (Math.random() * 1.5 + 1) * 1000; // 1s-2.5s in ms

      let startX_vw = -5, startY_vh = 50, endX_vw = 105, endY_vh = 50;
      const startEdge = Math.floor(Math.random() * 4);
      switch (startEdge) {
        case 0: startX_vw = Math.random() * 100; startY_vh = -5; break;
        case 1: startX_vw = 105; startY_vh = Math.random() * 100; break;
        case 2: startX_vw = Math.random() * 100; startY_vh = 105; break;
        case 3: startX_vw = -5; startY_vh = Math.random() * 100; break;
      }
      
      const endEdge = (startEdge + 2) % 4;
      switch (endEdge) {
        case 0: endX_vw = Math.random() * 100; endY_vh = -5; break;
        case 1: endX_vw = 105; endY_vh = Math.random() * 100; break;
        case 2: endX_vw = Math.random() * 100; endY_vh = 105; break;
        case 3: endX_vw = -5; endY_vh = Math.random() * 100; break;
      }
      
      const deltaX_px = (endX_vw - startX_vw) * window.innerWidth;
      const deltaY_px = (endY_vh - startY_vh) * window.innerHeight;
      const angle = Math.atan2(deltaY_px, deltaX_px) * 180 / Math.PI;
      const opacity = Math.random() * 0.4 + 0.6;

      const keyframes = [
        { transform: `translate(${startX_vw}vw, ${startY_vh}vh) rotate(${angle}deg)`, opacity: 0 },
        { opacity: 0, offset: 0.05 },
        { opacity: opacity, offset: 0.15 },
        { opacity: opacity, offset: 0.75 },
        { opacity: 0, offset: 0.85 },
        { transform: `translate(${endX_vw}vw, ${endY_vh}vh) rotate(${angle}deg)`, opacity: 0 }
      ];

      const animation = starEl.animate(keyframes, { duration, easing: 'linear' });

      animation.onfinish = () => {
        starEl.remove();
      };

      starContainerRef.current.appendChild(starEl);
      
      const randomInterval = Math.random() * 8000 + 4000; // 4-12 seconds
      timeoutIdRef.current = window.setTimeout(createStar, randomInterval);
    };

    timeoutIdRef.current = window.setTimeout(createStar, Math.random() * 5000);

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510]">
      {/* Blurred Background Overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
        
        {/* Shooting Stars */}
        <div ref={starContainerRef} className="absolute inset-0 overflow-hidden" />
      </div>
      
      {/* Glass Morphism Modal */}
      <div className="relative w-full max-w-md mx-4">
        <div className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 space-y-6">
          <div className="text-center">
            <img src="/Serplexity.png" alt="Serplexity" className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="text-gray-300 mt-1">Sign in to your account</p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-1">Email</label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-1">Password</label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          
          <div className="flex items-center">
            <div className="flex-1 border-t border-gray-300/50"></div>
            <span className="px-3 text-sm text-gray-300">or</span>
            <div className="flex-1 border-t border-gray-300/50"></div>
          </div>
          
          <div>
            <button 
              onClick={handleGoogleLogin} 
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
          
          <p className="text-sm text-center text-gray-300">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 