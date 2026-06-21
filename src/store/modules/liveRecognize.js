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
    if (!payload?.taskId) {
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
      streamMode: saved?.streamMode || 'cloud_hls',
      starting: false,
      stopping: false,
      pollTimer: null,
      bootstrapped: false,
      logTail: ''
    }
  },
  getters: {
    running(state) {
      return state.status === 'running' || state.status === 'starting'
    },
    active(state) {
      return !!state.taskId && (state.status === 'running' || state.status === 'starting')
    }
  },
  actions: {
    persist() {
      if (this.active) {
        saveStorage({
          taskId: this.taskId,
          status: this.status,
          message: this.message,
          deviceSerial: this.deviceSerial,
          streamMode: this.streamMode
        })
      } else {
        saveStorage(null)
      }
    },

    applyTask(task) {
      if (!task) {
        return
      }
      if (task.status === 'not_found') {
        this.taskId = ''
        this.status = 'idle'
        this.message = task.message || '任务不存在或已过期'
        this.stopPoll()
        this.persist()
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

    async pollOnce() {
      if (!this.taskId) {
        this.stopPoll()
        return
      }
      try {
        const response = await getLiveRecognizeStatus(this.taskId)
        this.applyTask(response.data)
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
          return
        }
      } catch {
        // ignore
      }
      if (this.taskId) {
        try {
          const response = await getLiveRecognizeStatus(this.taskId)
          this.applyTask(response.data)
        } catch {
          // keep local session until explicit stop or not_found
        }
      }
    },

    async bootstrap() {
      if (this.bootstrapped) {
        if (this.active) {
          this.startPoll()
        }
        return
      }
      this.bootstrapped = true
      await this.syncFromServer()
      if (this.active) {
        this.startPoll()
      }
    },

    async startRecognize(payload) {
      this.starting = true
      this.message = ''
      try {
        const response = await startLiveRecognize(payload)
        this.applyTask(response.data)
        if (this.taskId) {
          this.startPoll()
        }
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
