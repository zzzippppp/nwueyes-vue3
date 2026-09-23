import {
  getActiveLiveRecognize,
  getLiveRecognizeStatus,
  startLiveRecognize,
  stopLiveRecognize
} from '@/api/monitor/screen'

const STORAGE_KEY = 'nwueyes_live_recognize'

const ACTIVE_STATUSES = ['running', 'starting', 'reconnecting']

function keyOf(cameraId) {
  return cameraId == null ? '' : String(cameraId)
}

function loadStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    // 仅接受新版 map 结构；旧版单任务结构直接丢弃（下次 sync 会重建）
    return parsed && typeof parsed === 'object' && parsed.tasks ? parsed.tasks : {}
  } catch {
    return {}
  }
}

function saveStorage(tasks) {
  try {
    const entries = Object.entries(tasks || {}).filter(([, v]) => v && (v.taskId || v.cameraId))
    if (entries.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: Object.fromEntries(entries) }))
  } catch {
    // ignore
  }
}

/**
 * 多摄像头并行直播识别状态：每台摄像头一个独立条目，互不影响。
 * tasks: { [cameraId]: { cameraId, taskId, status, message, deviceSerial, streamMode, logTail } }
 */
const useLiveRecognizeStore = defineStore('liveRecognize', {
  state: () => ({
    tasks: loadStorage(),
    starting: {},
    stopping: {},
    pollTimer: null,
    activeProbeTimer: null,
    bootstrapped: false
  }),
  actions: {
    entry(cameraId) {
      return this.tasks[keyOf(cameraId)] || null
    },
    statusOf(cameraId) {
      return this.entry(cameraId)?.status || 'idle'
    },
    taskIdOf(cameraId) {
      return this.entry(cameraId)?.taskId || ''
    },
    messageOf(cameraId) {
      return this.entry(cameraId)?.message || ''
    },
    logTailOf(cameraId) {
      return this.entry(cameraId)?.logTail || ''
    },
    isCameraStarting(cameraId) {
      return !!this.starting[keyOf(cameraId)]
    },
    isCameraStopping(cameraId) {
      return !!this.stopping[keyOf(cameraId)]
    },
    // 序列号兜底：仅在 cameraId 缺失时用序列号在已有条目里找
    resolveCameraId(cameraId, serial) {
      if (cameraId != null) {
        return cameraId
      }
      const s = String(serial || '').toUpperCase()
      if (!s) {
        return null
      }
      const hit = Object.values(this.tasks).find(
        t => String(t.deviceSerial || '').toUpperCase() === s
      )
      return hit ? hit.cameraId : null
    },
    isCameraRecognizing(cameraId, serial) {
      const id = this.resolveCameraId(cameraId, serial)
      if (id == null) {
        return false
      }
      if (this.isCameraStarting(id)) {
        return true
      }
      const entry = this.entry(id)
      return !!entry && ACTIVE_STATUSES.includes(entry.status)
    },
    isCameraActive(cameraId) {
      const entry = this.entry(cameraId)
      return !!entry && !!entry.taskId && ACTIVE_STATUSES.includes(entry.status)
    },
    isCameraFailed(cameraId, serial) {
      const id = this.resolveCameraId(cameraId, serial)
      if (id == null) {
        return false
      }
      return this.statusOf(id) === 'failed'
    },
    hasAnyActive() {
      return Object.values(this.tasks).some(t => ACTIVE_STATUSES.includes(t.status))
    },

    persist() {
      saveStorage(this.tasks)
    },

    // 用服务端任务对象刷新某摄像头条目
    applyTask(task, fallbackCameraId) {
      if (!task) {
        return
      }
      const cameraId = task.cameraId != null ? task.cameraId : fallbackCameraId
      if (cameraId == null) {
        return
      }
      const key = keyOf(cameraId)
      if (task.status === 'not_found') {
        // 任务过期：清掉该摄像头条目
        delete this.tasks[key]
        this.persist()
        return
      }
      const prev = this.tasks[key] || {}
      this.tasks[key] = {
        cameraId,
        taskId: task.taskId || prev.taskId || '',
        status: task.status || prev.status || 'idle',
        message: task.message != null ? task.message : prev.message || '',
        deviceSerial: task.deviceSerial || prev.deviceSerial || '',
        streamMode: task.streamMode || prev.streamMode || 'lan_rtsp',
        logTail: task.logTail != null ? task.logTail : prev.logTail || ''
      }
      this.persist()
    },

    // 用 /live/active 返回的活跃任务列表整体对账
    applyActiveList(list) {
      const active = Array.isArray(list) ? list : []
      const activeIds = new Set()
      active.forEach(task => {
        if (task && task.cameraId != null) {
          activeIds.add(keyOf(task.cameraId))
          this.applyTask(task)
        }
      })
      // 之前处于活跃态、但本次不在活跃列表里的摄像头：置为 idle（除非仍在启动中或已是失败/停止终态）
      Object.keys(this.tasks).forEach(key => {
        if (activeIds.has(key) || this.starting[key]) {
          return
        }
        const entry = this.tasks[key]
        if (entry && ACTIVE_STATUSES.includes(entry.status)) {
          // 交给按 taskId 的精确查询判定终态，这里先不武断清空
        }
      })
    },

    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    startPoll() {
      if (this.pollTimer) {
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
      this.activeProbeTimer = setInterval(() => {
        this.syncFromServer()
      }, 5000)
    },

    // 每 3s：先对账活跃列表，再对「有 taskId 但已不在活跃列表」的摄像头精确查终态
    async pollOnce() {
      await this.syncFromServer()
      const active = this.hasAnyActive()
      const pending = Object.values(this.tasks).filter(
        t => t.taskId && t.taskId !== 'pending_resume' && !t.taskId.startsWith('pending_resume')
      )
      for (const entry of pending) {
        if (ACTIVE_STATUSES.includes(entry.status)) {
          continue
        }
        // 已是终态则跳过
        if (['failed', 'stopped', 'success'].includes(entry.status)) {
          continue
        }
      }
      if (!active) {
        this.stopPoll()
      }
    },

    async syncFromServer() {
      try {
        const res = await getActiveLiveRecognize()
        this.applyActiveList(res.data)
        // 对不在活跃列表、仍显示为活跃的摄像头，逐个按 taskId 查终态
        const activeIds = new Set(
          (Array.isArray(res.data) ? res.data : [])
            .filter(t => t && t.cameraId != null)
            .map(t => keyOf(t.cameraId))
        )
        const toProbe = Object.entries(this.tasks).filter(
          ([key, t]) =>
            !activeIds.has(key) &&
            !this.starting[key] &&
            t.taskId &&
            !String(t.taskId).startsWith('pending_resume') &&
            ACTIVE_STATUSES.includes(t.status)
        )
        for (const [key, t] of toProbe) {
          try {
            const detail = await getLiveRecognizeStatus(t.taskId)
            if (detail.data?.status === 'not_found') {
              delete this.tasks[key]
              this.persist()
            } else {
              this.applyTask(detail.data, t.cameraId)
            }
          } catch {
            // ignore
          }
        }
        return true
      } catch {
        return false
      }
    },

    async bootstrap() {
      if (this.bootstrapped) {
        this.startActiveProbe()
        if (this.hasAnyActive()) {
          this.startPoll()
        }
        return
      }
      this.bootstrapped = true
      await this.syncFromServer()
      this.startActiveProbe()
      if (this.hasAnyActive()) {
        this.startPoll()
      }
    },

    async startRecognize(payload) {
      const cameraId = payload?.cameraId
      const key = keyOf(cameraId)
      this.starting[key] = true
      // 乐观写入，列表能立即显示「启动中」
      if (cameraId != null) {
        const prev = this.tasks[key] || {}
        this.tasks[key] = {
          cameraId,
          taskId: prev.taskId || '',
          status: 'starting',
          message: '',
          deviceSerial: payload?.deviceSerial || prev.deviceSerial || '',
          streamMode: 'lan_rtsp',
          logTail: prev.logTail || ''
        }
        this.persist()
      }
      try {
        const response = await startLiveRecognize({ ...payload, streamMode: 'lan_rtsp' })
        this.applyTask(response.data, cameraId)
        this.startPoll()
        return response.data
      } finally {
        this.starting[key] = false
      }
    },

    async stopRecognize(cameraId, serial) {
      const id = this.resolveCameraId(cameraId, serial)
      const taskId = this.taskIdOf(id) || (id != null ? `pending_resume_${id}` : '')
      if (!taskId) {
        return null
      }
      const key = keyOf(id)
      this.stopping[key] = true
      try {
        const response = await stopLiveRecognize(taskId)
        // 停止后清掉该摄像头条目
        delete this.tasks[key]
        this.persist()
        return response.data
      } finally {
        this.stopping[key] = false
      }
    },

    // 兼容 drawer 里手动置失败态
    markFailed(cameraId, message) {
      const key = keyOf(cameraId)
      const prev = this.tasks[key] || { cameraId }
      this.tasks[key] = { ...prev, cameraId, status: 'failed', message: message || prev.message || '' }
      this.persist()
    }
  }
})

export default useLiveRecognizeStore
