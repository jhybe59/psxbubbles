import pg from 'pg';
const { Client } = pg;

const test = async (dbName) => {
    const client = new Client({
        host: 'localhost',
        port: 8812,
        user: 'postgres',
        password: 'postgres',
        database: dbName
    });
    try {
        await client.connect();
        console.log(`Connected to QuestDB with database: ${dbName}`);
        await client.end();
        return true;
    } catch (err) {
        console.log(`Failed to connect with database: ${dbName} - ${err.message}`);
        return false;
    }
};

const main = async () => {
    await test('qdb');
    await test('public');
    await test('postgres');
    await test('main');
    await test('');
};

main();
