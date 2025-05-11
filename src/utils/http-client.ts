// src/utils/http-client.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from './logger';

export interface HttpClientOptions {
  timeout?: number;
  headers?: Record<string, string>;
  proxy?: string;
  followRedirects?: boolean;
  userAgent?: string;
}

export class HttpClient {
  private client: AxiosInstance;
  
  constructor(options?: HttpClientOptions) {
    this.client = axios.create({
      timeout: options?.timeout || 10000,
      headers: {
        'User-Agent': options?.userAgent || 'EASM-Scanner/1.0',
        ...options?.headers
      },
      proxy: options?.proxy ? {
        host: options.proxy.split(':')[0],
        port: parseInt(options.proxy.split(':')[1], 10)
      } : undefined,
      maxRedirects: options?.followRedirects ? 5 : 0
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use((config) => {
      logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`HTTP Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.debug(`HTTP Error: ${error.response.status} ${error.config?.url}`);
        } else {
          logger.debug(`HTTP Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }
  
  async get(url: string, options?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      return await this.client.get(url, {
        ...options,
        validateStatus: () => true // Accept any status code
      });
    } catch (error) {
      logger.error(`Error in HTTP GET request to ${url}:`, error);
      throw error;
    }
  }
  
  async post(url: string, data: any, options?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      return await this.client.post(url, data, {
        ...options,
        validateStatus: () => true // Accept any status code
      });
    } catch (error) {
      logger.error(`Error in HTTP POST request to ${url}:`, error);
      throw error;
    }
  }
  
  async head(url: string, options?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      return await this.client.head(url, {
        ...options,
        validateStatus: () => true
      });
    } catch (error) {
      logger.error(`Error in HTTP HEAD request to ${url}:`, error);
      throw error;
    }
  }
  
  async put(url: string, data: any, options?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      return await this.client.put(url, data, {
        ...options,
        validateStatus: () => true
      });
    } catch (error) {
      logger.error(`Error in HTTP PUT request to ${url}:`, error);
      throw error;
    }
  }
}