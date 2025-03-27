import dgram from 'dgram';
import radius from 'radius';
import { Redis } from 'ioredis';
import { SessionLogger } from '../logging/SessionLogger';
import { Session, SessionEventType } from '../types';
import config from '../config';

export class RadiusAcctResponder {
  private server: dgram.Socket;
  private logger: SessionLogger;
  private redis: Redis;
  private secret: string;
  private port: number;
  private sessionRepository: any; // Will be replaced with actual DB repository

  constructor(redis: Redis, logger: SessionLogger, sessionRepository: any) {
    this.redis = redis;
    this.logger = logger;
    this.sessionRepository = sessionRepository;
    this.secret = config.radius.secret;
    this.port = config.radius.acctPort;
    this.server = dgram.createSocket('udp4');

    // load Microtik dictionary
    radius.add_dictionary('mikrotik/dictionary.mikrotik');

    this.setupServer();
  }

  private setupServer(): void {
    this.server.on('message', async (msg, rinfo) => {
      try {
        let packet;
        try {
          packet = radius.decode({
            packet: msg,
            secret: this.secret,
          });
          this.logger.debug(`RADIUS accounting packet received: code=${packet.code}, identifier=${packet.identifier}`);
        } catch (decodeError) {
          this.logger.error(`Failed to decode RADIUS accounting packet: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
          // We can't use sendResponse here because we don't have a valid packet
          this.sendBasicResponse(rinfo, msg[1]); // msg[1] should contain the identifier
          return;
        }

        if (packet.code !== 'Accounting-Request') {
          this.logger.warn(`Ignoring non-Accounting-Request packet: ${packet.code}`);
          return;
        }

        const statusType = packet.attributes['Acct-Status-Type'];
        const sessionId = packet.attributes['Acct-Session-Id'];
        const username = packet.attributes['User-Name'];
        const clientIp = packet.attributes['Framed-IP-Address'];
        const macAddress = this.extractMacFromUsername(username);
        const inputOctets = packet.attributes['Acct-Input-Octets'] || 0;
        const outputOctets = packet.attributes['Acct-Output-Octets'] || 0;

        if (!username || !sessionId) {
          this.logger.warn('Missing username or session ID in RADIUS accounting request');
          this.sendResponse(packet, rinfo);
          return;
        }

        switch (statusType) {
          case 'Start':
            await this.handleSessionStart({
              mac: macAddress,
              ip: clientIp || '',
              username,
              sessionId,
              startTime: new Date(),
              bytesIn: 0,
              bytesOut: 0,
              active: true,
            });
            break;
            
          case 'Interim-Update':
            await this.handleSessionUpdate({
              mac: macAddress,
              ip: clientIp || '',
              username,
              sessionId,
              updateTime: new Date(),
              bytesIn: inputOctets,
              bytesOut: outputOctets,
              active: true,
            });
            break;
            
          case 'Stop':
            await this.handleSessionStop({
              mac: macAddress,
              ip: clientIp || '',
              username,
              sessionId,
              endTime: new Date(),
              bytesIn: inputOctets,
              bytesOut: outputOctets,
              active: false,
            });
            break;
            
          default:
            this.logger.warn(`Unknown accounting status type: ${statusType}`);
        }

        this.sendResponse(packet, rinfo);
      } catch (error) {
        this.logger.error(`Error processing RADIUS accounting request: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // We can't safely use sendResponse here as we might not have a valid packet
        try {
          // Try to get the identifier from the message
          const identifier = msg[1]; // The identifier should be the second byte
          this.sendBasicResponse(rinfo, identifier);
        } catch (sendError) {
          this.logger.error(`Failed to send RADIUS accounting response: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`);
        }
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      this.logger.info(`RADIUS Accounting Server listening on port ${address.port}`);
    });

    this.server.on('error', (error) => {
      this.logger.error(`RADIUS Accounting Server error: ${error.message}`);
    });

    this.server.bind(this.port);
  }

  private extractMacFromUsername(username: string): string {
    // Try to extract MAC from username if it's in MAC format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (macRegex.test(username)) {
      return username.toLowerCase();
    }
    
    // Return username as fallback
    return username;
  }

  private async handleSessionStart(session: Session): Promise<void> {
    try {
      // Store in Redis for quick access
      await this.redis.hmset(
        `session:${session.sessionId}`,
        'mac', session.mac,
        'ip', session.ip,
        'username', session.username,
        'startTime', session.startTime.toISOString(),
        'bytesIn', '0',
        'bytesOut', '0',
        'active', '1'
      );
      
      // Store in database for persistence
      await this.sessionRepository.create(session);
      
      this.logger.log(SessionEventType.START, `Session started for ${session.username} (${session.mac})`);
    } catch (error) {
      this.logger.error(`Error handling session start: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleSessionUpdate(session: Partial<Session>): Promise<void> {
    try {
      if (!session.sessionId) return;
      
      // Update Redis, but don't need to update database on every interim update
      await this.redis.hmset(
        `session:${session.sessionId}`,
        'bytesIn', session.bytesIn?.toString() || '0',
        'bytesOut', session.bytesOut?.toString() || '0',
        'updateTime', session.updateTime?.toISOString() || new Date().toISOString()
      );
      
      this.logger.log(
        SessionEventType.UPDATE, 
        `Session update for ${session.username} (${session.mac}): IN=${session.bytesIn}, OUT=${session.bytesOut}`
      );
    } catch (error) {
      this.logger.error(`Error handling session update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleSessionStop(session: Partial<Session>): Promise<void> {
    try {
      if (!session.sessionId) return;
      
      // Get data from Redis to ensure we have all the session info
      const redisData = await this.redis.hgetall(`session:${session.sessionId}`);
      
      if (Object.keys(redisData).length > 0) {
        // Update database with final session data
        await this.sessionRepository.update(
          {
            endTime: session.endTime,
            bytesIn: session.bytesIn || parseInt(redisData.bytesIn || '0', 10),
            bytesOut: session.bytesOut || parseInt(redisData.bytesOut || '0', 10),
            active: false,
          },
          {
            where: { sessionId: session.sessionId },
          }
        );
        
        // Remove from Redis
        await this.redis.del(`session:${session.sessionId}`);
      }
      
      this.logger.log(SessionEventType.STOP, `Session ended for ${session.username} (${session.mac})`);
    } catch (error) {
      this.logger.error(`Error handling session stop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private sendResponse(packet: any, rinfo: dgram.RemoteInfo): void {
    try {
      const response = radius.encode_response({
        packet: packet,
        code: 'Accounting-Response',
        secret: this.secret,
      });

      this.logger.debug(`Sending RADIUS Accounting-Response to ${rinfo.address}:${rinfo.port}, identifier: ${packet.identifier}, length: ${response.length}`);
      
      this.server.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
        if (err) {
          this.logger.error(`UDP send error for Accounting-Response: ${err.message}`);
        } else {
          this.logger.debug(`Successfully sent RADIUS Accounting-Response packet to ${rinfo.address}:${rinfo.port}`);
        }
      });
    } catch (error) {
      this.logger.error(`Error sending Accounting-Response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fall back to basic response if we can't encode the response
      this.sendBasicResponse(rinfo, packet.identifier);
    }
  }
  
  // Send a basic response when we don't have a valid packet
  private sendBasicResponse(rinfo: dgram.RemoteInfo, identifier: number): void {
    try {
      // Create a simple RADIUS packet from scratch
      const response = radius.encode({
        code: 'Accounting-Response',
        identifier: identifier,
        attributes: [],
        secret: this.secret
      });

      this.logger.debug(`Sending basic RADIUS accounting response to ${rinfo.address}:${rinfo.port}, identifier: ${identifier}, length: ${response.length}`);
      
      this.server.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
        if (err) {
          this.logger.error(`UDP send error for basic Accounting-Response: ${err.message}`);
        } else {
          this.logger.debug(`Successfully sent basic RADIUS Accounting-Response packet to ${rinfo.address}:${rinfo.port}`);
        }
      });
    } catch (error) {
      this.logger.error(`Error sending basic Accounting-Response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}