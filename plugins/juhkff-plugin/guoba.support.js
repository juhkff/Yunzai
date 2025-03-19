import path from "path";
import lodash from "lodash";
import { pluginResources } from "#juhkff.path";
import setting from "#juhkff.setting";
import { ChatInterface, chatMap } from "#juhkff.api.chat";
import Objects from "#juhkff.kits";

// 支持锅巴
export function supportGuoba() {
  return {
    // 插件信息，将会显示在前端页面
    // 如果你的插件没有在插件库里，那么需要填上补充信息
    // 如果存在的话，那么填不填就无所谓了，填了就以你的信息为准
    pluginInfo: {
      // name 为插件唯一标识，尽量不要与其他插件重复
      name: "juhkff-plugin",
      // title 为显示名称
      title: "综合插件 (juhkff-plugin)",
      // 插件描述
      description: "主动回复群聊、表情偷取、日报推送等综合功能插件",
      // 作者可以为字符串也可以为数组，当有多个作者时建议使用数组
      author: ["@扎克芙芙"],
      // 作者主页地址。若author为数组，则authorLink也需要为数组，且需要与author一一对应
      authorLink: ["https://github.com/juhkff"],
      // 仓库地址
      link: "https://github.com/juhkff/juhkff-plugin",
      isV3: true,
      isV2: false,
      // 是否显示在左侧菜单，可选值：auto、true、false
      // 当为 auto 时，如果配置项大于等于 3 个，则显示在左侧菜单
      showInMenu: "auto",
      // 显示图标，此为个性化配置
      // 图标可在 https://icon-sets.iconify.design 这里进行搜索
      icon: "material-symbols:robot-2-rounded",
      // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
      iconColor: "#288ac3",
      // 如果想要显示成图片，也可以填写图标路径（绝对路径）
      iconPath: path.join(pluginResources, "images/icon.jpg"),
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        {
          label: "群聊配置",
          // 第一个分组标记开始，无需标记结束
          component: "SOFT_GROUP_BEGIN",
        },
        {
          field: "autoReply.useAutoReply",
          label: "主动群聊开关",
          bottomHelpMessage: "若开启，BOT会根据概率和设定主动回复群聊",
          component: "Switch",
        },
        {
          field: "autoReply.attachUrlAnalysis",
          label: "是否解析URL",
          bottomHelpMessage:
            "是否解析消息中包含的链接，确保chatApi生效时开启，可能会降低AI回复准确度",
          // 【组件类型】，可参考
          // https://doc.vvbin.cn/components/introduction.html
          // https://3x.antdv.com/components/overview-cn/
          component: "Switch",
        },
        {
          field: "autoReply.useContext",
          label: "是否使用上下文",
          bottomHelpMessage: "是否保存群聊历史对话",
          component: "Switch",
        },
        {
          field: "autoReply.maxHistoryLength",
          label: "上下文长度",
          bottomHelpMessage: "存储历史对话的长度",
          component: "InputNumber",
          componentProps: {
            min: 1,
            step: 1,
          },
        },
        {
          field: "autoReply.chatApi",
          label: "群聊AI接口选择",
          bottomHelpMessage:
            "AI接口选择，如果开启解析URL，则该接口也会用于URL内容总结",
          component: "Select",
          componentProps: {
            options: [
              { label: "deepseek", value: "deepseek" },
              { label: "siliconflow", value: "siliconflow" },
            ],
          },
        },
        {
          field: "autoReply.chatApiKey",
          label: "群聊AI ApiKey",
          bottomHelpMessage: "deepseek的apiKey或siliconflow的apiKey",
          component: "Input",
        },
        {
          field: "autoReply.chatModel",
          label: "群聊AI模型",
          bottomHelpMessage:
            "选择AI接口，写入正确的ApiKey，保存并刷新页面后，再选择该项",
          component: "Select",
          componentProps: {
            options: getChatModels(),
          },
        },
        {
          field: "autoReply.defaultChatRate",
          label: "默认主动回复率",
          bottomHelpMessage: "概率小数[0,1]，越高越容易触发主动回复",
          component: "InputNumber",
          componentProps: {
            min: 0,
            max: 1,
            step: 0.01,
          },
          required: true,
        },
        {
          field: "autoReply.groupChatRate",
          label: "特定群主动回复率",
          bottomHelpMessage: "该项优先于默认概率",
          component: "GSubForm",
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: "groupList",
                label: "群号",
                required: true,
                bottomHelpMessage: "群号",
                component: "GSelectGroup",
                required: true,
              },
              {
                field: "chatRate",
                label: "主动回复概率",
                component: "InputNumber",
                componentProps: {
                  min: 0,
                  max: 1,
                  step: 0.01,
                },
                required: true,
              },
            ],
          },
        },
        {
          field: "autoReply.useVisual",
          label: "是否使用视觉AI",
          bottomHelpMessage: "开启此选项可对图片进行识别并应用于上下文记忆",
          component: "Switch",
        },
        {
          field: "autoReply.visualApi",
          label: "视觉AI接口选择",
          bottomHelpMessage: "可选项：siliconflow",
          component: "Select",
          componentProps: {
            options: [{ label: "siliconflow", value: "siliconflow" }],
          },
        },
        {
          field: "autoReply.visualApiKey",
          label: "视觉AI ApiKey",
          bottomHelpMessage: "目前仅支持siliconflow的apiKey",
          component: "Input",
        },
        {
          field: "autoReply.visualModel",
          label: "视觉AI模型选择",
          bottomHelpMessage: "目前仅支持Qwen/Qwen2-VL-72B-Instruct",
          component: "Select",
          componentProps: {
            options: [
              {
                label: "Qwen/Qwen2-VL-72B-Instruct（视觉）",
                value: "Qwen/Qwen2-VL-72B-Instruct",
              },
            ],
          },
        },
        {
          field: "autoReply.chatPrompt",
          label: "群聊预设",
          bottomHelpMessage: "定义BOT的人设或信息处理的基本逻辑",
          component: "Input",
          componentProps: {
            placeholder: "请输入群聊预设",
          },
        },
        {
          field: "autoReply.useEmotion",
          label: "BOT情感开关",
          bottomHelpMessage:
            "若开启，BOT每天会生成当天心情用于辅助生成群聊内容",
          component: "Switch",
        },
        {
          field: "autoReply.emotionGenerateTime",
          label: "定时生成情感时间",
          bottomHelpMessage:
            "秒[0,59] 分钟[0,59] 小时[0,23] 日期[1,31] 月份[1,12] 星期[0,7/SUN,SAT]",
          component: "Input",
          componentProps: {
            placeholder: "*表示任意，?表示不指定（月日和星期互斥）",
          },
        },
        {
          field: "autoReply.emotionGeneratePrompt",
          label: "情感生成预设",
          bottomHelpMessage: "BOT的每日心情生成所使用的预设",
          component: "Input",
          componentProps: {
            placeholder: "请输入心情预设",
          },
        },
        {
          label: "日报配置",
          // 第二个分组标记开始
          component: "SOFT_GROUP_BEGIN",
        },
        {
          field: "dailyReport.useDailyReport",
          label: "日报开关",
          bottomHelpMessage: "若开启，BOT会启用 `#日报` 命令和定时发送任务",
          component: "Switch",
        },
        {
          field: "dailyReport.dailyReportFullShow",
          label: "新闻是否显示完全信息",
          bottomHelpMessage: "根据个人喜好调整：新闻单行显示/换行完全显示",
          component: "Switch",
        },
        {
          field: "dailyReport.alapiToken",
          label: "alapi_token",
          bottomHelpMessage: "该项置空即可",
          component: "Input",
        },
        {
          field: "dailyReport.push",
          label: "是否开启定时推送",
          bottomHelpMessage: "开启后可在特定时刻自动推送日报到指定群组",
          component: "Switch",
        },
        {
          field: "dailyReport.dailyReportTime",
          label: "定时发送日报时间",
          bottomHelpMessage:
            "秒[0,59] 分钟[0,59] 小时[0,23] 日期[1,31] 月份[1,12] 星期[0,7/SUN,SAT]",
          component: "Input",
          componentProps: {
            placeholder: "*表示任意，?表示不指定（月日和星期互斥）",
          },
        },
        {
          field: "dailyReport.pushGroupList",
          label: "推送群组列表",
          bottomHelpMessage: "推送群组列表",
          component: "GSelectGroup",
        },
        {
          label: "偷图配置",
          // 第三个分组标记开始
          component: "SOFT_GROUP_BEGIN",
        },
        {
          field: "emojiSave.useEmojiSave",
          label: "偷图功能开关",
          bottomHelpMessage: "若开启，BOT会根据配置偷表情和发表情",
          component: "Switch",
        },
        {
          field: "emojiSave.defaultReplyRate",
          label: "默认回复表情概率",
          bottomHelpMessage: "默认回复表情概率",
          component: "InputNumber",
          componentProps: {
            min: 0,
            max: 1,
            step: 0.01,
          },
          required: true,
        },
        {
          field: "emojiSave.defaultEmojiRate",
          label: "默认发送偷图概率",
          bottomHelpMessage: "目前未实现本地图库，必发偷的图，该配置暂时无意义",
          component: "InputNumber",
          componentProps: {
            min: 0,
            max: 1,
            step: 0.01,
          },
          required: true,
        },
        {
          field: "emojiSave.expireTimeInSeconds",
          label: "表情确认时间（秒）",
          bottomHelpMessage:
            "只有发送两次相同图片时，会被记为表情并偷取，默认259200为3天",
          component: "InputNumber",
          componentProps: {
            min: 1,
            step: 1,
          },
          required: true,
        },
        {
          field: "emojiSave.groupRate",
          label: "特定群偷图配置",
          bottomHelpMessage: "该项优先于默认概率",
          component: "GSubForm",
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: "groupList",
                label: "群号",
                required: true,
                bottomHelpMessage: "群号",
                component: "GSelectGroup",
              },
              {
                field: "replyRate",
                label: "回复表情概率",
                component: "InputNumber",
                componentProps: {
                  min: 0,
                  max: 1,
                  step: 0.01,
                },
                required: true,
              },
              {
                field: "emojiRate",
                label: "发送偷图概率",
                component: "InputNumber",
                componentProps: {
                  min: 0,
                  max: 1,
                  step: 0.01,
                },
                required: false,
              },
            ],
          },
        },
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        var config = setting.getAllConfig();
        var guobaConfig = {};
        //将二层配置转为一层配置
        for (var app in config) {
          for (var key in config[app]) {
            guobaConfig[`${app}.${key}`] = config[app][key];
          }
        }
        return guobaConfig;
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        var config = setting.getAllConfig();
        // 更新前校验和处理
        var beforeResult = beforeUpdate(config);
        if (beforeResult.code != 0) {
          return Result.error(beforeResult.code, null, beforeResult.message);
        }
        for (let [keyPath, value] of Object.entries(data)) {
          var keyPaths = keyPath.split(".");
          var app = keyPaths[0];
          var key = keyPaths[1];
          if (!(app in config)) config[app] = {};
          config[app][key] = value;
        }
        // 更新后校验和处理
        var afterResult = afterUpdate(config);
        if (afterResult.code != 0) {
          return Result.error(afterResult.code, null, afterResult.message);
        }
        // 前后配置比较处理
        var compare = validate(beforeResult, afterResult, config);
        if (compare.code != 0) {
          return Result.error(compare.code, null, compare.message);
        }
        var err = setting.setConfig(config);
        if (err != null)
          return Result.err(-1, null, "保存失败: " + err.message);
        else {
          onFinish(config);
          return Result.ok({}, "保存成功~");
        }
      },
    },
  };
}

