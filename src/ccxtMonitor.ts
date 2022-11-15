import { k_any_2_any, OHLCV_KEYS } from './parseK';
import { getIndicators, getIndicatorTime, Indicator } from './parseIndicator';
import { sleep, retry } from './utils';
import { monitorMsg } from './wxClinet';
import { get_dynamic_config } from './config';
import ccxt from 'ccxt';
import { static_config } from './config';

const client = new ccxt.binance({
    apiKey: static_config.bianan_apikey,
    secret: static_config.bianan_secret,
    options: {
        defaultMarket: 'future',
    },
});

// [count, ok, left, right]
const filterCount = (indicators: Indicator[], type: 'HIGN_DEAD' | 'LOW_GOLD', kCount: number): [number, boolean, Indicator, Indicator] => {
    let count = 0; // 满足的点数
    let ok = true; // 最新的点是否满足
    let right: Indicator; // 最新一个满足的点
    let left: Indicator; // 最后一个满足的点
    const excludeTypes = type == 'HIGN_DEAD' ? ['LOW_GOLD', 'LOW_DEAD', 'LOW_NORMAL'] : ['HIGN_GOLD', 'HIGN_DEAD', 'HIGN_NORMAL'];
    const reverseType = type == 'HIGN_DEAD' ? 'HIGN_GOLD' : 'LOW_DEAD'; // 相对相反类型
    const len = indicators.length;
    for (let i = len - 1; i >= len - kCount; i--) {
        const cur = indicators[i];
        if (!cur) break;
        if (count == 0 && cur.type == type) right = cur; // 第一个满足的点
        if (count == 0 && cur.type == reverseType) return [0, false, left, right]; // 如果count为0，且遇到相对反点 直接结束
        if (excludeTypes.includes(cur.type)) break; // 如果遇到非满足点 结束
        if (cur.type == type) count++, (left = cur); // 如果满足点 计数+1
    }
    return [count, ok, left, right];
};

const consumer5m = (symbol: string, _5m_indicators: Indicator[], _45m_indicators: Indicator[], trend: 'BUY' | 'SELL') => {
    const last = _5m_indicators[_5m_indicators.length - 1];

    if (!last) return;

    if (['HIGN_DEAD', 'LOW_GOLD'].includes(last.type)) {
        // 5分钟连续金叉死叉时，判断45分钟级别
        const countType = last.type as 'HIGN_DEAD' | 'LOW_GOLD';
        const flag = countType === 'HIGN_DEAD' ? '做空' : '做多';
        const cha = countType === 'HIGN_DEAD' ? '死叉' : '金叉';

        // 判断5分钟级别的点的数量是否足够2个 从后往前判断
        const [_5m_count, _5m_ok] = filterCount(_5m_indicators, countType, 10);
        if (_5m_count < 2 || !_5m_ok) return;

        // 判断45级别的点的数量是否足够2个 从后往前判断
        _45m_indicators = _45m_indicators.filter((x) => x.time <= last.time);
        const [_45m_count, _45m_ok, _45m_left, _45m_right] = filterCount(_45m_indicators, countType, 12);
        if (_45m_count < 2 || !_45m_ok) return;

        monitorMsg(
            last,
            symbol,
            '5m',
            `${flag}信号: ${_45m_count} * 45${cha} + ${_5m_count} * 5${cha}\n4小时级别趋势: ${trend ? '做多' : '做空'}`,
            `\n对应的45m点: 连续${cha} | ${getIndicatorTime(_45m_right)} | ${_45m_right.STOCHRSI.k.toFixed(2)}`,
            true
        );
    }

    // 2x45金叉已完成，且现在是1x5 并且又5M死叉一次了，马上可能要2*45+2*5金叉
    if (['HIGN_GOLD', 'LOW_DEAD'].includes(last.type)) {
        const countType = (last.type == 'HIGN_GOLD' ? 'HIGN_DEAD' : 'LOW_GOLD') as 'HIGN_DEAD' | 'LOW_GOLD';
        const flag = countType === 'HIGN_DEAD' ? '做空' : '做多';
        const cha = countType === 'HIGN_DEAD' ? '死叉' : '金叉';
        const reverseCha = countType === 'HIGN_DEAD' ? '金叉' : '死叉';

        // 先判断5m级别 10个k线内是否满足 n*5正叉 + 1个反叉的结构
        const [_5m_count, _5m_ok, _5m_left, _5m_right] = filterCount(_5m_indicators.slice(0, -1), countType, 9); // 从最后一个k线往前数9个k线
        if (_5m_count < 1 || !_5m_ok) return;

        // 判断45级别的点的数量是否足够2个 从最左边的5分钟的点往前判断
        _45m_indicators = _45m_indicators.filter((x) => x.time <= _5m_left.time);
        const [_45m_count, _45m_ok, _45m_left, _45m_right] = filterCount(_45m_indicators, countType, 10);
        if (_45m_count < 2 || !_45m_ok) return;

        monitorMsg(
            last,
            symbol,
            '5m',
            `${flag}信号(预测): ${_45m_count} * 45${cha} + ${_5m_count} * 5${cha} + (5${reverseCha})\n4小时级别趋势: ${trend ? '做多' : '做空'}`,
            `\n对应的45m点: 连续${cha} | ${getIndicatorTime(_45m_right)} | ${_45m_right.STOCHRSI.k.toFixed(2)}`,
            true
        );
    }
};

