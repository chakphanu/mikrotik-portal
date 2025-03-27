import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import Redis from 'ioredis';
import expressLayouts from 'express-ejs-layouts';
import { HotspotRequest, SessionEventType } from './types';
import { ClickToLoginAdapter } from './auth/ClickToLoginAdapter';
import { MikrotikService } from './services/MikrotikService';
import { SessionLogger } from './logging/SessionLogger';
import config from './config';

export function createApp(redis: Redis, logger: SessionLogger) {
  const app = express();
  
  // Enable trust proxy if configured
  if (config.security.trustProxy) {
    app.set('trust proxy', true);
  }
  
  const authAdapter = new ClickToLoginAdapter(redis);
  const mikrotikService = new MikrotikService();

  // Set view engine
  app.set('views', config.views.path);
  app.set('view engine', 'ejs');
  
  // Set up EJS layouts
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.set('layout extractScripts', true);

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(config.public.path));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });

  // Routes
  app.get('/', (req: Request, res: Response) => {
    res.render('index', {
      companyName: config.company.name,
      companyLogo: config.company.logoUrl,
    });
  });

  // Helper function to get client IP from various sources
  const getClientIP = (req: Request): string => {
    // Only check proxy headers if configured to trust them
    if (config.security.trustProxy) {
      // Try X-Real-IP header (commonly set by Nginx)
      const realIP = req.headers['x-real-ip'];
      if (realIP && typeof realIP === 'string') {
        return realIP;
      }
      
      // Try X-Forwarded-For header (common standard for proxies)
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
        // The leftmost one is the original client IP
        const ips = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',');
        return ips[0].trim();
      }
    }
    
    // Fall back to standard request IP or socket remote address
    return req.ip || req.socket.remoteAddress || '';
  };

  // IP filtering middleware for login endpoint
  const ipFilterMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const clientIP = getClientIP(req);
    
    // Log the detected client IP and its source for debugging
    logger.debug(`Client IP: ${clientIP} (source: ${
      req.headers['x-real-ip'] ? 'X-Real-IP' : 
      req.headers['x-forwarded-for'] ? 'X-Forwarded-For' : 
      'direct'
    })`);
    
    // If no allowed IPs are configured, allow all
    if (config.security.allowedIPs.length === 0) {
      return next();
    }
    
    // Check if client IP matches any of the allowed IPs or subnets
    const isAllowed = config.security.allowedIPs.some(allowedIP => {
      // Exact IP match
      if (clientIP === allowedIP) {
        return true;
      }
      
      // Simple subnet check (e.g., 192.168.1.0/24)
      if (allowedIP.includes('/')) {
        const [subnet, maskStr] = allowedIP.split('/');
        const mask = parseInt(maskStr, 10);
        
        // Convert IPs to binary strings
        const clientIPBinary = clientIP.split('.').map(octet => 
          parseInt(octet, 10).toString(2).padStart(8, '0')).join('');
        const subnetBinary = subnet.split('.').map(octet => 
          parseInt(octet, 10).toString(2).padStart(8, '0')).join('');
        
        // Compare only the network part (based on mask)
        return clientIPBinary.substring(0, mask) === subnetBinary.substring(0, mask);
      }
      
      return false;
    });
    
    if (isAllowed) {
      return next();
    }
    
    logger.warn(`Access denied to login page from unauthorized IP: ${clientIP}`);
    return res.status(403).render('error', {
      message: `Access denied. Your IP address (${clientIP}) is not authorized.`,
      companyName: config.company.name,
      companyLogo: config.company.logoUrl,
    });
  };

  // Login endpoint - handles the callback from MikroTik
  app.get('/login', ipFilterMiddleware, (req: Request, res: Response) => {
    const { mac, ip, 'link-status': linkStatus } = req.query;
    
    if (!mac || !ip || !linkStatus) {
      return res.status(400).render('error', {
        message: 'Missing required parameters',
        companyName: config.company.name,
        companyLogo: config.company.logoUrl,
      });
    }

    const request: HotspotRequest = {
      mac: String(mac),
      ip: String(ip),
      linkStatus: String(linkStatus),
    };

    logger.info(`Login request: MAC=${request.mac}, IP=${request.ip}`);

    // Render the login page with the received parameters
    res.render('login', {
      mac: request.mac,
      ip: request.ip,
      linkStatus: request.linkStatus,
      companyName: config.company.name,
      companyLogo: config.company.logoUrl,
    });
  });

  // Handle the click to connect form submission
  app.post('/connect', async (req: Request, res: Response) => {
    try {
      const { mac, ip, linkStatus, termsAccepted } = req.body;
      
      if (!mac || !ip || !linkStatus) {
        return res.status(400).render('error', {
          message: 'Missing required parameters',
          companyName: config.company.name,
          companyLogo: config.company.logoUrl,
        });
      }

      if (termsAccepted !== 'on') {
        return res.render('login', {
          mac,
          ip,
          linkStatus,
          error: 'You must accept the terms and conditions',
          companyName: config.company.name,
          companyLogo: config.company.logoUrl,
        });
      }

      const request: HotspotRequest = { mac, ip, linkStatus };
      
      // Generate credentials
      const credentials = await authAdapter.handleRequest(request);
      
      // Call MikroTik API to login the user
      const loginResult = await mikrotikService.loginUser(ip, credentials.username, credentials.password);
      
      if (loginResult.success) {
        logger.log(SessionEventType.LOGIN, `User ${mac} (${ip}) logged in successfully`);
        
        // Render success page
        return res.render('success', {
          mac,
          ip,
          linkStatus: decodeURIComponent(linkStatus),
          companyName: config.company.name,
          companyLogo: config.company.logoUrl,
        });
      } else {
        logger.error(`Login failed for ${mac} (${ip}): ${loginResult.message}`);
        
        // Get detailed error message from Mikrotik API
        let errorMessage = 'Failed to log in. Please try again.';
        if (loginResult.error && loginResult.error.detail) {
          errorMessage = loginResult.error.detail;
        } else if (loginResult.message) {
          errorMessage = loginResult.message;
        }
        
        return res.render('login', {
          mac,
          ip,
          linkStatus,
          error: errorMessage,
          companyName: config.company.name,
          companyLogo: config.company.logoUrl,
        });
      }
    } catch (error) {
      logger.error(`Error processing connect request: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      res.status(500).render('error', {
        message: 'An error occurred while processing your request',
        companyName: config.company.name,
        companyLogo: config.company.logoUrl,
      });
    }
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(`Unhandled error: ${err.message}`);
    
    res.status(500).render('error', {
      message: 'Something went wrong',
      companyName: config.company.name,
      companyLogo: config.company.logoUrl,
    });
  });

  return app;
}