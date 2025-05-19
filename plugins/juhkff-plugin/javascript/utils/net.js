/**
 * @file: net.js
 * @description: 网络请求相关
 */
import fs from "fs";
import https from "https";
import path from "path";
import axios from "axios";
import { DOMParser } from "xmldom";
import fastImageSize from "fast-image-size";
import { FileType } from "./kits.js";
/**
 * 下载文件
 * @param url 文件下载链接
 * @param dest 目标文件路径（带后缀）
 * @returns
 */
export async function downloadFile(url, dest) {
    //自动创建子文件夹
    if (!fs.existsSync(path.dirname(dest))) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
    }
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
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
        }).on("error", (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}
/**
 * 下载图片并转为 Base64
 * @param {string} url 图片链接
 * @param {boolean} isReturnBuffer 是否返回 Buffer，默认为 false
 * @returns {string | Buffer | null} 图片的 Base64 编码或 Buffer
 */
export async function url2Base64(url, isReturnBuffer = false) {
    try {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 60000, // 设置超时时间为60秒
        });
        /*
        // 移除图片大小限制
        const contentLength =
          response.headers?.["content-length"] || response.headers?.get("size");
        const maxSizeInBytes = 10 * 1024 * 1024; // 10MB in bytes

        if (contentLength && parseInt(contentLength) > maxSizeInBytes) {
          logger.error("[tools]图片大小超过10MB，请使用大小合适的图片");
          return null;
        }
        */
        // 返回 Buffer
        if (isReturnBuffer)
            return Buffer.from(response.data, "binary");
        // 根据图片类型来处理
        var base64 = Buffer.from(response.data, "binary").toString("base64");
        return `${FileType.getBase64ImageType(base64)}${base64}`;
    }
    catch (error) {
        throw new Error(`[net]下载图片${url}失败: ${error}`);
    }
}
/**
 * 发送 GET 请求
 * @param {string} url 请求链接
 * @returns {json} 请求结果
 */
export async function get(url) {
    try {
        let response = await fetch(url, {
            method: "GET",
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    }
    catch (error) {
        throw new Error(`[net]Error request get: ${error}`);
    }
}
/**
 * 发送 GET 请求获取 XML
 * @param {*} url 请求链接
 * @returns {Document} 解析后的 XML DOM 对象
 */
export async function getXML(url) {
    try {
        var response = await fetch(url, {
            method: "GET",
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // 获取响应的 XML 字符串
        var xmlText = await response.text();
        // 使用 DOMParser 解析 XML 字符串
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xmlText, "text/xml");
        return xmlDoc; // 返回解析后的 XML DOM 对象
    }
    catch (error) {
        throw new Error(`[net]Error fetching XML: ${error}`);
    }
}
export async function getImageDimensions(url) {
    try {
        // 使用 axios 下载图片数据
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 60000, // 设置超时时间为60秒
        });
        // 将响应数据转换为 Buffer
        const buffer = Buffer.from(response.data, "binary");
        // 使用 fast-image-size 获取图片尺寸
        const size = fastImageSize(buffer);
        return { width: size.width, height: size.height };
    }
    catch (err) {
        console.error("获取图片尺寸失败:", err);
        return { width: 0, height: 0 }; // 返回默认值或抛出错误
    }
}
