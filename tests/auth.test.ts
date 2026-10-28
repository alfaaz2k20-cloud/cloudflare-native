import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../backend/src/auth/crypto';

describe('Auth & Cryptography Subsystem', () => {
  const secret = 'super-secret-test-key-32-bytes-long!';

  describe('PBKDF2 Password Hashing', () => {
    it('generates a valid modular format hash with 100,000 iterations', async () => {
      const password = 'TestSecretPassword123!';
      const hashed = await hashPassword(password);

      expect(hashed).toMatch(/^pbkdf2:sha256:100000:[a-f0-9]{32}:[a-f0-9]{64}$/);
    });

    it('verifies correct password against hash', async () => {
      const password = 'MySecurePassphrase$2026';
      const hashed = await hashPassword(password);

      const isValid = await verifyPassword(password, hashed);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect password against hash', async () => {
      const password = 'MySecurePassphrase$2026';
      const hashed = await hashPassword(password);

      const isInvalid = await verifyPassword('WrongPassword', hashed);
      expect(isInvalid).toBe(false);
    });

    it('generates unique salts across multiple hashes of identical password', async () => {
      const password = 'IdenticalPassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('Stateless HMAC-SHA256 JWT Subsystem', () => {
    it('creates a signed 3-part JWT token', async () => {
      const token = await createToken({
        email: 'member@alfaaz.local',
        status: 'PARTICIPANT'
      }, secret);

      const parts = token.split('.');
      expect(parts.length).toBe(3);
    });

    it('verifies and decodes a valid token', async () => {
      const token = await createToken({
        email: 'admin@alfaaz.local',
        status: 'ADMIN'
      }, secret);

      const payload = await verifyToken(token, secret);
      expect(payload).not.toBeNull();
      expect(payload?.email).toBe('admin@alfaaz.local');
      expect(payload?.status).toBe('ADMIN');
      expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects token signed with different secret', async () => {
      const token = await createToken({
        email: 'member@alfaaz.local',
        status: 'PARTICIPANT'
      }, secret);

      const payload = await verifyToken(token, 'different-wrong-secret-key');
      expect(payload).toBeNull();
    });

    it('rejects corrupted or tampered token signature', async () => {
      const token = await createToken({
        email: 'member@alfaaz.local',
        status: 'PARTICIPANT'
      }, secret);

      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.badsignature`;

      const payload = await verifyToken(tampered, secret);
      expect(payload).toBeNull();
    });
  });
});
