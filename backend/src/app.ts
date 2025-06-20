import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import passport from './config/passport'; 
import metricsRouter from './routes/metrics';
import authRouter from './routes/authRoutes';
import companyRouter from './routes/companyRoutes';
import paymentRouter from './routes/paymentRoutes';
import reportRouter from './routes/reportRoutes';
import userRouter from './routes/userRoutes';
import { authenticate } from './middleware/authMiddleware';
import env from './config/env';
import { PrismaClient } from '@prisma/client';
import { stripeWebhook } from './controllers/paymentController';
import prisma from './config/db'; // Use singleton prisma

dotenv.config();

const app: Application = express();

const corsOptions = {
    origin: env.CORS_ORIGIN,
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(morgan('dev', {
  skip: (req, res) => req.originalUrl === '/api/auth/refresh' && res.statusCode === 401,
}));

// Stripe webhook needs raw body, so we register it before the JSON parser.
app.post('/api/payments/webhook', express.raw({type: 'application/json'}), stripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
});

app.get('/api/health/deep', async (req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'UP', db: 'UP' });
    } catch (error) {
        res.status(500).json({ status: 'DOWN', db: 'DOWN', error: (error as Error).message });
    }
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/metrics', authenticate, metricsRouter);
app.use('/api/companies', companyRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/reports', reportRouter);
app.use('/api/users', userRouter);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from the Serplexity backend!');
});

const main = async () => {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('Database connection successful.');
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
};

export default app; 