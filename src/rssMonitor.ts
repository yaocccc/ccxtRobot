import * as RSSHub from 'rsshub';
import { get_dynamic_config, static_config } from './config';
import { sendMessage } from './wxClinet';
import { sleep } from './utils';

const cached = new Set();
const parseRss = (username: string, rssData: any) => {
    const datas = rssData.item
        .filter((item) => !cached.has(item.author + '|' + item.title))
        .slice(0, 3)
        .map((item) => {
            cached.add(item.author + '|' + item.title);
            return {
                user: item.author,
                title: item.title,
                time: new Date(item.pubDate).toLocaleString(),
                link: item.link,
            };
        });

    return datas;
};

const getRss = async (url: string, time: number, user: string, firstTime: boolean) => {
    console.log('开始获取RSS', url);
    try {
        const rssData = await RSSHub.request(url).then((res) => parseRss(url, res));
        console.log(rssData)
        if (!firstTime) {
            for (const item of rssData) {
                const msg = [`用户: ${item.user || user}`, `标题: ${item.title}`, `时间: ${item.time}`, '', item.link].join('\n');
                for (const group_wxid of static_config.ccxt_monitor_wxgroupids) {
                    await sendMessage(msg, group_wxid);
                }

                // 多给这个群发一路信号 19593650742@chatroom
                await sendMessage(msg, '19593650742@chatroom');
            }
        }
    } catch (e) {
        console.log(e);
    }

    await sleep(time);
    getRss(url, time, user, false);
}

RSSHub.init({
    CACHE_TYPE: null,
});
const run = async () => {
    getRss('/twitter/user/cz_binance/excludeReplies=1&count=3', 1000 * 10, '', true);
    getRss('/twitter/user/elonmusk/excludeReplies=1&count=3', 1000 * 10, '', true);
    getRss('/twitter/user/binancezh/excludeReplies=1&count=3', 1000 * 10, '', true);
    getRss('/twitter/user/justinsuntron/excludeReplies=1&count=3', 1000 * 10, '', true);
    getRss('/twitter/user/VitalikButerin/excludeReplies=1&count=3', 1000 * 10, '', true);
    getRss('/blockbeats/flash', 1000 * 10, '律动快讯', true);
    // getRss('/weibo/user/2622472937/', 1000 * 60);
};

export {
    run as runRssMonitor
}
