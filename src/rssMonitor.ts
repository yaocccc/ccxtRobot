import * as RSSHub from 'rsshub';
import fs from 'fs';
import * as uuid from 'uuid';
import { get_dynamic_config, static_config } from './config';
import { sendMessage } from './wxClinet';
import { sleep } from './utils';

const cached = new Set();
const parseRss = (rssData: any) => {
    const datas = rssData.item
        .filter((item) => !cached.has(item.author + '|' + item.title))
        .slice(0, 3)
        .map((item) => {
            cached.add(item.author + '|' + item.title);
            return {
                user: item.author,
                title: item.title,
                time: new Date(item.pubDate).toLocaleString('zh', {hour12: false}),
                link: item.link,
                html: `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                    </head>
                    <a href='${item.link}'>Link</a>
                    <h2>${item.title}</h2>
                    <h3>${item.author}</h3> 
                    <h3>${new Date(item.pubDate).toLocaleString('zh', {hour12: false})}</h3>
                    <div>${item.description}</div>
                `
            };
        });
    return datas;
};

const getRss = async (url: string, time: number, firstTime: boolean) => {
    console.log('开始获取RSS', url);
    try {
        const rssData = await RSSHub.request(url).then((res) => parseRss(res));
        console.log(rssData)
        if (!firstTime) {
            for (const item of rssData) {
                const id = uuid.v4();
                const url = `http://tw.ccxx.icu/${id}.html`;
                fs.writeFileSync(`/www/tw/${id}.html`, item.html); // 写入html文件
                const msg = [`用户: ${item.user}`, `标题: ${item.title}`, `时间: ${item.time}`, '', url].join('\n');
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
    getRss(url, time, false);
}

RSSHub.init({
    CACHE_TYPE: null,
});
const run = async () => {
    getRss('/twitter/user/cz_binance/excludeReplies=1&count=3', 1000 * 10, true);
    getRss('/twitter/user/elonmusk/excludeReplies=1&count=3', 1000 * 10, true);
    // getRss('/twitter/user/binancezh/excludeReplies=1&count=3', 1000 * 10, true);
    getRss('/twitter/user/VitalikButerin/excludeReplies=1&count=3', 1000 * 10, true);
    getRss('/twitter/user/SBF_FTX/excludeReplies=1&count=3', 1000 * 10, true);
    // getRss('/weibo/user/2622472937/', 1000 * 60);
};

export {
    run as runRssMonitor
}
