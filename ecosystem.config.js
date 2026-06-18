module.exports = {
    apps: [
        {
            name: "nextjs-app",
            script: "./server.cjs",
            restart_delay: 5000,
            env: {
                NODE_ENV: "production",
            }
        }
    ]
};
