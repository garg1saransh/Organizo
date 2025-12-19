import express from 'express';
import cors from 'cors';
import http from 'http';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import userRoutes from './routes/user.routes';
import { initSocket } from './realtime/socket';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS config for local + Vercel
const allowedOrigins = new Set<string>([
  'http://localhost:5173',
  'https://organizo-k3s1g8nvo-saransh-gargs-projects.vercel.app',
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        // allow tools like curl/Postman and health checks
        return callback(null, true);
      }
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      console.error('Blocked by CORS:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
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

// User routes
app.use('/api/users', userRoutes);

// Task routes
app.use('/api/tasks', taskRoutes);

// Global error handler
app.use(errorHandler);

// HTTP server + Socket.io
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;