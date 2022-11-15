import * as RSSHub from 'rsshub';

RSSHub.init({ CACHE_TYPE: null });
RSSHub.request(`/weibo/user/2622472937/`).then((res) => console.log(res)).catch(e => console.log(e));
