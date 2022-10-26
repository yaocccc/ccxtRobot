const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retry = async (func: Function, retryCount: number = 3, retryDelay: number = 1000) => {
    for (let i = 0; i < retryCount; i++) {
        try {
            const res = await func();
            return res;
        } catch (e) {
            console.log(e.stack)
            await sleep(retryDelay);
        }
    }
};

export { sleep, retry };

