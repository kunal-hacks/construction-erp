import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './config/database';
import { connectRedis } from './config/redis';
import { setupRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import vendorRoutes from './routes/vendors.routes';
import path from 'path';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const origins = config.CORS_ORIGINS as any;
    const allowed = Array.isArray(origins)
      ? origins.map((o: string) => String(o).trim())
      : String(origins || '')
          .split(',')
          .map((o: string) => o.trim())
          .filter((o: string) => o.length > 0);
    if (allowed.includes(origin) || allowed.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
}));

// Request parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Global sanitizer — converts empty strings to null, removes null bytes
app.use((req, _res, next) => {
  const sanitize = (val: any): any => {
    if (typeof val === 'string') {
      const cleaned = val.replace(/\0/g, '').replace(/\x00/g, '').trim();
      return cleaned === '' ? null : cleaned;  // ← empty string becomes null
    }
    if (Array.isArray(val)) return val.map(sanitize);
    if (val && typeof val === 'object') {
      return Object.fromEntries(
        Object.entries(val).map(([k, v]) => [k, sanitize(v)])
      );
    }
    return val;
  };
  if (req.body) req.body = sanitize(req.body);
  next();
});

app.use(compression());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Setup all routes
setupRoutes(app);
app.use('/api/vendors', vendorRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectRedis();
    logger.info('Redis connected');
    await prisma.$connect();
    logger.info('Database connected');
    app.listen(config.PORT, () => {
      logger.info(`🚀 Construction ERP Server running on port ${config.PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${config.PORT}/api/docs`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export default app;