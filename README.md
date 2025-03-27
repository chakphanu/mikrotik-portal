# MikroTik Hotspot Captive External Portal with RADIUS

A complete TypeScript implementation of an external captive portal for MikroTik devices with RADIUS authentication support. This project provides a seamless way to integrate hotspot login functionality with MikroTik routers using their REST API and RADIUS protocol.

## Features

- **External Captive Portal**: Handle redirects from MikroTik to a customizable login page
- **Click-to-Login**: Simple one-click authentication flow (no username/password entry required)
- **RADIUS Authentication**: Built-in RADIUS server for access-accept/reject responses
- **RADIUS Accounting**: Track session data like bytes transferred and session duration
- **Session Management**: Store and manage user sessions with SQLite database
- **MikroTik REST API Integration**: Communicate with MikroTik routers for login operations
- **Customizable Branding**: Change company name, logo, and styling
- **Responsive Design**: Mobile-friendly UI for better user experience
- **Error Handling**: Robust error handling for API communications and RADIUS packets
- **Logging**: Comprehensive logging for monitoring and troubleshooting

## Requirements

- Node.js 14+
- Redis server (for temporary credential storage)
- MikroTik router with hotspot configuration
- Basic understanding of MikroTik Hotspot and RADIUS setup

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/chakphanu/hotspot-radius.git
cd hotspot-radius
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment Configuration

Create a `.env` file in the root directory:

```
# MikroTik API Settings
MIKROTIK_API_HOST=192.168.88.1         # Just hostname/IP without protocol
MIKROTIK_API_USER=admin                # MikroTik API username
MIKROTIK_API_PASS=password             # MikroTik API password
MIKROTIK_PROTOCOL=http                 # Use http or https
MIKROTIK_IGNORE_CERT=true              # Ignore SSL certificate errors

# Redis Settings
REDIS_URL=redis://localhost:6379

# RADIUS Settings
RADIUS_SECRET=your-radius-secret
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813

# Application Settings
PORT=3000
NODE_ENV=development

# Company/Brand Settings
COMPANY_NAME=Your WiFi Provider
COMPANY_LOGO_URL=/images/logo.svg
```

You can use the `.env.example` file as a template.

### 4. Build and Run

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

The server will start with three components:
- HTTP server (External Captive Portal) on port 3000
- RADIUS Authentication server on port 1812
- RADIUS Accounting server on port 1813

## MikroTik Router Configuration

### 1. Configure Hotspot

In your MikroTik RouterOS, set up a hotspot with an external login page:

```
/ip hotspot profile add name="external-portal" login-by=http-chap,http-pap,trial,mac-cookie,radius html-directory=flash/hotspot
/ip hotspot add name="hotspot1" interface=bridge1 address-pool=dhcp profile=external-portal
```

### 2. Set External Portal URL

Configure the hotspot to use your external portal URL:

```
/ip hotspot profile set external-portal login-by=http-chap,http-pap,mac-cookie,radius login-url=http://your-server-ip:3000/login
```

### 3. Configure RADIUS Client

Set up your MikroTik as a RADIUS client:

```
/radius add address=your-server-ip secret=your-radius-secret service=hotspot
/radius incoming set accept=yes port=1812,1813
```

### 4. Enable RADIUS Accounting

```
/ip hotspot profile set external-portal use-radius=yes accounting=yes
```

## MikroTik API Configuration

The application uses MikroTik's REST API to log users in to the hotspot. Configure the API connection using these environment variables:

- `MIKROTIK_API_HOST`: IP address or hostname of your MikroTik router (without protocol)
- `MIKROTIK_API_USER`: Username for the MikroTik API (needs API access rights)
- `MIKROTIK_API_PASS`: Password for the MikroTik API
- `MIKROTIK_PROTOCOL`: Protocol to use (`http` or `https`)
- `MIKROTIK_IGNORE_CERT`: Set to `true` to ignore SSL certificate errors with self-signed certificates

### HTTP vs HTTPS

MikroTik RouterOS supports both HTTP and HTTPS for API access:

- **HTTP** is simpler to set up but less secure
- **HTTPS** provides encryption but requires certificate configuration

For production environments, we recommend:
- Use HTTPS with a proper certificate
- Set `MIKROTIK_IGNORE_CERT=false`
- Configure firewall rules to restrict API access

For testing or development:
```
MIKROTIK_PROTOCOL=http
```

## Development Guide

### Project Structure

