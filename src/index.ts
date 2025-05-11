// src/index.ts
import dotenv from 'dotenv';
import express from 'express';
import { z } from 'zod';
import { SecurityScanner } from './core/scanner';
import { WebConfigScanner } from './plugins/web-config';
import { TelerikScanner } from './plugins/telerik';
import { ScanTarget, ScanOptions } from './core/types';
import { PassiveReconManager } from './discovery/passive';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize scanner and register plugins
const scanner = new SecurityScanner({
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '10')
});

// Register all available plugins
scanner.registerPlugin(new WebConfigScanner());
scanner.registerPlugin(new TelerikScanner());

// Initialize passive reconnaissance manager
const passiveRecon = new PassiveReconManager({
  apiKeys: {
    shodan: process.env.SHODAN_API_KEY,
    censys: process.env.CENSYS_API_KEY,
    securityTrails: process.env.SECURITY_TRAILS_API_KEY
  }
});

// Create Express app for API
const app = express();
app.use(express.json());

// API request validation schemas
const ScanRequestSchema = z.object({
  url: z.string().url().optional(),
  domain: z.string().optional(),
  ip: z.string().ip().optional(),
  options: z.object({
    timeout: z.number().int().min(1000).max(60000).default(10000),
    depth: z.number().int().min(1).max(10).default(3),
    concurrency: z.number().int().min(1).max(20).default(5),
    userAgent: z.string().optional(),
    followRedirects: z.boolean().default(true)
  }).optional()
});

// API endpoints
app.post('/api/scan', async (req, res) => {
  try {
    // Validate request
    const validationResult = ScanRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request',
        details: validationResult.error.format()
      });
    }
    
    const { url, domain, ip, options } = validationResult.data;
    
    // Ensure at least one target type is provided
    if (!url && !domain && !ip) {
      return res.status(400).json({ 
        error: 'At least one target (url, domain, or ip) must be provided' 
      });
    }
    
    logger.info(`Starting scan for ${url || domain || ip}`);
    
    const target: ScanTarget = {};
    
    if (url) {
      target.url = url;
    }
    
    if (domain) {
      target.domain = domain;
    }
    
    if (ip) {
      target.ip = ip;
    }
    
    // If we have a domain, first gather passive reconnaissance data
    let assetDiscovery = null;
    if (domain) {
      logger.info(`Performing passive reconnaissance for ${domain}`);
      assetDiscovery = await passiveRecon.gatherDomainInformation(domain);
    }
    
    // Perform vulnerability scanning
    const scanResult = await scanner.scan(target, options);
    
    // Combine results
    const result = {
      scan: scanResult,
      discovery: assetDiscovery
    };
    
    logger.info(`Scan completed for ${url || domain || ip}`);
    
    return res.json(result);
  } catch (error) {
    logger.error('Error during scan:', error);
    return res.status(500).json({ error: 'Scan failed', message: error.message });
  }
});

// Asset discovery endpoint
app.post('/api/discover', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    logger.info(`Starting asset discovery for ${domain}`);
    
    const discoveryResult = await passiveRecon.gatherDomainInformation(domain);
    
    logger.info(`Asset discovery completed for ${domain}`);
    
    return res.json(discoveryResult);
  } catch (error) {
    logger.error('Error during asset discovery:', error);
    return res.status(500).json({ error: 'Asset discovery failed', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.status(200).send('OK');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`EASM Scanner running on port ${PORT}`);
});

// Support for running as a command line tool
if (process.argv.length > 2) {
  const url = process.argv[2];
  const target: ScanTarget = { url };
  
  logger.info(`Starting CLI scan for ${url}`);
  
  scanner.scan(target)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      logger.error('CLI scan failed:', error);
      process.exit(1);
    });
}
