import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';

const app = express();

// Apply CORS here
app.use(cors(corsOptions));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

export default app;