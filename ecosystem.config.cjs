module.exports = {
  apps: [{
    name: 'frames.vibra.so',
    script: 'node_modules/.bin/tsx',
    args: 'src/index.tsx',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};