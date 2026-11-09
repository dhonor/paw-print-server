// pm2 进程配置：pm2 start ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'paw-print-server',
            script: 'dist/main.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_memory_restart: '400M',
            env: {
                NODE_ENV: 'production',
            },
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            merge_logs: true,
            time: true,
        },
    ],
};
