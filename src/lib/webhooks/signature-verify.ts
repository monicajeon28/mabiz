import crypto from 'crypto';

function getWebhookSecret(): string {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('WEBHOOK_SECRET environment variable must be set');
  }
  return secret;
}

export const signatureVerify = {
  sign: (payload: string): string => {
    const secret = getWebhookSecret();
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  },

  verify: (payload: string, signature: string): boolean => {
    const expected = signatureVerify.sign(payload);
    if (Buffer.from(signature, 'hex').byteLength !== Buffer.from(expected, 'hex').byteLength) return false;
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
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
