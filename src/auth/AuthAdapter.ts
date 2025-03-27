import { HotspotRequest, Credentials } from '../types';

export interface AuthAdapter {
  handleRequest(request: HotspotRequest): Promise<Credentials>;
  validateCredentials(username: string, password: string): Promise<boolean>;
}