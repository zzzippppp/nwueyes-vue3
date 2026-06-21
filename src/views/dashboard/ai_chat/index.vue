<template>
  <div class="app-container ai-chat-page">
    <el-row :gutter="16" class="chat-layout">
      <el-col :span="16">
        <el-card shadow="never" class="chat-card">
          <template #header>
            <div class="card-header">
              <span>智能问答</span>
              <el-tag size="small" type="info">大模型助手</el-tag>
            </div>
          </template>
          <div ref="messageBoxRef" class="message-box">
            <div v-for="(item, index) in messages" :key="index" class="message-item" :class="item.role">
              <div class="message-avatar">
                <el-icon><component :is="item.role === 'user' ? 'User' : 'Service'" /></el-icon>
              </div>
              <div class="message-main">
                <div class="message-role">{{ item.role === 'user' ? '我' : '助手' }}</div>
                <div class="message-content">{{ item.content }}</div>
              </div>
            </div>
          </div>
          <div class="input-area">
            <el-input
              v-model="question"
              type="textarea"
              :rows="4"
              placeholder="请输入安全监测、考勤、设备相关的问题..."
              @keyup.ctrl.enter="sendMessage"
            />
            <div class="input-actions">
              <span class="hint">Ctrl + Enter 发送</span>
              <el-button type="primary" :loading="sending" @click="sendMessage">发送</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="side-card">
          <template #header>快捷问题</template>
          <div class="quick-list">
            <el-button
              v-for="item in quickQuestions"
              :key="item"
              class="quick-item"
              text
              @click="askQuick(item)"
            >
              {{ item }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'

const question = ref('')
const sending = ref(false)
const messageBoxRef = ref(null)
const messages = ref([
  {
    role: 'assistant',
    content: '你好，我是基于大模型的安全监测预警助手。你可以咨询考勤统计、异常行为、设备状态等问题。'
  }
])
const quickQuestions = [
  '今天有哪些陌生人进入？',
  '当前有哪些设备在线？',
  '帮我总结今日考勤情况',
  '最近一次异常行为是什么？'
]

async function scrollToBottom() {
  await nextTick()
  if (messageBoxRef.value) {
    messageBoxRef.value.scrollTop = messageBoxRef.value.scrollHeight
  }
}

function mockAnswer(text) {
  if (text.includes('陌生人')) {
    return '可在「考勤管理 → 陌生人研判」查看陌生人轨迹、人脸证据，并将身份转为已知人员。'
  }
  if (text.includes('设备')) {
    return '可在「设备管理 → 设备信息」查看监控点位与序列号，在「监控大屏」进行实时预览与识别。'
  }
  if (text.includes('考勤')) {
    return '可在「考勤管理 → 考勤信息」查看停留记录与人员档案，在「考勤日志」查看进出门流水。'
  }
  return '该功能正在接入大模型服务。当前为演示回复，后续可对接后端问答 API 返回实时分析结果。'
}

async function sendMessage() {
  const text = question.value.trim()
  if (!text || sending.value) return
  messages.value.push({ role: 'user', content: text })
  question.value = ''
  await scrollToBottom()
  sending.value = true
  window.setTimeout(async () => {
    messages.value.push({ role: 'assistant', content: mockAnswer(text) })
    sending.value = false
    await scrollToBottom()
  }, 600)
}

function askQuick(text) {
  question.value = text
  sendMessage()
}
</script>

<style scoped lang="scss">
.ai-chat-page {
  .chat-layout {
    min-height: calc(100vh - 120px);
  }
  .chat-card,
  .side-card {
    min-height: calc(100vh - 120px);
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .message-box {
    height: calc(100vh - 320px);
    overflow-y: auto;
    padding-right: 8px;
  }
  .message-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 20px;
    &.user {
      flex-direction: row-reverse;
      .message-main {
        align-items: flex-end;
      }
      .message-avatar {
        background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
        color: #fff;
      }
      .message-content {
        background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
        color: #fff;
        border-top-right-radius: 2px;
      }
    }
    &.assistant {
      .message-avatar {
        background: #eef1f6;
        color: #5b6b7c;
      }
      .message-content {
        background: #f4f6f9;
        border: 1px solid #ebeef5;
        border-top-left-radius: 2px;
      }
    }
  }
  .message-avatar {
    flex: 0 0 36px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }
  .message-main {
    display: flex;
    flex-direction: column;
    max-width: calc(100% - 56px);
  }
  .message-role {
    font-size: 12px;
    color: #909399;
    margin-bottom: 6px;
  }
  .message-content {
    display: inline-block;
    max-width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    line-height: 1.6;
    color: #303133;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .input-area {
    margin-top: 16px;
  }
  .input-actions {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hint {
    color: #909399;
    font-size: 12px;
  }
  .quick-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .quick-item {
    justify-content: flex-start;
    white-space: normal;
    height: auto;
    line-height: 1.5;
    padding: 12px 14px;
    border: 1px solid #ebeef5;
    border-radius: 10px;
    background: #fafbfc;
    color: #4b5563;
    transition: all 0.2s ease;
    &:hover {
      border-color: #c6e2ff;
      background: #ecf5ff;
      color: #409eff;
      transform: translateX(2px);
    }
  }
}
</style>
