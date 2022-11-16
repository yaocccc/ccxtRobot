import * as RSSHub from 'rsshub';
import fs from 'fs';
import * as uuid from 'uuid';
import { get_dynamic_config, static_config } from './config';
import { sendMessage } from './wxClinet';
import { sleep } from './utils';

const runtime = Date.now();
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

const getRss = async (url: string) => {
    console.log('开始获取RSS', url);
    try {
        const rssData = await RSSHub.request(url).then((res: any) => parseRss(res));
        console.log(rssData)
        if (Date.now() - runtime > 1000 * 60) { // 启动的一分钟内不推送
            for (const item of rssData) {
                const id = uuid.v4();
                const url = `http://tw.ccxx.icu/${id}.html`;
                fs.writeFileSync(`/www/tw/${id}.html`, item.html); // 写入html文件
                const msg = [`用户: ${item.user}`, `标题: ${item.title}`, `时间: ${item.time}`, '', url].join('\n');
                for (const group_wxid of static_config.ccxt_monitor_wxgroupids) {
                    await sendMessage(msg, group_wxid);
                }
            }
        }
    } catch (e) {
        console.log(e);
    }

    await sleep(10 * 1000);
    getRss(url);
}

RSSHub.init({
    CACHE_TYPE: null,
});
const run = async () => {
    getRss('/twitter/user/cz_binance/excludeReplies=1&count=3');
    getRss('/twitter/user/elonmusk/excludeReplies=1&count=3');
    // getRss('/twitter/user/binancezh/excludeReplies=1&count=3');
    getRss('/twitter/user/VitalikButerin/excludeReplies=1&count=3');
    getRss('/twitter/user/SBF_FTX/excludeReplies=1&count=3');
    // getRss('/weibo/user/2622472937/');
};

export {
    run as runRssMonitor
}
