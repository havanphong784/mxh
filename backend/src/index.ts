import Fastify from 'fastify';
import {db} from "./prisma/db";

const app = Fastify({ logger: true });
app.decorate('db',db);

app.get('/api/health', async () => {
    return { status: 'ok', message: 'Backend is running!' };
});

const start = async () => {
    try {
        await app.listen({ port: 3001, host: '0.0.0.0' });
        console.log('🚀 Backend running on http://localhost:5000');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

await start();
