import { init_config } from './config';
import { runCcxtMonitor } from './ccxtMonitor';
import { runTwitterMonitor } from './twitterMonitor';
import { runServer } from './server';

const run = async () => {
    init_config();
    runCcxtMonitor();
    runTwitterMonitor();
    runServer();
}

run();
