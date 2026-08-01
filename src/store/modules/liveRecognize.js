import {
  getActiveLiveRecognize,
  getLiveRecognizeStatus,
  startLiveRecognize,
  stopLiveRecognize
} from '@/api/monitor/screen'

const STORAGE_KEY = 'nwueyes_live_recognize'

function loadStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStorage(payload) {
  try {
    if (!payload) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    // 允许启动瞬间尚无 taskId，但仍保留 cameraId/status
    if (!payload.taskId && !payload.cameraId) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

const useLiveRecognizeStore = defineStore('liveRecognize', {
  state: () => {
    const saved = loadStorage()
    return {
      taskId: saved?.taskId || '',
      status: saved?.status || 'idle',
      message: saved?.message || '',
      deviceSerial: saved?.deviceSerial || '',
      cameraId: saved?.cameraId || null,
      streamMode: saved?.streamMode || 'lan_rtsp',
      starting: false,
      stopping: false,
      pollTimer: null,
      activeProbeTimer: null,
      bootstrapped: false,
      logTail: ''
    }
  },
  getters: {
    running(state) {
      return state.status === 'running' || state.status === 'starting' || state.status === 'reconnecting'
    },
    active(state) {
      return !!state.taskId && (state.status === 'running' || state.status === 'starting' || state.status === 'reconnecting')
    }
  },
  actions: {
    persist() {
      // 有任务，或启动中已确定摄像头：都写入，保证列表能匹配识别状态
      if (this.taskId || (this.cameraId != null && (this.status === 'starting' || this.status === 'reconnecting' || this.starting))) {
        saveStorage({
          taskId: this.taskId || '',
          status: this.status,
          message: this.message,
          deviceSerial: this.deviceSerial,
          cameraId: this.cameraId,
          streamMode: this.streamMode
        })
        return
      }
      saveStorage(null)
    },

    applyTask(task) {
      if (!task) {
        return
      }
      if (task.status === 'not_found') {
        // 不立刻清空：留给 poll/sync 再查一次 /live/active（后端可能已自动换新 task）
        this.message = task.message || '任务不存在或已过期'
        return
      }
      if (task.taskId) {
        this.taskId = task.taskId
      }
      if (task.status) {
        this.status = task.status
      }
      this.message = task.message || ''
      if (task.logTail) {
        this.logTail = task.logTail
      }
      if (task.deviceSerial) {
        this.deviceSerial = task.deviceSerial
      }
      if (task.cameraId) {
        this.cameraId = task.cameraId
      }
      if (task.streamMode) {
        this.streamMode = task.streamMode
      }
      if (['failed', 'stopped', 'success'].includes(this.status)) {
        this.stopPoll()
      } else if (this.running) {
        this.startPoll()
      }
      this.persist()
    },

    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },

    startPoll() {
      if (this.pollTimer || !this.taskId) {
        return
      }
      this.pollTimer = setInterval(() => {
        this.pollOnce()
      }, 3000)
    },

    startActiveProbe() {
      if (this.activeProbeTimer) {
        return
      }
      // 后端开机续跑/自动重启后，页面即使当时是「未启动」也能跟上
      this.activeProbeTimer = setInterval(() => {
        this.syncFromServer()
      }, 5000)
    },

    async pollOnce() {
      if (!this.taskId) {
        this.stopPoll()
        await this.syncFromServer()
        return
      }
      try {
        if (this.taskId === 'pending_resume') {
          await this.syncFromServer()
          return
        }
        const response = await getLiveRecognizeStatus(this.taskId)
        if (response.data?.status === 'not_found') {
          const active = await getActiveLiveRecognize()
          if (active.data?.taskId) {
            this.applyTask(active.data)
            return
          }
          this.taskId = ''
          this.status = 'idle'
          this.message = response.data?.message || '任务不存在或已过期'
          this.stopPoll()
          this.persist()
          return
        }
        this.applyTask(response.data)
        // 自动重启会换新 taskId：旧任务停在 reconnecting 时改跟 active
        if (this.status === 'reconnecting') {
          try {
            const active = await getActiveLiveRecognize()
            if (active.data?.taskId && active.data.taskId !== this.taskId) {
              this.applyTask(active.data)
            }
          } catch {
            // ignore
          }
        }
      } catch (error) {
        const msg = error?.response?.data?.msg || error?.message || '状态查询失败'
        this.message = msg
        if (/任务不存在|not_found/i.test(msg)) {
          try {
            const active = await getActiveLiveRecognize()
            if (active.data?.taskId) {
              this.applyTask(active.data)
              return
            }
          } catch {
            // ignore
          }
          this.taskId = ''
          this.status = 'idle'
          this.stopPoll()
          this.persist()
        }
      }
    },

    async syncFromServer() {
      try {
        const active = await getActiveLiveRecognize()
        if (active.data?.taskId) {
          this.applyTask(active.data)
          return true
        }
      } catch {
        // ignore
      }
      if (this.taskId && this.taskId !== 'pending_resume') {
        try {
          const response = await getLiveRecognizeStatus(this.taskId)
          if (response.data?.status === 'not_found') {
            this.taskId = ''
            this.status = 'idle'
            this.message = response.data?.message || ''
            this.stopPoll()
            this.persist()
            return false
          }
          this.applyTask(response.data)
          return this.active
        } catch {
          // keep local session until explicit stop or not_found
        }
      } else if (!this.active && this.status !== 'idle' && this.status !== 'stopped' && this.status !== 'failed') {
        // 服务端已无活跃任务
        this.taskId = ''
        this.status = 'idle'
        this.stopPoll()
        this.persist()
      }
      return false
    },

    async bootstrap() {
      if (this.bootstrapped) {
        this.startActiveProbe()
        if (this.active) {
          this.startPoll()
        }
        return
      }
      this.bootstrapped = true
      await this.syncFromServer()
      this.startActiveProbe()
      if (this.active) {
        this.startPoll()
      }
    },

    async startRecognize(payload) {
      this.starting = true
      this.message = ''
      // 先写入请求参数，避免接口未回传 cameraId 时列表一直显示「未启动」
      if (payload?.cameraId != null) {
        this.cameraId = payload.cameraId
      }
      if (payload?.deviceSerial) {
        this.deviceSerial = payload.deviceSerial
      }
      this.status = 'starting'
      this.persist()
      try {
        const response = await startLiveRecognize({
          ...payload,
          streamMode: 'lan_rtsp'
        })
        this.applyTask(response.data)
        if (payload?.cameraId != null && !this.cameraId) {
          this.cameraId = payload.cameraId
        }
        if (this.taskId) {
          this.startPoll()
        }
        this.persist()
        return response.data
      } finally {
        this.starting = false
      }
    },

    async stopRecognize() {
      if (!this.taskId) {
        return null
      }
      this.stopping = true
      try {
        const response = await stopLiveRecognize(this.taskId)
        this.applyTask(response.data)
        this.stopPoll()
        return response.data
      } finally {
        this.stopping = false
      }
    }
  }
})

export default useLiveRecognizeStore
