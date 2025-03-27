import dgram from 'dgram';
import radius from 'radius';
import { AuthAdapter } from '../auth/AuthAdapter';
import { SessionLogger } from '../logging/SessionLogger';
import config from '../config';
import path from 'node:path';

export class RadiusAuthResponder {
  private server: dgram.Socket;
  private authAdapter: AuthAdapter;
  private logger: SessionLogger;
  private secret: string;
  private port: number;

  constructor(authAdapter: AuthAdapter, logger: SessionLogger) {
    this.authAdapter = authAdapter;
    this.logger = logger;
    this.secret = config.radius.secret;
    this.port = config.radius.authPort;
    this.server = dgram.createSocket('udp4');

    // load Microtik dictionary
    radius.unload_dictionaries();
    radius.add_dictionary('mikrotik/dictionary.mikrotik');

    this.setupServer();
  }

  private setupServer(): void {
    this.server.on('message', async (msg, rinfo) => {
      let packet: radius.RadiusPacket;

      try {
        packet = radius.decode({ packet: msg, secret: this.secret });
      } catch (error) {
        this.logger.error(`[RADIUS] Failed to decode packet: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }

      if (packet.code !== 'Access-Request') {
        this.logger.warn(`[RADIUS] Ignoring non-Access-Request packet: ${packet.code}`);
        return;
      }

      const username = packet.attributes['User-Name'];
      const password = packet.attributes['User-Password'] as string;
      const nasIpAddress = packet.attributes['NAS-IP-Address'];
      const nasIdentifier = packet.attributes['NAS-Identifier'];

      if (!username || !password) {
        this.logger.warn('[RADIUS] Missing username or password in RADIUS request');
        this.sendReject(packet, rinfo, {});
        return;
      }

      try {
        const isValid = await this.authAdapter.validateCredentials(username, password);

        if (isValid) {
          this.logger.info(`[RADIUS] Auth success for user: ${username} from NAS: ${nasIpAddress || nasIdentifier}`);
          const attributes = [
            ['Idle-Timeout', 7200],
            ['Vendor-Specific', 14988, [
              ['Mikrotik-Rate-Limit', '10M/10M'],
            ]],
          ];
          this.sendAccept(packet, rinfo, attributes);
        } else {
          this.logger.warn(`[RADIUS] Auth failure for user: ${username} from NAS: ${nasIpAddress || nasIdentifier}`);
          this.sendReject(packet, rinfo, {});
        }
      } catch (error) {
        this.logger.error(`[RADIUS] Error during auth validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.sendReject(packet, rinfo, {});
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      this.logger.info(`RADIUS Auth Server listening on port ${address.port}`);
    });

    this.server.on('error', (error) => {
      this.logger.error(`RADIUS Auth Server error: ${error.message}`);
    });

    this.server.bind(this.port);
  }

  private sendAccept(packet: radius.RadiusPacket, rinfo: dgram.RemoteInfo, attributes: Record<string, any>): void {
    const response = radius.encode_response({
      packet,
      code: 'Access-Accept',
      secret: this.secret,
      attributes,
    });

    this.server.send(response, 0, response.length, rinfo.port, rinfo.address);
  }

  private sendReject(packet: radius.RadiusPacket, rinfo: dgram.RemoteInfo, attributes: Record<string, any>): void {
    const response = radius.encode_response({
      packet,
      code: 'Access-Reject',
      secret: this.secret,
      attributes,
    });

    this.server.send(response, 0, response.length, rinfo.port, rinfo.address);
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
