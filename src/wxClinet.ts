import moment from 'moment';
import axios from 'axios';
import { Indicator, getIndicatorTime } from './parseIndicator';
import { OHLCV_KEYS } from './parseK';
import { retry } from './utils';
import { get_dynamic_config, static_config } from './config';

const sendedMessages = new Set();
const parseType = (indicator: Indicator) => {
    if (indicator.type === 'LOW_GOLD') return '低位金叉';
    if (indicator.type === 'LOW_DEAD') return '低位金叉';
    if (indicator.type === 'HIGN_GOLD') return '高位金叉';
    if (indicator.type === 'HIGN_DEAD') return '高位死叉';
    return ''
}
export const sendMessage = async (msg: string, group_wxid: string) => {
    const req =  {
        token: static_config.ccxt_robottoken,
        api: 'SendTextMsg',
        robot_wxid: static_config.ccxt_robotid,
        to_wxid: group_wxid,
        msg,
    };
    await retry(async () => {
        return axios.post(static_config.ccxt_wx_server, req);
    });
}
export const monitorMsg = async (indicator: Indicator, symbol: string, interval: string, title: string, extra = '', needAt = false) => {
    const now = Date.now();
    if (now - indicator.ohlcv[0] > 1000 * 60 * 60) return; // 只播报一小時内

    let msg = [
        `${title}`,
        `交易对: ${symbol} | K线级别: ${interval}`,
        `收盘价: ${indicator.ohlcv[OHLCV_KEYS.close]} USDT`,
        `当前时间: ${moment(now).format('YYYY-MM-DD HH:mm')}`,
        `对应的${interval}点: ${parseType(indicator)} | ${getIndicatorTime(indicator)} | ${indicator.STOCHRSI.k.toFixed(2)}`,
    ].join('\n');
    if (extra != "") msg += `${extra}`;
    const key = `${symbol}|${title}|${getIndicatorTime(indicator)}|${interval}`;
    if (sendedMessages.has(key)) return;

    const member_wxids = get_dynamic_config('member_wxids');
    for (const group_wxid of static_config.ccxt_monitor_wxgroupids) {
        const member_wxid = member_wxids.filter((m: string) => m.startsWith(group_wxid)).map((m: string) => m.split('___')[1]).join(',');
        const req = needAt && member_wxid != '' ? {
            token: static_config.ccxt_robottoken,
            api: 'SendGroupMsgAndAt',
            robot_wxid: static_config.ccxt_robotid,
            group_wxid,
            member_wxid,
            msg: `\n\n${msg}`,
        } : {
            token: static_config.ccxt_robottoken,
            api: 'SendTextMsg',
            robot_wxid: static_config.ccxt_robotid,
            to_wxid: group_wxid,
            msg,
        };

        console.log(key);
        await retry(async () => {
            return axios.post(static_config.ccxt_wx_server, req).then((res) => res.data.Code == 0 && sendedMessages.add(key));
        });
    }
};
