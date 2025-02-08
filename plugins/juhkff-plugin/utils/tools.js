import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import https from "https";
import fetch from "node-fetch";
import setting from "../model/setting.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close(resolve);
        });

        file.on("error", (err) => {
          fs.unlink(dest, () => reject(err));
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

export async function getRandomUrl(imageUrls) {
  let imageUrl;

  if (Array.isArray(imageUrls)) {
    imageUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)];
  } else {
    imageUrl = imageUrls;
  }

  if (fs.existsSync(imageUrl) && fs.lstatSync(imageUrl).isDirectory()) {
    let imageFiles = await getAllImageFiles(imageUrl);

    if (imageFiles.length > 0) {
      imageUrl = imageFiles[Math.floor(Math.random() * imageFiles.length)];
    }
  }

  logger.info("[鸢尾花插件]图片url：" + imageUrl);
  return imageUrl;
}

async function getAllImageFiles(dirPath, imageFiles = []) {
  let files = fs.readdirSync(dirPath);

  for (let i = 0; i < files.length; i++) {
    let filePath = path.join(dirPath, files[i]);

    if (fs.statSync(filePath).isDirectory()) {
      imageFiles = await getAllImageFiles(filePath, imageFiles);
    } else if (
      [".jpg", ".png", ".gif", ".jpeg", ".webp"].includes(
        path.extname(filePath)
      )
    ) {
      imageFiles.push(filePath);
    }
  }

  return imageFiles;
}

/**
timestamp: Date.now()
*/
export async function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份从0开始，需要加1
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * @description: 处理引用消息：获取引用的图片和文本，图片放入e.img，优先级==> e.source.img > e.img，文本放入e.sourceMsg
 * @param {*} e
 * @return {*}处理过后的e: sourceImg-引用图片；sourceMsg-引用文本(markdown格式)；img-图片；msg-文本
 */
export async function parseSourceImg(e) {
  let reply;
  // 添加OneBotv11适配器
  if (e.reply_id) {
    reply = (await e.getReply(e.reply_id)).message;
  }

  if (reply) {
    let i = [];
    let text = []; // 用于存储文本消息
    let senderNickname = ""; // 存储发送者昵称

    // 获取发送者昵称
    if (e.source) {
      if (e.isGroup) {
        try {
          const sender = await e.group.pickMember(e.source.user_id);
          senderNickname = sender.card || sender.nickname;
        } catch (error) {
          logger.error("[tools]获取群成员信息失败:", error);
        }
      } else {
        try {
          const friend = e.bot.fl.get(e.source.user_id);
          senderNickname = friend?.nickname;
        } catch (error) {
          logger.error("[tools]获取好友信息失败:", error);
        }
      }
    }
    // 添加OneBotv11适配器的处理
    else if (e.reply_id) {
      try {
        const reply = await e.getReply(e.reply_id);
        senderNickname = reply.sender?.card || reply.sender?.nickname;
      } catch (error) {
        logger.error("[tools]获取引用消息发送者信息失败:", error);
      }
    }

    for (const val of reply) {
      if (val.type == "image") {
        i.push(val.url);
      }
      if (val.type == "text") {
        text.push(val.text); // 收集文本消息
      }
      if (val.type == "file") {
        e.reply("不支持消息中的文件，请将该文件以图片发送...", true);
        return;
      }
    }
    if (Boolean(i.length)) {
      // 防止消息中的图片被引用图片覆盖
      e.sourceImg = i;
    }
    if (text.length > 0) {
      // 如果有发送者昵称,添加到引用文本前,使用markdown引用格式
      const lines = text.join("\n").split("\n");
      const quotedLines = lines.map((line) => `> ${line}`).join("\n");
      e.sourceMsg = senderNickname
        ? `> ##### ${senderNickname}：\n> ---\n${quotedLines}`
        : quotedLines;
    }
  }
  return e;
}

/**
 * 处理消息中的URL并提取内容
 * @param {string} message 用户消息
 * @param {boolean} attachUrlAnalysis 是否将提取的内容附加到消息中，默认为true
 * @returns {Promise<{message: string, extractedContent: string}>} 处理后的消息和提取的内容
 */
export async function processMessageWithUrls(
  message,
  attachUrlAnalysis = true
) {
  const urls = extractUrls(message);
  if (urls.length === 0) {
    return { message, extractedContent: "" };
  }

  logger.mark(`[URL处理]从消息中提取到${urls.length}个URL`);
  let processedMessage = message;
  let extractedContent = "";

  for (const url of urls) {
    // 跳过不需要提取内容的URL
    if (isSkippedUrl(url)) {
      logger.mark(`[URL处理]跳过URL: ${url}`);
      continue;
    }

    logger.debug(`[URL处理]开始处理URL: ${url}`);
    const content = await extractUrlContent(url);
    if (content) {
      logger.debug(`[URL处理]成功提取URL内容: ${url}`);
      const urlContent = `\n\n提取的URL内容(${url}):\n内容: ${content.content}`;
      extractedContent += urlContent;
      if (attachUrlAnalysis) {
        processedMessage += urlContent;
      }
    }
  }

  return { message: processedMessage, extractedContent };
}

/**
 * 从URL提取内容
 * @param {string} url 需要提取内容的URL
 * @returns {Promise<Object>} 提取的内容
 */
async function extractUrlContent(url) {
  // 如果是需要跳过的URL类型，直接返回null
  if (isSkippedUrl(url)) {
    logger.mark(`[URL提取]跳过不需要处理的URL类型: ${url}`);
    return null;
  }

  try {
    logger.debug(`[URL提取]开始从URL获取内容: ${url}`);
    const response = await fetch(
      `https://lbl.news/api/extract?url=${encodeURIComponent(url)}`
    );
    if (!response.ok) {
      throw new Error(`提取内容失败: ${response.statusText}`);
    }
    const data = await response.json();
    logger.debug(`[URL提取]成功获取URL内容: ${url}`);
    return data;
  } catch (error) {
    logger.error(`[URL提取]提取内容失败: ${error.message}, URL: ${url}`);
    return null;
  }
}
