import path from "path";
import fs from "fs";
import { scheduleJob } from "node-schedule"
import { config } from "../config";
import { dailyReport } from "../apps/dailyReport";
import { sleep } from "../common";
import { PLUGIN_DATA_DIR } from "../model/path";
import { FileType } from "../utils/kits";
import { CronExpression, JobDict } from "../type";

const DAILY_REPORT_JOB_NAME = "dailyReportJob";
const jobDict: JobDict = {};

async function runDailyReportTask() {
    if (!config.dailyReport.preHandle) return;
    logger.log("预处理 -> 生成日报")
    let imageBuffer = null;
    let doOnce = false;
    while (true) {
        try {
            imageBuffer = await dailyReport.generateDailyReport();
            if (imageBuffer) {
                break;
            }
        } catch (e) {
            if (!doOnce) {
                logger.error(e)
                doOnce = true;
            }
            // 休眠1分钟循环执行
            sleep(60000)
        }
    }
    // 保存
    const imagePath = path.join(PLUGIN_DATA_DIR, `dailyReport.${(await FileType.getFileTypeFromBuffer(imageBuffer)).ext}`);
    if (!fs.existsSync(PLUGIN_DATA_DIR)) fs.mkdirSync(PLUGIN_DATA_DIR);
    fs.writeFileSync(imagePath, imageBuffer);
    logger.log("预处理 -> 生成日报成功")
}

/**
 * 创建或更新定时任务
 * @param taskName 枚举值
 * @param taskCron Cron 表达式
 */
function upsertJobFromConfig(taskName: string, taskCron: CronExpression) {
    if (jobDict[taskName] && jobDict[taskName].reschedule(taskCron)) logger.info(`已修改定时任务${taskName}: ${taskCron}`);
    else {
        jobDict[taskName] = scheduleJob(taskName, taskCron, runDailyReportTask);
        logger.info(`已设置定时任务${taskName}: ${taskCron}`);
    }
}

if (config.dailyReport.useDailyReport && config.dailyReport.preHandle)
    upsertJobFromConfig(DAILY_REPORT_JOB_NAME, config.dailyReport.pushTimeCron);

// 模拟监听配置变化（实际应根据你的配置管理系统实现）
function changeJobFromConfig(configs: [{ name: string, inputCron: CronExpression }]) {
    for (const { name, inputCron } of configs) {
        if (jobDict[name] !== inputCron) {
            console.log(`检测到配置变化，更新定时任务时间：${jobDict[name]} -> ${inputCron}`);
            upsertJobFromConfig(); // 重新创建任务
        }
    }
}