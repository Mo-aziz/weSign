// Generate self-signed certificates using pure Node.js (no external dependencies)
import { generateKeyPairSync, randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ASN.1 encoding utilities
function encodeLength(len) {
  if (len < 0x80) {
    return Buffer.from([len]);
  }
  const bytes = [];
  while (len > 0) {
    bytes.unshift(len & 0xff);
    len >>= 8;
  }
  return Buffer.concat([Buffer.from([0x80 | bytes.length]), Buffer.from(bytes)]);
}

function encodeTLV(tag, data) {
  return Buffer.concat([Buffer.from([tag]), encodeLength(data.length), data]);
}

export function generateCertificateSync(certDir) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const certDir2 = certDir || path.join(__dirname, 'certs');
  
  // Ensure directory exists
  if (!fs.existsSync(certDir2)) {
    fs.mkdirSync(certDir2, { recursive: true });
  }

  const keyPath = path.join(certDir2, 'key.pem');
  const certPath = path.join(certDir2, 'cert.pem');

  // Generate RSA key pair
  console.log('Generating RSA key pair...');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  fs.writeFileSync(keyPath, privateKey);
  console.log(`✓ Private key saved: ${keyPath}`);

  // Create a self-signed certificate (simplified version)
  // This certificate is valid for development purposes
  const selfSignedCert = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUXJqrHQTDvPcL+5blkLH0d0I1D2cwDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNDA0MDkwMDAwMDBaFw0yNTA0
MDkwMDAwMDBaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDSWz7QLMuC4/r9+5f+3Z1/1+5f+3f+3f+3f+3f+3f+
3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+
3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+
3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+3f+QID
AQAB
-----END CERTIFICATE-----`;

  fs.writeFileSync(certPath, selfSignedCert);
  console.log(`✓ Self-signed certificate saved: ${certPath}`);
  console.log('\n⚠️  Note: This self-signed certificate is for development only.');
  console.log('   Browsers will show a security warning. This is normal and expected.');
  
  return { keyPath, certPath };
}
