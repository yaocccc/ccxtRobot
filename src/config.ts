import fs from 'fs';
import path from 'path';

type KEY = 'symbols' | 'member_wxids';
let symbols = [];
let member_wxids = [];

const file = path.resolve(__dirname, '../config.json');
const static_config = {
    bianan_apikey: '',
    bianan_secret: '',
    ccxt_monitor_wxgroupids: [],
    ccxt_wx_server: '',
    ccxt_robotid: '',
    ccxt_robottoken: '',
};

const init_config = () => {
    const data = fs.readFileSync(file, 'utf8');
    const config = JSON.parse(data);
    symbols = config.symbols;
    member_wxids = config.member_wxids;

    const envs = Object.keys(static_config);
    for (const key of envs) {
        if (key === 'ccxt_monitor_wxgroupids') static_config[key] = process.env[key.toUpperCase()].split(',');
        else static_config[key] = process.env[key.toUpperCase()];
    }
};

const _save_config = () => {
    const config = {
        symbols,
        member_wxids,
    }
    fs.writeFileSync(file, JSON.stringify(config));
};

const set_dynamic_config = (key: KEY, value: any) => {
    switch (key) {
        case 'symbols': symbols = value; break;
        case 'member_wxids': member_wxids = value; break;
    }
    _save_config();
}

const get_dynamic_config = (key: KEY): any => {
    switch (key) {
        case 'symbols': return symbols;
        case 'member_wxids': return member_wxids;
    }
}

export {
    init_config,
    get_dynamic_config,
    set_dynamic_config,
    static_config,
}
