import {
  parseSourceImg,
  formatDate,
  processMessageWithUrls,
  url2Base64,
} from "#juhkff.tools";
import setting from "#juhkff.setting";
import fetch from "node-fetch";

/**
 * 主动群聊插件
 * @author Bilibili - 扎克芙芙
 */
export class AutoReply extends plugin {
  // 构建正则匹配等
  constructor() {
    super({
      name: "[扎克芙芙]主动群聊",
      dsc: "主动群聊",
      event: "message",
      priority: 1,
      rule: [
        {
          reg: "^((?!#).)*$", // 匹配所有非#开头的文本
          fnc: "autoReply",
          log: false,
        },
      ],
    });
  }

  get Config() {
    return setting.getConfig("AutoReply");
  }

  async autoReply(e) {
    // 避免重复保存上下文
    // 借助siliconflow-plugin保存群聊上下文
    // 处理引用消息,获取图片和文本
    let chatDate = await formatDate(Date.now());
    await parseSourceImg(e);
    // e.sourceImg-引用图片；e.sourceMsg-引用文本；e.img-图片；e.msg-文本
    // 引用图片链接
    let sourceImages = [];
    if (e.sourceImg && e.sourceImg.length > 0) {
      // 记录获取到的图片链接
      logger.info(`[AutoReply]获取到引用图片链接:\n${e.sourceImg.join("\n")}`);
      // 获取所有图片数据
      for (const imgUrl of e.sourceImg) {
        const base64Image = await url2Base64(imgUrl);
        if (!base64Image) {
          e.reply("[AutoReply]引用的图片地址已失效，无法回答", true);
          return true;
        }
        sourceImages.push(base64Image);
      }
    }
    let currentImages = [];
    if (!e.msg || e.msg == "") return false;
    // 为头像时删除对应img（不需要该功能）
    if (e.img && e.img.length > 0) {
      // 记录获取到的图片链接
      logger.info(`[AutoReply]获取到图片链接:\n${e.img.join("\n")}`);
      // 获取所有图片数据
      for (const imgUrl of e.img) {
        const base64Image = await url2Base64(imgUrl);
        if (!base64Image) {
          e.reply("[AutoReply]图片地址已失效，请重新发送图片", true);
          return true;
        }
        currentImages.push(base64Image);
      }
    }
    let msg = e.msg.trim();
    const quotedText = e.sourceMsg ? `[回复 ${e.sourceMsg}] ` : "";
    msg = quotedText + msg;
    // currentImages: img数组; msg: 包含引用消息和URL处理消息的msg
    let extractedContent = "";
    try {
      // 根据是否为图片模式决定是否在消息中显示提取的内容
      const { message, extractedContent } = await processMessageWithUrls(
        msg,
        this.Config.AttachUrlAnalysis
      );
      msg = message;

      if (extractedContent) {
        logger.info(`[AutoReply]URL处理成功`);
      } else {
        logger.info(`[AutoReply]消息中未发现需要处理的URL`);
      }
    } catch (error) {
      logger.error(
        `[AutoReply]处理URL时发生错误，将使用原始消息继续处理: ${error.message}`
      );
    }
    if (msg) msg = msg.trim();
    if (!msg || msg == "") {
      // logger.info('[潜伏模板]非文本消息，不回复')
      return false;
    }

    let answer = undefined;
    // 如果@了bot，就直接回复
    if (e.atBot || Math.random() < Number(this.Config.ChatRate)) {
      answer = await this.sf_chat(e, msg, sourceImages, currentImages);
      if (!e.atBot && (!answer || answer.startsWith("[AutoReply]"))) {
        // 如果自主发言失败不提示
      } else {
        await e.reply(answer);
      }
    }
    if (this.Config.UseContext) {
      // 保存用户消息
      let context = {
        role: "user",
        content: chatDate + " - " + e.sender.card + "：" + msg,
        extractedContent: extractedContent,
      };
      // 条件满足时保存图片
      if (this.Config.SaveChatImage) {
        context.imageBase64 =
          currentImages.length > 0 ? currentImages : undefined;
      }
      await this.saveContext(e.group_id, context);
      // 保存AI回复
      if (answer && !answer.startsWith("[AutoReply]")) {
        await this.saveContext(e.group_id, {
          role: "assistant",
          content: answer,
        });
      }
    }
    return false;
  }

