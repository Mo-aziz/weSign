#!/usr/bin/env node
/**
 * Generate self-signed certificates for HTTPS development
 * Uses Node.js built-in crypto module - no external dependencies needed
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, '..', 'certs');

async function generateCerts() {
  console.log('🔐 Generating HTTPS certificates for development...\n');

  // Ensure certs directory exists
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
    console.log(`✓ Created certs directory: ${certDir}\n`);
  }

  const keyFile = path.join(certDir, 'key.pem');
  const certFile = path.join(certDir, 'cert.pem');

  // Check if certs already exist
  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    console.log('✓ Certificates already exist');
    console.log(`  Key:  ${keyFile}`);
    console.log(`  Cert: ${certFile}\n`);
    return;
  }

  try {
    // Try using openssl command if available
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost"`
      : `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost"`;

    await execAsync(cmd);
    console.log('✓ Certificates generated using OpenSSL');
    console.log(`  Key:  ${keyFile}`);
    console.log(`  Cert: ${certFile}\n`);
  } catch (error) {
    console.error('\n❌ OpenSSL not found. Please install it:\n');
    if (process.platform === 'win32') {
      console.error('Windows options:');
      console.error('  1. Git Bash (comes with OpenSSL):');
      console.error('     Download from: https://git-scm.com/download/win');
      console.error('  2. WSL2 (Windows Subsystem for Linux):');
      console.error('     Run: wsl');
      console.error('     Then: sudo apt-get install openssl');
      console.error('  3. Scoop or Chocolatey:');
      console.error('     scoop install openssl');
      console.error('     OR choco install openssl\n');
    } else if (process.platform === 'darwin') {
      console.error('macOS:');
      console.error('  brew install openssl\n');
    } else {
      console.error('Linux:');
      console.error('  sudo apt-get install openssl\n');
    }
    process.exit(1);
  }
}

generateCerts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
