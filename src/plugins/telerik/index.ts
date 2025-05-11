// src/plugins/telerik/index.ts
import { SecurityPlugin } from '../../core/plugin';
import { ScanTarget, SecurityIssue, SeverityLevel, ScanOptions } from '../../core/types';
import { HttpClient } from '../../utils/http-client';
import logger from '../../utils/logger';

interface VulnerableVersion {
  cveId: string;
  versions: string[];
  description: string;
  severity: SeverityLevel;
}

export class TelerikScanner implements SecurityPlugin {
  id = 'telerik-scanner';
  name = 'Telerik UI Vulnerability Scanner';
  description = 'Scans for vulnerabilities in Telerik UI components';
  
  // Known vulnerable versions of Telerik UI
  private vulnerableVersions: VulnerableVersion[] = [
    {
      cveId: 'CVE-2019-18935',
      versions: ['2019.3.1023', '2019.2.514', '2019.1.115', '2018.3.910', '2018.2.710'], // and older
      description: 'Remote code execution vulnerability in RadAsyncUpload function',
      severity: SeverityLevel.Critical
    },
    {
      cveId: 'CVE-2017-11317',
      versions: ['2017.2.621', '2017.1.228', '2016.3.1027'], // and older
      description: 'Insecure deserialization vulnerability in RadAsyncUpload',
      severity: SeverityLevel.High
    },
    {
      cveId: 'CVE-2017-9248',
      versions: ['2017.2.621', '2017.1.228', '2016.3.1027'], // and older
      description: 'Cryptographic weakness in Telerik UI for ASP.NET AJAX',
      severity: SeverityLevel.High
    }
  ];
  
  // Telerik component indicators
  private telerikIndicators: string[] = [
    'Telerik.Web.UI.WebResource.axd',
    'Telerik.Web.UI.DialogHandler.aspx',
    'Telerik.Web.UI.SpellCheckHandler.axd',
    '/WebResource.axd?d=',
    'ScriptResource.axd'
  ];
  
  async execute(target: ScanTarget, options?: ScanOptions): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    if (!target.url) {
      logger.warn('Telerik scanner requires a URL target');
      return issues;
    }
    
    const baseUrl = target.url;
    const httpClient = new HttpClient({
      timeout: options?.timeout || 10000,
      headers: options?.headers,
      proxy: options?.proxy,
      followRedirects: options?.followRedirects,
      userAgent: options?.userAgent
    });
    
    logger.info(`Starting Telerik UI scan for: ${baseUrl}`);
    
    try {
      // Step 1: Check for Telerik presence
      logger.debug(`Checking for Telerik UI presence at ${baseUrl}`);
      const telerikPresent = await this.detectTelerikPresence(baseUrl, httpClient);
      if (!telerikPresent) {
        logger.debug(`No Telerik UI components detected at ${baseUrl}`);
        return issues;
      }
      
      logger.info(`Telerik UI components detected at ${baseUrl}`);
      
      // Step 2: Try to detect version
      logger.debug(`Attempting to identify Telerik UI version at ${baseUrl}`);
      const versionInfo = await this.detectVersion(baseUrl, httpClient);
      if (versionInfo) {
        logger.info(`Detected Telerik UI version: ${versionInfo}`);
        
        // Step 3: Check if the detected version is vulnerable
        const vulnerabilities = this.checkVulnerableVersion(versionInfo);
        for (const vuln of vulnerabilities) {
          issues.push({
            id: `telerik-${vuln.cveId}-${Date.now()}`,
            title: `Vulnerable Telerik UI Component (${vuln.cveId})`,
            description: vuln.description,
            severity: vuln.severity,
            cwe: 'CWE-502', // Deserialization of Untrusted Data
            location: {
              url: baseUrl
            },
            remediation: 'Update Telerik UI components to the latest version.',
            references: [
              `https://nvd.nist.gov/vuln/detail/${vuln.cveId}`,
              'https://www.telerik.com/support/kb/aspnet-ajax/details/security-advisory'
            ],
            metadata: {
              detectedVersion: versionInfo
            }
          });
        }
      }
      
      // Step 4: Test for vulnerable RadAsyncUpload handler
      logger.debug(`Testing for vulnerable RadAsyncUpload handler at ${baseUrl}`);
      const asyncUploadVuln = await this.testRadAsyncUploadHandler(baseUrl, httpClient);
      if (asyncUploadVuln) {
        issues.push(asyncUploadVuln);
      }
      
      // Step 5: Test for DialogHandler vulnerability
      logger.debug(`Testing for DialogHandler vulnerability at ${baseUrl}`);
      const dialogHandlerVuln = await this.testDialogHandler(baseUrl, httpClient);
      if (dialogHandlerVuln) {
        issues.push(dialogHandlerVuln);
      }
      
    } catch (error) {
      logger.error(`Error scanning for Telerik vulnerabilities:`, error);
    }
    