  /**
   *
   * @param {*} e
   * @param {*} msg 正文消息
   * @param {*} sourceImages 引用图片数组
   * @param {*} currentImages 正文图片数组
   * @returns answer 回复内容
   */
  async sf_chat(e, msg, sourceImages, currentImages) {
    let use_sf_key = this.Config.SiliconflowKey;
    let apiBaseUrl = this.Config.SiliconflowUrl;
    let model = this.Config.ChatModel;
    if (!use_sf_key || use_sf_key == "") {
      await e.reply("请在AutoReply.yaml中设置SiliconflowKey", true);
      return true;
    }
    if (!apiBaseUrl || apiBaseUrl == "") {
      await e.reply("请在AutoReply.yaml中设置SiliconflowUrl", true);
      return true;
    }
    if (!model || model == "") {
      await e.reply("请在AutoReply.yaml中设置ChatModel", true);
      return true;
    }

    // 获取历史对话
    let historyMessages = [];
    if (this.Config.UseContext) {
      historyMessages = await this.loadContext(e.group_id);
      logger.info(`[AutoReply]加载历史对话: ${historyMessages.length} 条`);
    }

    // 收集历史图片
    let historyImages = [];
    // 从历史消息中收集图片
    if (this.Config.AnalyzeImage) {
      historyMessages.forEach((msg) => {
        if (msg.imageBase64) {
          historyImages = historyImages.concat(msg.imageBase64);
        }
      });
    }

    const opt = {
      sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
      currentImages: currentImages.length > 0 ? currentImages : undefined,
      historyImages: historyImages.length > 0 ? historyImages : undefined,
    };

    let answer = await this.generatePrompt(
      e.sender.card + "：" + msg,
      use_sf_key,
      apiBaseUrl,
      model,
      opt,
      historyMessages
    );
    // 使用正则表达式去掉字符串 answer 开头的换行符
    answer = answer.replace(/^\n/, "");
    return answer;
  }