```
src/
├── index.ts                 # Application entry point
├── app.ts                   # Express configuration and routes
├── config.ts                # Environment configuration
├── types.ts                 # TypeScript interfaces and types
├── auth/                    # Authentication adapters
│   ├── AuthAdapter.ts       # Auth adapter interface
│   └── ClickToLoginAdapter.ts # Simple click-to-login implementation
├── services/
│   └── MikrotikService.ts   # MikroTik API client for hotspot login
├── radius/
│   ├── RadiusAuthResponder.ts # RADIUS authentication server
│   └── RadiusAcctResponder.ts # RADIUS accounting server
├── logging/
│   └── SessionLogger.ts     # Logging functionality
├── database/
│   ├── index.ts             # Database initialization
│   └── models/
│       └── Session.ts       # Session model for Sequelize
public/                      # Static assets
├── css/
│   └── styles.css           # Main stylesheet
├── js/
│   └── main.js              # Client-side JavaScript
└── images/                  # Image assets
views/                       # EJS templates
├── layout.ejs              # Main layout template
├── index.ejs               # Home page
├── login.ejs               # Login/captive portal page
├── success.ejs             # Successful login page
└── error.ejs               # Error page
```

### Development Workflow

1. Start development server:
```bash
npm run dev
```

2. The server uses `nodemon` to automatically restart when code changes

3. For TypeScript errors:
```bash
npm run build
```

4. For linting:
```bash
npm run lint
```

### Extending the Project

#### 1. Adding a New Authentication Method

The system uses an adapter pattern to support different authentication methods. Currently, it implements a simple click-to-login adapter. To add a new authentication method:

1. Create a new adapter in `src/auth/` that implements the `AuthAdapter` interface:

```typescript
import { HotspotRequest, Credentials } from '../types';
import { AuthAdapter } from './AuthAdapter';

export class YourCustomAdapter implements AuthAdapter {
  // Constructor with dependencies

  async handleRequest(request: HotspotRequest): Promise<Credentials> {
    // Implement your authentication logic
    // Return username and password for MikroTik login
  }

  async validateCredentials(username: string, password: string): Promise<boolean> {
    // Validate credentials when RADIUS auth request comes in
  }
}
```

2. Update `src/index.ts` to use your new adapter:

```typescript
// Replace or add your custom adapter
const authAdapter = new YourCustomAdapter(dependencies);
const authServer = new RadiusAuthResponder(authAdapter, logger);
```

#### 2. Customizing the UI

The UI is built with EJS templates and plain CSS:

1. Edit templates in the `views/` directory
2. Modify styles in `public/css/styles.css`
3. Add client-side functionality in `public/js/main.js`
4. Replace logos and images in `public/images/`

#### 3. Adding User Management

To add user management functionality:

1. Create user model in `src/database/models/User.ts`
2. Create a user repository in `src/database/repositories/UserRepository.ts`
3. Add user management routes in `src/app.ts`
4. Create user management views in `views/`

#### 4. Implementing Rate Limiting

To add bandwidth or time-based rate limiting:

1. Modify the `RadiusAuthResponder.ts` to include rate limiting attributes:

```typescript
private sendAccept(packet: radius.RadiusPacket, rinfo: dgram.RemoteInfo, user: User): void {
  // Add rate limiting attributes
  const attributes = {
    'Session-Timeout': user.sessionTimeout || 3600,
    'WISPr-Bandwidth-Max-Up': user.maxUpload || 1024000,
    'WISPr-Bandwidth-Max-Down': user.maxDownload || 2048000,
  };

  const response = radius.encode_response({
    packet,
    code: 'Access-Accept',
    secret: this.secret,
    attributes,
  });

  this.server.send(response, 0, response.length, rinfo.port, rinfo.address);
}
```

## Troubleshooting

### Common MikroTik Issues

1. **Login not working**:
   - Check MikroTik API credentials
   - Ensure the API user has permission to manage hotspot
   - Verify protocol (HTTP/HTTPS) configuration

2. **RADIUS authentication failing**:
   - Check RADIUS secret matches in both environments
   - Ensure MikroTik is configured as a RADIUS client
   - Check firewall settings allow RADIUS ports

3. **Unable to connect to Redis**:
   - Ensure Redis server is running
   - Check Redis connection URL

### Logging

Logs are stored in the `logs/` directory by default:
- `session-YYYY-MM-DD.log` - Detailed session logs for each day

For more verbose logging, set `NODE_ENV=development` in your `.env` file.

## Production Deployment

For production deployment, consider:

1. Using a process manager like PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

2. Setting up a reverse proxy with Nginx or similar

3. Implementing proper security measures:
   - Use HTTPS for the web portal
   - Restrict access to RADIUS ports
   - Configure a firewall
   - Set secure passwords for all services

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.

## License

This project is licensed under the MIT License.

## Code Generation

Some of the code in this project was generated or modified with Claude Code 🤖

```
🤖 Generated with Claude Code https://claude.ai/code
```