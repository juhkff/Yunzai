import fs, { appendFile } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from 'url';

const _filename = fileURLToPath(import.meta.url);
// 插件根目录 /../../plugins/juhkff-plugin
const pluginRoot = path.dirname(_filename);

if (!global.segment) {
    global.segment = (await import("oicq")).segment;
}

let ret = [];

logger.info(logger.yellow("- 正在载入 JUHKFF-PLUGIN"));
logger.info("- [JUHKFF-PLUGIN] 如果插件更新后出现问题，可能是新的配置同步时出现错误，可以尝试删除并重装该插件");

async function getFiles(dir) {
    const dirs = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        dirs.map((each) => {
            const res = path.resolve(dir, each.name);
            return each.isDirectory() ? getFiles(res) : res;
        })
    );
    return Array.prototype.concat(...files);
}

const appFiles = await getFiles(path.join(pluginRoot, "javascript", "apps")).then((files) =>
    files.filter((file) => file.endsWith(".js"))
);

const bgProcessFiles = await getFiles(path.join(pluginRoot, "javascript", "bgProcess")).then((files) =>
    files.filter((file) => file.endsWith(".js"))
);

const files = [...appFiles, ...bgProcessFiles];

files.forEach((file) => {
    file = pathToFileURL(file).href;  // 支持 Windows 路径
    ret.push(import(file));
});

ret = await Promise.allSettled(ret);

let apps = {};
for (let i in files) {
    let name = files[i].replace(".js", "");
    const appName = path.basename(name);

    if (ret[i].status !== "fulfilled") {
        logger.error(`载入插件错误：${logger.red(name)}`);
        logger.error(ret[i].reason);
        continue;
    }
    // apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
    const keys = Object.keys(ret[i].value);
    const validKey = keys.find(key => key.toLowerCase() === appName.toLowerCase()) || keys[0]; // 如果没有同名的键，默认取第一个
    apps[name] = ret[i].value[validKey];
}

logger.info(logger.green("- JUHKFF-PLUGIN 载入成功"));

export { apps };
