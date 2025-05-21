import { get, getXML } from "../utils/net.js";
import { formatDate, getFestivalsDates } from "../utils/date.js";
import { generateDailyReport } from "../utils/page.js";
import { config } from "../config/index.js";
import { Objects } from "../utils/kits.js";

export const help = () => {
    return {
        name: "日报",
        type: "passive",
        command: "#日报",
        dsc: "主动或定时推送日报",
        enable: config.dailyReport.useDailyReport,
    }
}

export class dailyReport extends plugin {
    constructor() {
        super({
            name: "[扎克芙芙]推送日报",
            dsc: "推送日报",
            event: "message",
            priority: 1,
            rule: [
                {
                    reg: "^#日报$",
                    fnc: "dailyReport",
                },
            ],
        });
        if (config.dailyReport.useDailyReport && config.dailyReport.push) {
            this.task = Object.defineProperties(
                {},
                {
                    cron: { value: config.dailyReport.dailyReportTime, writable: false },
                    name: { value: "推送日报", writable: false },
                    fnc: { value: () => this.dailyReport(), writable: false },
                    log: { get: () => false },
                }
            );
        }
    }
    static hitokoto_url = "https://v1.hitokoto.cn/?c=a";
    static alapi_url = "https://v2.alapi.cn/api/zaobao";
    static six_url = "https://60s-api.viki.moe/v2/60s";
    static game_url = "https://www.4gamers.com.tw/rss/latest-news";
    static bili_url = "https://s.search.bilibili.com/main/hotword";
    static it_url = "https://www.ithome.com/rss/";
    static anime_url = "https://api.bgm.tv/calendar";
    static week: Record<number, string> = {
        0: "日",
        1: "一",
        2: "二",
        3: "三",
        4: "四",
        5: "五",
        6: "六",
    };

    static getCurrentWeekDay() {
        const today = new Date();
        const dayIndex = today.getDay();
        return `星期${dailyReport.week[dayIndex]}`;
    }


    static async generateDailyReport(): Promise<Buffer<ArrayBuffer>> {
        var hitokotoResp = await get(dailyReport.hitokoto_url);
        var hitokoto;
        var sixResp, six;
        var biliResp = await get(dailyReport.bili_url);
        var bili = [];
        var itResp = await getXML(dailyReport.it_url);
        var it = [];
        var animeResp = await get(dailyReport.anime_url);
        var anime = [];

        hitokoto = hitokotoResp.hitokoto;

        if (Objects.isNull(config.dailyReport.alapiToken)) {
            // 使用 alapitoken 获取数据
            let alapi = await get(`${dailyReport.alapi_url}?token=${config.dailyReport.alapiToken}`);
            let news = alapi.data.news;
            // 删掉、
            news.forEach((item: string, index: number) => {
                var find = news[index].indexOf('、');
                if (find !== -1) {
                    news[index] = item.substring(find + 1, item.length);
                }
                // 删除句子最后的标点
                if (news[index].endsWith('。') || news[index].endsWith('！') || news[index].endsWith('；') || news[index].endsWith('？')) {
                    news[index] = news[index].substring(0, news[index].length - 1);
                }
            });
            six = news;
            if (six.length > 11) {
                six = six.slice(0, 11);
            }
        } else {
            sixResp = await get(dailyReport.six_url);
            six = sixResp.data.news;
            if (six.length > 11) {
                six = six.slice(0, 11);
            }
        }
        for (var each in biliResp.list) {
            if (biliResp.list.hasOwnProperty(each)) {
                bili.push({
                    keyword: biliResp.list[each].keyword,
                    icon: biliResp.list[each].icon,
                });
            }
        }
        // 获取所有 <item> 元素
        var items = itResp.getElementsByTagName("item");
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var title = item.getElementsByTagName("title")[0]?.textContent || "无标题";
            it.push(title);
            if (it.length >= 11) break;
        }
        const currentDay = dailyReport.getCurrentWeekDay(); // 获取当前星期几
        for (var day of animeResp) {
            if (day.weekday.cn === currentDay) {
                var i = 0;
                for (var eachItem of day.items) {
                    if (eachItem.name_cn) {
                        anime.push({
                            name: eachItem.name_cn,
                            image: eachItem.images.large ? eachItem.images.large : eachItem.images.common,
                        });
                    } else {
                        anime.push({
                            name: eachItem.name,
                            image: eachItem.images.large ? eachItem.images.large : eachItem.images.common,
                        });
                    }
                    i++;
                    if (i >= 8) break;
                }
                break;
            }
        }
        var data = {
            data_hitokoto: hitokoto,
            data_six: six,
            data_bili: bili,
            data_it: it,
            data_anime: anime,
            week: dailyReport.week[new Date().getDay()],
            date: await formatDate(Date.now()),
            zh_date: await formatDate(Date.now(), "zh"),
            full_show: config.dailyReport.dailyReportFullShow,
            data_festival: await getFestivalsDates(),
        };

        // 生成图片
        var image = await generateDailyReport(data);
        var imageBuffer = Buffer.from(image);
        return imageBuffer;
    }

    static async pushDailyReport(imageBuffer: Buffer<ArrayBuffer>) {
        logger.info("推送日报");
        for (let i = 0; i < config.dailyReport.pushGroupList.length; i++) {
            // 添加延迟以防止消息发送过快
            setTimeout(async () => {
                const group = Bot.pickGroup(config.dailyReport.pushGroupList[i]);
                logger.info(`正在向群组 ${group} 推送新闻。`);
                await group.sendMsg([segment.image(imageBuffer)]);
            }, i * 1000);
        }
    }

    async dailyReport(e: any) {
        if (!config.dailyReport.useDailyReport) return false;
        if (e.message_type != "group") {
            await e.reply("功能只对群聊开放");
            return true;
        }
        const imageBuffer = await dailyReport.generateDailyReport();
        e.reply([segment.image(imageBuffer)]);
        return true;
    }
}
