import * as RSSHub from 'rsshub';
import { ethers, providers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import * as uuid from 'uuid';
import { get_dynamic_config, static_config } from './config';
import { monitorMsg, sendMessage } from './wxClinet';
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
                        <meta charset="UTF-8" />
                        <style>
                          body,html, div, p { padding: 0px; margin: 0;  }
                          .title { width: 710px; margin: 0 auto;  padding: 20px; }
                          .title h2, .title h3 { margin: 16px 0; }
                          .content { width: 710px; margin: 0 auto; padding: 20px; }
                          .content video { width: 710px; }
                          .content .link { margin: 10px 0; display: block; }
                        </style>
                        <script src="http://g.tbcdn.cn/mtb/lib-flexible/0.3.2/??flexible_css.js,flexible.js" ></script>
                      </head>
                      <div class="title">
                        <a href="${item.link}">Link</a>
                        <h2>${item.title}</h2>
                        <h3>${item.author}</h3> 
                        <h3>${new Date(item.pubDate).toLocaleString('zh', {hour12: false})}</h3>
                      </div>
                      <div class="content">${item.description}</div>
                    </html>
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

let eth = -1;
const monitorEth = async () => {
    try {
        const _eth = await axios.get(`https://api.etherscan.io/api/?module=account&action=balance&address=0x59abf3837fa962d6853b4cc0a19513aa031fd32b&tag=latest&apikey=VR9IVVURYC4N5SW2ZWQ6VQWHT7FPAVVYEP`).then((r) => Number(ethers.utils.formatEther(r.data.result)))
        console.log(_eth)
        // if (eth === -1) {
        //     eth = _eth;
        // }
        if (eth != _eth) {
            const msg = `FTX黑客账户ETH余额发生变动: \n 从 ${eth} 变为 ${_eth}`;
            for (const group_wxid of static_config.ccxt_monitor_wxgroupids) {
                await sendMessage(msg, group_wxid);
            }
            eth = _eth;
        }
    } catch (e) {
    }

    await sleep(20 * 1000);
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
    monitorEth();
};

export {
    run as runRssMonitor
}
