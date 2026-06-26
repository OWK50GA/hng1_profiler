module.exports = {
  apps: [
    {
      name: "insighta-api",
      script: "node",
      args: "dist/index.js",
      cwd: "/var/www/insighta/current",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};