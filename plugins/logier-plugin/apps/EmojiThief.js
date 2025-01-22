import { downloadFile, getemoji } from "../utils/getdate.js";
import setting from "../model/setting.js";
import fs, { readdirSync } from "fs";

const _path = process.cwd() + "/plugins/logier-plugin";

export class TextMsg extends plugin {
  constructor() {
    super({
      name: "[鸢尾花插件]表情包小偷",
      dsc: "表情包小偷",
      event: "message",
      priority: 9999,
      rule: [
        {
          reg: "",
          fnc: "表情包小偷",
          log: false,
        },
      ],
    });
  }

  get appconfig() {
    return setting.getConfig("EmojiThief");
  }

  async 表情包小偷(e) {
    let rate = this.appconfig.DefaultReplyRate; // 默认概率
    let EmojiRate = this.appconfig.DefaultEmojiRate;
    let groupMatched = false;

    // 如果 ETGroupRate 配置存在且不为空
    if (this.appconfig.ETGroupRate && this.appconfig.ETGroupRate.length > 0) {
      for (let config of this.appconfig.ETGroupRate) {
        // 确保 config.groupList 是数组，以避免 undefined 的情况
        if (
          Array.isArray(config.groupList) &&
          config.groupList.includes(e.group_id)
        ) {
          rate = config.rate;
          EmojiRate = config.EmojiRate;
          groupMatched = true;
          break;
        }
      }
    }

    const emojiThiefDir = `${_path}/data/EmojiThief/${e.group_id}_EmojiThief`;
    // 表情包二次确认的过期时间为3天
    const expireTimeInSeconds = 3 * 24 * 60 * 60;
    await fs.promises.mkdir(emojiThiefDir, { recursive: true });
    let list = await fs.promises.readdir(emojiThiefDir);

    // 处理消息的每一项
    for (const item of e.message) {
      item.file_unique = item.file.split(".")[0];
      if (item.type === "image" && item.file_size < 100000) {
        try {
          list = list ? list : [];
          if (!list.includes(`${item.file_unique}.jpg`)) {
            let can_be_stored = false;
            if (
              !(await redis.get(`EmojiThief:${e.group_id}:${item.file_unique}`))
            ) {
              //key不存在，设置key
              await redis.set(
                `EmojiThief:${e.group_id}:${item.file_unique}`,
                "1",
                {
                  EX: expireTimeInSeconds,
                }
              );
              logger.info(`[表情包小偷]待二次确认: ${item.file_unique}`);
            } else {
              // key存在，二次确认成功
              await redis.del(`EmojiThief:${e.group_id}:${item.file_unique}`);
              can_be_stored = true;
              logger.info(`[表情包小偷]二次确认成功: ${item.file_unique}`);
            }
            if (!can_be_stored) continue;
            logger.info("[表情包小偷]偷取表情包");
            let imgType = item.file.split(".").pop();
            await downloadFile(
              item.url,
              `${emojiThiefDir}/${item.file_unique}.${imgType}`
            );
            list.push(`${item.file_unique}.${imgType}`);
            if (list.length > 50) {
              const randomIndex = Math.floor(Math.random() * list.length);
              const randomFile = list[randomIndex];
              fs.unlinkSync(`${emojiThiefDir}/${randomFile}`);
              list.splice(randomIndex, 1);
              logger.info(`[表情包小偷]存储过多，删除表情包: ${randomFile}`);
            }
          }
        } catch (error) {
          logger.error(`[表情包小偷]出错: ${error}`);
        }
      }
    }

    // 发送表情包的概率判断
    if (Math.random() < rate) {
      try {
        let emojiUrl = await getemoji(e, this.appconfig.ETEmojihubCategory);

        // 有表情包的情况下才继续
        if (list.length > 0 && Math.random() >= Number(EmojiRate)) {
          let randomIndex = Math.floor(Math.random() * list.length);
          emojiUrl = `${emojiThiefDir}/${list[randomIndex]}`;
        }
        logger.info(`[鸢尾花插件] 发送表情包: ${emojiUrl}`);
        e.reply([segment.image(emojiUrl)]);
      } catch (error) {
        logger.error(`[表情包小偷]表情包发送失败: ${error}`);
      }
    }

    return false;
  }
}
