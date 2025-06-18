import dotenv from 'dotenv';

dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 8001,
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-key',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8001/api/auth/google/callback',

  // Frontend URL
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
};

// Validate that essential variables are set
if (!env.DATABASE_URL) {
  throw new Error('FATAL ERROR: DATABASE_URL is not defined.');
}
if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL ERROR: JWT secrets are not defined.');
}

export default env; 