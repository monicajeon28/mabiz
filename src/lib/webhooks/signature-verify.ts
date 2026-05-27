import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  throw new Error('WEBHOOK_SECRET environment variable must be set');
}

export const signatureVerify = {
  sign: (payload: string): string => {
    return crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
  },

  verify: (payload: string, signature: string): boolean => {
    const expected = signatureVerify.sign(payload);
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  },

  createSignatureHeader: (payload: any): string => {
    const payloadStr = JSON.stringify(payload);
    return signatureVerify.sign(payloadStr);
  },

  extractFromHeader: (authHeader?: string): string | null => {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
  },
};
