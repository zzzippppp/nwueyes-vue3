<template>
  <div class="app-container board-page video-test-page">
    <el-card shadow="never" class="upload-card">
      <template #header>
        <div class="card-header">
          <span>视频上传测试</span>
          <el-tag size="small" type="info">YOLO + ByteTrack</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="door-config-alert"
        :title="doorConfigTitle"
      />

      <el-upload
        class="video-uploader"
        drag
        :show-file-list="false"
        :auto-upload="false"
        :on-change="handleFileChange"
        :before-upload="beforeUpload"
        accept=".mp4,.mov,.avi,.mkv,.flv,.webm"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽视频到这里，或 <em>点击选择</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            仅支持视频文件，单文件不超过 30MB。上传后点击「运行 YOLO 检测」查看结果（不入库）。
          </div>
        </template>
      </el-upload>

      <div class="upload-actions">
        <el-button type="primary" :disabled="!selectedFile || uploading" :loading="uploading" @click="submitUpload">
          上传视频
        </el-button>
        <el-button :disabled="!selectedFile || uploading" @click="clearSelection">清空</el-button>
        <el-button
          type="success"
          :disabled="analyzeStarting || analyzeRunning"
          :loading="analyzeStarting"
          @click="startAnalyze"
        >
          运行 YOLO 检测
        </el-button>
      </div>

      <el-descriptions v-if="selectedFile" :column="1" border size="small" class="file-meta">
        <el-descriptions-item label="已选择文件">{{ selectedFile.name }}</el-descriptions-item>
        <el-descriptions-item label="大小">{{ formatBytes(selectedFile.size) }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ selectedFile.type || '未知' }}</el-descriptions-item>
      </el-descriptions>

      <el-form label-width="130px" class="manual-file-form">
        <el-form-item label="上传状态">
          <el-tag :type="lastUpload.fileName ? 'success' : 'info'">
            {{ lastUpload.fileName ? '已上传到服务器' : '仅本地已选择，未上传' }}
          </el-tag>
        </el-form-item>
        <el-form-item label="上传文件 fileName">
          <el-input
            v-model.trim="manualUploadedFileName"
            placeholder="可粘贴 /profile/upload/...mp4"
          />
        </el-form-item>
      </el-form>

      <el-progress v-if="uploading" :percentage="uploadProgress" :stroke-width="12" />
    </el-card>

    <el-card shadow="never" class="result-card">
      <template #header>
        <div class="card-header">
          <span>测试结果（YOLO + ByteTrack）</span>
          <el-tag size="small" :type="statusTagType">{{ statusText }}</el-tag>
        </div>
      </template>

      <el-alert
        v-if="analyzeRunning"
        type="warning"
        :closable="false"
        show-icon
        title="正在分析视频，请稍候…（时长取决于视频帧数）"
      />

      <template v-if="analyzeResult">
        <el-row :gutter="12" class="stat-row">
          <el-col :xs="12" :sm="8" :md="4">
            <div class="stat-box">
              <div class="stat-label">算法</div>
              <div class="stat-value small">{{ analyzeResult.algorithm }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="stat-box">
              <div class="stat-label">总帧数</div>
              <div class="stat-value">{{ analyzeResult.totalFrames }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="stat-box">
              <div class="stat-label">轨迹数</div>
              <div class="stat-value">{{ analyzeResult.uniqueTracks }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="stat-box">
              <div class="stat-label">进门事件</div>
              <div class="stat-value enter">{{ analyzeResult.enterCount }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="stat-box">
              <div class="stat-label">出门事件</div>
              <div class="stat-value exit">{{ analyzeResult.exitCount }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="stat-box">
              <div class="stat-label">ROI 内峰值人数</div>
              <div class="stat-value">{{ analyzeResult.maxPersonsInRoi }}</div>
            </div>
          </el-col>
        </el-row>

        <el-descriptions :column="2" border size="small" class="meta-desc">
          <el-descriptions-item label="模型">{{ analyzeResult.model }}</el-descriptions-item>
          <el-descriptions-item label="分辨率">{{ analyzeResult.width }} × {{ analyzeResult.height }}</el-descriptions-item>
          <el-descriptions-item label="帧率">{{ analyzeResult.fps }} fps</el-descriptions-item>
          <el-descriptions-item label="过线 Y">{{ analyzeResult.lineY }}</el-descriptions-item>
          <el-descriptions-item label="ROI" :span="2">{{ analyzeResult.roi }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="debugVideoUrl" class="preview-wrap">
          <div class="section-title">标注调试视频（检测框 + 轨迹 ID + 过线事件）</div>
          <video class="preview-video" controls :src="debugVideoUrl" />
        </div>

        <div class="section-title">过线事件</div>
        <div v-if="analyzeResult" class="import-actions">
          <el-button
            type="warning"
            :disabled="!canImportBehaviorLogs || importingBehaviorLogs"
            :loading="importingBehaviorLogs"
            @click="importBehaviorLogs"
          >
            写入行为日志
          </el-button>
          <span class="import-tip">
            与直播一致：每次过线单独抓拍择优帧；下方展示监控画面与库内匹配结果，确认后可写入行为日志
          </span>
          <el-alert
            v-if="!hasCaptureSnapshots"
            type="warning"
            :closable="false"
            show-icon
            class="capture-warn"
            title="当前分析结果无抓拍数据，写入后行为日志将缺少监控画面。请重新运行 YOLO 检测后再写入。"
          />
        </div>
        <el-table :data="displayEvents" v-loading="matchingEvents" class="board-table" max-height="360" empty-text="未检测到过线事件">
          <el-table-column prop="frame" label="帧" width="70" />
          <el-table-column prop="timeSec" label="时间(秒)" width="90" />
          <el-table-column prop="trackId" label="轨迹 ID" width="80" />
          <el-table-column prop="eventType" label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.eventType === 'enter' ? 'success' : 'warning'" size="small">
                {{ row.eventType === 'enter' ? '进门' : '出门' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="匹配人员" min-width="130">
            <template #default="{ row }">
              <span>{{ row.displayName || defaultEventName(row) }}</span>
              <el-tag v-if="row.matched" size="small" type="success" class="match-tag">已匹配</el-tag>
              <el-tag v-else size="small" type="info" class="match-tag">未匹配</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="匹配分" width="100">
            <template #default="{ row }">
              <span v-if="row.eventType === 'enter'">{{ formatScore(row.faceMatchScore) }}</span>
              <span v-else>{{ formatScore(row.bodyMatchScore) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="监控画面" width="148">
            <template #default="{ row }">
              <el-image
                v-if="row.snapshotUrl"
                :src="resolveMediaUrl(row.snapshotUrl)"
                fit="cover"
                class="snapshot-thumb"
                :preview-src-list="[resolveMediaUrl(row.snapshotUrl)]"
                preview-teleported
              />
              <span v-else class="muted">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="qualityFlag" label="质量" width="80" />
          <el-table-column prop="confidence" label="置信度" width="80" />
          <el-table-column prop="inferred" label="补推断" width="70">
            <template #default="{ row }">
              <el-tag v-if="row.inferred" size="small" type="info">是</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="matchSummary" class="match-summary">{{ matchSummary }}</div>

        <div class="section-title">最佳抓拍与向量（512 维）</div>
        <div v-if="analyzeResult" class="embed-actions">
          <el-button
            type="primary"
            :disabled="!hasCaptureSnapshots || embeddingCaptures"
            :loading="embeddingCaptures"
            @click="loadCaptureEmbeddings"
          >
            {{ captureEmbedTracks.length ? '重新计算向量' : '计算抓拍向量' }}
          </el-button>
          <span v-if="embedSummary" class="embed-summary">{{ embedSummary }}</span>
        </div>
        <el-empty
          v-if="!captureEmbedTracks.length && !embeddingCaptures && hasCaptureSnapshots"
          description="分析已完成，点击「计算抓拍向量」查看人脸/体态图及 512 维向量"
        />
        <div v-for="track in captureEmbedTracks" :key="track.trackKey || track.trackId" class="embed-track-card">
          <div class="embed-track-head">
            <span>轨迹 {{ track.trackId }} · {{ track.trackKey }}</span>
            <span class="embed-meta">采样 {{ track.sampledFrames }} 帧 · 人脸分 {{ formatScore(track.faceScore) }} · 人体分 {{ formatScore(track.bodyScore) }}</span>
          </div>
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <div class="embed-panel">
                <div class="embed-panel-title">人脸</div>
                <el-image
                  v-if="track.faceImageUrl"
                  :src="resolveMediaUrl(track.faceImageUrl)"
                  :preview-src-list="[resolveMediaUrl(track.faceImageUrl)]"
                  preview-teleported
                  fit="contain"
                  class="embed-thumb"
                />
                <div v-else class="embed-missing">无人脸图</div>
                <div v-if="track.faceEmbedding" class="embed-vector-block">
                  <el-tag :type="track.faceEmbedding.ok ? 'success' : 'danger'" size="small">
                    {{ track.faceEmbedding.ok ? '向量 OK' : '向量失败' }}
                  </el-tag>
                  <span v-if="track.faceEmbedding.model" class="embed-model">{{ track.faceEmbedding.model }}</span>
                  <div v-if="track.faceEmbedding.error" class="embed-error">{{ track.faceEmbedding.error }}</div>
                  <div v-if="track.faceEmbedding.embedding?.length" class="embed-preview">
                    dim={{ track.faceEmbedding.dim }} · 前 8 维: {{ formatVectorPreview(track.faceEmbedding.embedding, 8) }}
                  </div>
                  <el-collapse v-if="track.faceEmbedding.embedding?.length" class="embed-collapse">
                    <el-collapse-item title="查看完整人脸向量 JSON" :name="`face-${track.trackId}`">
                      <el-input
                        :model-value="formatVectorJson(track.faceEmbedding.embedding)"
                        type="textarea"
                        :rows="6"
                        readonly
                      />
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :md="12">
              <div class="embed-panel">
                <div class="embed-panel-title">人体</div>
                <el-image
                  v-if="track.bodyImageUrl"
                  :src="resolveMediaUrl(track.bodyImageUrl)"
                  :preview-src-list="[resolveMediaUrl(track.bodyImageUrl)]"
                  preview-teleported
                  fit="contain"
                  class="embed-thumb"
                />
                <div v-else class="embed-missing">无人体图</div>
                <div v-if="track.bodyEmbedding" class="embed-vector-block">
                  <el-tag :type="track.bodyEmbedding.ok ? 'success' : 'danger'" size="small">
                    {{ track.bodyEmbedding.ok ? '向量 OK' : '向量失败' }}
                  </el-tag>
                  <span v-if="track.bodyEmbedding.model" class="embed-model">{{ track.bodyEmbedding.model }}</span>
                  <div v-if="track.bodyEmbedding.error" class="embed-error">{{ track.bodyEmbedding.error }}</div>
                  <div v-if="track.bodyEmbedding.embedding?.length" class="embed-preview">
                    dim={{ track.bodyEmbedding.dim }} · 前 8 维: {{ formatVectorPreview(track.bodyEmbedding.embedding, 8) }}
                  </div>
                  <el-collapse v-if="track.bodyEmbedding.embedding?.length" class="embed-collapse">
                    <el-collapse-item title="查看完整体态向量 JSON" :name="`body-${track.trackId}`">
                      <el-input
                        :model-value="formatVectorJson(track.bodyEmbedding.embedding)"
                        type="textarea"
                        :rows="6"
                        readonly
                      />
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <div class="section-title">轨迹统计</div>
              <el-table :data="analyzeResult.tracks || []" class="board-table" max-height="280" empty-text="无轨迹">
          <el-table-column prop="trackId" label="轨迹 ID" width="90" />
          <el-table-column prop="firstFrame" label="首帧" width="80" />
          <el-table-column prop="lastFrame" label="末帧" width="80" />
          <el-table-column prop="firstTimeSec" label="起始(秒)" width="100" />
          <el-table-column prop="lastTimeSec" label="结束(秒)" width="100" />
          <el-table-column prop="hitFrames" label="命中帧数" width="100" />
          <el-table-column prop="avgConfidence" label="平均置信度" />
        </el-table>
      </template>

      <el-empty
        v-else-if="!analyzeRunning"
        description="上传视频后点击「运行 YOLO 检测」，结果将展示在此（检测视频、过线事件、轨迹统计）。"
      />

      <el-collapse v-if="analyzeTask.logTail" class="log-collapse">
        <el-collapse-item title="运行日志" name="log">
          <el-input :model-value="analyzeTask.logTail" type="textarea" :rows="8" readonly />
        </el-collapse-item>
      </el-collapse>

      <div v-if="lastUpload.url && !analyzeResult" class="preview-wrap source-preview">
        <div class="section-title">原始上传视频</div>
        <video class="preview-video" controls :src="lastUpload.url" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { getPresenceDoorConfig, getVideoAnalyzeStatus, startVideoAnalyzeTest, uploadVideoTestFile, embedAnalyzeCaptures, matchAnalyzeEvents } from '@/api/dashboard/video_test'
import { importBehaviorLogsFromVideo } from '@/api/dashboard/behavior_log'

const apiBase = import.meta.env.VITE_APP_BASE_API || ''
const MAX_VIDEO_SIZE_MB = 30
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

const selectedFile = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const manualUploadedFileName = ref('')
const analyzeStarting = ref(false)
const analyzeRunning = ref(false)
const analyzeTaskId = ref('')
const analyzeTask = ref({
  status: '',
  startedAt: '',
  finishedAt: '',
  message: '',
  logTail: '',
  exitCode: null,
  resultJson: ''
})
const analyzeResult = ref(null)
const importingBehaviorLogs = ref(false)
const embeddingCaptures = ref(false)
const matchingEvents = ref(false)
const captureEmbedTracks = ref([])
const embedSummary = ref('')
const eventMatchRows = ref([])
const matchSummary = ref('')
const doorConfig = ref({
  lineY: null,
  roi: '',
  yoloConf: null,
  snapshotWindowSec: null
})
let timer = null

const lastUpload = ref({
  url: '',
  fileName: '',
  newFileName: '',
  originalFilename: ''
})

const effectiveUploadedFileName = computed(() => {
  return lastUpload.value.fileName || manualUploadedFileName.value
})

const doorConfigTitle = computed(() => {
  const c = doorConfig.value
  if (c.lineY == null || !c.roi) {
    return '门区标定：加载中…（与直播识别共用 application-local.yml）'
  }
  const conf = c.yoloConf != null ? ` · conf=${c.yoloConf}` : ''
  const win = c.snapshotWindowSec != null ? ` · 抓拍窗=${c.snapshotWindowSec}s` : ''
  return `门区标定（与直播一致）：lineY=${c.lineY} · ROI=${c.roi}${conf}${win}`
})

async function loadDoorConfig() {
  try {
    const res = await getPresenceDoorConfig()
    const data = res?.data ?? res ?? {}
    doorConfig.value = {
      lineY: data.lineY ?? null,
      roi: data.roi || '',
      yoloConf: data.yoloConf ?? null,
      snapshotWindowSec: data.snapshotWindowSec ?? null
    }
  } catch (e) {
    ElMessage.warning('门区配置加载失败，将使用后端默认值')
  }
}

onMounted(() => {
  loadDoorConfig()
})

const debugVideoUrl = computed(() => {
  const url = analyzeResult.value?.debugVideoUrl
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  if (apiBase && url.startsWith(apiBase)) return url
  return apiBase ? apiBase + url : url
})

const hasCaptureSnapshots = computed(() => {
  if ((analyzeResult.value?.captureTracks?.length || 0) > 0) {
    return true
  }
  const events = analyzeResult.value?.events || []
  return events.some(ev => ev.snapshotUrl || ev.faceImageUrl || ev.bodyImageUrl)
})

const displayEvents = computed(() => {
  const events = analyzeResult.value?.events || []
  if (!eventMatchRows.value.length) {
    return events.map(ev => ({
      ...ev,
      displayName: ev.displayName || defaultEventName(ev)
    }))
  }
  const map = new Map()
  eventMatchRows.value.forEach(row => {
    map.set(`${row.frame}-${row.trackId}-${row.eventType}`, row)
  })
  return events.map(ev => {
    const key = `${ev.frame}-${ev.trackId}-${ev.eventType}`
    const matched = map.get(key)
    if (matched) {
      return { ...ev, ...matched }
    }
    return { ...ev, displayName: ev.displayName || defaultEventName(ev) }
  })
})

function defaultEventName(row) {
  const key = row.trackKey || `yolo_${row.trackId}`
  return `未登记-${key}`
}

const canImportBehaviorLogs = computed(() => {
  return !!analyzeTaskId.value
    && analyzeTask.value.status === 'success'
    && (analyzeResult.value?.events?.length || 0) > 0
})

function resolveMediaUrl(rawUrl) {
  if (!rawUrl) return ''
  if (/^(https?:|data:|blob:)/i.test(rawUrl)) return rawUrl
  let path = rawUrl
  if (path.startsWith('/face-library/')) {
    path = `/dashboard/data-board/file/face/${path.split('/').pop()}`
  } else if (path.startsWith('/body-library/')) {
    path = `/dashboard/data-board/file/body/${path.split('/').pop()}`
  }
  if (apiBase && path.startsWith(apiBase)) return path
  return apiBase ? apiBase + path : path
}

function formatScore(score) {
  if (score === null || score === undefined || score === '') return '—'
  return Number(score).toFixed(3)
}

function formatVectorPreview(vec, count = 8) {
  if (!Array.isArray(vec) || !vec.length) return '—'
  return vec.slice(0, count).map(v => Number(v).toFixed(4)).join(', ')
}

function formatVectorJson(vec) {
  return JSON.stringify(vec || [], null, 2)
}

async function loadEventMatches() {
  if (!analyzeTaskId.value || !(analyzeResult.value?.events?.length)) {
    return
  }
  if (!hasCaptureSnapshots.value) {
    return
  }
  matchingEvents.value = true
  matchSummary.value = ''
  try {
    const res = await matchAnalyzeEvents(analyzeTaskId.value)
    const data = res?.data || res || {}
    eventMatchRows.value = data.events || []
    matchSummary.value = `共 ${data.eventCount || 0} 条过线事件 · 库内匹配 ${data.matchedCount || 0} 条`
  } catch (e) {
    const msg = e?.response?.data?.msg || e?.message || '人员匹配失败'
    ElMessage.error(msg)
  } finally {
    matchingEvents.value = false
  }
}

async function loadCaptureEmbeddings() {
  if (!analyzeTaskId.value || !hasCaptureSnapshots.value) {
    ElMessage.warning('请先完成 YOLO 检测且存在抓拍数据')
    return
  }
  embeddingCaptures.value = true
  embedSummary.value = ''
  try {
    const res = await embedAnalyzeCaptures(analyzeTaskId.value)
    const data = res?.data || res || {}
    captureEmbedTracks.value = data.tracks || []
    embedSummary.value = `轨迹 ${data.trackCount || 0} 条 · 人脸向量 ${data.faceOkCount || 0} · 体态向量 ${data.bodyOkCount || 0}`
    if (!captureEmbedTracks.value.length) {
      ElMessage.warning('未返回抓拍向量数据')
    } else {
      ElMessage.success('向量计算完成')
    }
  } catch (e) {
    const msg = e?.response?.data?.msg || e?.message || '向量计算失败'
    ElMessage.error(msg)
  } finally {
    embeddingCaptures.value = false
  }
}

/** 若依 AjaxResult：任务在 res.data；/common/upload 字段在顶层 */
function unwrapTask(res) {
  if (!res) return {}
  if (res.data && typeof res.data === 'object') {
    return res.data
  }
  return res
}

const statusText = computed(() => {
  const status = analyzeTask.value.status
  if (!status) {
    return analyzeRunning.value ? '分析中' : '未运行'
  }
  if (status === 'pending') return '排队中'
  if (status === 'running') return '分析中'
  if (status === 'success') return '完成'
  if (status === 'failed') return `失败(${analyzeTask.value.exitCode ?? '--'})`
  return status
})

const statusTagType = computed(() => {
  const status = analyzeTask.value.status
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running' || status === 'pending' || analyzeRunning.value) return 'warning'
  return 'info'
})

function handleFileChange(file) {
  const raw = file.raw || null
  if (raw && !beforeUpload(raw)) {
    selectedFile.value = null
    return
  }
  selectedFile.value = raw
}

function clearSelection() {
  selectedFile.value = null
  uploadProgress.value = 0
}

function beforeUpload(file) {
  if (!file) return false
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|flv|webm)$/i.test(file.name)
  if (!isVideo) {
    ElMessage.error('仅支持上传视频文件')
    return false
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    ElMessage.error(`视频大小不能超过 ${MAX_VIDEO_SIZE_MB}MB`)
    return false
  }
  return true
}

async function submitUpload() {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择视频文件')
    return
  }
  if (!beforeUpload(selectedFile.value)) {
    return
  }
  uploading.value = true
  uploadProgress.value = 0
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  try {
    const res = await uploadVideoTestFile(formData, evt => {
      if (!evt?.total) return
      uploadProgress.value = Math.min(100, Math.round((evt.loaded / evt.total) * 100))
    })
    const data = res || {}
    lastUpload.value = {
      url: data.url || '',
      fileName: data.fileName || '',
      newFileName: data.newFileName || '',
      originalFilename: data.originalFilename || selectedFile.value.name
    }
    ElMessage.success('视频上传成功')
  } finally {
    uploading.value = false
  }
}

function parseResultJson(raw) {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

async function importBehaviorLogs() {
  if (!canImportBehaviorLogs.value) {
    ElMessage.warning('请先完成 YOLO 检测且存在过线事件')
    return
  }
  if (!hasCaptureSnapshots.value) {
    ElMessage.warning('当前结果无抓拍数据，建议重新运行 YOLO 检测后再写入')
  }
  importingBehaviorLogs.value = true
  try {
    const res = await importBehaviorLogsFromVideo({
      taskId: analyzeTaskId.value,
      cameraId: 1
    })
    const data = res?.data || res || {}
    ElMessage.success(data.message || `已写入 ${data.insertedCount || 0} 条行为日志`)
  } catch (e) {
    const msg = e?.response?.data?.msg || e?.message || '写入行为日志失败'
    ElMessage.error(msg)
  } finally {
    importingBehaviorLogs.value = false
  }
}

async function startAnalyze() {
  if (!effectiveUploadedFileName.value && selectedFile.value) {
    ElMessage.info('正在先上传视频，再启动检测…')
    await submitUpload()
  }
  if (!effectiveUploadedFileName.value) {
    ElMessage.warning('请先上传视频，或填写 fileName')
    return
  }
  analyzeStarting.value = true
  analyzeResult.value = null
  captureEmbedTracks.value = []
  eventMatchRows.value = []
  embedSummary.value = ''
  matchSummary.value = ''
  try {
    const payload = {
      uploadedFileName: effectiveUploadedFileName.value
    }
    if (doorConfig.value.lineY != null) {
      payload.lineY = doorConfig.value.lineY
    }
    if (doorConfig.value.roi) {
      payload.roi = doorConfig.value.roi
    }
    const res = await startVideoAnalyzeTest(payload)
    const task = unwrapTask(res)
    analyzeTaskId.value = task.taskId || ''
    analyzeTask.value = { ...analyzeTask.value, ...task }
    analyzeRunning.value = true
    ElMessage.success('已启动 YOLO 检测')
    startPolling()
  } catch (e) {
    analyzeRunning.value = false
    const msg = e?.response?.data?.msg || e?.message || '启动检测失败'
    ElMessage.error(msg)
  } finally {
    analyzeStarting.value = false
  }
}

async function pollAnalyzeOnce() {
  const res = await getVideoAnalyzeStatus(analyzeTaskId.value)
  const task = unwrapTask(res)
  analyzeTask.value = { ...analyzeTask.value, ...task }
  if (task.status === 'success') {
    analyzeResult.value = parseResultJson(task.resultJson)
    analyzeRunning.value = false
    if (!analyzeResult.value) {
      ElMessage.warning('分析完成但结果为空，请查看运行日志')
    } else {
      ElMessage.success('YOLO 检测完成')
      if (hasCaptureSnapshots.value) {
        loadEventMatches()
      }
    }
    stopPolling()
    return true
  }
  if (task.status === 'failed') {
    analyzeRunning.value = false
    if (task.message) ElMessage.error(task.message)
    stopPolling()
    return true
  }
  return false
}

function startPolling() {
  stopPolling()
  if (!analyzeTaskId.value) {
    ElMessage.warning('未获取到任务 ID，无法查询进度')
    analyzeRunning.value = false
    return
  }
  const tick = async () => {
    try {
      await pollAnalyzeOnce()
    } catch (e) {
      analyzeRunning.value = false
      const msg = e?.response?.data?.msg || e?.message || '获取任务状态失败'
      ElMessage.error(msg)
      stopPolling()
    }
  }
  tick()
  timer = setInterval(tick, 2000)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onBeforeUnmount(() => {
  stopPolling()
})

function formatBytes(size) {
  if (!size && size !== 0) return '--'
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';

.video-test-page {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .upload-actions {
    margin-top: 12px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .file-meta,
  .manual-file-form {
    margin-top: 12px;
  }

  .stat-row {
    margin-bottom: 12px;
  }

  .stat-box {
    background: #f5f7fa;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 8px;
    min-height: 72px;

    .stat-label {
      font-size: 12px;
      color: #909399;
    }

    .stat-value {
      margin-top: 6px;
      font-size: 22px;
      font-weight: 600;
      color: #303133;

      &.small {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
      }

      &.enter {
        color: #67c23a;
      }

      &.exit {
        color: #e6a23c;
      }
    }
  }

  .meta-desc {
    margin-bottom: 14px;
  }

  .section-title {
    margin: 16px 0 8px;
    font-weight: 600;
    color: #303133;
  }

  .import-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .import-tip {
    color: #909399;
    font-size: 12px;
  }

  .match-tag {
    margin-left: 6px;
  }

  .match-summary {
    margin-top: 8px;
    font-size: 13px;
    color: #606266;
  }

  .snapshot-thumb {
    width: 128px;
    height: 72px;
    border-radius: 4px;
    background: #111827;
  }

  .muted {
    color: #9aa4b2;
  }

  .capture-warn {
    flex: 1 1 100%;
    margin: 0;
  }

  .embed-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .embed-summary {
    color: #606266;
    font-size: 13px;
  }

  .embed-track-card {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    background: #fafafa;
  }

  .embed-track-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    font-weight: 600;
    flex-wrap: wrap;
  }

  .embed-meta {
    font-size: 12px;
    font-weight: 400;
    color: #909399;
  }

  .embed-panel {
    background: #fff;
    border-radius: 6px;
    padding: 10px;
    min-height: 280px;
  }

  .embed-panel-title {
    font-weight: 600;
    margin-bottom: 8px;
  }

  .embed-thumb {
    width: 100%;
    max-width: 220px;
    height: 160px;
    border-radius: 4px;
    background: #f5f7fa;
  }

  .embed-missing {
    width: 100%;
    max-width: 220px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    color: #909399;
    border-radius: 4px;
  }

  .embed-vector-block {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .embed-model {
    font-size: 12px;
    color: #909399;
  }

  .embed-error {
    color: #f56c6c;
    font-size: 12px;
  }

  .embed-preview {
    font-size: 12px;
    color: #606266;
    word-break: break-all;
  }

  .embed-collapse {
    margin-top: 4px;
  }

  .preview-wrap {
    margin-top: 8px;

    &.source-preview {
      margin-top: 20px;
    }
  }

  .preview-video {
    width: 100%;
    max-height: 480px;
    border-radius: 6px;
    background: #000;
  }

  .log-collapse {
    margin-top: 16px;
  }
}
</style>
