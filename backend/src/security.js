import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

function encryptionKey() {
  const encoded = process.env.PII_ENCRYPTION_KEY;
  if (!encoded) throw new Error('PII_ENCRYPTION_KEY is required to process contact details');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('PII_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
}

export function encryptPII(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptPII(payload) {
  const bytes = Buffer.from(payload);
  if (bytes[0] !== 1 || bytes.length < 30) throw new Error('Unsupported encrypted PII payload');
  const iv = bytes.subarray(1, 13);
  const tag = bytes.subarray(13, 29);
  const ciphertext = bytes.subarray(29);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

export function contactLookupHash(phone) {
  const normalized = String(phone).replace(/\D/g, '');
  return crypto.createHmac('sha256', encryptionKey()).update(`beauty-face-customer-phone-v1:${normalized}`).digest('hex');
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, saltHex, hashHex] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/i.test(saltHex || '') || !/^[a-f0-9]{128}$/i.test(hashHex || '')) return false;
  const candidate = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export const hashSessionToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function constantTimeStringEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function validChapaSignature(rawBody, signature) {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const received = Buffer.from(signature, 'hex');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export const newMerchantReference = () => `BF${crypto.randomBytes(9).toString('hex')}`;
