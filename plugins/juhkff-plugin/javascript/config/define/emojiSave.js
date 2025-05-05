import path from "path";
import fs from "fs";
import YAML from "yaml";
import { PLUGIN_CONFIG_DIR, PLUGIN_DEFAULT_CONFIG_DIR } from "../../model/path.js";
import { configFolderCheck, configSync } from "../common.js";
export let emojiSaveConfig = null;
export function setEmojiSaveConfig(config) {
    emojiSaveConfig = config;
}
(() => {
    const file = path.join(PLUGIN_CONFIG_DIR, `emojiSave.yaml`);
    const defaultFile = path.join(PLUGIN_DEFAULT_CONFIG_DIR, `emojiSave.yaml`);
    if (configFolderCheck(file, defaultFile))
        logger.info(`[JUHKFF-PLUGIN]创建表情包配置`);
    emojiSaveConfig = YAML.parse(fs.readFileSync(file, "utf8"));
    const defaultConfig = YAML.parse(fs.readFileSync(defaultFile, "utf8"));
    configSync(emojiSaveConfig, defaultConfig);
    fs.writeFileSync(file, YAML.stringify(emojiSaveConfig));
    /*
    chokidar.watch(file).on("change", () => {
        emojiSaveConfig = YAML.parse(fs.readFileSync(file, "utf8"));
        logger.info(`[JUHKFF-PLUGIN]同步表情偷取配置`);
    }).on("error", (err) => { logger.error(`[JUHKFF-PLUGIN]表情偷取同步配置异常`, err) })
    */
})();
//# sourceMappingURL=emojiSave.js.map