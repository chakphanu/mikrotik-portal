import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  security: {
    allowedIPs: process.env.ALLOWED_LOGIN_IPS ? process.env.ALLOWED_LOGIN_IPS.split(',').map(ip => ip.trim()) : [],
    trustProxy: process.env.TRUST_PROXY === 'true', // Whether to trust the X-Forwarded-For and X-Real-IP headers
  },
  
  mikrotik: {
    apiHost: process.env.MIKROTIK_API_HOST || process.env.MIKROTIK_API_URL || '192.168.88.1', // No protocol or path here
    apiUrl: process.env.MIKROTIK_API_HOST || process.env.MIKROTIK_API_URL || '192.168.88.1', // For backward compatibility
    apiUser: process.env.MIKROTIK_API_USER || 'admin',
    apiPass: process.env.MIKROTIK_API_PASS || '',
    protocol: process.env.MIKROTIK_PROTOCOL || 'http',
    ignoreCert: process.env.MIKROTIK_IGNORE_CERT === 'true',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 60, // 60 seconds TTL for temporary credentials
  },
  
  radius: {
    secret: process.env.RADIUS_SECRET || 'your-radius-secret',
    authPort: parseInt(process.env.RADIUS_AUTH_PORT || '1812', 10),
    acctPort: parseInt(process.env.RADIUS_ACCT_PORT || '1813', 10),
  },
  
  company: {
    name: process.env.COMPANY_NAME || 'WiFi Hotspot',
    logoUrl: process.env.COMPANY_LOGO_URL || '/images/logo.png',
  },
  
  database: {
    path: path.resolve(__dirname, '../data/database.sqlite'),
    options: {
      logging: process.env.NODE_ENV === 'development',
    },
  },
  
  views: {
    path: path.resolve(__dirname, '../views'),
  },
  
  public: {
    path: path.resolve(__dirname, '../public'),
  },
};

export default config;