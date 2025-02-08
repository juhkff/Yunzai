import {
  parseSourceImg,
  formatDate,
  processMessageWithUrls,
} from "../utils/tools.js";
import setting from "../model/setting.js";
import fs from "fs";

/**
 * 主动群聊插件
 * @author Bilibili - 扎克芙芙
 */
export class AutoReply extends plugin {
  // 构建正则匹配等
  constructor() {
    super({
      name: "[扎克芙芙]主动群聊",
      event: "主动群聊",
      priority: 10000 - 2,
      rule: [
        {
          reg: "",
          fnc: "autoReply",
          log: false,
        },
      ],
    });

    this.sfPainting = new SF_Painting();
  }

  get Config() {
    return setting.getConfig("AutoReply");
  }

  async autoReply(e) {
    // 避免重复保存上下文
    // 借助siliconflow-plugin保存群聊上下文
    // 处理引用消息,获取图片和文本
    await parseSourceImg(e);
    // e.sourceImg-引用图片；e.sourceMsg-引用文本(markdown格式)；e.img-图片；e.msg-文本
    // 引用图片链接
    let sourceImages = [];
    if (e.sourceImg && e.sourceImg.length > 0) {
      // 记录获取到的图片链接
      logger.mark(`[AutoReply]获取到引用图片链接:\n${e.sourceImg.join("\n")}`);
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
    // 为头像时删除对应img（不需要该功能）
    if (e.img && e.img.length > 0) {
      // 记录获取到的图片链接
      logger.mark(`[AutoReply]获取到图片链接:\n${e.img.join("\n")}`);
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
    const quotedText = e.sourceMsg ? e.sourceMsg + "\n_____\n" : "";
    msg = quotedText + msg;
    // currentImages: img数组; msg: 包含引用消息和URL处理消息的msg
    let extractedContent = "";
    try {
      // 根据是否为图片模式决定是否在消息中显示提取的内容
      const { processedMsg, extracted } = await processMessageWithUrls(
        msg,
        this.Config.AttachUrlAnalysis
      );
      msg = processedMsg;
      extractedContent = extracted;

      if (extractedContent) {
        logger.debug(`[AutoReply]URL处理成功`);
      } else {
        logger.debug(`[AutoReply]消息中未发现需要处理的URL`);
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
    }
    if (Config.UseContext) {
      // 保存用户消息
      await this.saveContext(e.group_id, {
        role: "user",
        content:
          (await formatDate(Date.now())) + " - " + e.sender.card + "：" + msg,
        extractedContent: extractedContent,
        imageBase64: currentImages.length > 0 ? currentImages : undefined,
      });
      // 保存AI回复
      if (!answer) {
        await this.saveContext(e.group_id, {
          role: "assistant",
          content: answer,
        });
      }
    }
    return true;
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
    let model = this.Config.TranslateModel;
    if (!use_sf_key || use_sf_key == "") {
      await e.reply("请在AutoReply.yaml中设置SiliconflowKey", true);
      return true;
    }
    if (!apiBaseUrl || apiBaseUrl == "") {
      await e.reply("请在AutoReply.yaml中设置SiliconflowUrl", true);
      return true;
    }
    if (!model || model == "") {
      await e.reply("请在AutoReply.yaml中设置TranslateModel", true);
      return true;
    }

    // 获取历史对话
    let historyMessages = [];
    if (this.Config.UseContext) {
      historyMessages = await this.loadContext(e.group_id);
      logger.mark(`[AutoReply]加载历史对话: ${historyMessages.length} 条`);
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
      aiMessage,
      use_sf_key,
      config_date,
      true,
      apiBaseUrl,
      model,
      opt,
      historyMessages
    );
    // 使用正则表达式去掉字符串 answer 开头的换行符
    answer = answer.replace(/^\n/, "");

    // 获取markdown开关配置，默认为false
    const useMarkdown = config_date?.ss_useMarkdown ?? false;

    try {
      if (useMarkdown) {
        const img = await markdown_screenshot(
          e.user_id,
          e.self_id,
          e.img
            ? e.img.map((url) => `<img src="${url}" width="256">`).join("\n") +
                "\n\n" +
                msg
            : msg,
          answer
        );
        if (img) {
          await e.reply({ ...img, origin: true });
        } else {
          logger.error("[sf插件] markdown图片生成失败");
        }
        e.reply(
          await common.makeForwardMsg(
            e,
            [answer],
            `${e.sender.card || e.sender.nickname || e.user_id}的对话`
          )
        );
      } else {
        await e.reply(answer);
      }
    } catch (error) {
      logger.error("[sf插件] 回复消息时发生错误：", error);
      await e.reply("消息处理失败，请稍后再试", true);
    }
    return true;
  }

  /**
   * @description: 自动提示词
   * @param {*} input
   * @param {*} use_sf_key
   * @param {*} config_date
   * @param {*} forChat 聊天调用
   * @param {*} apiBaseUrl 使用的API地址
   * @param {*} model 使用的API模型
   * @param {*} opt 可选参数
   * @return {string}
   */
  async generatePrompt(
    input,
    use_sf_key,
    config_date,
    forChat = false,
    apiBaseUrl = "",
    model = "",
    opt = {},
    historyMessages = []
  ) {
    // 构造请求体
    const requestBody = {
      model: model || config_date.translateModel,
      messages: [
        {
          role: "system",
          content: !forChat
            ? config_date.sf_textToPaint_Prompt
            : config_date.ss_Prompt ||
              "You are a helpful assistant, you prefer to speak Chinese. Now you are in a chat group, and the following is chat history",
        },
      ],
      stream: false,
      temperature: 1.7,
    };

    // 添加历史对话
    if (historyMessages && historyMessages.length > 0) {
      historyMessages.forEach((msg) => {
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
      });
    }

    // 构造当前消息
    // 当前消息作为统一的一个message放入requestBody.messages
    try {
      // 构造消息内容数组
      let allContent = [];
      // 添加\引用的和当前的图片
      if (
        config_date.ss_canSendImage &&
        opt.sourceImages &&
        opt.sourceImages.length > 0
      ) {
        opt.sourceImages.forEach((image) => {
          allContent.push({
            type: "text",
            text: "ref images:\n",
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
        config_date.ss_canSendImage &&
        opt.currentImages &&
        opt.currentImages.length > 0
      ) {
        allContent.push({
          type: "text",
          text: "send images:\n",
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
        config_date.ss_canSendImage &&
        opt.historyImages &&
        opt.historyImages.length > 0
      ) {
        allContent.push({
          type: "text",
          text: "\n历史对话中的图片:",
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

      // ss_canSendImage=true --- 带图片的消息格式
      requestBody.messages.push({
        role: "user",
        content: allContent,
      });
    } catch (error) {
      logger.error("[sf插件]消息处理失败\n", error);
      // 如果处理失败，至少保留用户输入
      requestBody.messages.push({
        role: "user",
        content: input,
      });
    }

    logger.debug("[sf插件]API调用LLM msg：\n" + input);
    try {
      const response = await fetch(
        `${apiBaseUrl || config_date.sfBaseUrl}/chat/completions`,
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
        logger.error("[sf插件]LLM调用错误：\n", JSON.stringify(data, null, 2));
        return !forChat ? input : "[sf插件]LLM调用错误，详情请查阅控制台。";
      }
    } catch (error) {
      logger.error("[sf插件]LLM调用失败\n", error);
      return !forChat ? input : "[sf插件]LLM调用失败，详情请查阅控制台。";
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
