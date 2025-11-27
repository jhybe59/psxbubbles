import WebSocket from 'ws';

const ws = new WebSocket('wss://psxterminal.com/');

ws.on('open', () => {
    console.log('Connected to WebSocket');

    const subscribeMsg = {
        type: "subscribe",
        subscriptionType: "marketData",
        params: {
            marketType: "REG"
        },
        requestId: "req-test-001"
    };

    console.log('Sending subscription:', subscribeMsg);
    ws.send(JSON.stringify(subscribeMsg));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());

        if (message.type === 'marketData') {
            // Log a sample to avoid flooding
            console.log('Market Data:', message.data?.symbol, message.data?.price);
        } else {
            console.log('Received:', message);
        }

        if (message.type === 'ping') {
            console.log('Sending pong...');
            ws.send(JSON.stringify({
                type: 'pong',
                timestamp: message.timestamp
            }));
        }
    } catch (err) {
        console.error('Failed to parse message:', err);
    }
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
});

ws.on('close', () => {
    console.log('WebSocket connection closed');
});

// Keep alive for a bit to see messages
setTimeout(() => {
    console.log('Closing connection after timeout');
    ws.close();
}, 60000);