/**
 * 更新前校验和处理
 * @param {*} config 更新前配置
 * @returns code, message, data
 */
function beforeUpdate(config) {
  var preChatApi = config.autoReply.chatApi;
  return {
    code: 0,
    message: "校验成功",
    data: {
      chatApi: preChatApi,
    },
  };
}

/**
 * 更新后校验和处理
 * @param {*} config 更新后配置
 * @returns code, message, data
 */
function afterUpdate(config) {
  if (config.autoReply.useAutoReply) {
    if (Objects.isNull(config.autoReply.chatApi)) {
      return {
        code: -1,
        message: "请选择有效的群聊AI接口",
      };
    }
    if (Objects.isNull(config.autoReply.chatApiKey)) {
      return {
        code: -1,
        message: "请输入有效的群聊AI ApiKey",
      };
    }
  }
  if (config.autoReply.useVisual) {
    if (Objects.isNull(config.autoReply.visualApi)) {
      return {
        code: -1,
        message: "请选择有效的视觉AI接口",
      };
    }
    if (Objects.isNull(config.autoReply.visualApiKey)) {
      return {
        code: -1,
        message: "请输入有效的视觉AI ApiKey",
      };
    }
    if (Objects.isNull(config.autoReply.visualModel)) {
      return {
        code: -1,
        message: "请选择有效的视觉AI模型",
      };
    }
  }
  var newChatApi = config.autoReply.chatApi;
  return {
    code: 0,
    message: "校验成功",
    data: {
      chatApi: newChatApi,
    },
  };
}

/**
 * 前后配置比较处理
 * @param {*} before beforeUpdate 阶段暂存结果
 * @param {*} after afterUpdate 阶段暂存结果
 * @param {*} config 配置
 * @returns code, message
 */
function validate(before, after, config) {
  var origin = before.data;
  var after = after.data;
  if (origin.chatApi != after.chatApi) {
    config.autoReply.chatModel = "";
  }
  return {
    code: 0,
    message: "校验成功",
  };
}

/**
 * 配置更新后回调
 * @param {*} config
 */
function onFinish(config) {
  var chatInstance = chatMap[config.autoReply.chatApi];
  chatInstance[ChatInterface.getModelMap]();
}

function getChatModels() {
  var chatApi = setting.getConfig("autoReply").chatApi;
  var chatInstance = chatMap[chatApi];
  if (!chatInstance) return ["请选择有效的群聊AI接口"];
  var result = [];
  for (const key of Object.keys(chatInstance.ModelMap)) {
    result.push({ label: key, value: key });
  }
  return result;
}
