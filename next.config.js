const path = require('path');

const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
};
module.exports = nextConfig;
