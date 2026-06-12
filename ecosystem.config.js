// Port is read once, when `pm2 start ecosystem.config.js` runs:
//   sudo -u cuncWebsite -H env PORT=3017 pm2 start ecosystem.config.js
const PORT = process.env.PORT || "3000";

module.exports = {
  apps: [
    {
      name: "cunctator",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT}`,
      cwd: "/srv/cuncWebsite/app",
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
    },
  ],
};
