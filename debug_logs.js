const { execSync } = require('child_process');
try {
    const logs = execSync('docker logs --tail 50 psxbubbles-main-api-1').toString();
    const lines = logs.split('\n');
    for (const line of lines) {
        if (line.includes('"level":50')) {
            try {
                const json = JSON.parse(line);
                console.log('--- ERROR ---');
                console.log(json.msg);
                if (json.err) {
                    console.log(json.err.message || json.err);
                    console.log(json.err.stack);
                }
            } catch (e) { console.log('Raw line:', line); }
        }
    }
} catch (e) {
    console.error(e);
}
