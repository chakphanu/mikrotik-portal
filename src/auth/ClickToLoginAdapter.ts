import { HotspotRequest, Credentials } from '../types';
import { AuthAdapter } from './AuthAdapter';
import { Redis } from 'ioredis';
import config from '../config';
import crypto from 'crypto';

export class ClickToLoginAdapter implements AuthAdapter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async handleRequest(request: HotspotRequest): Promise<Credentials> {
    const username = request.mac;
    const password = this.generateRandomPassword();

    console.log('Set credentials in Redis with TTL', config.redis.ttl);
    console.log('username:', username);
    console.log('password:', password);
    
    // Store credentials in Redis with TTL
    await this.redis.set(
      `auth:${username}`, 
      password, 
      'EX', 
      config.redis.ttl
    );
    
    return {
      username,
      password,
    };
  }

  async validateCredentials(username: string, password: string): Promise<boolean> {
    const storedPassword = await this.redis.get(`auth:${username}`);
    
    if (!storedPassword) {
      console.log('No stored password found for', username);
      return false;
    }

    // debug
    console.log('Stored password:', storedPassword);
    
    // Check if the provided password matches the stored one
    const isValid = storedPassword === password;
    
    // If valid, remove the temporary credentials from Redis
    if (isValid) {
      await this.redis.del(`auth:${username}`);
    }
    
    return isValid;
  }

  private generateRandomPassword(length = 16): string {
    return crypto.randomBytes(length).toString('hex');
  }
}