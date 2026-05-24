const path = require('path');

const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
};
module.exports = nextConfig;
