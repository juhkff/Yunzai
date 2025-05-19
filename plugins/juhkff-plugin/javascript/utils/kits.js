import * as fileType from "file-type";
import NodeID3 from "node-id3";
/**
 * @description: 对象工具类
 */
export class Objects {
    /**
     * 判断对象是否为空，包括空字符串，空数组，空对象
     * @param {*} obj
     * @returns boolean
     */
    static isNull(obj) {
        if (!obj || obj === null || obj === undefined)
            return true;
        if (Array.isArray(obj)) {
            return obj.length === 0;
        }
        if (typeof obj === "string" || obj instanceof String) {
            return obj.trim() === "";
        }
        return false;
    }
    /**
     * 判断多个对象中是否有空对象
     * @param objs
     * @returns
     */
    static hasNull(...objs) {
        return objs.some((obj) => Objects.isNull(obj));
    }
}
/**
 * @description: 字符串工具类
 */
export class StringUtils {
    /**
     * 首字母大写
     * @param {*} str
     * @returns string
     */
    static toUpperFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
export class FileType {
    static getBase64ImageType(base64) {
        // 将Base64数据解码为二进制数据
        const binaryData = Buffer.from(base64, "base64");
        // 获取前几个字节作为魔数（magic number）
        const magicNumber = binaryData.subarray(0, 2).toString("hex").toUpperCase();
        // 根据魔数确定图片类型
        switch (magicNumber) {
            case "8950":
                return "data:image/png;base64,";
            case "FFD8":
                return "data:image/jpeg;base64,";
            case "4749":
                return "data:image/gif;base64,";
            case "424D":
                return "data:image/bmp;base64,";
            case "5249":
                return "data:image/webp;base64,";
            case "4949":
            case "4D4D":
                return "data:image/tiff;base64,";
            default:
                return null;
        }
    }
    static getImageTypeFromBase64(base64) {
        if (base64.startsWith("data:image/")) {
            return base64.split(";")[0].substring(5);
        }
        const base64Type = FileType.getBase64ImageType(base64);
        if (base64Type) {
            return "image/" + base64Type.split("/")[1].split(";")[0];
        }
        return null;
    }
    static getImageContentFromBase64(base64) {
        if (base64.startsWith("data:image/"))
            return base64.split(";base64,")[1];
        if (Objects.isNull(base64))
            return base64;
        return null;
    }
    static async getAudioTypeFromBuffer(arrayBuffer) {
        return await fileType.fileTypeFromBuffer(arrayBuffer);
    }
}
export class Audio {
    static parseCaptions(captionsJson) {
        const captions = JSON.parse(captionsJson);
        let lrcLines = [];
        for (const utterance of captions.utterances) {
            const words = utterance.words || [];
            const startMs = Math.floor(words.start_time);
            const text = words.text;
            // LRC 行：[mm:ss.xx]text
            const timeStr = Audio.formatTimeLRC(startMs);
            const lineText = `${timeStr}${text}`;
            if (lineText) {
                // LRC 格式
                lrcLines.push(lineText);
            }
        }
        return {
            lrc: lrcLines.join('\n')
        };
    }
    static formatTimeLRC(ms) {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const hundredths = Math.floor((ms % 1000) / 10);
        return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
    }
    static async writeLyricsToMP3(mp3FilePath, lrcContent) {
        const tags = NodeID3.read(mp3FilePath);
        // tags.uslt = {
        //     language: 'eng',
        //     descriptor: 'Embedded Lyrics',
        //     text: lrcContent
        // };
        NodeID3.write(tags, mp3FilePath);
        console.log('✅ 歌词已写入 MP3 文件');
    }
}
