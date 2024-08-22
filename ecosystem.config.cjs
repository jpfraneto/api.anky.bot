module.exports = {
    apps: [{
      name: 'frames.vibra.so',
      script: 'npm',
      args: 'run serve',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }]
  };