module.exports = {
  apps: [
    {
      name: 'sua-talk-api',
      script: './src/app.js',
      instances: 'max', 
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        API_URL: 'https://api.suatalk.site',
        FRONTEND_URL: 'https://suatalk.site'
      },
      // Production optimizations
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 5,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      
      // Logging
      log_file: './logs/app.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Health monitoring
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Environment-specific settings
      node_args: process.env.NODE_ENV === 'production' ? 
        '--max-old-space-size=1024' : 
        '--max-old-space-size=512'
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/username/sua-talk-be.git',
      path: '/var/www/sua-talk-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production'
      }
    },
    staging: {
      user: 'deploy',
      host: ['staging-server-ip'],
      ref: 'origin/develop',
      repo: 'https://github.com/username/sua-talk-be.git',
      path: '/var/www/sua-talk-api-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
}; 