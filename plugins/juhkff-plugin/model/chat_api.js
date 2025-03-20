import axios from "axios";
import fetch from "node-fetch";
import setting from "#juhkff.setting";
import { EMOTION_KEY } from "#juhkff.redis";
import Objects from "#juhkff.kits";

/************************** 接口和基础类定义 **************************/

export const ChatInterface = {
  generateRequest: Symbol("generateRequest"),
  getModelMap: Symbol("getModelMap"),
};

/**
 *
 * @param {*} apiKey apiKey
 * @param {*} model 使用的API模型
 * @param {*} input 当前聊天输入
 * @param {*} historyMessages 聊天历史记录
 * @param {*} image_list 图片列表
 * @param {*} image_type 是否可传入图片
 */
ChatInterface.generateRequest = async function ({
  apiKey,
  model,
  input,
  historyMessages = [],
  image_list = {},
  image_type = false,
  useSystemRole = true,
}) { };

ChatInterface.getModelMap = function () { };

class ChatApi {
  constructor() {
    this.Config = setting.getConfig("autoReply");
    this.ModelMap = {};
    this.ApiBaseUrl = undefined;
    // 默认情况下模型等信息在指定API后提供，禁止用户自行输入
    this.shouldInputSelf = false;
  }

  [ChatInterface.getModelMap]() { }

  async [ChatInterface.generateRequest]({
    apiKey,
    model,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole = true,
  }) { }
}


/************************** 各API实现 **************************/

export class Siliconflow extends ChatApi {
  constructor() {
    super();
    this.ApiBaseUrl = "https://api.siliconflow.cn/v1";
    if (this.Config.chatApi == "siliconflow") this[ChatInterface.getModelMap]();
  }

