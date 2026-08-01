/**
 * 前端 Vite 开发服：崩溃自动重启
 *
 * 常用命令（在 RuoYi-Vue3 目录）：
 *   npm run pm2:start
 *   npm run pm2:stop
 *   npm run pm2:restart
 *   npm run pm2:logs
 *   npm run pm2:status
 */
module.exports = {
  apps: [
    {
      name: 'nwueyes-vue3',
      cwd: __dirname,
      script: 'node_modules/vite/bin/vite.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 50,
      min_uptime: '5s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}
