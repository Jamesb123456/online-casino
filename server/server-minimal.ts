import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Root route
app.get('/', (req: express.Request, res: express.Response) => {
  res.json({ 
    message: 'Platinum Casino API is running in TypeScript!',
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'healthy', typescript: true });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ TypeScript server running on port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
});

export default app; 