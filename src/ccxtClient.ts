import ccxt from 'ccxt';
import {static_config} from './config';

const client = new ccxt.binance({
    apiKey: static_config.bianan_apikey,
    secret: static_config.bianan_secret,
    options: {
        defaultMarket: 'future',
    },
});

export { client };
