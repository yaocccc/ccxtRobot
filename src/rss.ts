import * as RSSHub from 'rsshub';

RSSHub.init({ CACHE_TYPE: null });
RSSHub.request(`/twitter/user/VitalikButerin/excludeReplies=1&count=3`).then((res) => console.log(res)).catch(e => console.log(e));
