module.exports = {
    apps: [
        {
            name: "nextjs-app",
            script: "./server.cjs",
            env: {
                NODE_ENV: "production",
            }
        },
        {
            name: "zkteco-worker",
            script: "./worker.js",
            env: {
                NODE_ENV: "production",
            }
        }
    ]
};
