import path from "path";
import lodash from "lodash";
import { pluginResources } from "#juhkff.path";
import setting from "#juhkff.setting";
import { ChatInterface, chatMap } from "#juhkff.api.chat";
import Objects from "#juhkff.kits";
import { VisualInterface, visualMap } from "#juhkff.api.visual";
import { removeSubKeys, EMOTION_KEY } from "#juhkff.redis";

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
          field: "autoReply.defaultChatRate",
          label: "主动回复概率",
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
          field: "autoReply.defaultReplyAtBot",
          label: "@BOT时回复",
          bottomHelpMessage:
            "当有人@BOT时，BOT是否回复。如果关闭，@BOT也会走概率回复",
          component: "Switch",
          required: true,
        },
        {
          field: "autoReply.groupChatRate",
          label: "特定群设置",
          bottomHelpMessage: "该项优先于默认设置",
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
              {
                field: "replyAtBot",
                label: "@BOT时回复",
                component: "Switch",
                componentProps: {
                  defaultChecked: true,
                },
                bottomHelpMessage: "不管是还是否，都要点一下才能提交",
                required: true,
              },
            ],
          },
        },
        {
          field: "autoReply.chatPrompt",
          label: "群聊预设",
          bottomHelpMessage: "定义BOT的人设或信息处理的基本逻辑",
          component: "InputTextArea",
          componentProps: {
            placeholder: "请输入群聊预设",
            rows: 6,
          },
        },
        {
          field: "autoReply.useEmotion",
          label: "BOT情感开关",
          bottomHelpMessage:
            "若开启，会生成每日心情辅助生成群聊内容，由于意义不明，默认设为关闭",
          component: "Switch",
        },
        {
          field: "autoReply.emotionGenerateTime",
          label: "定时生成情感时间",
          bottomHelpMessage:
            "秒[0,59] 分钟[0,59] 小时[0,23] 日期[1,31] 月份[1,12] 星期[0,7/SUN,SAT]",
          component: "EasyCron",
          componentProps: {
            placeholder: "*表示任意，?表示不指定（月日和星期互斥）",
          },
        },
        {
          field: "autoReply.emotionGeneratePrompt",
          label: "情感生成预设",
          bottomHelpMessage: "BOT的每日心情生成所使用的预设",
          component: "InputTextArea",
          componentProps: {
            placeholder: "请输入心情预设",
            rows: 3,
          },
        },
        {
          component: "Divider",
          label: "常规接口配置",
          componentProps: {
            type: "horizontal",
            style: {
              fontWeight: "bold",
              color: "rgb(76, 113, 201)",
              fontSize: "16px",
            },
            // 前端写死了，这里写啥其实都没用
            orientation: "left",
            plain: true,
          },
        },
        {
          field: "autoReply.chatApi",
          label: "群聊AI接口选择",
          bottomHelpMessage:
            "AI接口选择，如果开启解析URL，则该接口也会用于URL内容总结",
          component: "Select",
          componentProps: {
            options: listAllChatApi(),
          },
        },
        {
          field: "autoReply.chatApiKey",
          label: "群聊AI ApiKey",
          bottomHelpMessage:
            "填写AI接口和ApiKey、确保主动群聊开关开启后，务必先保存并刷新页面，否则模型无法选择！",
          component: "InputPassword",
        },
        ...appendIfShouldInputSelf(),
        {
          component: "Divider",
          label: "视觉接口配置",
          componentProps: {
            type: "horizontal",
            style: {
              fontWeight: "bold",
              color: "rgb(76, 113, 201)",
              fontSize: "16px",
            },
            // 前端写死了，这里写啥其实都没用
            orientation: "left",
            plain: true,
          },
        },
        {
          field: "autoReply.useVisual",
          label: "是否使用视觉AI接口",
          bottomHelpMessage: "开启此选项可对图片进行识别并应用于上下文记忆",
          component: "Switch",
        },
        {
          field: "autoReply.visualReplaceChat",
          label: "视觉AI替代群聊AI",
          bottomHelpMessage:
            "开启此选项，视觉AI将替代群聊AI，常规接口配置将失效；关闭此选项（并开启视觉AI接口），视觉AI仅会将图片转文本存入上下文。群聊AI准确度高于视觉AI时可关闭该项。切换此选项会清空已经记录的上下文",
          component: "Switch",
        },
        {
          field: "autoReply.visualApi",
          label: "视觉AI接口选择",
          bottomHelpMessage: "可选项：siliconflow",
          component: "Select",
          componentProps: {
            options: listAllVisualApi(),
          },
        },
        {
          field: "autoReply.visualApiKey",
          label: "视觉AI ApiKey",
          bottomHelpMessage:
            "填写AI接口和ApiKey、确保视觉AI接口开启后，务必先保存并刷新页面，否则模型无法选择！",
          component: "InputPassword",
        },
        ...appendIfShouldInputSelfVisual(),
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
          component: "EasyCron",
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
        {
          label: "豆包",
          // 第四个分组标记开始
          component: "SOFT_GROUP_BEGIN",
        },
        {
          field: "douBao.useDouBao",
          label: "豆包开关",
          bottomHelpMessage: "启用豆包相关功能，可使用`#豆包`命令查询可用指令",
          component: "Switch",
        },
        {
          component: "Divider",
          label: "视频生成",
          componentProps: {
            type: "horizontal",
            style: {
              fontWeight: "bold",
              color: "rgb(76, 113, 201)",
              fontSize: "16px",
            },
            // 前端写死了，这里写啥其实都没用
            orientation: "left",
            plain: true,
          },
        },
        {
          field: "douBao.useVideoGenerate",
          label: "视频生成开关",
          bottomHelpMessage: "若开启，会启用视频生成功能",
          component: "Switch",
        },
        {
          field: "douBao.videoGenerate",
          label: "视频生成配置",
          bottomHelpMessage: "视频生成相关的配置",
          component: "GSubForm",
          componentProps: {
            modalProps: {
              title: "视频生成配置"
            },
            style: {
              maxHeight: '100px', // 设置最大高度
              overflowY: 'auto'   // 添加垂直滚动条
            },
            schemas: [
              {
                field: "apiKey",
                label: "ApiKey",
                bottomHelpMessage: "官网: https://console.volcengine.com/ark/",
                component: "Input",
              },
              {
                field: "url",
                label: "视频生成URL",
                bottomHelpMessage: "视频生成请求URL，官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                field: "model",
                label: "视频生成模型",
                bottomHelpMessage: "官网文档模型ID: https://www.volcengine.com/docs/82379/1330310",
                component: "Input",
              },
            ]
          },
        },
        {
          component: "Divider",
          label: "图片生成",
          componentProps: {
            type: "horizontal",
            style: {
              fontWeight: "bold",
              color: "rgb(76, 113, 201)",
              fontSize: "16px",
            },
            // 前端写死了，这里写啥其实都没用
            orientation: "left",
            plain: true,
          },
        },
        {
          field: "douBao.useImageGenerate",
          label: "图片生成开关",
          bottomHelpMessage: "若开启，会启用文生图/图生图功能",
          component: "Switch",
        },
        {
          field: "douBao.imageGenerate",
          label: "图片生成配置",
          bottomHelpMessage: "图片生成相关的配置",
          component: "GSubForm",
          componentProps: {
            modalProps: {
              title: "图片生成配置"
            },
            style: {
              maxHeight: '100px', // 设置最大高度
              overflowY: 'auto'   // 添加垂直滚动条
            },
            schemas: [
              {
                field: "accessKeyId",
                label: "AccessKeyId",
                bottomHelpMessage:
                  "必填！官网密钥: https://console.volcengine.com/iam/keymanage",
                component: "InputPassword",
              },
              {
                field: "secretAccessKey",
                label: "SecretAccessKey",
                bottomHelpMessage:
                  "必填！官网密钥: https://console.volcengine.com/iam/keymanage",
                component: "InputPassword",
              },
              {
                field: "host",
                label: "服务Host",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                field: "region",
                label: "服务Region",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                field: "service",
                label: "服务名称",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                field: "action",
                label: "服务Action",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                field: "version",
                label: "服务Version",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                component: "Divider",
                label: "文生图",
                componentProps: {
                  type: "horizontal",
                  style: {
                    fontWeight: "bold",
                    color: "rgb(76, 113, 201)",
                    fontSize: "16px",
                  },
                  // 前端写死了，这里写啥其实都没用
                  orientation: "left",
                  plain: true,
                },
              },
              {
                field: "reqKey",
                label: "文生图算法",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                field: "modelVersion",
                label: "模型名称",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值（为空时会自动取默认值，下面同理）",
                component: "Input",
              },
              {
                field: "reqScheduleConf",
                label: "生成模式",
                bottomHelpMessage:
                  "置空则默认为`general_v20_9B_pe`美感版——美感更好，出图多样性更多；`general_v20_9B_rephraser`标准版——图文匹配度更好，结构表现更好",
                component: "Input",
              },
              {
                field: "usePreLlm",
                label: "文本扩写",
                bottomHelpMessage:
                  "会针对输入prompt进行扩写优化，如果输入prompt较短建议开启，如果输入prompt较长建议关闭",
                component: "Switch",
              },
              {
                field: "useSr",
                label: "超分",
                bottomHelpMessage:
                  "开启后可将生图宽高均乘以2，此参数打开后延迟会有增加。如上述宽高均为512和512，此参数关闭出图 512*512 ，此参数打开出图1024 * 1024",
                component: "Switch",
              },
              {
                field: "returnUrl",
                label: "只返回链接",
                bottomHelpMessage:
                  "是否只返回图片链接 （链接有效期为24小时）",
                component: "Switch",
              },
              {
                component: "Divider",
                label: "图生图",
                componentProps: {
                  type: "horizontal",
                  style: {
                    fontWeight: "bold",
                    color: "rgb(76, 113, 201)",
                    fontSize: "16px",
                  },
                  // 前端写死了，这里写啥其实都没用
                  orientation: "left",
                  plain: true,
                },
              },
              {
                field: "withImgReqKey",
                label: "图生图算法",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值",
                component: "Input",
              },
              {
                field: "withImgModelVersion",
                label: "模型名称",
                bottomHelpMessage:
                  "官方没有变动就不需要改默认值（为空时会自动取默认值，下面同理）",
                component: "Input",
              },
              {
                field: "withImgUseRephraser",
                label: "文本扩写",
                bottomHelpMessage:
                  "如果输入内容较短建议开启扩写，输入内容过长可根据情况进行关闭，否则可能会影响图文匹配程度",
                component: "Switch",
              },
              {
                field: "withImgReturnUrl",
                label: "只返回链接",
                bottomHelpMessage:
                  "是否只返回图片链接 （链接有效期为24小时）",
                component: "Switch",
              },
              {
                field: "withImgControlnetArgs",
                label: "图生图配置",
                bottomHelpMessage:
                  "参考模式和强度设置",
                component: "GSubForm",
                componentProps: {
                  schemas: [
                    {
                      field: "type",
                      label: "图生图参考模式",
                      bottomHelpMessage:
                        "可参考输入图的canny（轮廓边缘）、depth（景深）、pose（人物姿态）进行出图",
                      component: "Input",
                      placeholder: "canny | depth | pose",
                    },
                    {
                      field: "strength",
                      label: "图生图参考的强度",
                      bottomHelpMessage:
                        "数值范围(0.0, 1.0]，数值越大越接近参考图",
                      component: "InputNumber",
                      componentProps: {
                        min: 0,
                        max: 1,
                        step: 0.01,
                      },
                    }
                  ]
                },
              },
            ],
          }
        }
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        var config = setting.getAllConfig();
        return config;
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

