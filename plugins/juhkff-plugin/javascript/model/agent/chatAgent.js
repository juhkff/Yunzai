/**
 * @file chatApi.ts
 * @fileoverview 聊天接口定义和公用函数
 * @author juhkff
 */
import { config } from "../../config/index.js";
import { Objects } from "../../utils/kits.js";
import { EMOTION_KEY } from "../../utils/redis.js";
export class ChatAgent {
    apiKey;
    apiUrl = undefined;
    modelsChat;
    modelsVisual;
    constructor(apiKey, apiUrl = null) {
        this.apiKey = apiKey;
        if (apiUrl)
            this.apiUrl = apiUrl;
        (async () => {
            this.modelsChat = await this.chatModels();
            this.modelsVisual = await this.visualModels();
        })();
    }
    static hasVisual = () => { throw new Error("Method not implemented."); };
    /**
     * 生成 role = system 的内容
     * @param useEmotion 是否使用情感
     * @param chatPrompt 聊天预设
     * @returns `{role: 'system', content: 'xxx'}`
     */
    async generateSystemContent(useEmotion, chatPrompt) {
        if (Objects.isNull(chatPrompt))
            chatPrompt =
                "You are a helpful assistant, you must speak Chinese. Now you are in a chat group, and the following is chat history";
        var emotionPrompt = await redis.get(EMOTION_KEY);
        return {
            role: "system",
            // 按deepseek-r1的模板修正格式
            content: (useEmotion ?
                `${chatPrompt} \n 你的情感倾向——${emotionPrompt.replace(/\n/g, "").replace(/\s+/g, "")}`
                : chatPrompt)
        };
    }
    async generateSystemContentVisual(useEmotion, chatPrompt) {
        if (Objects.isNull(chatPrompt))
            chatPrompt =
                "You are a helpful assistant, you must speak Chinese. Now you are in a chat group, and the following is chat history";
        var emotionPrompt = await redis.get(EMOTION_KEY);
        return {
            role: "system",
            content: [{
                    type: "text",
                    text: (useEmotion ?
                        `${chatPrompt} \n 你的情感倾向——${emotionPrompt.replace(/\n/g, "").replace(/\s+/g, "")}`
                        : chatPrompt),
                }],
        };
    }
    async commonRequestChat(request, input, historyMessages = [], useSystemRole = true) {
        if (useSystemRole) {
            var systemContent = await this.generateSystemContent(config.autoReply.useEmotion, config.autoReply.chatPrompt);
            request.options.body.messages.push(systemContent);
        }
        // 添加历史对话
        if (historyMessages && historyMessages.length > 0) {
            historyMessages.forEach((msg) => {
                // 不是图片时添加
                // if (!msg.imageBase64) {
                request.options.body.messages.push({ role: msg.role, content: msg.content });
                // }
            });
        }
        request.options.body.messages.push({ role: "user", content: input });
        if (config.autoReply.debugMode)
            logger.info(`[autoReply]对话模型 ${request.options.body.model} API调用，请求内容：${JSON.stringify(request, null, 2)}`);
        try {
            request.options.body = JSON.stringify(request.options.body);
            let response = await fetch(request.url, request.options);
            const data = await response.json();
            if (data?.choices?.[0]?.message?.content) {
                return data.choices[0].message.content;
            }
            else {
                logger.error(`[autoReply]对话模型调用失败：`, JSON.stringify(data, null, 2));
                return `[autoReply]对话模型调用失败，详情请查阅控制台。`;
            }
        }
        catch (error) {
            logger.error(`[autoReply]对话模型调用失败`, error);
            return `[autoReply]对话模型调用失败，详情请查阅控制台。`;
        }
    }
    async commonRequestVisual(request, nickeName, j_msg, historyMessages, useSystemRole = true) {
        if (useSystemRole) {
            var systemContent = await this.generateSystemContentVisual(config.autoReply.useEmotion, config.autoReply.chatPrompt);
            request.options.body.messages.push(systemContent);
        }
        // 添加历史对话
        if (historyMessages && historyMessages.length > 0) {
            historyMessages.forEach((history) => {
                var content = [];
                var hasContent = false;
                var msg = history.content;
                if (!Objects.isNull(msg.sourceImg)) {
                    for (const img of msg.sourceImg) {
                        content.push({ type: "image_url", image_url: { detail: "auto", url: img } });
                    }
                    content.push({
                        type: "text",
                        text: "上述图片中可能包含装饰性图片/表情包（如无文字梗图、通用表情符号或纯娱乐性meme），此类视觉元素不携带实质性信息，在后续内容生成时应予以忽略"
                    });
                    hasContent = true;
                }
                if (!Objects.isNull(msg.img)) {
                    for (const img of msg.img) {
                        content.push({ type: "image_url", image_url: { detail: "auto", url: img } });
                    }
                    content.push({
                        type: "text",
                        text: "上述图片中可能包含装饰性图片/表情包（如无文字梗图、通用表情符号或纯娱乐性meme），此类视觉元素不携带实质性信息，在后续内容生成时应予以忽略",
                    });
                    hasContent = true;
                }
                // TODO 引用消息文本和消息正文拼接，不参与描述引用图片，先按这种逻辑实现试试
                let finalMsg = "";
                if (!Objects.isNull(msg.sourceText))
                    finalMsg += msg.sourceText;
                if (!Objects.isNull(msg.text))
                    finalMsg += msg.text;
                if (!Objects.isNull(finalMsg)) {
                    // 如果只发图片会不记录发送人昵称，改为在最后额外发送一条json，指明发送人和时间
                    content.push({ type: "text", text: finalMsg });
                    hasContent = true;
                }
                // TODO 如果content只有notProcessed部分有内容，例如发送默认表情(type==face)情况，就直接跳过不加
                if (hasContent) {
                    // 在content头部插入
                    if (history.role != "assistant")
                        content.unshift({ type: "text", text: `${history.time} - ${history.nickName} 发送消息如下：` });
                    request.options.body.messages.push({ role: history.role, content: content });
                }
            });
        }
        // j_msg = {sourceImg: [], sourceText: "", img: [], text: "", notProcessed: []}
        // 添加消息内容
        let content = [];
        if (!Objects.isNull(j_msg.sourceImg)) {
            for (const img of j_msg.sourceImg) {
                content.push({ type: "image_url", image_url: { detail: "auto", url: img } });
            }
            content.push({
                type: "text",
                text: "上述图片中可能包含装饰性图片/表情包（如无文字梗图、通用表情符号或纯娱乐性meme），此类视觉元素不携带实质性信息，在后续内容生成时应予以忽略",
            });
        }
        if (!Objects.isNull(j_msg.img)) {
            for (const img of j_msg.img) {
                content.push({
                    type: "image_url",
                    image_url: { detail: "auto", url: img },
                });
            }
            content.push({
                type: "text",
                text: "上述图片中可能包含装饰性图片/表情包（如无文字梗图、通用表情符号或纯娱乐性meme），此类视觉元素不携带实质性信息，在后续内容生成时应予以忽略",
            });
        }
        // TODO 引用消息文本和消息正文拼接，不参与描述引用图片，先按这种逻辑实现试试
        var finalMsg = j_msg.text;
        if (!Objects.isNull(finalMsg) && !Objects.isNull(j_msg.sourceText))
            finalMsg = j_msg.sourceText + finalMsg;
        if (!Objects.isNull(finalMsg)) {
            content.push({ type: "text", text: finalMsg });
        }
        if (content.length > 0)
            content.unshift({ type: "text", text: `${nickeName} 发送消息如下：` });
        request.options.body.messages.push({ role: "user", content: content });
        if (config.autoReply.debugMode) {
            // 创建打印用副本
            var logRequest = JSON.parse(JSON.stringify(request));
            logRequest.options.body.messages.forEach((message) => {
                var content = message.content;
                content.forEach((item) => {
                    if (item.type == "image_url") {
                        // 截断前40位
                        item.image_url.url = item.image_url.url.substring(0, 40) + "...";
                    }
                    if (item.type == "text" && item.text.length > 40) {
                        item.text = item.text.substring(0, 40) + "...";
                    }
                });
            });
            logger.info(`[autoReply]视觉模型 ${logRequest.options.body.model} API调用，请求内容：${JSON.stringify(logRequest, null, 2)}`);
        }
        var response;
        try {
            request.options.body = JSON.stringify(request.options.body);
            response = await fetch(request.url, request.options);
            const data = await response.json();
            if (data?.choices?.[0]?.message?.content) {
                return data.choices[0].message.content;
            }
            else {
                logger.error("[autoReply]视觉模型API调用失败：", JSON.stringify(data, null, 2));
                return "[autoReply]视觉模型API调用失败，详情请查阅控制台。";
            }
        }
        catch (error) {
            logger.error("[autoReply]视觉模型API调用失败", error);
            return "[autoReply]视觉模型API调用失败，详情请查阅控制台。";
        }
    }
    /**
     * 工具请求
     * @param {*} request
     * @param {*} j_msg:{img:[],text:[]}
     */
    async commonRequestTool(request, j_msg) {
        var content = [];
        if (!Objects.isNull(j_msg.img)) {
            j_msg.img.forEach((base64) => {
                content.push({
                    type: "image_url",
                    image_url: { detail: "auto", url: base64 },
                });
            });
        }
        if (!Objects.isNull(j_msg.text)) {
            j_msg.text.forEach((text) => {
                content.push({ type: "text", text: text });
            });
        }
        request.options.body.messages.push({ role: "user", content: content });
        if (config.autoReply.debugMode) {
            // 创建打印用副本
            var logRequest = JSON.parse(JSON.stringify(request));
            logRequest.options.body.messages.forEach((message) => {
                var content = message.content;
                content.forEach((item) => {
                    if (item.type == "image_url") {
                        // 截断前40位
                        item.image_url.url = item.image_url.url.substring(0, 40) + "...";
                    }
                    if (item.type == "text" && item.text.length > 40) {
                        item.text = item.text.substring(0, 40) + "...";
                    }
                });
            });
            logger.info(`[autoReply]视觉模型 ${logRequest.options.body.model} API工具请求调用，请求内容：${JSON.stringify(logRequest, null, 2)}`);
        }
        var response;
        try {
            request.options.body = JSON.stringify(request.options.body);
            response = await fetch(request.url, request.options);
            const data = await response.json();
            if (data?.choices?.[0]?.message?.content) {
                return data.choices[0].message.content;
            }
            else {
                logger.error(`[autoReply]视觉模型API工具请求调用失败: ${JSON.stringify(data, null, 2)}`);
                return "[autoReply]视觉模型API工具请求调用失败，详情请查阅控制台。";
            }
        }
        catch (error) {
            logger.error("[autoReply]视觉模型API工具请求调用失败", error);
            return "[autoReply]视觉模型API工具请求调用失败，详情请查阅控制台。";
        }
    }
}
