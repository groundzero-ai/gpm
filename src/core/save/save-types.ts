import type { Platform } from '../platforms.js';

export type SaveCandidateSource = 'local' | 'workspace';

export interface SaveCandidate {
  source: SaveCandidateSource;
  registryPath: string;
  fullPath: string;
  content: string;
  contentHash: string;
  mtime: number;
  displayPath: string;
  /** Root file section body when applicable */
  sectionBody?: string;
  /** Indicates the candidate represents a root file chunk */
  isRootFile?: boolean;
  /** Original file content when different from `content` */
  originalContent?: string;
  /** Indicates the candidate maps back to a specific platform */
  platform?: Platform | 'ai';
  /** The parsed YAML frontmatter when file is markdown */
  frontmatter?: any;
  /** Raw frontmatter block text (without delimiters) */
  rawFrontmatter?: string;
  /** Markdown body without frontmatter */
  markdownBody?: string;
  /** Tracks whether the candidate originates from a markdown file */
  isMarkdown?: boolean;
}

export interface SaveCandidateGroup {
  registryPath: string;
  local?: SaveCandidate;
  workspace: SaveCandidate[];
}

export type ResolutionStrategy =
  | 'skip'
  | 'write-single'
  | 'write-newest'
  | 'interactive'
  | 'force-newest';

export interface ResolutionResult {
  selection: SaveCandidate | null; // null if only platform-specific variants selected
  platformSpecific: SaveCandidate[];
  strategy: ResolutionStrategy;
  wasInteractive: boolean;
}

export interface WriteOperation {
  registryPath: string;
  targetPath: string;
  content: string;
  operation: 'create' | 'update' | 'skip';
  isPlatformSpecific: boolean;
  platform?: string;
}

export interface WriteResult {
  operation: WriteOperation;
  success: boolean;
  error?: Error;
}

// DEPRECATED: Use ResolutionResult instead
export interface SaveConflictResolution {
  selection: SaveCandidate;
  platformSpecific: SaveCandidate[];
}
