export interface HotspotRequest {
  mac: string;
  ip: string;
  linkStatus: string;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface MikrotikLoginResponse {
  success: boolean;
  message?: string;
  error?: {
    detail?: string;
    error?: number;
    message?: string;
    [key: string]: any;
  };
}

export interface RadiusAuthRequest {
  username: string;
  password: string;
  nasIpAddress: string;
  nasIdentifier?: string;
  userMac?: string;
}

export interface Session {
  id?: number;
  mac: string;
  ip: string;
  username: string;
  sessionId?: string;
  startTime: Date;
  updateTime?: Date;
  endTime?: Date;
  bytesIn?: number;
  bytesOut?: number;
  active: boolean;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export enum SessionEventType {
  START = 'start',
  UPDATE = 'update',
  STOP = 'stop',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ERROR = 'error',
  WARN = 'warn',
}
