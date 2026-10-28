#!/usr/bin/env node
/**
 * Alfaaz Collective - Production Administrator Bootstrap Utility
 * 
 * Secure standalone Node.js CLI tool to provision or rotate an initial administrator
 * account for Cloudflare D1 without using hardcoded or development passwords.
 * 
 * Uses Web Crypto PBKDF2 (SHA-256, 100,000 iterations, 16-byte random salt)
 * conforming precisely to backend/src/auth/crypto.ts.
 * 
 * Usage:
 *   node scripts/bootstrap-admin.js [options]
 *   npm run bootstrap:admin -- --email="admin@alfaazcollective.org"
 * 
 * Options:
 *   --email <email>        Admin email (default: admin@alfaazcollective.org or env BOOTSTRAP_ADMIN_EMAIL)
 *   --password <password>  Admin password (generated securely if omitted)
 *   --name <fullName>      Full name (default: "System Administrator" or env BOOTSTRAP_ADMIN_NAME)
 *   --output-sql <path>    Write generated SQL statement to file
 *   --execute-local        Execute directly against local SQLite/D1 database if available
 *   --help                 Display this help message
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const crypto = globalThis.crypto;

export function parseArgs(rawArgs = process.argv.slice(2)) {
  const options = {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'System Administrator',
    outputSql: '',
    executeLocal: false,
    help: false
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--email' && rawArgs[i + 1]) {
      options.email = rawArgs[++i];
    } else if (arg.startsWith('--email=')) {
      options.email = arg.split('=')[1];
    } else if (arg === '--password' && rawArgs[i + 1]) {
      options.password = rawArgs[++i];
    } else if (arg.startsWith('--password=')) {
      options.password = arg.split('=')[1];
    } else if (arg === '--name' && rawArgs[i + 1]) {
      options.name = rawArgs[++i];
    } else if (arg.startsWith('--name=')) {
      options.name = arg.split('=')[1];
    } else if (arg === '--output-sql' && rawArgs[i + 1]) {
      options.outputSql = rawArgs[++i];
    } else if (arg.startsWith('--output-sql=')) {
      options.outputSql = arg.split('=')[1];
    } else if (arg === '--execute-local') {
      options.executeLocal = true;
    }
  }

  return options;
}

export function generateSecurePassword(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const saltHex = bufferToHex(salt.buffer);
  const hashHex = bufferToHex(derived);
  return `pbkdf2:sha256:100000:${saltHex}:${hashHex}`;
}

export async function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
Alfaaz Collective - Production Administrator Bootstrap Utility

Usage:
  node scripts/bootstrap-admin.js [options]
  npm run bootstrap:admin -- --email="admin@alfaazcollective.org"

Options:
  --email <email>        Admin email (default: admin@alfaazcollective.org or env BOOTSTRAP_ADMIN_EMAIL)
  --password <password>  Admin password (generated securely if omitted)
  --name <fullName>      Full name (default: "System Administrator" or env BOOTSTRAP_ADMIN_NAME)
  --output-sql <path>    Write generated SQL statement to file
  --execute-local        Execute directly against local SQLite/D1 database if available
  --help                 Show this help screen
`);
    return;
  }

  const email = (options.email || 'admin@alfaazcollective.org').trim().toLowerCase();
  const wasGenerated = !options.password;
  const password = options.password || generateSecurePassword(24);
  const name = options.name.trim();

  console.log('\n======================================================');
  console.log('   ALFAAZ COLLECTIVE — SECURE ADMIN BOOTSTRAP');
  console.log('======================================================\n');
  console.log(`Target Email : ${email}`);
  console.log(`Full Name    : ${name}`);
  console.log(`Password     : ${password} ${wasGenerated ? '(Cryptographically Generated)' : '(Provided via CLI/Env)'}`);
  console.log(`Hashing Spec : PBKDF2-HMAC-SHA256 (100,000 iterations, 16-byte random salt)`);

  const passwordHash = await hashPassword(password);
  console.log(`Hash Format  : ${passwordHash.substring(0, 35)}...`);

  // Escape single quotes for SQL safety
  const safeEmail = email.replace(/'/g, "''");
  const safeName = name.replace(/'/g, "''");
  const safeHash = passwordHash.replace(/'/g, "''");

  const sqlStatement = `-- Production Administrator Bootstrap (${new Date().toISOString()})
INSERT INTO users (email, password, full_name, status)
VALUES ('${safeEmail}', '${safeHash}', '${safeName}', 'ADMIN')
ON CONFLICT(email) DO UPDATE SET
  password = excluded.password,
  full_name = excluded.full_name,
  status = 'ADMIN';
`;

  console.log('\n--- Generated Safe SQL Statement ---');
  console.log(sqlStatement.trim());
  console.log('-------------------------------------\n');

  if (options.outputSql) {
    const targetPath = path.resolve(process.cwd(), options.outputSql);
    fs.writeFileSync(targetPath, sqlStatement, 'utf8');
    console.log(`✓ SQL statement written to: ${targetPath}`);
  }

  if (options.executeLocal) {
    try {
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const { DatabaseSync } = require('node:sqlite');
      const localDbPath = path.resolve(process.cwd(), 'alfaaz_data.db');
      if (fs.existsSync(localDbPath)) {
        const db = new DatabaseSync(localDbPath);
        db.exec(sqlStatement);
        console.log(`✓ Admin user successfully provisioned in local database: ${localDbPath}`);
      } else {
        console.log(`! Local database file not found at ${localDbPath}. Skipping local execution.`);
      }
    } catch (err) {
      console.warn(`! Local execution warning: ${err.message}`);
    }
  }

  console.log('--- Production Provisioning Instructions ---');
  console.log('To apply this administrator to your remote Cloudflare D1 database:');
  console.log('1. Save the above SQL to a temporary file (e.g. \`admin_bootstrap.sql\`).');
  console.log('2. Execute via Wrangler:');
  console.log('     npx wrangler d1 execute DB --remote --file=admin_bootstrap.sql');
  console.log('3. Securely record the generated password in your password manager.');
  console.log('4. Delete \`admin_bootstrap.sql\` immediately.');
  console.log('======================================================\n');
}

const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (executedFilePath === currentFilePath) {
  main().catch((err) => {
    console.error('Fatal error during admin bootstrap:', err);
    process.exit(1);
  });
}
