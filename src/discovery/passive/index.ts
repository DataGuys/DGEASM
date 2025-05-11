// src/discovery/passive/index.ts
import { v4 as uuidv4 } from 'uuid';
import { BaseAsset, AssetType, AssetRelationship, DiscoveryResult } from '../../core/types';
import { HttpClient } from '../../utils/http-client';
import logger from '../../utils/logger';

export interface PassiveReconConfig {
  apiKeys?: {
    shodan?: string;
    censys?: string;
    securityTrails?: string;
  };
  timeout?: number;
  maxResults?: number;
}

export class PassiveReconManager {
  private config: PassiveReconConfig;
  private httpClient: HttpClient;
  
  constructor(config: PassiveReconConfig = {}) {
    this.config = {
      timeout: 30000,
      maxResults: 1000,
      ...config
    };
    
    this.httpClient = new HttpClient({
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });
  }
  
  async gatherDomainInformation(domain: string): Promise<DiscoveryResult> {
    logger.info(`Starting passive reconnaissance for domain: ${domain}`);
    
    const assets: BaseAsset[] = [];
    const relationships: AssetRelationship[] = [];
    const timestamp = new Date();
    
    try {
      // Start with the main domain as the first asset
      const mainDomainAsset: BaseAsset = {
        id: uuidv4(),
        name: domain,
        type: AssetType.Website,
        discoveredAt: timestamp,
        lastUpdatedAt: timestamp,
        metadata: {
          source: 'initial-input'
        }
      };
      
      assets.push(mainDomainAsset);
      
      // 1. Get subdomains from Certificate Transparency logs
      const subdomains = await this.getSubdomainsFromCertificates(domain);
      
      for (const subdomain of subdomains) {
        const subdomainAsset: BaseAsset = {
          id: uuidv4(),
          name: subdomain,
          type: AssetType.Website,
          discoveredAt: timestamp,
          lastUpdatedAt: timestamp,
          metadata: {
            source: 'certificate-transparency'
          }
        };
        
        assets.push(subdomainAsset);
        
        // Create relationship to main domain
        relationships.push({
          sourceId: mainDomainAsset.id,
          targetId: subdomainAsset.id,
          type: 'parent-domain',
          discoveredAt: timestamp
        });
      }
      
      // 2. Get WHOIS information if API key is available
      const whoisData = await this.getWhoisData(domain);
      if (whoisData) {
        mainDomainAsset.metadata = {
          ...mainDomainAsset.metadata,
          whois: whoisData
        };
      }
      
      // 3. Get DNS records
      const dnsRecords = await this.getDnsRecords(domain);
      for (const record of dnsRecords) {
        if (record.type === 'A' || record.type === 'AAAA') {
          const ipAsset: BaseAsset = {
            id: uuidv4(),
            name: record.value,
            type: AssetType.Server,
            discoveredAt: timestamp,
            lastUpdatedAt: timestamp,
            metadata: {
              source: 'dns-resolution',
              recordType: record.type
            }
          };
          
          assets.push(ipAsset);
          
          // Create relationship between domain and IP
          relationships.push({
            sourceId: mainDomainAsset.id,
            targetId: ipAsset.id,
            type: 'resolves-to',
            discoveredAt: timestamp
          });
        }
      }
      
      // 4. Get Shodan information if API key is available
      if (this.config.apiKeys?.shodan) {
        const shodanResults = await this.getShodanInformation(domain);
        for (const result of shodanResults) {
          // Find the IP asset or create a new one
          let ipAsset = assets.find(a => a.name === result.ip);
          
          if (!ipAsset) {
            ipAsset = {
              id: uuidv4(),
              name: result.ip,
              type: AssetType.Server,
              discoveredAt: timestamp,
              lastUpdatedAt: timestamp,
              metadata: {
                source: 'shodan'
              }
            };
            
            assets.push(ipAsset);
            
            // Create relationship to main domain
            relationships.push({
              sourceId: mainDomainAsset.id,
              targetId: ipAsset.id,
              type: 'relates-to',
              discoveredAt: timestamp
            });
          }
          
          // Add services as assets
          if (result.ports && Array.isArray(result.ports)) {
            for (const port of result.ports) {
              const serviceAsset: BaseAsset = {
                id: uuidv4(),
                name: `${result.ip}:${port}`,
                type: AssetType.API,
                discoveredAt: timestamp,
                lastUpdatedAt: timestamp,
                metadata: {
                  source: 'shodan',
                  port: port,
                  service: result.services?.[port]
                }
              };
              
              assets.push(serviceAsset);
              
              // Create relationship between IP and service
              relationships.push({
                sourceId: ipAsset.id,
                targetId: serviceAsset.id,
                type: 'hosts',
                discoveredAt: timestamp
              });
            }
          }
        }
      }
      
    } catch (error) {
      logger.error(`Error in passive reconnaissance for ${domain}:`, error);
    }
    
    logger.info(`Completed passive reconnaissance for ${domain}. Found ${assets.length} assets and ${relationships.length} relationships.`);
    
    return {
      assets,
      relationships,
      providerName: 'passive-recon',
      scanTime: timestamp
    };
  }
  
