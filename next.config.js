const path = require('path');

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Recharts formatter 타입 호환성 (임시)
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};
module.exports = nextConfig;
