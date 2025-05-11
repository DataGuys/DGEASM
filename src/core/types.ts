// src/core/types.ts

export enum AssetType {
  Website = 'website',
  API = 'api',
  Server = 'server',
  Database = 'database',
  CloudService = 'cloudService',
  NetworkDevice = 'networkDevice',
  Container = 'container',
  Function = 'function'
}

export enum SeverityLevel {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Info = 'info'
}

export interface BaseAsset {
  id: string;
  name: string;
  type: AssetType;
  discoveredAt: Date;
  lastUpdatedAt: Date;
  metadata?: Record<string, any>;
}

export interface AssetRelationship {
  sourceId: string;
  targetId: string;
  type: string;
  discoveredAt: Date;
  metadata?: Record<string, any>;
}

export interface ScanTarget {
  url?: string;
  ip?: string;
  domain?: string;
  assetId?: string;
}

export interface SecurityIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  cwe?: string;
  location: {
    url?: string;
    file?: string;
    line?: number;
    column?: number;
    function?: string;
  };
  remediation?: string;
  references?: string[];
  metadata?: Record<string, any>;
}

export interface ScanOptions {
  timeout?: number;
  depth?: number;
  concurrency?: number;
  userAgent?: string;
  followRedirects?: boolean;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  proxy?: string;
}

export interface ScanResult {
  target: ScanTarget;
  issues: SecurityIssue[];
  timestamp: Date;
  scanDuration?: number;
  metadata?: Record<string, any>;
  summary?: ScanSummary;
}

export interface ScanSummary {
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
}

export interface DiscoveryResult {
  assets: BaseAsset[];
  relationships: AssetRelationship[];
  providerName: string;
  scanTime: Date;
}

export interface Vulnerability {
  type: string;
  url: string;
  severity: string;
  evidence: string;
  remediation: string;
}