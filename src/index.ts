import { init_config } from './config';
import { runMonitor } from './monitor';
import { runServer } from './server';

const run = async () => {
    init_config();
    runMonitor();
    runServer();
}

run();
