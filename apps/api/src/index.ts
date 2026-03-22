import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import solutionsRouter from './routes/solutions';
import solveRouter from './routes/solve';
import problemsRouter from './routes/problems';
import feedbackRouter from './routes/feedback';
import webhooksRouter from './routes/webhooks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ---- Middleware ----
app.use(cors());
app.use(express.json());

// ---- Routes ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', api: 'QuashAPI v1.0', ts: new Date().toISOString() });
});

app.use('/solutions', solutionsRouter);
app.use('/solve', solveRouter);
app.use('/problems', problemsRouter);
app.use('/feedback', feedbackRouter);
app.use('/webhooks', webhooksRouter);

// ---- 404 Fallthrough ----
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

app.listen(PORT, () => {
  console.log(`\n🔧 QuashAPI v1.0 running on http://localhost:${PORT}`);
  console.log(`   Network: ${process.env.STACKS_NETWORK ?? 'testnet'}`);
});
