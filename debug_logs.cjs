const { execSync } = require('child_process');
try {
    const logs = execSync('docker logs --tail 50 psxbubbles-main-api-1').toString();
    const lines = logs.split('\n');
    for (const line of lines) {
        if (line.includes('"level":50')) {
            try {
                const json = JSON.parse(line);
                console.log('--- ERROR --- Time:', json.time, '(', new Date(json.time).toISOString(), ')');
                console.log(json.msg);
                if (json.err) {
                    console.log(json.err.message || json.err);
                    console.log(json.err.stack);
                }
            } catch (e) { }
        }
    }
} catch (e) {
    console.error(e);
}