/********************************** Config 更新生命周期 **********************************/
/**
 * 更新前校验和处理
 * @param {*} config 更新前配置
 * @returns code, message, data
 */
function beforeUpdate(config) {
  var preChatApi = config.autoReply.chatApi;
  var preVisualReplaceChat = config.autoReply.visualReplaceChat;
  return {
    code: 0,
    message: "校验成功",
    data: {
      chatApi: preChatApi,
      visualReplaceChat: preVisualReplaceChat,
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
    /*
    if (Objects.isNull(config.autoReply.visualModel)) {
      return {
        code: -1,
        message: "请选择有效的视觉AI模型",
      };
    }
    */
  }
  var newChatApi = config.autoReply.chatApi;
  var newVisualReplaceChat = config.autoReply.visualReplaceChat;
  return {
    code: 0,
    message: "校验成功",
    data: {
      chatApi: newChatApi,
      visualReplaceChat: newVisualReplaceChat,
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
  // 因为实现逻辑和结构体不同，所以切换时删除之前的redis存储
  if (origin.visualReplaceChat != after.visualReplaceChat) {
    removeSubKeys("juhkff:auto_reply", EMOTION_KEY).then(() => { });
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
  if (config.autoReply.useAutoReply)
    chatInstance?.[ChatInterface.getModelMap]();

  var visualInstance = visualMap[config.autoReply.visualApi];
  if (config.autoReply.useVisual)
    visualInstance?.[VisualInterface.getModelMap]();
}

/********************************** 函数调用 **********************************/

/**
 * 获取群聊AI模型
 * @returns 群聊AI模型列表
 */
function getChatModels() {
  var chatApi = setting.getConfig("autoReply").chatApi;
  var chatInstance = chatMap[chatApi];
  if (!chatInstance) return [];
  var result = [];
  for (const key of Object.keys(chatInstance.ModelMap)) {
    result.push({ label: key, value: key });
  }
  return result;
}

function getVisualModels() {
  var visualApi = setting.getConfig("autoReply").visualApi;
  var chatInstance = visualMap[visualApi];
  if (!chatInstance) return [];
  var result = [];
  for (const key of Object.keys(chatInstance.ModelMap)) {
    result.push({ label: key, value: key });
  }
  return result;
}

/**
 * 获取群聊AI接口列表
 * @returns 群聊AI接口列表
 */
function listAllChatApi() {
  var chatKeys = Object.keys(chatMap);
  var result = [];
  for (const key of chatKeys) {
    result.push({ label: key, value: key });
  }
  return result;
}

/**
 * 获取视觉AI接口列表
 * @returns 视觉AI接口列表
 */
function listAllVisualApi() {
  var visualKeys = Object.keys(visualMap);
  var result = [];
  for (const key of visualKeys) {
    result.push({ label: key, value: key });
  }
  return result;
}

function appendIfShouldInputSelf() {
  var chatApi = setting.getConfig("autoReply").chatApi;
  var chatInstance = chatMap[chatApi];
  if (chatInstance?.shouldInputSelf) {
    var subSchemas = [
      {
        field: "autoReply.chatModel",
        label: "群聊AI模型",
        bottomHelpMessage: "确保开关开启，保存并刷新页面后，再选择或填写该项！",
        component: "Input",
      },
      {
        field: "autoReply.apiCustomUrl",
        label: "模型请求URL",
        bottomHelpMessage: "格式一般以http(s)开头，以/chat/completions结尾",
        component: "Input",
      },
    ];
  } else {
    var subSchemas = [
      {
        field: "autoReply.chatModel",
        label: "群聊AI模型",
        bottomHelpMessage: "确保开关开启，保存并刷新页面后，再选择或填写该项！",
        component: "Select",
        componentProps: {
          options: getChatModels(),
        },
      },
    ];
  }
  return subSchemas;
}

function appendIfShouldInputSelfVisual() {
  var visualApi = setting.getConfig("autoReply").visualApi;
  var chatInstance = visualMap[visualApi];
  if (chatInstance?.shouldInputSelf) {
    var subSchemas = [
      {
        field: "autoReply.visualModel",
        label: "视觉AI模型",
        bottomHelpMessage: "确保开关开启，保存并刷新页面后，再选择或填写该项！",
        component: "Input",
      },
      {
        field: "autoReply.visualApiCustomUrl",
        label: "视觉模型请求URL",
        component: "Input",
      },
    ];
  } else {
    var subSchemas = [
      {
        field: "autoReply.visualModel",
        label: "视觉AI模型",
        bottomHelpMessage: "确保开关开启，保存并刷新页面后，再选择或填写该项！",
        component: "Select",
        componentProps: {
          options: getVisualModels(),
        },
      },
    ];
  }
  return subSchemas;
}
