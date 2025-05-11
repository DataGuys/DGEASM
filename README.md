# EASM Solution - External Attack Surface Management

A comprehensive, production-ready External Attack Surface Management solution built with TypeScript and Node.js.

![EASM Solution](https://via.placeholder.com/800x400?text=EASM+Solution)

## Features

- **Comprehensive Vulnerability Scanning**: Detect web application vulnerabilities, exposed configuration files, and more
- **Web Component Analysis**: Scan for security issues in common web components (Telerik UI, etc.)
- **Asset Discovery**: Identify your complete external attack surface using passive and active techniques
- **Modular Architecture**: Easily extend with custom scanning plugins
- **Scalable Design**: Built to handle enterprise-scale scanning with rate limiting and worker distribution
- **Cloud-Native**: Deploy to Azure with a single command
- **API & CLI Interface**: Use as an API service or command-line tool

## Quick Start

### One-liner Azure Deployment

Deploy the EASM Scanner to Azure in one command using Azure Cloud Shell:

```bash
curl -sL https://raw.githubusercontent.com/yourusername/easm-solution/main/install.sh | bash
```

This will automatically:
1. Clone the repository
2. Create Azure resources
3. Build and deploy the Docker container
4. Configure the service
5. Output the service URL

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/easm-solution.git
cd easm-solution
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

5. Run in production mode:
```bash
npm start
```

### Using Docker

```bash
# Build the image
docker build -t easm-solution .

# Run the container
docker run -p 3000:3000 easm-solution
```

### Using Docker Compose

```bash
docker-compose up -d
```

## API Usage

### Vulnerability Scanning

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "timeout": 10000,
      "depth": 3,
      "followRedirects": true
    }
  }'
```

### Asset Discovery

```bash
curl -X POST http://localhost:3000/api/discover \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com"
  }'
```

### CLI Usage

```bash
# Scan a URL directly
npm start -- https://example.com
```

## Scanner Capabilities

### Web.config Exposure Detection

Detects exposed ASP.NET configuration files that could reveal sensitive information:

- Connection strings
- Authentication settings
- Application secrets
- Server configurations

### Telerik UI Vulnerability Scanning

Identifies security issues in Telerik UI components including:

- CVE-2019-18935: Remote code execution vulnerability
- CVE-2017-11317: Insecure deserialization vulnerability
- CVE-2017-9248: Cryptographic weakness 

### Passive Reconnaissance

Discovers assets through non-intrusive methods:

- Certificate Transparency logs
- DNS records
- WHOIS information
- Third-party services (Shodan, SecurityTrails)

## Architecture

![Architecture Diagram](https://via.placeholder.com/800x500?text=EASM+Architecture)

The EASM Solution is built with a modular architecture:

- **Core Framework**: Handles orchestration and plugin management
- **Scanner Plugins**: Modular components for specific vulnerability types
- **Discovery System**: Asset identification and relationship mapping
- **HTTP Client**: Robust request management with error handling
- **Reporting System**: Structured vulnerability reports

## Deployment Options

### Azure Container Instances

The one-liner deployment uses Azure Container Instances for quick setup.

### Kubernetes

For production deployments, use the Kubernetes configuration:

```bash
# Replace with your ACR details
export ACR_LOGIN_SERVER=yourregistry.azurecr.io

# Apply the deployment
envsubst < infra/kubernetes/deployment.yaml | kubectl apply -f -
```

### Azure App Service

For integration with other Azure services, deploy to Azure App Service:

```bash
az webapp up --runtime "NODE|18-lts" --sku B1 --name easm-scanner
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port for the server | 3000 |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | info |
| `MAX_CONCURRENCY` | Maximum concurrent scans | 10 |
| `SHODAN_API_KEY` | Shodan API key for enhanced reconnaissance | - |
| `SECURITY_TRAILS_API_KEY` | SecurityTrails API key | - |
| `CENSYS_API_KEY` | Censys API key | - |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Security

For security issues, please contact security@yourdomain.com instead of using a public issue.