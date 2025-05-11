// src/core/plugin.ts
import { ScanTarget, SecurityIssue, ScanOptions } from './types';

export interface SecurityPlugin {
  id: string;
  name: string;
  description: string;
  execute(target: ScanTarget, options?: ScanOptions): Promise<SecurityIssue[]>;
}