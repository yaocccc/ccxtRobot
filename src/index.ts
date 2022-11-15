import { init_config } from './config';
import { runCcxtMonitor } from './ccxtMonitor';
import { runRssMonitor } from './rssMonitor';
import { runServer } from './server';

const run = async () => {
    init_config();
    runCcxtMonitor();
    runRssMonitor();
    runServer();
}

run();
