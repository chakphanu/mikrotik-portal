import { MikrotikLoginResponse } from '../types';
import config from '../config';
import https from 'https';
import http from 'http';
import { URL } from 'url';

export class MikrotikService {
  private apiHost: string;
  private apiUser: string;
  private apiPass: string;
  private protocol: string;
  private ignoreCert: boolean;

  constructor() {
    this.apiHost = config.mikrotik.apiHost; // Use new property name
    this.apiUser = config.mikrotik.apiUser;
    this.apiPass = config.mikrotik.apiPass;
    // Ensure protocol is in the right format
    this.protocol = config.mikrotik.protocol;
    this.ignoreCert = config.mikrotik.ignoreCert;
    
    // Log configuration
    console.log('MikrotikService initialized with:');
    console.log(`- API Host: ${this.apiHost}`);
    console.log(`- Protocol: ${this.protocol}`);
    console.log(`- Ignore Certificate: ${this.ignoreCert}`);
  }

  async loginUser(ip: string, username: string, password: string): Promise<MikrotikLoginResponse> {
    try {
      // Strip any protocol, trailing slashes, and path components to get clean hostname
      let hostname = this.apiHost.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\/+$/, '');
      
      // Construct the full endpoint URL with the correct protocol
      const loginEndpoint = `${this.protocol}://${hostname}/rest/ip/hotspot/active/login`;
      
      console.log('Using login endpoint:', loginEndpoint);
      
      const data = JSON.stringify({
        ip,
        user: username,
        password,
      });

      const response = await this.makeRequest(loginEndpoint, 'POST', data);
      
      if (response.statusCode === 200) {
        return {
          success: true,
          message: 'Login successful'
        };
      } else {
        // Try to parse the error message from the response
        try {
          const errorResponse = JSON.parse(response.body);
          return {
            success: false,
            message: errorResponse.detail || errorResponse.message || `Login failed with status: ${response.statusCode}`,
            error: errorResponse
          };
        } catch (parseError) {
          // If parsing fails, return the generic error
          return {
            success: false,
            message: `Login failed with status: ${response.statusCode}`
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private makeRequest(url: string, method: string, data?: string): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.apiUser}:${this.apiPass}`).toString('base64');
      const parsedUrl = new URL(url);

      // Use the protocol from the URL instead of the config
      const urlProtocol = parsedUrl.protocol.replace(':', '');

      const options = {
        host: parsedUrl.hostname,
        port: parsedUrl.port || (urlProtocol === 'https' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Length': data?.length,
        },
        rejectUnauthorized: urlProtocol === 'https' ? !this.ignoreCert : undefined, // Only for HTTPS
        
      };

      // Use the protocol from the URL for the request function
      const requestFn = urlProtocol === 'https' ? https.request : http.request;
      
      const req = requestFn(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          console.log('req end:', res.statusCode, body);
          resolve({
            statusCode: res.statusCode || 500,
            body,
          });
        });
      });

      req.on('error', (error) => {
        console.log('req on err:', error);
        reject(error);
      });

      if (data) {
        console.log('data to write:', data);
        req.write(data);
      }
      
      req.end();
    });
  }
}