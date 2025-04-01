import YAML from "yaml";
import fs from "node:fs";
import { _path, pluginResources, pluginRoot } from "#juhkff.path";
import path from "path";
import Objects from "#juhkff.kits";

class Setting {
  constructor() {
    /** 用户设置 */
    this.configPath = path.join(pluginRoot, "config");
    this.config = this.initConfig();

    this.dataPath = path.join(pluginRoot, "data");
    this.data = {};
  }

  initConfig() {
    var config = {};
    if (!fs.existsSync(this.configPath)) {
      logger.error(`插件缺失配置文件夹`);
      return false;
    }
    var defaultConfigDir = path.join(this.configPath, "default");
    var files = this.getAllFiles(defaultConfigDir).filter((f) =>
      f.endsWith(".yaml")
    );
    for (const defaultFile of files) {
      const app = path.basename(defaultFile, ".yaml");
      if (!fs.existsSync(path.join(this.configPath, `${app}.yaml`))) {
        // 复制 default 内对应的 yaml 文件到 config/*.yaml 中
        fs.copyFileSync(
          path.join(defaultConfigDir, `${app}.yaml`),
          path.join(this.configPath, `${app}.yaml`)
        );
        logger.info(`已复制 ${app} 默认配置文件`);
      }
      var file = path.join(this.configPath, `${app}.yaml`);
      if (app in config) {
        logger.error(`[${app}] 配置文件不止一个`);
        return false;
      }

      try {
        // 先读取用户配置文件
        config[app] = YAML.parse(fs.readFileSync(file, "utf8"));
        var defaultConfig = YAML.parse(fs.readFileSync(defaultFile, "utf8"));

        // 对预设单独处理，将旧预设自动更新为新预设
        var oldPromptList = defaultConfig["oldPrompt"];
        if (!Objects.isNull(oldPromptList)) {
          var curPrompt = config["autoReply"]["chatPrompt"];
          if (oldPromptList.includes(curPrompt.trim())) {
            config["autoReply"]["chatPrompt"] = defaultConfig["chatPrompt"];
          }
        }

        // 优先使用用户配置文件，添加缺少的配置，便于版本更新同步
        for (var key in config[app]) {
          if (key in defaultConfig) {
            delete defaultConfig[key];
          } else {
            // 用户配置中多余的配置
            // delete config[app][key];
          }
        }
        // 手动删除不应同步的配置
        delete defaultConfig["oldPrompt"];
        // 新增配置同步到用户配置文件中
        for (var key in defaultConfig) {
          config[app][key] = defaultConfig[key];
        }
        // 保存用户配置文件
        fs.writeFileSync(file, YAML.stringify(config[app]));
      } catch (error) {
        logger.error(`[${app}.yaml] 格式错误 ${error}`);
        return false;
      }
    }
    return config;
  }

  // 获取所有应用配置
  getAllConfig() {
    return this.config;
  }

  setConfig(config) {
    this.config = config;
    // 保存
    for (var app in this.config) {
      try {
        fs.writeFileSync(
          path.join(this.configPath, `${app}.yaml`),
          YAML.stringify(this.config[app])
        );
      } catch (error) {
        logger.error(`[${app}.yaml] 格式错误 ${error}`);
        return error;
      }
    }
    return null;
  }

  // 获取对应应用配置
  getConfig(app) {
    return this.config[app];
  }

  // 获取对应数据文件
  getData(folderPath, filename) {
    folderPath = path.join(this.dataPath, folderPath);
    try {
      if (!fs.existsSync(path.join(folderPath, `${filename}.yaml`))) {
        return false;
      }
      return YAML.parse(
        fs.readFileSync(path.join(folderPath, `${filename}.yaml`), "utf8")
      );
    } catch (error) {
      logger.error(`[${filename}] 读取失败 ${error}`);
      return false;
    }
  }

  // 递归获取目录下所有文件
  getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      fileList.push(filePath);
      /*
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
      */
    });
    return fileList;
  }
}

export default new Setting();
