// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000'
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/mabiz_test'

// Mock NextRequest for API tests
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(url, options = {}) {
      this.url = url;
      this.method = options.method || 'GET';
      this.headers = options.headers || {};
    }
  };
}

// Suppress console errors during tests (optional)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

global.console = {
  ...console,
  error: (...args) => {
    // Only suppress Next.js specific warnings
    if (args[0]?.includes?.('Request is not defined')) {
      return;
    }
    originalConsoleError(...args);
  },
  warn: (...args) => {
    if (args[0]?.includes?.('Warning: ')) {
      return;
    }
    originalConsoleWarn(...args);
  },
}
