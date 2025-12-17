import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import http from 'http';
import { initSocket } from './realtime/socket';

const app = express();
const PORT = 3001;

// Global middlewares
app.use(
  cors({
    origin: 'http://localhost:5173', // React dev server
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend ready!' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Task routes
app.use('/api/tasks', taskRoutes);

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;