const consumer45m = (symbol: string, _5m_indicators: Indicator[], _45m_indicators: Indicator[], trend: 'BUY' | 'SELL') => {
    const last = _45m_indicators[_45m_indicators.length - 1];

    if (!last) return;

    // n * 45 + n * 5 + 45
    if (['HIGN_DEAD', 'LOW_GOLD'].includes(last.type)) {
        const countType = last.type as 'HIGN_DEAD' | 'LOW_GOLD';
        const flag = countType === 'HIGN_DEAD' ? '做空' : '做多';
        const cha = countType === 'HIGN_DEAD' ? '死叉' : '金叉';

        // 判断45级别的点的数量是否足够2个 从后往前判断
        const [_45m_count, _45m_ok, _45m_left, _45m_right] = filterCount(_45m_indicators, countType, 10);
        if (_45m_count >= 2 && _45m_ok) monitorMsg(_45m_right, symbol, '45m', `${flag}信号: ${_45m_count} * 45${cha}`, '', false);
        else return;

        // 判断5分钟级别的点的数量是否足够2个 从最后一个点往前判断
        const [_5m_count, _5m_ok, _4m_left, _5m_right] = filterCount(_5m_indicators, countType, 10);
        if (_45m_count < 2 || !_45m_ok) return;

        monitorMsg(
            last,
            symbol,
            '45m',
            `${flag}信号: ${_45m_count - 1} * 45${cha} + ${_5m_count} * 5${cha} + 45${cha}\n4小时级别趋势: ${trend ? '做多' : '做空'}`,
            `\n对应的5m点: 连续${cha} | ${getIndicatorTime(_5m_right)} | ${_5m_right.STOCHRSI.k.toFixed(2)}`,
            true
        );
    }

    // 预测: n * 45 + n * 5 + (45)
    if (['HIGN_GOLD', 'LOW_DEAD'].includes(last.type)) {
        // === 先判断5分钟级别的
        const countType = (last.type == 'HIGN_GOLD' ? 'HIGN_DEAD' : 'LOW_GOLD') as 'HIGN_DEAD' | 'LOW_GOLD';
        const flag = countType === 'HIGN_DEAD' ? '做空' : '做多';
        const cha = countType === 'HIGN_DEAD' ? '死叉' : '金叉';
        const recha = countType === 'HIGN_DEAD' ? '金叉' : '死叉';

        // 先判断45分钟级别 是否有 10个k线内是否满足 n*45正叉 + 1个反叉的结构 从最后一个k线往前数9个k线
        const [_45m_count, _45m_ok, _45m_left] = filterCount(_45m_indicators.slice(0, -1), countType, 9);
        if (_45m_count < 1 || !_45m_ok) return;

        // 判断5分钟级别的点的数量是否足够2个 从45m left和last中的点判断
        _5m_indicators = _5m_indicators.filter((x) => x.time >= _45m_left.time);
        const [_5m_count, _5m_ok, _5m_left, _5m_right] = filterCount(_5m_indicators, countType, 10);
        if (_5m_count < 2 || !_5m_ok) return;

        monitorMsg(
            last,
            symbol,
            '45m',
            `${flag}信号(预测): ${_45m_count} * 45${cha} + ${_5m_count} * 5${cha} + (45${recha})\n4小时级别趋势: ${trend ? '做多' : '做空'}`,
            `\n对应的5m点: 连续${cha} | ${getIndicatorTime(_5m_right)} | ${_5m_right.STOCHRSI.k.toFixed(2)}`,
            true
        );
    }
};

