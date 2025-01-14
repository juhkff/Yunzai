import { getPersonality, getemoji, gpt } from '../utils/getdate.js'
import setting from '../model/setting.js'
import fs from 'fs'
import chat_history from '../model/chat_history.js'
import { SF_Painting } from '../../siliconflow-plugin/apps/SF_Painting.js'

const _path = process.cwd() + "/plugins/logier-plugin"

// 导出一个问候插件
export class greetings extends plugin {
  // 构建正则匹配等
  constructor() {
    super({
      name: '[鸢尾花插件]潜伏gpt',
      event: 'message',
      priority: 5001,
      rule: [
        {
          reg: '',
          fnc: '潜伏',
          log: false
        }
      ]
    })

    this.sfPainting = new SF_Painting()
  }

  get appconfig() {
    return setting.getConfig('Customize')
  }

  get thiefconfig() {
    return setting.getConfig('EmojiThief')
  }

  get GPTconfig() {
    return setting.getConfig('GPTconfig')
  }

  async 潜伏(e) {
    // 和siliconflow-plugin做一下结合，因为对消息的统一判断是在这里处理的
    // 如果@了bot，就直接回复
    let chatFinish = false
    if (e.atBot) {
      await this.sfPainting.sf_chat(e)
      chatFinish = true
    }

    if (!this.GPTconfig.GPTKey) {
      return false
    }

    if (!e.msg) {
      // logger.info('[潜伏模板]非文本消息，不回复')
      return false
    }

    if (Math.random() > Number(this.appconfig.CustomizeRate)) { return false }
    // 借助siliconflow-plugin的功能，对消息进行处理，原逻辑删除
    if (!chatFinish) {
      await this.sfPainting.sf_chat(e)
      chatFinish = true
    }

    if (Math.random() > Number(this.appconfig.CustomizeEmojiRate)) { return true }
    let imageUrl = await getemoji(e, this.appconfig.CustomizeEmojiCategory)

    let EmojiRate = this.thiefconfig.DefaultEmojiRate
    // 如果 ETGroupRate 配置存在且不为空
    if (this.thiefconfig.ETGroupRate && this.thiefconfig.ETGroupRate.length > 0) {
      for (let config of this.thiefconfig.ETGroupRate) {
        // 确保 config.groupList 是数组，以避免 undefined 的情况
        if (Array.isArray(config.groupList) && config.groupList.includes(e.group_id)) {
          EmojiRate = config.EmojiRate
          break
        }
      }
    }
    // 有表情包的情况下才继续
    const emojiThiefDir = `${_path}/data/EmojiThief/${e.group_id}_EmojiThief`
    await fs.promises.mkdir(emojiThiefDir, { recursive: true })
    let list = await fs.promises.readdir(emojiThiefDir)
    list = list ? list : []
    if (list.length > 0 && Math.random() >= Number(EmojiRate)) {
      let randomIndex = Math.floor(Math.random() * list.length)
      imageUrl = `${emojiThiefDir}/${list[randomIndex]}`
      logger.info("[潜伏模板]发送偷图表情包")
    } else {
      logger.info(this.appconfig.CustomizeEmojiCategory)
    }
    logger.info(imageUrl)
    if (imageUrl) {
      await new Promise(resolve => setTimeout(resolve, 3000)) // 在所有句子都回复完之后再发送图片
      logger.info(`[潜伏模板]发送“${this.appconfig.CustomizeEmojiCategory}”表情包`)
      e.reply([segment.image(imageUrl)])
    }

    return true
  };
}
