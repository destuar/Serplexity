import app from './app';
import http from 'http';
import env from './config/env';

const PORT = env.PORT;

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 