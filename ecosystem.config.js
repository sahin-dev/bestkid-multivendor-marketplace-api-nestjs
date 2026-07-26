module.exports = {
  apps: [
    {
      name: 'bestkid-api-dev',
      script: 'node_modules/@nestjs/cli/bin/nest.js',
      args: 'start --watch',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      node_args: '--trace-deprecation',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 5050,
      },
      error_file: 'logs/bestkid-api-dev-error.log',
      out_file: 'logs/bestkid-api-dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'bestkid-api',
      script: 'dist/src/main.js',
      cwd: process.env.PM2_CWD || __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      wait_ready: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5050,
      },
      error_file: 'logs/bestkid-api-error.log',
      out_file: 'logs/bestkid-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
