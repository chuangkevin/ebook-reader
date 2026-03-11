import cors from 'cors';
import config from '../config/environment';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowAll = config.cors.allowedOrigins.includes('*');
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('[::1]');

    if (allowAll || config.cors.allowedOrigins.includes(origin) || config.env === 'development' || isLocalhost) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
