const { tunnel } = require('cloudflared');
(async () => {
    try {
        const t = tunnel({ '--url': 'http://localhost:3420' });
        const tunnelUrl = await t.url;
        console.log("Cloudflare URL:", tunnelUrl);
        t.stop();
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