const trendCache: Map<string, ['BUY' | 'SELL', number]> = new Map(); // 趋势缓存半小时缓存一次 Map<symbol, [trend, time]>
const priceCache: Map<string, [number, number]> = new Map(); // 价格缓存半小时缓存一次 Map<symbol, price>
const syncCache = async () => {
    await sleep(300 * 1000);
    for (const key of [...trendCache.keys()]) {
        const cache = trendCache.get(key);
        if (Date.now() - cache[1] > 1000 * 60 * 30) trendCache.delete(key);
    }
    for (const key of [...priceCache.keys()]) {
        const cache = priceCache.get(key);
        if (Date.now() - cache[1] > 1000 * 60 * 30) priceCache.delete(key);
    }
    syncCache();
};
syncCache();

let lasttime = 0;
const consumer = async () => {
    lasttime = Date.now();
    const symbols = get_dynamic_config('symbols');
    for (const symbol of symbols) {
        try {
            const _5m_ohlcvs = await retry(() => client.fetchOHLCV(symbol, '5m'));
            const _15m_ohlcvs = await retry(() => client.fetchOHLCV(symbol, '15m'));
            const _45m_ohlcvs = k_any_2_any(_15m_ohlcvs, 15, 45);

            const _5m_indicators = getIndicators(_5m_ohlcvs, symbol, '5m');
            const _45m_indicators = getIndicators(_45m_ohlcvs, symbol, '45m');

            // 判断大趋势
            let trend: 'BUY' | 'SELL' = 'BUY';
            const cache = trendCache.get(symbol);
            if (cache && Date.now() - cache[1] <= 1000 * 60 * 30) trend = cache[0];
            else {
                const _4h_ohlcvs = await retry(() => client.fetchOHLCV(symbol, '4h'));
                const _4h_indicators = getIndicators(_4h_ohlcvs, symbol, '4h');
                const spec = _4h_indicators.reverse().find((x) => x.type == 'HIGN_DEAD' || x.type == 'LOW_GOLD');
                trend = spec && spec.type == 'HIGN_DEAD' ? 'SELL' : 'BUY';
                trendCache.set(symbol, [trend, Date.now()]);
            }

            // 缓存价格
            priceCache.set(symbol, [_5m_ohlcvs[_5m_ohlcvs.length - 1][OHLCV_KEYS.close], Date.now()]);
            console.log(symbol, trend);

            consumer5m(symbol, _5m_indicators, _45m_indicators, trend);
            consumer45m(symbol, _5m_indicators, _45m_indicators, trend);
        } catch (_) {
            console.log(_);
            await sleep(3000);
        }
    }
};

const run = async () => {
    if (Date.now() - lasttime > 1000 * 25) await consumer();
    await sleep(5 * 1000);
    run();
};

export { run as runCcxtMonitor, consumer as monitorConsumer, trendCache, priceCache, client };
