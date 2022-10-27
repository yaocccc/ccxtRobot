import Koa from 'koa';
import { Middleware, ParameterizedContext } from 'koa';
import bodyParser from 'koa-body';
import Router from 'koa-router';
import { get_dynamic_config, set_dynamic_config, static_config } from './config';
import { sendMessage } from './wxClinet';
import { client } from './ccxtClient';
import { trendCache, priceCache } from './monitor';

export const createRequestMonitor = (bodyParser: Middleware): Middleware => {
    return async (ctx: ParameterizedContext, next: () => Promise<any>) => {
        const startTime = Date.now();
        try {
            await bodyParser(ctx, () => Promise.resolve(0));
        } catch (e) {
            ctx.logger.info(`monitor: error parsing request.`);
        }
        await next();
    };
};

const run = async () => {
    const app = new Koa();
    const router = new Router();

    const msgsMap = {
        口令: {
            desc: '返回口令列表',
            func: async (group_wxid: string, ...args: any[]) => {
                const texts = [];
                for (const key in msgsMap) {
                    texts.push(`${key}: ${msgsMap[key].desc}`);
                }
                sendMessage(texts.join('\n'), group_wxid);
            },
        },

        监控列表: {
            desc: '返回监控列表',
            func: (group_wxid: string, ...args: any[]) => sendMessage(get_dynamic_config('symbols').join('\n'), group_wxid),
        },

        添加监控: {
            desc: '添加监控: (添加监控 ETCUSDT)',
            func: async (group_wxid: string, ...args: any[]) => {
                const symbol = args[0];
                if (symbol) {
                    let k = [];
                    let err: any;
                    try {
                        k = await client.fetchOHLCV(symbol, '1M');
                    } catch (e) {
                        err = e.stack;
                    }
                    if (k.length > 0) {
                        if (!get_dynamic_config('symbols').includes(symbol)) set_dynamic_config('symbols', [...get_dynamic_config('symbols'), symbol]);
                        await sendMessage(`添加监控: ${symbol} 成功\n当前监控列表: \n\n` + get_dynamic_config('symbols').join('\n'), group_wxid);
                    } else {
                        await sendMessage(`添加监控: ${symbol} 失败\n${err}`, group_wxid);
                    }
                } else {
                    await sendMessage('请输入监控对象 例: 添加监控 ETCUSDT', group_wxid);
                }
            },
        },

        删除监控: {
            desc: '删除监控: (删除监控 ETCUSDT)',
            func: async (group_wxid: string, ...args: any[]) => {
                const symbol = args[0];
                if (symbol) {
                    const symbols = get_dynamic_config('symbols').filter((s) => s !== symbol);
                    set_dynamic_config('symbols', symbols);
                    await sendMessage(`删除监控: ${symbol} 成功\n当前监控列表: \n\n` + get_dynamic_config('symbols').join('\n'), group_wxid);
                } else {
                    await sendMessage('请输入监控对象 例: 删除监控 ETCUSDT', group_wxid);
                }
            },
        },

        at列表: {
            desc: '返回at列表',
            func: (group_wxid: string, ...args: any[]) => sendMessage(get_dynamic_config('member_wxids').join('\n'), group_wxid),
        },
        添加at我: {
            desc: '添加@我',
            func: async (group_wxid: string, ...args: any[]) => {
                const wxid = args[0];
                if (!get_dynamic_config('member_wxids').includes(wxid)) set_dynamic_config('member_wxids', [...get_dynamic_config('member_wxids'), wxid]);
                await sendMessage(`添加@我: ${wxid} 成功\n当前at列表: \n\n` + get_dynamic_config('member_wxids').join('\n'), group_wxid);
            },
        },
        删除at我: {
            desc: '删除@我',
            func: async (group_wxid: string, ...args: any[]) => {
                const wxid = args[0];
                const wxids = get_dynamic_config('member_wxids').filter((s) => s !== wxid);
                set_dynamic_config('member_wxids', wxids);
                await sendMessage(`删除@: ${wxid} 成功\n当前@列表: \n\n` + get_dynamic_config('member_wxids').join('\n'), group_wxid);
            },
        },

        查看趋势: {
            desc: '查看4h趋势',
            func: async (group_wxid: string, ...args: any[]) => {
                const texts = [];
                for (const symbol of [...trendCache.keys()]) {
                    const price = priceCache.get(symbol) || '';
                    texts.push(`${symbol}: ${trendCache.get(symbol)[0] == 'BUY' ? `多(实时) ${price[0]}` : `空(实时) ${price[0]}`}`);
                }
                await sendMessage(texts.join('\n'), group_wxid);
            },
        },

        重新启动: {
            desc: '重新启动服务',
            func: (group_wxid: string, ...args: any[]) => process.exit(0),
        },
    };

    router.post('/', async (ctx: ParameterizedContext) => {
        let body: any = ctx.request.body;
        try {
            body = JSON.parse(ctx.request.body);
        } catch (e) {}
        if (body.Event == 'EventGroupChat' && static_config.ccxt_monitor_wxgroupids.includes(body.content.from_group) && body.content.from_wxid) {
            const msg = body.content.msg.replace(/\\u/g, '%u');
            const _params = msg.split(' ').filter((p) => p != ' ');
            const order = _params[0];
            let args = _params.slice(1).map((s) => s.trim());
            for (const key in msgsMap) {
                if (key == order) {
                    console.log(key, ...args);
                    if (key == '添加at我' || key == '删除at我') {
                        args = [`${body.content.from_group}___${body.content.from_wxid}`];
                    }
                    msgsMap[order].func(body.content.from_group, ...args);
                    break;
                }
            }
        }
        ctx.body = 'ok';
    });

    router.get('/', async (ctx: ParameterizedContext) => {
        const result = {};
        priceCache.forEach((v, k) => {
            result[k] = v[0];
        })
        ctx.body = result;
    });

    app.use(
        createRequestMonitor(
            bodyParser({
                multipart: true,
                formidable: {
                    maxFileSize: 3145728,
                },
            })
        )
    ).use(router.routes());

    const server = app.listen(7666);
    console.log('api is running on 7666');
    return server;
};

export { run as runServer };
