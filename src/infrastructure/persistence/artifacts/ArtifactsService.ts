/**
 * Artifacts Service
 * Manages storage and retrieval of test artifacts:
 * - Screenshots
 * - Videos
 * - Traces
 * - Logs
 * - Reports
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../../../core/config';
import { createLogger, WinstonLogger } from '../../logging/winston.logger';
import { ArtifactInfo } from '../../../api/dto/execution.dto';

// Create a logger instance for this module
const logger = createLogger({
  level: 'info',
  format: 'json',
  serviceName: 'artifacts-service',
});

/**
 * Artifact type
 */
export type ArtifactType = 'screenshot' | 'video' | 'trace' | 'log' | 'report';

/**
 * Artifact metadata
 */
export interface ArtifactMetadata {
  /** Artifact ID */
  id: string;
  /** Test plan ID */
  testPlanId: string;
  /** Item ID (scenario) */
  itemId?: string;
  /** Step ID or index */
  stepId?: string;
  /** Artifact type */
  type: ArtifactType;
  /** Original filename */
  fileName: string;
  /** File path relative to artifacts root */
  relativePath: string;
  /** Absolute file path */
  absolutePath: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create artifact input
 */
export interface CreateArtifactInput {
  /** Test plan ID */
  testPlanId: string;
  /** Item ID (optional) */
  itemId?: string;
  /** Step ID (optional) */
  stepId?: string;
  /** Artifact type */
  type: ArtifactType;
  /** File content (Buffer or Base64 string) */
  content: Buffer | string;
  /** Original filename */
  fileName?: string;
  /** Description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * List artifacts filter
 */
export interface ListArtifactsFilter {
  /** Test plan ID */
  testPlanId: string;
  /** Filter by type */
  type?: ArtifactType;
  /** Filter by item ID */
  itemId?: string;
  /** Filter by step ID */
  stepId?: string;
}

/**
 * MIME types by artifact type
 */
const MIME_TYPES: Record<ArtifactType, string> = {
  screenshot: 'image/png',
  video: 'video/webm',
  trace: 'application/zip',
  log: 'text/plain',
  report: 'text/html',
};

/**
 * File extensions by artifact type
 */
const EXTENSIONS: Record<ArtifactType, string> = {
  screenshot: 'png',
  video: 'webm',
  trace: 'zip',
  log: 'txt',
  report: 'html',
};

/**
 * Artifacts Service
 */
export class ArtifactsService {
  private artifactsRoot: string;
  private artifactIndex: Map<string, ArtifactMetadata> = new Map();
  private testPlanArtifacts: Map<string, Set<string>> = new Map();

