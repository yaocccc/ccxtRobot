import ccxt from 'ccxt';

enum OHLCV_KEYS {
    'time' = 0,
    'open' = 1,
    'high' = 2,
    'low' = 3,
    'close' = 4,
    'volume' = 5,
}
const getOhlcv = (ohlcvs: ccxt.OHLCV[], key: OHLCV_KEYS) => ohlcvs.map((x) => x[key]);

const mergeK = (target: ccxt.OHLCV, cur: ccxt.OHLCV) => {
    if (cur) {
        target[OHLCV_KEYS.high] = Math.max(cur[OHLCV_KEYS.high], target[OHLCV_KEYS.high]);
        target[OHLCV_KEYS.low] = Math.min(cur[OHLCV_KEYS.low], target[OHLCV_KEYS.low]);
        target[OHLCV_KEYS.close] = cur[OHLCV_KEYS.close];
        target[OHLCV_KEYS.volume] += cur[OHLCV_KEYS.volume];
    };
    return target;
}

const k_any_2_any = (ohlcvs: ccxt.OHLCV[], source: 5 | 15,  target: 15 | 45 | 60) => {
    ohlcvs = [...ohlcvs];
    const result: ccxt.OHLCV[] = [];
    while (ohlcvs[0] && ohlcvs[0][OHLCV_KEYS.time] / 1000 / 60 % target != 0) ohlcvs.shift();
    while (ohlcvs[0]) {
        const cs = ohlcvs.splice(0, target / source);
        const c = cs[0];
        for (let i = 1; i < cs.length; i++)
            mergeK(c, cs[i]);
        result.push(c);
    }

    return result;
}

export {
    OHLCV_KEYS,
    getOhlcv,
    k_any_2_any,
}
