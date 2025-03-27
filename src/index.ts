import Redis from 'ioredis';
import { createApp } from './app';
import { RadiusAuthResponder } from './radius/RadiusAuthResponder';
import { RadiusAcctResponder } from './radius/RadiusAcctResponder';
import { SessionLogger } from './logging/SessionLogger';
import { initDatabase, Session } from './database';
import config from './config';

async function bootstrap() {
  try {
    // Initialize logger
    const logger = new SessionLogger(
      'logs',
      config.environment === 'development'
    );
    
    // Connect to Redis
    const redis = new Redis(config.redis.url);
    redis.on('error', (error) => {
      logger.error(`Redis error: ${error.message}`);
    });
    
    // Initialize database
    await initDatabase();
    
    // Create and start Express app
    const app = createApp(redis, logger);
    const server = app.listen(config.port, () => {
      logger.info(`HTTP server running on port ${config.port}`);
    });
    
    // Create and start RADIUS auth server
    const authAdapter = new ClickToLoginAdapter(redis);
    const authServer = new RadiusAuthResponder(authAdapter, logger);
    
    // Create and start RADIUS accounting server
    const acctServer = new RadiusAcctResponder(redis, logger, Session);
    
    // Handle application shutdown
    const shutdown = async () => {
      logger.info('Shutting down application...');
      
      // Close HTTP server
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      // Close Redis connection
      await redis.quit();
      logger.info('Redis connection closed');
      
      // Exit process
      process.exit(0);
    };
    
    // Handle graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();

// Import the ClickToLoginAdapter (needed here to avoid circular dependencies)
import { ClickToLoginAdapter } from './auth/ClickToLoginAdapter';