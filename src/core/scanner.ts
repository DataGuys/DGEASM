// src/core/scanner.ts
import { SecurityPlugin } from './plugin';
import { ScanTarget, ScanResult, ScanOptions, SecurityIssue, SeverityLevel } from './types';
import logger from '../utils/logger';
import { Worker } from 'worker_threads';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export class SecurityScanner {
  private plugins: SecurityPlugin[] = [];
  private rateLimiter: RateLimiterMemory;
  
  constructor(options?: { maxConcurrency?: number }) {
    // Setup rate limiter to control concurrency
    this.rateLimiter = new RateLimiterMemory({
      points: options?.maxConcurrency || 10, // Maximum concurrent scans
      duration: 1, // Per second
    });
  }
  
  registerPlugin(plugin: SecurityPlugin): void {
    logger.info(`Registering plugin: ${plugin.name}`);
    this.plugins.push(plugin);
  }
  
  async scan(target: ScanTarget, options?: ScanOptions): Promise<ScanResult> {
    const issues: SecurityIssue[] = [];
    const startTime = Date.now();
    
    logger.info(`Starting scan for target: ${JSON.stringify(target)}`);
    
    try {
      // Consume a point from the rate limiter
      await this.rateLimiter.consume('scan');
      
      // Execute all plugins concurrently with Promise.all
      const pluginPromises = this.plugins.map(plugin => 
        this.executePluginWithRetry(plugin, target, options)
          .catch(error => {
            logger.error(`Error executing plugin ${plugin.name}:`, error);
            return [];
          })
      );
      
      const pluginResults = await Promise.all(pluginPromises);
      
      // Flatten results from all plugins
      for (const result of pluginResults) {
        issues.push(...result);
      }
      
    } catch (error) {
      logger.error(`Rate limit exceeded for scan, retrying...`);
      // Wait and retry if rate limited
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.scan(target, options);
    }
    
    const scanDuration = Date.now() - startTime;
    
    const result: ScanResult = {
      target,
      issues,
      timestamp: new Date(),
      scanDuration,
      summary: this.summarizeIssues(issues)
    };
    
    logger.info(`Scan completed for target: ${JSON.stringify(target)}. Found ${issues.length} issues.`);
    
    return result;
  }
  
  private async executePluginWithRetry(
    plugin: SecurityPlugin, 
    target: ScanTarget, 
    options?: ScanOptions, 
    retryCount = 3
  ): Promise<SecurityIssue[]> {
    try {
      logger.debug(`Executing plugin: ${plugin.name}`);
      return await plugin.execute(target, options);
    } catch (error) {
      if (retryCount > 0) {
        logger.warn(`Retrying plugin ${plugin.name} (${retryCount} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.executePluginWithRetry(plugin, target, options, retryCount - 1);
      }
      throw error;
    }
  }
  
  private summarizeIssues(issues: SecurityIssue[]): { 
    totalIssues: number, 
    criticalCount: number, 
    highCount: number, 
    mediumCount: number, 
    lowCount: number, 
    infoCount: number 
  } {
    return {
      totalIssues: issues.length,
      criticalCount: issues.filter(i => i.severity === SeverityLevel.Critical).length,
      highCount: issues.filter(i => i.severity === SeverityLevel.High).length,
      mediumCount: issues.filter(i => i.severity === SeverityLevel.Medium).length,
      lowCount: issues.filter(i => i.severity === SeverityLevel.Low).length,
      infoCount: issues.filter(i => i.severity === SeverityLevel.Info).length
    };
  }
  
  // Method to distribute scans across worker threads for CPU-intensive operations
  private processWithWorkerThread(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./dist/workers/scanner-worker.js', {
        workerData: data
      });
      
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}