  constructor(artifactsRoot?: string) {
    this.artifactsRoot = artifactsRoot || path.join(process.cwd(), 'artifacts');
    this.ensureDirectoryExists(this.artifactsRoot);
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Get directory for a test plan
   */
  private getTestPlanDir(testPlanId: string): string {
    return path.join(this.artifactsRoot, testPlanId);
  }

  /**
   * Get directory for artifact type within a test plan
   */
  private getTypeDir(testPlanId: string, type: ArtifactType): string {
    return path.join(this.getTestPlanDir(testPlanId), type + 's');
  }

  /**
   * Generate artifact filename
   */
  private generateFileName(
    type: ArtifactType,
    itemId?: string,
    stepId?: string,
    originalName?: string
  ): string {
    const timestamp = Date.now();
    const ext = EXTENSIONS[type];
    
    if (originalName) {
      const baseName = path.basename(originalName, path.extname(originalName));
      return `${baseName}_${timestamp}.${ext}`;
    }

    const parts: string[] = [type];
    if (itemId) parts.push(itemId.slice(0, 8));
    if (stepId) parts.push(`step${stepId}`);
    parts.push(timestamp.toString());
    
    return `${parts.join('_')}.${ext}`;
  }

  /**
   * Create and save an artifact
   */
  async createArtifact(input: CreateArtifactInput): Promise<ArtifactMetadata> {
    const { testPlanId, itemId, stepId, type, content, fileName, description, metadata } = input;

    // Ensure directories exist
    const typeDir = this.getTypeDir(testPlanId, type);
    await this.ensureDirectoryExists(typeDir);

    // Generate filename and paths
    const artifactId = uuidv4();
    const generatedFileName = this.generateFileName(type, itemId, stepId, fileName);
    const absolutePath = path.join(typeDir, generatedFileName);
    const relativePath = path.relative(this.artifactsRoot, absolutePath);

    // Convert content to buffer if needed
    let buffer: Buffer;
    if (typeof content === 'string') {
      // Assume base64 encoded
      buffer = Buffer.from(content, 'base64');
    } else {
      buffer = content;
    }

    // Write file
    await fs.writeFile(absolutePath, buffer);

    // Get file stats
    const stats = await fs.stat(absolutePath);

    // Create metadata
    const artifactMetadata: ArtifactMetadata = {
      id: artifactId,
      testPlanId,
      itemId,
      stepId,
      type,
      fileName: generatedFileName,
      relativePath,
      absolutePath,
      size: stats.size,
      mimeType: MIME_TYPES[type],
      createdAt: new Date(),
      description,
      metadata,
    };

    // Index artifact
    this.artifactIndex.set(artifactId, artifactMetadata);
    
    // Index by test plan
    if (!this.testPlanArtifacts.has(testPlanId)) {
      this.testPlanArtifacts.set(testPlanId, new Set());
    }
    this.testPlanArtifacts.get(testPlanId)!.add(artifactId);

    logger.debug(`Created artifact: ${artifactId} (${type}) for test plan ${testPlanId}`);

    return artifactMetadata;
  }

  /**
   * Save a screenshot
   */
  async saveScreenshot(
    testPlanId: string,
    content: Buffer | string,
    itemId?: string,
    stepId?: string,
    description?: string
  ): Promise<ArtifactMetadata> {
    return this.createArtifact({
      testPlanId,
      itemId,
      stepId,
      type: 'screenshot',
      content,
      description,
    });
  }

  /**
   * Save a video
   */
  async saveVideo(
    testPlanId: string,
    content: Buffer | string,
    itemId?: string,
    description?: string
  ): Promise<ArtifactMetadata> {
    return this.createArtifact({
      testPlanId,
      itemId,
      type: 'video',
      content,
      description,
    });
  }

  /**
   * Save a trace file
   */
  async saveTrace(
    testPlanId: string,
    content: Buffer | string,
    itemId?: string,
    description?: string
  ): Promise<ArtifactMetadata> {
    return this.createArtifact({
      testPlanId,
      itemId,
      type: 'trace',
      content,
      description,
    });
  }

  /**
   * Save a log file
   */
  async saveLog(
    testPlanId: string,
    content: string,
    itemId?: string,
    description?: string
  ): Promise<ArtifactMetadata> {
    return this.createArtifact({
      testPlanId,
      itemId,
      type: 'log',
      content: Buffer.from(content, 'utf-8'),
      description,
    });
  }

  /**
   * Save an HTML report
   */
  async saveReport(
    testPlanId: string,
    content: string,
    description?: string
  ): Promise<ArtifactMetadata> {
    return this.createArtifact({
      testPlanId,
      type: 'report',
      content: Buffer.from(content, 'utf-8'),
      description,
    });
  }

  /**
   * Get artifact by ID
   */
  async getArtifact(artifactId: string): Promise<ArtifactMetadata | undefined> {
    return this.artifactIndex.get(artifactId);
  }

  /**
   * Get artifact content
   */
  async getArtifactContent(artifactId: string): Promise<Buffer | undefined> {
    const artifact = this.artifactIndex.get(artifactId);
    if (!artifact) return undefined;

    try {
      return await fs.readFile(artifact.absolutePath);
    } catch (error) {
      logger.error(`Failed to read artifact ${artifactId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }

  /**
   * Get artifact as base64
   */
  async getArtifactBase64(artifactId: string): Promise<string | undefined> {
    const content = await this.getArtifactContent(artifactId);
    return content?.toString('base64');
  }

  /**
   * List artifacts for a test plan
   */
  async listArtifacts(filter: ListArtifactsFilter): Promise<ArtifactMetadata[]> {
    const { testPlanId, type, itemId, stepId } = filter;

    const artifactIds = this.testPlanArtifacts.get(testPlanId);
    if (!artifactIds) return [];

    let artifacts = Array.from(artifactIds)
      .map(id => this.artifactIndex.get(id))
      .filter((a): a is ArtifactMetadata => a !== undefined);

    // Apply filters
    if (type) {
      artifacts = artifacts.filter(a => a.type === type);
    }
    if (itemId) {
      artifacts = artifacts.filter(a => a.itemId === itemId);
    }
    if (stepId) {
      artifacts = artifacts.filter(a => a.stepId === stepId);
    }

    // Sort by creation date (newest first)
    return artifacts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get total size of artifacts for a test plan
   */
  async getTotalSize(testPlanId: string): Promise<number> {
    const artifacts = await this.listArtifacts({ testPlanId });
    return artifacts.reduce((sum, a) => sum + a.size, 0);
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(artifactId: string): Promise<boolean> {
    const artifact = this.artifactIndex.get(artifactId);
    if (!artifact) return false;

    try {
      // Delete file
      await fs.unlink(artifact.absolutePath);

      // Remove from indexes
      this.artifactIndex.delete(artifactId);
      this.testPlanArtifacts.get(artifact.testPlanId)?.delete(artifactId);

      logger.debug(`Deleted artifact: ${artifactId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete artifact ${artifactId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Delete all artifacts for a test plan
   */
  async deleteTestPlanArtifacts(testPlanId: string): Promise<number> {
    const artifacts = await this.listArtifacts({ testPlanId });
    let deleted = 0;

    for (const artifact of artifacts) {
      if (await this.deleteArtifact(artifact.id)) {
        deleted++;
      }
    }

    // Try to remove the test plan directory
    try {
      const testPlanDir = this.getTestPlanDir(testPlanId);
      await fs.rm(testPlanDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }

    this.testPlanArtifacts.delete(testPlanId);
    logger.info(`Deleted ${deleted} artifacts for test plan ${testPlanId}`);

    return deleted;
  }

  /**
   * Convert metadata to API response format
   */
  toArtifactInfo(metadata: ArtifactMetadata): ArtifactInfo {
    return {
      id: metadata.id,
      type: metadata.type,
      fileName: metadata.fileName,
      size: metadata.size,
      mimeType: metadata.mimeType,
      path: metadata.relativePath,
      itemId: metadata.itemId,
      stepId: metadata.stepId,
      capturedAt: metadata.createdAt,
      description: metadata.description,
    };
  }

  /**
   * Get artifacts root path
   */
  getArtifactsRoot(): string {
    return this.artifactsRoot;
  }

  /**
   * Clean up old artifacts (older than specified days)
   */
  async cleanupOldArtifacts(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deleted = 0;

    for (const [artifactId, artifact] of this.artifactIndex) {
      if (artifact.createdAt < cutoffDate) {
        if (await this.deleteArtifact(artifactId)) {
          deleted++;
        }
      }
    }

    logger.info(`Cleaned up ${deleted} old artifacts (older than ${olderThanDays} days)`);
    return deleted;
  }
}

// Singleton instance
let artifactsServiceInstance: ArtifactsService | null = null;

/**
 * Get or create the artifacts service instance
 */
export function getArtifactsService(artifactsRoot?: string): ArtifactsService {
  if (!artifactsServiceInstance) {
    artifactsServiceInstance = new ArtifactsService(artifactsRoot);
  }
  return artifactsServiceInstance;
}

/**
 * Reset the artifacts service (mainly for testing)
 */
export function resetArtifactsService(): void {
  artifactsServiceInstance = null;
}
