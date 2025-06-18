import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import passport from './config/passport'; 
import metricsRouter from './routes/metrics';
import authRouter from './routes/authRoutes';
import companyRouter from './routes/companyRoutes';
import { authenticate } from './middleware/authMiddleware';
import env from './config/env';

dotenv.config();

const app: Application = express();

const corsOptions = {
    origin: env.CORS_ORIGIN,
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/metrics', authenticate, metricsRouter);
app.use('/api/companies', companyRouter);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from the Serplexity backend!');
});

export default app; 