  private async getSubdomainsFromCertificates(domain: string): Promise<string[]> {
    try {
      logger.debug(`Getting certificate transparency logs for ${domain}`);
      
      // Use crt.sh for certificate transparency
      const response = await this.httpClient.get(`https://crt.sh/?q=%25.${domain}&output=json`);
      
      if (response.status === 200 && Array.isArray(response.data)) {
        const subdomains = new Set<string>();
        
        for (const cert of response.data) {
          // Extract subdomain from name_value field
          const name = cert.name_value || '';
          if (name && name.endsWith(domain) && name !== domain) {
            subdomains.add(name.toLowerCase());
          }
        }
        
        logger.debug(`Found ${subdomains.size} subdomains from certificates for ${domain}`);
        return Array.from(subdomains);
      }
      
      logger.debug(`No certificate data found for ${domain}`);
      return [];
    } catch (error) {
      logger.error(`Error getting certificate transparency data for ${domain}:`, error);
      return [];
    }
  }
  
  private async getWhoisData(domain: string): Promise<any> {
    try {
      logger.debug(`Getting WHOIS data for ${domain}`);
      
      // Use a public WHOIS API
      const response = await this.httpClient.get(`https://api.whoisfreaks.com/v1.0/whois?apiKey=${this.config.apiKeys?.securityTrails || ''}&domainName=${domain}&type=live`);
      
      if (response.status === 200 && response.data) {
        logger.debug(`Retrieved WHOIS data for ${domain}`);
        return response.data;
      }
      
      logger.debug(`No WHOIS data found for ${domain}`);
      return null;
    } catch (error) {
      logger.error(`Error getting WHOIS data for ${domain}:`, error);
      return null;
    }
  }
  
  private async getDnsRecords(domain: string): Promise<Array<{ type: string, value: string }>> {
    try {
      logger.debug(`Getting DNS records for ${domain}`);
      
      // Use a public DNS API
      const response = await this.httpClient.get(`https://dns.google.com/resolve?name=${domain}&type=A`);
      
      if (response.status === 200 && response.data && response.data.Answer) {
        const records = response.data.Answer.map((ans: any) => ({
          type: ans.type === 1 ? 'A' : ans.type === 28 ? 'AAAA' : `TYPE${ans.type}`,
          value: ans.data
        }));
        
        logger.debug(`Found ${records.length} DNS records for ${domain}`);
        return records;
      }
      
      logger.debug(`No DNS records found for ${domain}`);
      return [];
    } catch (error) {
      logger.error(`Error getting DNS records for ${domain}:`, error);
      return [];
    }
  }
  
  private async getShodanInformation(domain: string): Promise<any[]> {
    if (!this.config.apiKeys?.shodan) {
      logger.debug(`Skipping Shodan lookup for ${domain} - no API key`);
      return [];
    }
    
    try {
      logger.debug(`Getting Shodan information for ${domain}`);
      
      const response = await this.httpClient.get(`https://api.shodan.io/shodan/host/search?key=${this.config.apiKeys.shodan}&query=hostname:${domain}`);
      
      if (response.status === 200 && response.data && response.data.matches) {
        logger.debug(`Found ${response.data.matches.length} Shodan results for ${domain}`);
        return response.data.matches.map((match: any) => ({
          ip: match.ip_str,
          ports: match.ports,
          services: match.data?.reduce((acc: Record<string, any>, service: any) => {
            if (service.port) {
              acc[service.port] = {
                name: service.service,
                product: service.product,
                version: service.version
              };
            }
            return acc;
          }, {})
        }));
      }
      
      logger.debug(`No Shodan data found for ${domain}`);
      return [];
    } catch (error) {
      logger.error(`Error getting Shodan information for ${domain}:`, error);
      return [];
    }
  }
}