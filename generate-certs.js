// Generate self-signed certificates using Node.js crypto (no external dependencies)
import { generateKeyPairSync, randomBytes } from 'crypto';
import { createWriteStream } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function generateSelfSignedCertificate(certDir) {
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  // Check if certs already exist
  if (existsSync(keyPath) && existsSync(certPath)) {
    console.log('✓ Using existing self-signed certificates');
    return { keyPath, certPath };
  }

  console.log('Generating self-signed certificates...');

  // Ensure directory exists
  if (!existsSync(certDir)) {
    mkdirSync(certDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    // Try using openssl if available
    const openssl = spawn('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', keyPath,
      '-out', certPath,
      '-days', '365',
      '-nodes',
      '-subj', '/C=US/ST=State/L=City/O=Dev/CN=localhost'
    ], { stdio: 'pipe' });

    let hasError = false;

    openssl.on('error', () => {
      hasError = true;
    });

    openssl.on('close', (code) => {
      if (code === 0 && existsSync(keyPath) && existsSync(certPath)) {
        console.log('✓ Certificates generated with OpenSSL');
        resolve({ keyPath, certPath });
      } else if (!hasError) {
        reject(new Error('OpenSSL not found. Please install it or use HTTP for localhost testing.'));
      }
    });
  });
}
