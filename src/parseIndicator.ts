import moment from 'moment';
import ccxt from 'ccxt';
import { StochasticRSI } from 'technicalindicators';
import { StochasticRSIOutput } from 'technicalindicators/declarations/momentum/StochasticRSI';
import { OHLCV_KEYS } from './parseK';

type IndicatorPointType = 'HIGN_NORMAL' | 'LOW_NORMAL' | 'HIGN_GOLD' | 'HIGN_DEAD' | 'LOW_GOLD' | 'LOW_DEAD'; // 当前点和前一个点的关系
type Indicator = {
    ohlcv: ccxt.OHLCV;
    STOCHRSI?: StochasticRSIOutput;
    symbol: string,
    time: number,
    type: IndicatorPointType,
    interval: string,
};

const getOhlcv = (ohlcvs: ccxt.OHLCV[], key: OHLCV_KEYS) => ohlcvs.map((x) => x[key]);
const getIndicatorTime = (indicator: Indicator) => moment(new Date(indicator.ohlcv[0])).format('YYYY-MM-DD HH:mm');
const indicatorsFuncs = {
    getDefault: (ohlcvs: ccxt.OHLCV[], symbol: string, interval: string): Indicator[] => ohlcvs.map((ohlcv) => {
        return {
            ohlcv,
            symbol,
            time: ohlcv[OHLCV_KEYS.time],
            type: 'HIGN_NORMAL',
            consequentCount: 1,
            interval,
        }
    }),
    STOCHRSI: (indicators: Indicator[], kPeriod: number, dPeriod: number, stochasticPeriod: number, rsiPeriod: number) => {
        const ohlcvs = indicators.map((x) => x.ohlcv);
        const stochasticrsiInput = { values: getOhlcv(ohlcvs, OHLCV_KEYS.close), kPeriod, dPeriod, stochasticPeriod, rsiPeriod };
        const stochrsis = StochasticRSI.calculate(stochasticrsiInput);
        indicators.splice(0, ohlcvs.length - stochrsis.length);
        indicators.forEach((indicator, i) => {
            indicator.STOCHRSI = stochrsis[i];
        });
    },
    parseType: (indicators: Indicator[]) => {
        indicators.forEach((cur, i) => {
            if (i === 0) return;
            const prev = indicators[i - 1];
            let result: IndicatorPointType;
            if (cur.STOCHRSI.k > 50) {
                if (prev.STOCHRSI.k <= prev.STOCHRSI.d && cur.STOCHRSI.k >= cur.STOCHRSI.d) result = 'HIGN_GOLD';
                else if (prev.STOCHRSI.k >= prev.STOCHRSI.d && cur.STOCHRSI.k <= cur.STOCHRSI.d) result = 'HIGN_DEAD';
                else result = 'HIGN_NORMAL';
            } else {
                if (prev.STOCHRSI.k <= prev.STOCHRSI.d && cur.STOCHRSI.k >= cur.STOCHRSI.d) result = 'LOW_GOLD';
                else if (prev.STOCHRSI.k >= prev.STOCHRSI.d && cur.STOCHRSI.k <= cur.STOCHRSI.d) result = 'LOW_DEAD';
                else result = 'LOW_NORMAL';
            }
            cur.type = result;
        });
    }
};

const getIndicators = (ohlcvs: ccxt.OHLCV[], symbol: string, interval: string) => {
    const indicators = indicatorsFuncs.getDefault(ohlcvs, symbol, interval);
    indicatorsFuncs.STOCHRSI(indicators, 3, 3, 14, 14);
    indicatorsFuncs.parseType(indicators);
    return indicators;
};

export {
    getIndicators,
    getIndicatorTime,
    IndicatorPointType,
    Indicator
}
