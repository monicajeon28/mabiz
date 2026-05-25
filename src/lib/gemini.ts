/**
 * Google Gemini API Client (Stub)
 *
 * TODO: Full implementation pending
 * - Initialize Gemini client with API key
 * - Implement scanPassport for passport scanning
 * - Add vision analysis capabilities
 *
 * Current usage: Placeholder for future Gemini integration
 * Last updated: 2026-05-26
 */

export const initGeminiClient = () => {
  // TODO: Initialize with process.env.GOOGLE_GEMINI_API_KEY
  return {
    ready: false,
    error: 'Gemini client not yet implemented',
  };
};

/**
 * Scan passport using Gemini Vision API
 * @param imageUrl - Passport image URL or base64 encoded image
 * @returns Extracted passport data (MRZ, name, DOB, etc.)
 */
export const scanPassport = async (imageUrl: string) => {
  // TODO: Implement actual Gemini vision API call
  console.warn('[TODO] scanPassport requires Gemini Vision API implementation');
  return {
    mrz: null,
    name: null,
    dateOfBirth: null,
    expiryDate: null,
    passportNumber: null,
    country: null,
    extracted: false,
  };
};

export default {
  initGeminiClient,
  scanPassport,
};
