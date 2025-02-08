/** @type {Object<groupNumber, string[]>} */
class ChatHistory {
    constructor() {
        this.chatMap = {}
    }

    checkGroup(groupNumber) {
        if (!this.chatMap[groupNumber]) {
            this.chatMap[groupNumber] = []
        }
    }

    addMessage(groupNumber, message) {
        this.chatMap[groupNumber].push(message)
        // 保留最近10条消息
        if (this.chatMap[groupNumber].length > 10) {
            this.chatMap[groupNumber].shift()
        }
    }

    generateContent(groupNumber) {
        return this.chatMap[groupNumber].join('\n')
    }
}
export default new ChatHistory()