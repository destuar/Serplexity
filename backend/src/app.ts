import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import metricsRouter from './routes/metrics';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/metrics', metricsRouter);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from the Serplexity backend!');
});

export default app; 