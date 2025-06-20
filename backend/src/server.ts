import './config/tracing'; // IMPORTANT: Must be the first import to ensure all modules are instrumented
import app from './app';
import http from 'http';
import env from './config/env';
import './queues/reportWorker'; // This initializes and starts the worker process
import './queues/archiveWorker'; // This initializes and starts the archive worker process

const PORT = env.PORT;

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 