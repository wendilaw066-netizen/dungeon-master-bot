const { spawn } = require('child_process');
const cf = spawn('C:\\Users\\USER\\.gemini\\antigravity\\scratch\\discord-bot\\node_modules\\cloudflared\\bin\\cloudflared.exe', ['tunnel', '--url', 'http://localhost:3420']);

cf.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
        console.log("FOUND URL:", match[0]);
        cf.kill();
        process.exit(0);
    }
});
setTimeout(() => { console.log("Timeout"); cf.kill(); process.exit(1); }, 20000);
