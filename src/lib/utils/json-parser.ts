/**
 * Type-safe JSON parsing utilities
 * Prevents "as unknown as object" anti-patterns
 */

/**
 * Safely parse JSON string with full type validation
 * @template T The expected type of parsed data
 * @param json JSON string to parse
 * @param schema Zod schema for validation (optional)
 * @returns Parsed and validated data
 * @throws Error if parsing or validation fails
 */
export function parseJSON<T>(
  json: string,
  validate?: (data: unknown) => T
): T {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (validate) {
      return validate(parsed);
    }
    return parsed as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Safely parse request body with type assertion
 * @template T The expected type of request body
 * @param body Raw request body
 * @param validate Optional validation function
 * @returns Parsed and validated body
 */
export function parseRequestBody<T extends Record<string, unknown>>(
  body: unknown,
  validate?: (data: unknown) => data is T
): T {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a valid object');
  }

  const data = body as T;

  if (validate && !validate(data)) {
    throw new Error('Request body validation failed');
  }

  return data;
}

/**
 * Type guard for checking if value is valid JSON object
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

/**
 * Type guard for checking if value is valid JSON array
 */
export function isValidArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Create a type validator function (without external dependencies)
 * @param expectedKeys Keys that should exist in the object
 * @returns Validation function
 */
export function createObjectValidator(expectedKeys: string[]) {
  return (data: unknown): data is Record<string, unknown> => {
    if (!isValidObject(data)) return false;
    return expectedKeys.every((key) => key in data);
  };
}

/**
 * Create an array validator function
 * @param itemValidator Optional validator for each item
 * @returns Validation function
 */
export function createArrayValidator<T>(
  itemValidator?: (item: unknown) => item is T
) {
  return (data: unknown): data is T[] => {
    if (!isValidArray(data)) return false;
    if (itemValidator) {
      return data.every(itemValidator);
    }
    return true;
  };
}
