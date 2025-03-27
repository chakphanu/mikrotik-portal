import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';
import config from '../config';
import { Session } from './models/Session';

// Ensure the database directory exists
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.database.path,
  logging: config.database.options.logging,
});

// Initialize models
Session.initialize(sequelize);

export { sequelize, Session };

export async function initDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync all models with the database
    await sequelize.sync();
    console.log('Database models synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}