import { getPersonality, getemoji, gpt, formatDate } from "../utils/getdate.js";
import setting from "../model/setting.js";
import fs from "fs";
import chat_history from "../model/chat_history.js";
import { SF_Painting } from "../../siliconflow-plugin/apps/SF_Painting.js";
import {
  parseSourceImg,
  url2Base64,
} from "../../siliconflow-plugin/utils/getImg.js";
import { processMessageWithUrls } from "../../siliconflow-plugin/utils/extractUrl.js";
import { saveContext } from "../../siliconflow-plugin/utils/context.js";
import Config from "../../siliconflow-plugin/components/Config.js";

const _path = process.cwd() + "/plugins/logier-plugin";

// 导出一个问候插件
export class greetings extends plugin {
  // 构建正则匹配等
  constructor() {
    super({
      name: "[鸢尾花插件]潜伏gpt",
      event: "message",
      priority: 5001,
      rule: [
        {
          reg: "",
          fnc: "潜伏",
          log: false,
        },
      ],
    });

    this.sfPainting = new SF_Painting();
  }

  get appconfig() {
    return setting.getConfig("Customize");
  }

  get thiefconfig() {
    return setting.getConfig("EmojiThief");
  }

  get GPTconfig() {
    return setting.getConfig("GPTconfig");
  }

  async 潜伏(e) {
    // 和siliconflow-plugin做一下结合，因为对消息的统一判断是在这里处理的
    // 如果@了bot，就直接回复
    let chatFinish = false;
    if (e.atBot) {
      await this.sfPainting.sf_chat(e,true);
      chatFinish = true;
    }

    if (!chatFinish) {
      // 避免重复保存上下文
      // 借助siliconflow-plugin保存群聊上下文
      // 处理引用消息,获取图片和文本
      const config_date = Config.getConfig();
      await parseSourceImg(e);
      let currentImages = [];
      let msg = e.msg.trim();
      // 为头像时删除对应img（不需要该功能）
      if (e.img && e.img.length > 0) {
        // 记录获取到的图片链接
        logger.mark(`[SF插件][ss]获取到图片链接:\n${e.img.join("\n")}`);
        // 获取所有图片数据
        for (const imgUrl of e.img) {
          const base64Image = await url2Base64(imgUrl);
          if (!base64Image) {
            e.reply("图片地址已失效，请重新发送图片", true);
            return true;
          }
          currentImages.push(base64Image);
        }
      }
      const quotedText = e.sourceMsg ? "回复[" + e.sourceMsg + "]:" : "";
      msg = quotedText + msg;
      let extractedContent = "";
      try {
        // 根据是否为图片模式决定是否在消息中显示提取的内容
        const { message: processedMsg, extractedContent: extracted } =
          await processMessageWithUrls(msg, !config_date.ss_useMarkdown);
        msg = processedMsg;
        extractedContent = extracted;

        if (extractedContent) {
          logger.debug(`[SF插件][URL处理]URL处理成功`);
        } else {
          logger.debug(`[SF插件][URL处理]消息中未发现需要处理的URL`);
        }
      } catch (error) {
        logger.error(
          `[SF插件][URL处理]处理URL时发生错误，将使用原始消息继续处理: ${error.message}`
        );
      }
      // 如果是图片模式，在发送给AI时将提取的内容加回去
      const aiMessage = config_date.ss_useMarkdown
        ? msg + extractedContent
        : msg;
      if (config_date.gg_useContext) {
        // 保存用户消息
        await saveContext(e.group_id, {
          role: "user",
          content:
            (await formatDate(Date.now())) +
            " - " +
            e.sender.card +
            "：" +
            aiMessage,
          extractedContent: extractedContent,
          imageBase64: currentImages.length > 0 ? currentImages : undefined,
        });
      }
    }

    if (!this.GPTconfig.GPTKey) {
      return false;
    }

    if (!e.msg) {
      // logger.info('[潜伏模板]非文本消息，不回复')
      return false;
    }

    if (Math.random() > Number(this.appconfig.CustomizeRate)) {
      return false;
    }
    // 借助siliconflow-plugin的功能，对消息进行处理，原逻辑删除
    if (!chatFinish) {
      await this.sfPainting.sf_chat(e,false);
      chatFinish = true;
    }

    if (Math.random() > Number(this.appconfig.CustomizeEmojiRate)) {
      return true;
    }
    let imageUrl = await getemoji(e, this.appconfig.CustomizeEmojiCategory);

    let EmojiRate = this.thiefconfig.DefaultEmojiRate;
    // 如果 ETGroupRate 配置存在且不为空
    if (
      this.thiefconfig.ETGroupRate &&
      this.thiefconfig.ETGroupRate.length > 0
    ) {
      for (let config of this.thiefconfig.ETGroupRate) {
        // 确保 config.groupList 是数组，以避免 undefined 的情况
        if (
          Array.isArray(config.groupList) &&
          config.groupList.includes(e.group_id)
        ) {
          EmojiRate = config.EmojiRate;
          break;
        }
      }
    }
    // 有表情包的情况下才继续
    const emojiThiefDir = `${_path}/data/EmojiThief/${e.group_id}_EmojiThief`;
    await fs.promises.mkdir(emojiThiefDir, { recursive: true });
    let list = await fs.promises.readdir(emojiThiefDir);
    list = list ? list : [];
    if (list.length > 0 && Math.random() >= Number(EmojiRate)) {
      let randomIndex = Math.floor(Math.random() * list.length);
      imageUrl = `${emojiThiefDir}/${list[randomIndex]}`;
      logger.info("[潜伏模板]发送偷图表情包");
    } else {
      logger.info(this.appconfig.CustomizeEmojiCategory);
    }
    logger.info(imageUrl);
    if (imageUrl) {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // 在所有句子都回复完之后再发送图片
      logger.info(
        `[潜伏模板]发送“${this.appconfig.CustomizeEmojiCategory}”表情包`
      );
      e.reply([segment.image(imageUrl)]);
    }

    return true;
  }
}