  [ChatInterface.getModelMap]() {
    this.ModelMap = {};
    var responsePromise = axios.get(`${this.ApiBaseUrl}/models?type=text`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.Config.chatApiKey}`,
      },
    });
    responsePromise
      .then((response) => {
        var models = response.data.data;
        var modelMap = {};
        for (const model of models) {
          modelMap[model.id] = this.commonRequest.bind(this);
        }
        this.ModelMap = modelMap;
      })
      .catch((error) => {
        logger.error("[autoReply] 获取模型失败：", error);
      });
  }

  async [ChatInterface.generateRequest]({
    apiKey,
    model,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole = true,
  }) {
    // 构造请求体
    var request = {
      url: `${this.ApiBaseUrl}/chat/completions`,
      options: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: model,
          messages: [],
          stream: false,
          temperature: 1.5,
        },
      },
    };

    // var response = await this.ModelMap[model](
    var response = await this.commonRequest(
      request,
      input,
      historyMessages,
      image_list,
      image_type,
      useSystemRole
    );
    return response;
  }
  async commonRequest(
    request,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole
  ) {
    if (useSystemRole) {
      var systemContent = await generateSystemContent(
        this.Config.useEmotion,
        this.Config.chatPrompt
      );
      request.options.body.messages.push(systemContent);
    }

    // 添加历史对话
    if (historyMessages && historyMessages.length > 0) {
      historyMessages.forEach((msg) => {
        // 不是图片时添加
        if (!msg.imageBase64) {
          request.options.body.messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      });
    }
    request.options.body.messages.push({
      role: "user",
      content: input,
    });

    logger.mark(
      `\n[autoReply]Siliconflow API调用，请求内容：${JSON.stringify(
        request,
        null,
        2
      )}`
    );

    var response;
    try {
      request.options.body = JSON.stringify(request.options.body);
      response = await fetch(request.url, request.options);

      const data = await response.json();

      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      } else {
        logger.error(
          "[autoReply]Siliconflow调用失败：",
          JSON.stringify(data, null, 2)
        );
        return "[autoReply]Siliconflow调用失败，详情请查阅控制台。";
      }
    } catch (error) {
      logger.error(
        `[autoReply]Siliconflow调用失败, 请求返回结果：${JSON.stringify(
          response
        )}\n`,
        error
      );
      return "[autoReply]Siliconflow调用失败，详情请查阅控制台。";
    }
  }
}

export class DeepSeek extends ChatApi {
  constructor() {
    super();
    this.ApiBaseUrl = "https://api.deepseek.com/";
    if (this.Config.chatApi == "deepseek") this[ChatInterface.getModelMap]();
  }

  [ChatInterface.getModelMap]() {
    this.ModelMap = {
      "deepseek-chat": this.deepseek_chat.bind(this),
      "deepseek-reasoner": this.deepseek_reasoner.bind(this),
    };
  }

  async [ChatInterface.generateRequest]({
    apiKey,
    model,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole = true,
  }) {
    if (!this.ModelMap[model]) {
      logger.error("[autoReply]不支持的模型：" + model);
      return "[autoReply]不支持的模型：" + model;
    }
    var request = {
      url: `${this.ApiBaseUrl}/chat/completions`,
      options: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: model,
          messages: [],
          stream: false,
          temperature: 1.5,
        },
      },
    };

    var response = await this.ModelMap[model](
      request,
      input,
      historyMessages,
      image_list,
      image_type,
      useSystemRole
    );
    // 如果 DeepSeek-R1 失败，尝试使用 DeepSeek-V3

    if (
      typeof response === "string" &&
      response.startsWith("[autoReply]DeepSeek-R1调用失败")
    ) {
      request.options.body.model = "deepseek-chat";
      response = await this.deepseek_chat(
        JSON.parse(JSON.stringify(request)),
        input,
        historyMessages,
        image_list,
        image_type
      );
    }
    return response;
  }

  async deepseek_chat(
    request,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole
  ) {
    // 添加消息内容
    if (useSystemRole) {
      var systemContent = await generateSystemContent(
        this.Config.useEmotion,
        this.Config.chatPrompt
      );
      request.options.body.messages.push(systemContent);
    }
    // 添加历史对话
    if (historyMessages && historyMessages.length > 0) {
      historyMessages.forEach((msg) => {
        // 不是图片时添加
        if (!msg.imageBase64) {
          request.options.body.messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      });
      // 添加当前对话
      request.options.body.messages.push({
        role: "user",
        content: input,
      });
    }
    logger.mark(
      `\n[autoReply]DeepSeek-V3 API调用，请求内容：${JSON.stringify(
        request,
        null,
        2
      )}`
    );
    var response;
    try {
      request.options.body = JSON.stringify(request.options.body);
      response = await fetch(request.url, request.options);

      const data = await response.json();

      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      } else {
        logger.error(
          "[autoReply]DeepSeek-V3调用失败：",
          JSON.stringify(data, null, 2)
        );
        return "[autoReply]DeepSeek-V3调用失败，详情请查阅控制台。";
      }
    } catch (error) {
      logger.error(
        `[autoReply]DeepSeek-V3调用失败, 请求返回结果：${JSON.stringify(
          response
        )}\n`,
        error
      );
      return "[autoReply]DeepSeek-V3调用失败，详情请查阅控制台。";
    }
  }

  async deepseek_reasoner(
    request,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole
  ) {
    // 添加消息内容
    if (useSystemRole) {
      var systemContent = await generateSystemContent(
        this.Config.useEmotion,
        this.Config.chatPrompt
      );
      request.options.body.messages.push(systemContent);
    }
    // 添加历史对话
    var content = "";
    if (historyMessages && historyMessages.length > 0) {
      content += historyMessages
        .filter((msg) => !msg.imageBase64)
        .map((msg) => `"role": "${msg.role}", "content": "${msg.content}",\n`)
        .join("");
      content += `"role": "user", "content": "${input}"`;
    } else {
      content = input;
    }
    request.options.body.messages.push({
      role: "user",
      content: content,
    });

    logger.mark(
      `\n[autoReply]DeepSeek-R1 API调用，请求内容：${JSON.stringify(
        request,
        null,
        2
      )}`
    );
    var response;
    try {
      request.options.body = JSON.stringify(request.options.body);
      response = await fetch(request.url, request.options);

      const data = await response.json();

      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      } else {
        logger.error(
          "[autoReply]DeepSeek-R1调用失败：",
          JSON.stringify(data, null, 2)
        );
        return "[autoReply]DeepSeek-R1调用失败，详情请查阅控制台。";
      }
    } catch (error) {
      logger.error(
        `[autoReply]DeepSeek-R1调用失败, 请求返回结果：${JSON.stringify(
          response
        )}\n`,
        error
      );
      return "[autoReply]DeepSeek-R1调用失败，详情请查阅控制台。";
    }
  }
}

export class ArkEngine extends ChatApi {
  constructor(Config) {
    super(Config);
    // 需要用户自行输入模型等信息
    this.shouldInputSelf = true;
  }

  // 自定义模型，不依靠成员变量
  [ChatInterface.getModelMap]() { }

  async [ChatInterface.generateRequest]({
    apiKey,
    model,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole = true,
  }) {
    // 构造请求体
    var request = {
      url: `${this.Config.apiCustomUrl}`,
      options: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: model,
          messages: [],
          stream: false,
          temperature: 1.5,
        },
      },
    };

    // var response = await this.ModelMap[model](
    var response = await this.commonRequest(
      request,
      input,
      historyMessages,
      image_list,
      image_type,
      useSystemRole
    );
    // 调用返回结果的头尾容易有换行符，进行处理
    response = response.replace(/^\n+|\n+$/g, "");
    return response;
  }
  async commonRequest(
    request,
    input,
    historyMessages = [],
    image_list = {},
    image_type = false,
    useSystemRole
  ) {
    if (useSystemRole) {
      var systemContent = await generateSystemContent(
        this.Config.useEmotion,
        this.Config.chatPrompt
      );
      request.options.body.messages.push(systemContent);
    }

    // 添加历史对话
    if (historyMessages && historyMessages.length > 0) {
      historyMessages.forEach((msg) => {
        // 不是图片时添加
        if (!msg.imageBase64) {
          request.options.body.messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      });
    }
    request.options.body.messages.push({
      role: "user",
      content: input,
    });

    logger.mark(
      `\n[autoReply]火山方舟 API调用，请求内容：${JSON.stringify(
        request,
        null,
        2
      )}`
    );

    var response;
    try {
      request.options.body = JSON.stringify(request.options.body);
      response = await fetch(request.url, request.options);

      const data = await response.json();

      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      } else {
        logger.error(
          "[autoReply]火山方舟调用失败：",
          JSON.stringify(data, null, 2)
        );
        return "[autoReply]火山方舟调用失败，详情请查阅控制台。";
      }
    } catch (error) {
      logger.error(
        `[autoReply]火山方舟调用失败, 请求返回结果：${JSON.stringify(
          response
        )}\n`,
        error
      );
      return "[autoReply]火山方舟调用失败，详情请查阅控制台。";
    }
  }
}

/************************** 函数调用 **************************/

/**
 * 生成 role = system 的内容
 * @param {*} useEmotion 是否使用情感
 * @param {*} chatPrompt 聊天预设
 * @returns `{role: 'system', content: 'xxx'}`
 */
async function generateSystemContent(useEmotion, chatPrompt) {
  if (Objects.isNull(chatPrompt))
    chatPrompt =
      "You are a helpful assistant, you must speak Chinese. Now you are in a chat group, and the following is chat history";
  var emotionPrompt = await redis.get(EMOTION_KEY);
  return {
    role: "system",
    // todo 按deepseek-r1的模板修正格式，之后有问题再说
    content: useEmotion
      ? `${chatPrompt} \n 你的情感倾向——${emotionPrompt
        .replace(/\n/g, "")
        .replace(/\s+/g, "")}`
      : chatPrompt,
  };
}

/************************** 模型列表 **************************/

/**
 * 聊天模型列表，新增的都加里面
 */
export const chatMap = {
  siliconflow: new Siliconflow(),
  deepseek: new DeepSeek(),
  "火山方舟": new ArkEngine(),
};