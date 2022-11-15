import * as RSSHub from 'rsshub';
import { get_dynamic_config, static_config } from './config';
import { sendMessage } from './wxClinet';
import { sleep } from './utils';

const cached = new Set();
const parseTwitter = (username: string, twitterData: any) => {
    const datas = twitterData.item
        .filter((item) => !item.title.startsWith('Re @'))
        .filter((item) => !cached.has(username + '|' + item.title))
        .slice(0, 5)
        .map((item) => {
            cached.add(username + '|' + item.title);
            return {
                user: username,
                title: item.title,
                time: new Date(item.pubDate).toLocaleString(),
                link: item.link,
            };
        });

    return datas;
};

const getTwitter = async (username: string) => {
    try {
        const twitterData = await RSSHub.request(`/twitter/user/${username}/`).then((res) => parseTwitter(username, res));
        for (const item of twitterData) {
            for (const group_wxid of static_config.ccxt_monitor_wxgroupids) {
                await sendMessage([`推特监控: ${item.user}`, `标题: ${item.title}`, `时间: ${item.time}`].join('\n'), group_wxid);
            }
        }

    } catch (e) {}
}

RSSHub.init({
    CACHE_TYPE: null,
});
const run = async () => {
    await Promise.all([
        getTwitter('cz_binance'), 
        getTwitter('elonmusk'),
        getTwitter('binancezh'),
    ]);
    await sleep(10000)
    run();
};

export {
    run as runTwitterMonitor
}
