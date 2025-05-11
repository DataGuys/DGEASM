// src/plugins/web-config/index.ts
import { SecurityPlugin } from '../../core/plugin';
import { ScanTarget, SecurityIssue, SeverityLevel, ScanOptions } from '../../core/types';
import { HttpClient } from '../../utils/http-client';
import logger from '../../utils/logger';

export class WebConfigScanner implements SecurityPlugin {
  id = 'web-config-scanner';
  name = 'Web.config Exposure Scanner';
  description = 'Scans for exposed web.config files that may contain sensitive configuration data';
  
  private targets: string[] = [
    '/web.config',
    '/config/web.config',
    '/.././web.config',
    '/app/web.config',
    '/website/web.config',
    '/wwwroot/web.config'
  ];
  
  private patterns: RegExp[] = [
    /<connectionStrings>/i,
    /<appSettings>/i,
    /<configuration xmlns=/i,
    /<system\.webServer>/i,
    /<authentication mode=/i,
    /<compilation debug=/i
  ];
  
  async execute(target: ScanTarget, options?: ScanOptions): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    if (!target.url) {
      logger.warn('Web.config scanner requires a URL target');
      return issues;
    }
    
    const baseUrl = target.url;
    const httpClient = new HttpClient({
      timeout: options?.timeout || 5000,
      headers: options?.headers,
      proxy: options?.proxy,
      followRedirects: options?.followRedirects,
      userAgent: options?.userAgent
    });
    
    logger.info(`Starting web.config scan for: ${baseUrl}`);
    
    // First try with path traversal variants
    for (const path of this.targets) {
      try {
        const url = `${baseUrl}${path}`;
        logger.debug(`Scanning ${url} for web.config exposure`);
        
        const response = await httpClient.get(url);
        
        // Check if the response contains web.config patterns
        if (response.status === 200) {
          const content = typeof response.data === 'string' 
            ? response.data 
            : JSON.stringify(response.data);
            
          for (const pattern of this.patterns) {
            if (pattern.test(content)) {
              issues.push({
                id: `web-config-exposure-${Date.now()}`,
                title: 'Exposed web.config Configuration File',
                description: 'A Microsoft ASP.NET web.config file was found exposed on the web server. This file may contain sensitive configuration data including connection strings, authentication keys, and application settings.',
                severity: SeverityLevel.High,
                cwe: 'CWE-538', // Exposure of Sensitive Information
                location: {
                  url: url
                },
                remediation: 'Configure web server to prevent access to configuration files by adding appropriate rules in web.config or through server configuration.',
                references: [
                  'https://learn.microsoft.com/en-us/aspnet/core/security/preventing-open-redirects',
                  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information'
                ],
                metadata: {
                  evidence: content.substring(0, 200) + '...',
                  responseSize: content.length,
                  statusCode: response.status
                }
              });
              break;
            }
          }
        }
      } catch (error) {
        logger.error(`Error scanning ${baseUrl}${path}:`, error);
      }
    }
    
    // Now try with URL encoding variations
    const encodedPaths = [
      '/%77%65%62%2e%63%6f%6e%66%69%67', // /web.config URL encoded
      '/w%65b.config',                    // Partial encoding
      '/%2e%2e/%2e%2e/web.config'         // Path traversal encoded
    ];
    
    for (const path of encodedPaths) {
      try {
        const url = `${baseUrl}${path}`;
        logger.debug(`Scanning ${url} for encoded web.config exposure`);
        
        const response = await httpClient.get(url);
        
        // Check if the response contains web.config patterns
        if (response.status === 200) {
          const content = typeof response.data === 'string' 
            ? response.data 
            : JSON.stringify(response.data);
            
          for (const pattern of this.patterns) {
            if (pattern.test(content)) {
              issues.push({
                id: `web-config-exposure-encoded-${Date.now()}`,
                title: 'Exposed web.config via URL Encoding',
                description: 'A Microsoft ASP.NET web.config file was accessible using URL encoding techniques, potentially bypassing security controls.',
                severity: SeverityLevel.Critical,
                cwe: 'CWE-22', // Path Traversal
                location: {
                  url: url
                },
                remediation: 'Configure web server to properly handle URL encoded paths and prevent access to configuration files.',
                references: [
                  'https://owasp.org/www-community/attacks/Path_Traversal',
                  'https://learn.microsoft.com/en-us/aspnet/core/security/preventing-open-redirects'
                ],
                metadata: {
                  evidence: content.substring(0, 200) + '...',
                  encodedPath: path,
                  responseSize: content.length,
                  statusCode: response.status
                }
              });
              break;
            }
          }
        }
      } catch (error) {
        logger.error(`Error scanning encoded path ${baseUrl}${path}:`, error);
      }
    }
    
    logger.info(`Completed web.config scan for: ${baseUrl}, found ${issues.length} issues`);
    return issues;
  }
}