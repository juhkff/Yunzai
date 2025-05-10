import { config } from "../../../config/index.js";
import { Base64, Objects } from "../../../utils/kits.js";
import { EMOTION_KEY } from "../../../utils/redis.js";
import { ChatAgent } from "../chatAgent.js";
export class Gemini extends ChatAgent {
    constructor(apiKey) { super(apiKey, "https://generativelanguage.googleapis.com/v1beta/models"); }
    static hasVisual = () => true;
    async chatModels() {
        return {
            "gemini-2.5-flash-preview-04-17": this.commonRequestChat.bind(this),
            "gemini-2.5-pro-preview-05-06": this.commonRequestChat.bind(this),
            "gemini-2.5-pro-exp-03-25": this.commonRequestChat.bind(this),
            "gemini-2.0-flash": this.commonRequestChat.bind(this),
            "输入其它模型（请勿选择该项）": null
        };
    }
    async chatRequest(model, input, historyMessages, useSystemRole) {
        // 构造请求体
        var request = {
            url: `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
            options: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: {
                    contents: []
                },
            },
        };
        if (!this.modelsChat.hasOwnProperty(model) || this.modelsChat[model] === null) {
            let response = await this.commonRequestChat(request, input, historyMessages, useSystemRole);
            return response;
        }
        else {
            let response = await this.modelsChat[model](request, input, historyMessages, useSystemRole);
            return response;
        }
    }
    async visualModels() {
        return {
            "gemini-2.5-flash-preview-04-17": {
                chat: this.commonRequestVisual.bind(this),
                tool: this.commonRequestTool.bind(this)
            },
            "gemini-2.5-pro-preview-05-06": {
                chat: this.commonRequestVisual.bind(this),
                tool: this.commonRequestTool.bind(this)
            },
            "gemini-2.5-pro-exp-03-25": {
                chat: this.commonRequestVisual.bind(this),
                tool: this.commonRequestTool.bind(this)
            },
            "gemini-2.0-flash": {
                chat: this.commonRequestVisual.bind(this),
                tool: this.commonRequestTool.bind(this)
            },
            "输入其它模型（请勿选择该项）": null
        };
    }
    async visualRequest(model, nickName, j_msg, historyMessages, useSystemRole) {
        /*
        if (!this.modelsVisual[model]) {
            logger.error("[Gemini]不支持的视觉模型：" + model);
            return "[Gemini]不支持的视觉模型：" + model;
        }
        */
        let request = {
            url: `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
            options: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: {
                    contents: []
                },
            },
        };
        if (!this.modelsVisual.hasOwnProperty(model) || this.modelsVisual[model] === null) {
            let response = await this.commonRequestVisual(JSON.parse(JSON.stringify(request)), nickName, j_msg, historyMessages, useSystemRole);
            return response;
        }
        else {
            let response = await this.modelsVisual[model].chat(JSON.parse(JSON.stringify(request)), nickName, j_msg, historyMessages, useSystemRole);
            return response;
        }
    }
    async toolRequest(model, j_msg) {
        /*
        if (!this.modelsVisual[model]) {
            logger.error(`[Gemini]不支持的视觉模型: ${model}`);
            return `[Gemini]不支持的视觉模型: ${model}`;
        }
        */
        var request = {
            url: `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
            options: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: {
                    contents: []
                },
            },
        };
        if (!this.modelsVisual.hasOwnProperty(model)) {
            let response = await this.commonRequestTool(JSON.parse(JSON.stringify(request)), j_msg);
            return response;
        }
        else {
            var response = await this.modelsVisual[model].tool(JSON.parse(JSON.stringify(request)), j_msg);
            return response;
        }
    }
    async commonRequestChat(request, input, historyMessages = [], useSystemRole = true) {
        if (useSystemRole) {
            var systemContent = await this.generateSystemContent(config.autoReply.useEmotion, config.autoReply.chatPrompt);
            request.options.body["system_instruction"] = systemContent;
        }
        // 添加历史对话
        if (historyMessages && historyMessages.length > 0) {
            historyMessages.forEach((msg) => {
                // 不是图片时添加
                // if (!msg.imageBase64) {
                request.options.body.contents.push({ role: msg.role == "assistant" ? "model" : msg.role, parts: [{ text: msg.content }] });
                // }
            });
        }
        request.options.body.contents.push({ role: "user", parts: [{ text: input }] });
        if (config.autoReply.debugMode)
            logger.info(`[Gemini]对话模型 Gemini API调用，请求内容：${JSON.stringify(request, null, 2)}`);
        try {
            request.options.body = JSON.stringify(request.options.body);
            let response = await fetch(request.url, request.options);
            const data = await response.json();
            if (data?.error) {
                return `${data?.error?.status}: ${data?.error?.message}`;
            }
            if (data?.candidates[0]?.content?.parts[0]) {
                return data?.candidates[0]?.content?.parts[0].text;
            }
            else {
                logger.error(`[Gemini]对话模型调用失败：`, JSON.stringify(data, null, 2));
                return `[Gemini]对话模型调用失败，详情请查阅控制台。`;
            }
        }
        catch (error) {
            logger.error(`[Gemini]对话模型调用失败`, error);
            return `[Gemini]对话模型调用失败，详情请查阅控制台。`;
        }
    }
    async generateSystemContent(useEmotion, chatPrompt) {
        if (Objects.isNull(chatPrompt))
            chatPrompt =
                "You are a helpful assistant, you must speak Chinese. Now you are in a chat group, and the following is chat history";
        var emotionPrompt = await redis.get(EMOTION_KEY);
        return {
            parts: [{
                    text: (useEmotion ?
                        `${chatPrompt.replace("assistant", "model")} \n 你的情感倾向——${emotionPrompt.replace(/\n/g, "").replace(/\s+/g, "")}`
                        : chatPrompt.replace("assistant", "model"))
                }],
        };
    }
    async commonRequestVisual(request, nickeName, j_msg, historyMessages, useSystemRole = true) {
        if (useSystemRole) {
            var systemContent = await this.generateSystemContent(config.autoReply.useEmotion, config.autoReply.chatPrompt);
            request.options.body["system_instruction"] = systemContent;
        }
        // 添加历史对话
        if (historyMessages && historyMessages.length > 0) {
            historyMessages.forEach((history) => {
                var content = [];
                var hasContent = false;
                var msg = history.content;
                if (!Objects.isNull(msg.sourceImg)) {
                    for (const img of msg.sourceImg) {
                        content.push({
                            inline_data: {
                                mime_type: Base64.getImageTypeFromBase64(img),
                                data: Base64.getImageContentFromBase64(img)
                            }
                        });
                    }
                    hasContent = true;
                }
                if (!Objects.isNull(msg.img)) {
                    for (const img of msg.img) {
                        content.push({
                            inline_data: {
                                mime_type: Base64.getImageTypeFromBase64(img),
                                data: Base64.getImageContentFromBase64(img)
                            }
                        });
                    }
                    hasContent = true;
                }
                if (content.length > 0)
                    content.push({
                        text: "上述图片中可能包含装饰性图片/表情包（如无文字梗图、通用表情符号或纯娱乐性meme），此类视觉元素不携带实质性信息，在后续内容生成时应予以忽略",
                    });
                // TODO 引用消息文本和消息正文拼接，不参与描述引用图片，先按这种逻辑实现试试
                let finalMsg = "";
                if (!Objects.isNull(msg.sourceText))
                    finalMsg += msg.sourceText;
                if (!Objects.isNull(msg.text))
                    finalMsg += msg.text;
                if (!Objects.isNull(finalMsg)) {
                    if (history.role == "assistant") {
                        // TODO 机器人的记录如果添加上时间戳和昵称，生成的结果容易也包含这些，看上去就很假
                        content.push({ text: finalMsg });
                    }
                    else {
                        content.push({ text: history.time + " - " + history.nickName + "：" + finalMsg });
                    }
                    hasContent = true;
                }
                // TODO 如果content只有notProcessed部分有内容，例如发送默认表情(type==face)情况，就直接跳过不加
                if (hasContent) {
                    request.options.body.contents.push({ role: history.role == "assistant" ? "model" : history.role, parts: content });
                }
            });
        }
        // j_msg = {sourceImg: [], sourceText: "", img: [], text: "", notProcessed: []}
        // 添加消息内容
        let content = [];
        if (!Objects.isNull(j_msg.sourceImg)) {
            for (const img of j_msg.sourceImg) {
                content.push({
                    inline_data: {
                        mime_type: Base64.getImageTypeFromBase64(img),
                        data: Base64.getImageContentFromBase64(img)
                    }
                });
            }
            content.push({
                text: "上述图片中可能包含装饰性图片/表情包（如无文字梗图、通用表情符号或纯娱乐性meme），此类视觉元素不携带实质性信息，在后续内容生成时应予以忽略",
            });
        }
        if (!Objects.isNull(j_msg.img)) {
            for (const img of j_msg.img) {
                content.push({
                    inline_data: {
                        mime_type: Base64.getImageTypeFromBase64(img),
                        data: Base64.getImageContentFromBase64(img)
                    }
                });
            }
            content.push({
                text: "上述图片中可能包含装饰性图片/表情包（如无文字梗图、通用表情符号或纯娱乐性meme），此类视觉元素不携带实质性信息，在后续内容生成时应予以忽略",
            });
        }
        // TODO 引用消息文本和消息正文拼接，不参与描述引用图片，先按这种逻辑实现试试
        var finalMsg = j_msg.text;
        if (!Objects.isNull(finalMsg) && !Objects.isNull(j_msg.sourceText))
            finalMsg = j_msg.sourceText + finalMsg;
        if (!Objects.isNull(finalMsg)) {
            content.push({ text: nickeName + "：" + finalMsg });
        }
        request.options.body.contents.push({ role: "user", parts: content });
        if (config.autoReply.debugMode) {
            // 创建打印用副本
            var logRequest = JSON.parse(JSON.stringify(request));
            logRequest.options.body.contents.forEach((message) => {
                var content = message.parts;
                content.forEach((item) => {
                    if (item.hasOwnProperty("inline_data")) {
                        // 截断前40位
                        item.inline_data.data = item.inline_data.data.substring(0, 40) + "...";
                    }
                    if (item.hasOwnProperty("text") && item.text.length > 40) {
                        item.text = item.text.substring(0, 40) + "...";
                    }
                });
            });
            logger.info(`[Gemini]视觉模型 Gemini API调用，请求内容：${JSON.stringify(logRequest, null, 2)}`);
        }
        var response;
        try {
            request.options.body = JSON.stringify(request.options.body);
            response = await fetch(request.url, request.options);
            const data = await response.json();
            if (data?.error) {
                return `${data?.error?.status}: ${data?.error?.message.length > 40 ? data?.error?.message.substring(0, 40) + "..." : data?.error?.message}`;
            }
            if (data?.candidates[0]?.content?.parts[0]) {
                return data?.candidates[0]?.content?.parts[0].text;
            }
            else {
                logger.error(`[Gemini]对话模型调用失败：`, JSON.stringify(data, null, 2));
                return `[Gemini]对话模型调用失败，详情请查阅控制台。`;
            }
        }
        catch (error) {
            logger.error("[Gemini]视觉模型API调用失败", error);
            return "[Gemini]视觉模型API调用失败，详情请查阅控制台。";
        }
    }
    async commonRequestTool(request, j_msg) {
        var content = [];
        if (!Objects.isNull(j_msg.img)) {
            j_msg.img.forEach((base64) => {
                content.push({
                    inline_data: {
                        mime_type: Base64.getImageTypeFromBase64(base64),
                        data: Base64.getImageContentFromBase64(base64)
                    }
                });
            });
        }
        if (!Objects.isNull(j_msg.text)) {
            j_msg.text.forEach((text) => {
                content.push({ text: text });
            });
        }
        request.options.body.contents.push({ role: "user", parts: content });
        if (config.autoReply.debugMode) {
            // 创建打印用副本
            var logRequest = JSON.parse(JSON.stringify(request));
            logRequest.options.body.contents.forEach((message) => {
                var content = message.parts;
                content.forEach((item) => {
                    if (item.hasOwnProperty("inline_data")) {
                        // 截断前40位
                        item.inline_data.data = item.inline_data.data.substring(0, 40) + "...";
                    }
                    if (item.hasOwnProperty("text") && item.text.length > 40) {
                        item.text = item.text.substring(0, 40) + "...";
                    }
                });
            });
            logger.info(`[Gemini]视觉模型 Gemini API工具请求调用，请求内容：${JSON.stringify(logRequest, null, 2)}`);
        }
        var response;
        try {
            request.options.body = JSON.stringify(request.options.body);
            response = await fetch(request.url, request.options);
            const data = await response.json();
            if (data?.error) {
                return `${data?.error?.status}: ${data?.error?.message.length > 40 ? data?.error?.message.substring(0, 40) + "..." : data?.error?.message}`;
            }
            if (data?.candidates[0]?.content?.parts[0]) {
                return data?.candidates[0]?.content?.parts[0].text;
            }
            else {
                logger.error(`[Gemini]视觉模型API工具请求调用失败：`, JSON.stringify(data, null, 2));
                return `[Gemini]视觉模型API工具请求调用失败，详情请查阅控制台。`;
            }
        }
        catch (error) {
            logger.error("[Gemini]视觉模型API工具请求调用失败", error);
            return "[Gemini]视觉模型API工具请求调用失败，详情请查阅控制台。";
        }
    }
}