  /**
   * @description: 自动提示词
   * @param {*} input
   * @param {*} use_sf_key
   * @param {*} apiBaseUrl 使用的API地址
   * @param {*} model 使用的API模型
   * @param {*} opt 可选参数
   * @return {string}
   */
  async generatePrompt(
    input,
    use_sf_key,
    apiBaseUrl = "",
    model = "",
    opt = {},
    historyMessages = []
  ) {
    // 构造请求体
    const requestBody = {
      model: model || this.Config.ChatModel,
      messages: [
        {
          role: "system",
          content:
            this.Config.ChatPrompt ||
            "You are a helpful assistant, you prefer to speak Chinese. Now you are in a chat group, and the following is chat history",
        },
      ],
      stream: false,
      temperature: 1.5,
    };

    // 添加历史对话
    if (historyMessages && historyMessages.length > 0) {
      historyMessages.forEach((msg) => {
        // 不是图片时添加
        if (!msg.imageBase64) {
          if (msg.role === "system") {
            requestBody.messages.push({
              role: "system",
              content: msg.content,
            });
          }
          if (msg.role === "user") {
            requestBody.messages.push({
              role: "user",
              content: msg.content,
            });
          } else if (msg.role === "assistant") {
            requestBody.messages.push({
              role: "assistant",
              content: msg.content,
            });
          }
        }
      });
    }

    // 构造当前消息
    // 当前消息作为统一的一个message放入requestBody.messages
    try {
      // 构造消息内容数组
      let allContent = [];
      // 添加\引用的和当前的图片
      if (
        this.Config.ModelCanSendImage &&
        opt.sourceImages &&
        opt.sourceImages.length > 0
      ) {
        opt.sourceImages.forEach((image) => {
          allContent.push({
            type: "text",
            text: "引用消息包含的图片:\n",
          });
          allContent.push({
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${image}`,
            },
          });
        });
      }
      if (
        this.Config.ModelCanSendImage &&
        opt.currentImages &&
        opt.currentImages.length > 0
      ) {
        allContent.push({
          type: "text",
          text: "消息正文包含的图片:\n",
        });
        opt.currentImages.forEach((image) => {
          allContent.push({
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${image}`,
            },
          });
        });
      }
      allContent.push({
        type: "text",
        text: input,
      });

      // 添加历史图片
      if (
        this.Config.ModelCanSendImage &&
        opt.historyImages &&
        opt.historyImages.length > 0
      ) {
        allContent.push({
          type: "text",
          text: "\n历史对话包含的图片:",
        });
        opt.historyImages.forEach((image) => {
          allContent.push({
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${image}`,
            },
          });
        });
      }

      // 兼容带图片的消息格式
      requestBody.messages.push({
        role: "user",
        content: allContent,
      });
    } catch (error) {
      logger.error("[AutoReply]消息处理失败\n", error);
      // 如果处理失败，至少保留用户输入
      requestBody.messages.push({
        role: "user",
        content: input,
      });
    }

    logger.mark(
      `\n[AutoReply]API调用，请求内容：${JSON.stringify(
        requestBody.messages,
        null,
        2
      )}`
    );
    try {
      const response = await fetch(
        `${apiBaseUrl || this.Config.SiliconflowUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${use_sf_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      } else {
        logger.error(
          "[AutoReply]API调用错误：\n",
          JSON.stringify(data, null, 2)
        );
        return "[AutoReply]API调用错误，详情请查阅控制台。";
      }
    } catch (error) {
      logger.error("[AutoReply]API调用失败\n", error);
      return "[AutoReply]API调用失败，详情请查阅控制台。";
    }
  }

  // 保存对话上下文
  async saveContext(groupId, message) {
    try {
      const maxHistory = this.Config.MaxHistoryLength;
      const timestamp = Date.now();
      const key = `juhkff:auto_reply:${groupId}:${timestamp}`;

      // 直接保存消息,不修改content结构
      await redis.set(key, JSON.stringify(message), { EX: 12 * 60 * 60 }); // 12小时过期

      // 获取该用户的所有消息
      const keys = await redis.keys(`juhkff:auto_reply:${groupId}:*`);
      keys.sort((a, b) => {
        const timeA = parseInt(a.split(":")[3]);
        const timeB = parseInt(b.split(":")[3]);
        return timeB - timeA; // 按时间戳降序排序
      });

      // 如果超出限制，删除旧消息
      if (keys.length > maxHistory) {
        const keysToDelete = keys.slice(maxHistory);
        for (const key of keysToDelete) {
          await redis.del(key);
        }
      }

      return true;
    } catch (error) {
      logger.error("[AutoReply]保存上下文失败:", error);
      return false;
    }
  }

  // 加载群历史对话
  async loadContext(groupId) {
    try {
      const maxHistory = this.Config.MaxHistoryLength;

      // 获取该群的所有消息
      const keys = await redis.keys(`juhkff:auto_reply:${groupId}:*`);
      keys.sort((a, b) => {
        const timeA = parseInt(a.split(":")[3]);
        const timeB = parseInt(b.split(":")[3]);
        return timeA - timeB; // 按时间戳升序排序
      });

      // 只获取最近的N条消息
      const recentKeys = keys.slice(-maxHistory);
      const messages = [];

      for (const key of recentKeys) {
        const data = await redis.get(key);
        if (data) {
          messages.push(JSON.parse(data));
        }
      }

      return messages;
    } catch (error) {
      logger.error("[AutoReply]加载上下文失败:", error);
      return [];
    }
  }
}
