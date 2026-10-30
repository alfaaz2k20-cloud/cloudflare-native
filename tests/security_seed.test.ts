import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Production Seed Safety Static Security Guard', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const remoteSeedRegex = /d1\s+execute.*--remote.*seed/i;

  function scanDirectory(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== '.agents') {
          scanDirectory(fullPath, fileList);
        }
      } else if (entry.isFile()) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('asserts zero occurrences of remote seed commands in docs/', () => {
    const docsDir = path.join(projectRoot, 'docs');
    const files = scanDirectory(docsDir);
    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (remoteSeedRegex.test(line)) {
          violations.push({
            file: path.relative(projectRoot, file),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('asserts zero occurrences of remote seed commands in scripts/', () => {
    const scriptsDir = path.join(projectRoot, 'scripts');
    const files = scanDirectory(scriptsDir);
    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (remoteSeedRegex.test(line)) {
          violations.push({
            file: path.relative(projectRoot, file),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('asserts zero occurrences of remote seed commands in package.json', () => {
    const pkgPath = path.join(projectRoot, 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf8');
    const lines = content.split('\n');
    const violations: { line: number; content: string }[] = [];

    lines.forEach((line, index) => {
      if (remoteSeedRegex.test(line)) {
        violations.push({
          line: index + 1,
          content: line.trim()
        });
      }
    });

    expect(violations).toEqual([]);
  });

  it('verifies bootstrap-admin.js exists, exports functions, and contains no hardcoded passwords', async () => {
    const scriptPath = path.join(projectRoot, 'scripts', 'bootstrap-admin.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Confirm no hardcoded production passwords
    expect(content).not.toContain('AlfaazAdmin2026!');
    expect(content).not.toContain('curator2026!');

    const { generateSecurePassword, parseArgs } = await import('../scripts/bootstrap-admin.js');
    expect(typeof generateSecurePassword).toBe('function');
    const generated = generateSecurePassword(32);
    expect(generated).toHaveLength(32);

    const parsed = parseArgs(['--email=custom@alfaaz.com', '--name=Test Lead']);
    expect(parsed.email).toBe('custom@alfaaz.com');
    expect(parsed.name).toBe('Test Lead');
  });

  it('scans docs/ and source trees for plaintext high-entropy secrets and unredacted API keys', () => {
    // AGENTS.md Invariant 1: Security test suites must scan docs/** in addition to source code for high-entropy literals
    const targetDirs = ['docs', 'backend/src', 'frontend/src'].map(d => path.join(projectRoot, d));
    const allFiles: string[] = [];
    for (const d of targetDirs) {
      scanDirectory(d, allFiles);
    }

    const secretPatterns = [
      /AIzaSy[0-9A-Za-z_-]{33}/, // Google API key
      /gsk_[0-9A-Za-z]{48}/ // Groq API key
    ];

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Skip lines that have been explicitly redacted or template examples
        if (line.includes('<redacted') || line.includes('dev-insecure')) return;

        for (const pattern of secretPatterns) {
          const match = line.match(pattern);
          if (match) {
            violations.push({
              file: path.relative(projectRoot, file),
              line: index + 1,
              match: match[0].slice(0, 8) + '...'
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