    logger.info(`Completed Telerik UI scan for: ${baseUrl}, found ${issues.length} issues`);
    return issues;
  }
  
  private async detectTelerikPresence(baseUrl: string, httpClient: HttpClient): Promise<boolean> {
    // Check homepage for Telerik script references
    try {
      const response = await httpClient.get(baseUrl);
      const content = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
        
      if (content.includes('Telerik.Web.UI') || 
          content.includes('telerik.web') || 
          content.includes('RadAjaxPanel') ||
          content.includes('RadScriptManager')) {
        return true;
      }
      
      // Check for specific Telerik URLs
      for (const indicator of this.telerikIndicators) {
        const testUrl = `${baseUrl}${indicator.startsWith('/') ? '' : '/'}${indicator}`;
        const testResponse = await httpClient.get(testUrl);
        
        if (testResponse.status === 200 || testResponse.status === 302) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking for Telerik presence:`, error);
      return false;
    }
  }
  
  private async detectVersion(baseUrl: string, httpClient: HttpClient): Promise<string | null> {
    try {
      // Try to get version from ScriptResource.axd
      const scriptResourceUrl = `${baseUrl}/ScriptResource.axd?d=`;
      const response = await httpClient.get(scriptResourceUrl);
      
      if (response.status === 200) {
        const contentString = typeof response.data === 'string' 
          ? response.data 
          : JSON.stringify(response.data);
          
        // Look for version pattern in the script
        const versionMatch = contentString.match(/Telerik\.Web\.UI,\s*Version=([\d\.]+)/i);
        if (versionMatch && versionMatch[1]) {
          return versionMatch[1];
        }
      }
      
      // Try to get version from main page
      const mainResponse = await httpClient.get(baseUrl);
      if (mainResponse.status === 200) {
        const contentString = typeof mainResponse.data === 'string' 
          ? mainResponse.data 
          : JSON.stringify(mainResponse.data);
          
        // Look for version in script references
        const scriptMatch = contentString.match(/Telerik\.Web\.UI.*?(\d+\.\d+\.\d+\.\d+)/i);
        if (scriptMatch && scriptMatch[1]) {
          return scriptMatch[1];
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Error detecting Telerik version:`, error);
      return null;
    }
  }
  
  private checkVulnerableVersion(version: string): VulnerableVersion[] {
    const vulnerabilities: VulnerableVersion[] = [];
    
    // Convert version string to components for comparison
    const versionComponents = version.split('.').map(Number);
    
    for (const vuln of this.vulnerableVersions) {
      for (const vulnVersion of vuln.versions) {
        const vulnComponents = vulnVersion.split('.').map(Number);
        
        // Compare version components
        let isVulnerable = true;
        for (let i = 0; i < Math.min(versionComponents.length, vulnComponents.length); i++) {
          if (versionComponents[i] < vulnComponents[i]) {
            isVulnerable = false;
            break;
          } else if (versionComponents[i] > vulnComponents[i]) {
            break;
          }
        }
        
        if (isVulnerable) {
          vulnerabilities.push(vuln);
          break; // No need to check other versions for this vulnerability
        }
      }
    }
    
    return vulnerabilities;
  }
  
  private async testRadAsyncUploadHandler(baseUrl: string, httpClient: HttpClient): Promise<SecurityIssue | null> {
    try {
      const handlerUrls = [
        '/Telerik.Web.UI.WebResource.axd?type=rau',
        '/aspx/Telerik.Web.UI.WebResource.axd?type=rau',
        '/desktopmodules/telerik/radeditorprovider/Telerik.Web.UI.WebResource.axd?type=rau'
      ];
      
      for (const handlerUrl of handlerUrls) {
        const fullUrl = `${baseUrl}${handlerUrl}`;
        const response = await httpClient.get(fullUrl);
        
        if (response.status === 200) {
          return {
            id: `telerik-rau-handler-${Date.now()}`,
            title: 'Exposed RadAsyncUpload Handler',
            description: 'The Telerik RadAsyncUpload handler is accessible, which may indicate vulnerability to CVE-2019-18935 or similar issues if the version is vulnerable.',
            severity: SeverityLevel.High,
            cwe: 'CWE-434', // Unrestricted Upload of File with Dangerous Type
            location: {
              url: fullUrl
            },
            remediation: 'Update Telerik UI components to the latest version and ensure proper access controls for handlers.',
            references: [
              'https://nvd.nist.gov/vuln/detail/CVE-2019-18935',
              'https://www.telerik.com/support/kb/aspnet-ajax/upload-(async)/details/unrestricted-file-upload'
            ]
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Error testing RadAsyncUpload handler:`, error);
      return null;
    }
  }
  
  private async testDialogHandler(baseUrl: string, httpClient: HttpClient): Promise<SecurityIssue | null> {
    try {
      const handlerUrls = [
        '/Telerik.Web.UI.DialogHandler.aspx',
        '/aspx/Telerik.Web.UI.DialogHandler.aspx'
      ];
      
      for (const handlerUrl of handlerUrls) {
        const fullUrl = `${baseUrl}${handlerUrl}`;
        const response = await httpClient.get(fullUrl);
        
        if (response.status === 200) {
          return {
            id: `telerik-dialog-handler-${Date.now()}`,
            title: 'Exposed Telerik DialogHandler',
            description: 'The Telerik DialogHandler is accessible, which may indicate vulnerability to dialog-based attacks in older versions of Telerik UI.',
            severity: SeverityLevel.Medium,
            cwe: 'CWE-20', // Improper Input Validation
            location: {
              url: fullUrl
            },
            remediation: 'Update Telerik UI components to the latest version and ensure proper access controls for handlers.',
            references: [
              'https://www.telerik.com/support/kb/aspnet-ajax/details/security-advisory'
            ]
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Error testing DialogHandler:`, error);
      return null;
    }
  }
}