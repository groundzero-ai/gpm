/**
 * Tests for path comparison utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import {
  isPathLike,
  expandTilde,
  hasGlobChars,
  comparePathsWithGlobSupport,
  smartEquals,
  smartNotEquals
} from '../../src/utils/path-comparison.js';

describe('path-comparison', () => {
  const originalHomedir = os.homedir();

  describe('isPathLike', () => {
    it('should detect Unix-style paths', () => {
      expect(isPathLike('/usr/local/bin')).toBe(true);
      expect(isPathLike('./relative/path')).toBe(true);
      expect(isPathLike('../parent/path')).toBe(true);
    });

    it('should detect tilde paths', () => {
      expect(isPathLike('~/')).toBe(true);
      expect(isPathLike('~/Documents')).toBe(true);
    });

    it('should detect Windows-style paths', () => {
      expect(isPathLike('C:\\Windows\\System32')).toBe(true);
      expect(isPathLike('D:\\Projects')).toBe(true);
    });

    it('should return false for non-path strings', () => {
      expect(isPathLike('hello')).toBe(false);
      expect(isPathLike('my-package')).toBe(false);
      expect(isPathLike('123')).toBe(false);
      expect(isPathLike('')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isPathLike(123)).toBe(false);
      expect(isPathLike(null)).toBe(false);
      expect(isPathLike(undefined)).toBe(false);
      expect(isPathLike({})).toBe(false);
    });
  });

  describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
      expect(expandTilde('~')).toBe(originalHomedir);
    });

    it('should expand ~/ paths', () => {
      expect(expandTilde('~/Documents')).toBe(path.join(originalHomedir, 'Documents'));
      expect(expandTilde('~/.config')).toBe(path.join(originalHomedir, '.config'));
    });

    it('should not modify paths without tilde', () => {
      expect(expandTilde('/usr/local')).toBe('/usr/local');
      expect(expandTilde('./relative')).toBe('./relative');
      expect(expandTilde('no-tilde')).toBe('no-tilde');
    });

    it('should handle empty strings', () => {
      expect(expandTilde('')).toBe('');
    });
  });

  describe('hasGlobChars', () => {
    it('should detect glob patterns', () => {
      expect(hasGlobChars('*.js')).toBe(true);
      expect(hasGlobChars('file?.txt')).toBe(true);
      expect(hasGlobChars('dir/[abc].md')).toBe(true);
      expect(hasGlobChars('path/{a,b,c}')).toBe(true);
    });

    it('should return false for non-glob strings', () => {
      expect(hasGlobChars('/usr/local/bin')).toBe(false);
      expect(hasGlobChars('~/Documents')).toBe(false);
      expect(hasGlobChars('regular-file.txt')).toBe(false);
    });
  });

  describe('comparePathsWithGlobSupport', () => {
    it('should match exact paths', () => {
      const testPath = path.join(originalHomedir, 'Documents');
      expect(comparePathsWithGlobSupport(testPath, testPath)).toBe(true);
    });

    it('should expand and compare tilde paths', () => {
      const expanded = path.join(originalHomedir);
      expect(comparePathsWithGlobSupport(expanded, '~')).toBe(true);
      expect(comparePathsWithGlobSupport(expanded, '~/')).toBe(true);
    });

    it('should handle path normalization', () => {
      const testPath = '/usr/local/bin';
      expect(comparePathsWithGlobSupport('/usr/local/./bin', testPath)).toBe(true);
      expect(comparePathsWithGlobSupport('/usr/local/lib/../bin', testPath)).toBe(true);
    });

    it('should support glob patterns', () => {
      expect(comparePathsWithGlobSupport('/usr/local/bin', '/usr/*/bin')).toBe(true);
      expect(comparePathsWithGlobSupport('/usr/local/bin', '/usr/local/*')).toBe(true);
      expect(comparePathsWithGlobSupport('/home/user/project', '/home/*/project')).toBe(true);
    });

    it('should handle tilde in glob patterns', () => {
      const userDir = path.join(originalHomedir, 'Projects', 'my-app');
      expect(comparePathsWithGlobSupport(userDir, '~/Projects/*')).toBe(true);
    });

    it('should return false for non-matching paths', () => {
      expect(comparePathsWithGlobSupport('/usr/local/bin', '/opt/bin')).toBe(false);
      expect(comparePathsWithGlobSupport('/home/user1', '/home/user2')).toBe(false);
    });

    it('should return false for non-matching glob patterns', () => {
      expect(comparePathsWithGlobSupport('/usr/local/bin', '/opt/*/bin')).toBe(false);
      expect(comparePathsWithGlobSupport('/home/user/docs', '/home/*/project')).toBe(false);
    });
  });

  describe('smartEquals', () => {
    it('should use path comparison for path-like values', () => {
      const expanded = path.join(originalHomedir);
      expect(smartEquals(expanded, '~')).toBe(true);
      expect(smartEquals('~/', expanded)).toBe(true);
    });

    it('should use standard equality for non-paths', () => {
      expect(smartEquals('hello', 'hello')).toBe(true);
      expect(smartEquals('hello', 'world')).toBe(false);
      expect(smartEquals(123, 123)).toBe(true);
      expect(smartEquals(123, 456)).toBe(false);
    });

    it('should handle mixed types', () => {
      expect(smartEquals('~/Documents', 'hello')).toBe(false);
      expect(smartEquals(123, '/path/to/file')).toBe(false);
    });

    it('should support glob patterns in path comparison', () => {
      expect(smartEquals('/usr/local/bin', '/usr/*/bin')).toBe(true);
      expect(smartEquals('/usr/local/bin', '/opt/*/bin')).toBe(false);
    });
  });

  describe('smartNotEquals', () => {
    it('should return opposite of smartEquals', () => {
      const expanded = path.join(originalHomedir);
      expect(smartNotEquals(expanded, '~')).toBe(false);
      expect(smartNotEquals('hello', 'world')).toBe(true);
      expect(smartNotEquals('/usr/local/bin', '/usr/*/bin')).toBe(false);
      expect(smartNotEquals('/usr/local/bin', '/opt/*/bin')).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle global installation check', () => {
      // Simulate checking if targetRoot is home directory
      const targetRoot = originalHomedir;
      expect(smartEquals(targetRoot, '~/')).toBe(true);
      expect(smartEquals(targetRoot, '~')).toBe(true);
      expect(smartNotEquals(targetRoot, '~/')).toBe(false);
    });

    it('should handle workspace installation check', () => {
      // Simulate checking if targetRoot is NOT home directory
      const targetRoot = '/Users/john/my-project';
      expect(smartNotEquals(targetRoot, '~/')).toBe(true);
      expect(smartEquals(targetRoot, '~/')).toBe(false);
    });

    it('should handle pattern-based checks', () => {
      // Check if in Projects folder
      const projectPath = '/Users/john/Projects/my-app';
      expect(smartEquals(projectPath, '/Users/*/Projects/*')).toBe(true);
      
      // Check if in temp directory
      const tempPath = '/tmp/test-workspace';
      expect(smartEquals(tempPath, '/tmp/*')).toBe(true);
    });
  });
});
