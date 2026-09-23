<template>
  <div class="app-container person-detail-page" v-loading="pageLoading">
    <div class="detail-header">
      <div class="detail-header-left">
        <el-button icon="ArrowLeft" @click="goBack">返回</el-button>
        <span class="detail-title">人员详情</span>
      </div>
      <el-button type="primary" icon="Edit" @click="handleEdit" v-hasPermi="['system:person:edit']">修改</el-button>
    </div>

    <el-card v-if="person" class="info-card" shadow="never">
      <div class="info-layout">
        <div class="face-panel">
          <el-image
            v-if="primaryFaceUrl"
            :src="primaryFaceUrl"
            :preview-src-list="facePreviewList"
            preview-teleported
            fit="cover"
            class="face-image"
          />
          <div v-else class="face-placeholder">暂无人脸图</div>
        </div>
        <el-descriptions :column="3" border class="info-descriptions">
          <el-descriptions-item label="编号">{{ person.personId }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ person.displayName }}</el-descriptions-item>
          <el-descriptions-item label="学工号">{{ person.employeeNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="人员类型">
            <el-tag :disable-transitions="true">{{ formatPersonKindLabel(person.personType) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="性别">{{ genderLabel(person.gender) }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ person.phone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="档案状态">
            <dict-tag :options="sys_normal_disable" :value="person.status" />
          </el-descriptions-item>
          <el-descriptions-item label="出勤状态">
            <el-tag :type="attendanceStatusTagType(currentAttendanceStatus)" size="small">
              {{ formatAttendanceStatus(currentAttendanceStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="当前地点">{{ attendance?.deviceName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="今日到达">{{ formatDateTime(attendance?.firstEnterAt) }}</el-descriptions-item>
          <el-descriptions-item label="今日离开">{{ formatDateTime(attendance?.lastExitAt) }}</el-descriptions-item>
          <el-descriptions-item label="停留时长">
            {{ currentAttendanceStatus === 'absent' ? '—' : formatDuration(attendance?.totalDwellSeconds) }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ parseTime(person.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ parseTime(person.updatedAt) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="3">{{ person.note || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <el-card class="log-card" shadow="never">
      <template #header>
        <div class="log-card-header">
          <span>考勤日志</span>
          <el-button icon="Refresh" :loading="logLoading" @click="loadBehaviorLogs">刷新</el-button>
        </div>
      </template>

      <el-table v-loading="logLoading" :data="pagedLogs" class="log-table">
        <el-table-column prop="id" label="ID" width="74" />
        <el-table-column prop="eventType" label="行为" width="86">
          <template #default="{ row }">
            <el-tag
              :type="row.eventType === 'enter' ? 'success' : row.eventType === 'exit' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.eventType === 'enter' ? '进门' : row.eventType === 'exit' ? '出门' : '路过' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="eventTime" label="时间" min-width="162" />
        <el-table-column prop="deviceName" label="点位" min-width="120">
          <template #default="{ row }">{{ row.deviceName || row.locationName || '—' }}</template>
        </el-table-column>
        <el-table-column label="人数" width="72" align="center">
          <template #default="{ row }">
            <span v-if="displayPersonCount(row) != null">{{ displayPersonCount(row) }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="AI 分析" min-width="280">
          <template #default="{ row }">
            <div class="ai-summary-text">{{ displayAiSummary(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="视频" width="96" align="center">
          <template #default="{ row }">
            <el-button
              :disabled="!row.sceneClip && !row.clip"
              link
              type="primary"
              icon="VideoPlay"
              @click="openPreview(row)"
            >
              预览
            </el-button>
            <div v-if="displayClip(row)" class="clip-status-line">
              <el-tag :type="clipStatusTagType(displayClip(row))" size="small">
                {{ clipStatusText(displayClip(row)) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="监控画面" width="160" align="center">
          <template #default="{ row }">
            <div class="snapshot-cell">
              <SnapshotWithBBox
                v-if="row.snapshotUrl"
                :src="resolveMediaUrl(row.snapshotUrl)"
                :bbox="row.snapshotBbox"
                preview
                @preview="url => openSnapshotPreview(url, row)"
              />
              <span v-else class="muted">—</span>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="behaviorLogs.length > 0"
        :total="behaviorLogs.length"
        v-model:page="pageNum"
        v-model:limit="pageSize"
      />
      <el-empty v-if="!logLoading && !behaviorLogs.length" description="暂无考勤日志" />
    </el-card>

    <el-dialog
      v-model="previewVisible"
      title="视频预览"
      width="860px"
      append-to-body
      destroy-on-close
      class="video-preview-dialog"
      @closed="onPreviewClosed"
    >
      <div v-if="activeClip" class="clip-host">
        <video
          v-if="isNativeVideoUrl(activeClip.videoUrl)"
          class="clip-video"
          controls
          autoplay
          :src="resolveMediaUrl(activeClip.videoUrl)"
        />
        <div v-else-if="isEzvizPlaybackUrl(activeClip.videoUrl)" class="ezviz-player-wrap">
          <div :id="ezvizPlayerContainerId" class="ezviz-player-host" />
          <div v-if="ezvizLoading || !ezvizPlayerReady" class="ezviz-player-mask">
            {{ ezvizLoading ? '正在加载萤石回放' : '萤石回放待初始化' }}
          </div>
        </div>
        <el-alert v-else type="warning" :closable="false" title="当前视频地址暂不支持预览" />
      </div>
      <el-empty v-else description="暂无场景录像" />
      <el-alert v-if="ezvizError" class="playback-error" type="error" :closable="false" :title="ezvizError" />
      <el-alert
        v-if="activeClip?.providerErrorMessage"
        class="playback-error"
        type="warning"
        :closable="false"
        :title="activeClip.providerErrorMessage"
      />
    </el-dialog>

    <el-dialog
      v-model="snapshotPreviewVisible"
      title="监控画面"
      width="860px"
      append-to-body
      destroy-on-close
      class="snapshot-preview-dialog"
      align-center
    >
      <div class="snapshot-preview-wrap">
        <SnapshotWithBBox
          v-if="snapshotPreviewUrl"
          :src="snapshotPreviewUrl"
          :bbox="snapshotPreviewBbox"
          :person-name="snapshotPreviewName"
          variant="large"
          fit="contain"
        />
      </div>
    </el-dialog>

    <el-dialog title="修改人员" v-model="editOpen" width="560px" append-to-body>
      <el-form ref="personRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="姓名" prop="displayName">
          <el-input v-model="form.displayName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="学工号" prop="employeeNo">
          <el-input v-model="form.employeeNo" placeholder="请输入学工号" />
        </el-form-item>
        <el-form-item label="人员类型" prop="personType">
          <el-select v-model="form.personType" placeholder="请选择类型" style="width: 100%">
            <el-option label="学生" value="student" />
            <el-option label="教职工" value="staff" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio label="0">男</el-radio>
            <el-radio label="1">女</el-radio>
            <el-radio label="2">未知</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.value">
              {{ dict.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="note">
          <el-input v-model="form.note" type="textarea" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="PersonDetail">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listAttendance } from '@/api/dashboard/attendance'
import { listBehaviorLogs } from '@/api/dashboard/behavior_log'
import { getMonitorScreenConfig } from '@/api/monitor/screen'
import { getPerson, updatePerson } from '@/api/system/person'
import { dateRangeParams, defaultDateRangeLastDays, defaultQueryDate } from '@/utils/statDateRange'
import SnapshotWithBBox from '@/components/SnapshotWithBBox/index.vue'
import {
  attendanceStatusTagType,
  formatAttendanceStatus,
  formatPersonKindLabel
} from '@/utils/personKind'

const { proxy } = getCurrentInstance()
const { sys_normal_disable } = proxy.useDict('sys_normal_disable')
const route = useRoute()
const router = useRouter()

const pageLoading = ref(false)
const logLoading = ref(false)
const saving = ref(false)
const editOpen = ref(false)
const person = ref(null)
const attendance = ref(null)
const behaviorLogs = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const form = ref({})
const previewVisible = ref(false)
const snapshotPreviewVisible = ref(false)
const snapshotPreviewUrl = ref('')
const snapshotPreviewBbox = ref(null)
const snapshotPreviewName = ref('')
const currentRow = ref(null)
const ezvizAccessToken = ref('')
const ezvizLoading = ref(false)
const ezvizError = ref('')
const ezvizPlayerReady = ref(false)
const ezvizPlayerRef = shallowRef(null)
const EZVIZ_PLAYER_CONTAINER_PREFIX = 'person-detail-ezviz-player'

const rules = {
  displayName: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
  employeeNo: [{ required: true, message: '学工号不能为空', trigger: 'blur' }],
  personType: [{ required: true, message: '人员类型不能为空', trigger: 'change' }]
}

const personId = computed(() => Number(route.params.personId))

const currentAttendanceStatus = computed(() => attendance.value?.attendanceStatus || 'absent')

const activeClip = computed(() => displayClip(currentRow.value))

const ezvizPlayerContainerId = `${EZVIZ_PLAYER_CONTAINER_PREFIX}-scene`

const apiBase = import.meta.env.VITE_APP_BASE_API || ''

const primaryFaceUrl = computed(() => {
  // 人员档案主图优先用 persons.face_image_url，避免合并后展示陌生人抓拍
  if (person.value?.faceImageUrl) {
    return resolveMediaUrl(person.value.faceImageUrl)
  }
  const urls = person.value?.faceImageUrls || []
  const first = urls.find(Boolean)
  return first ? resolveMediaUrl(first) : ''
})

const facePreviewList = computed(() => {
  if (person.value?.faceImageUrl) {
    return [resolveMediaUrl(person.value.faceImageUrl)]
  }
  const urls = person.value?.faceImageUrls || []
  return urls.filter(Boolean).map(resolveMediaUrl)
})

const pagedLogs = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return behaviorLogs.value.slice(start, start + pageSize.value)
})

function resolveMediaUrl(rawUrl) {
  if (!rawUrl) return ''
  if (/^(https?:|data:|blob:|ezopen:)/i.test(rawUrl)) return rawUrl

  let path = rawUrl
  if (path.startsWith('/face-library/')) {
    path = `/dashboard/data-board/file/face/${path.split('/').pop()}`
  } else if (path.startsWith('/body-library/')) {
    path = `/dashboard/data-board/file/body/${path.split('/').pop()}`
  }

  if (apiBase && path.startsWith(apiBase)) {
    return path
  }
  return apiBase ? apiBase + path : path
}

function previewList(rawUrl) {
  const url = resolveMediaUrl(rawUrl)
  return url ? [url] : []
}

function genderLabel(g) {
  if (g === '0') return '男'
  if (g === '1') return '女'
  return '未知'
}

function preferredAnalysisItems(row) {
  const scene = (row?.sceneAnalysisResults || []).filter(item => item && item.status === 'success' && item.summary)
  if (scene.length) return scene
  const personItems = (row?.analysisResults || []).filter(item => item && item.status === 'success' && item.summary)
  if (personItems.length) return personItems
  if (row?.behaviorAnalysis) {
    return [{ summary: row.behaviorAnalysis, personCount: null }]
  }
  const anyScene = row?.sceneAnalysisResults || []
  if (anyScene.length) return anyScene
  return row?.analysisResults || []
}

function displayAiSummary(row) {
  const item = preferredAnalysisItems(row)[0]
  if (!item) {
    const status = row?.analysisStatus
    if (status === 'pending') return '分析中…'
    if (status === 'failed') return '分析失败'
    if (status === 'none') return '无视频'
    return '未分析'
  }
  return item.summary || (item.status === 'failed' ? (item.errorMessage || '分析失败') : '—')
}

function displayPersonCount(row) {
  if (row?.personCount != null) return row.personCount
  const item = preferredAnalysisItems(row).find(it => it.personCount != null)
  return item ? item.personCount : null
}

function displayClip(row) {
  return row?.sceneClip || row?.clip || null
}

function clipStatusText(clip) {
  const status = clip?.providerStatus || clip?.status || ''
  if (status === 'local_downloaded') return '已下载本地'
  if (status === 'ezviz_playback_only') return '萤石回放'
  if (status === 'ezviz_task_processing' || status === 'pending_playback') return '正在转封装'
  if (status === 'ezviz_task_failed') return '转封装失败'
  if (status === 'fallback_local_recorded') return '本地兜底'
  if (status === 'uploaded') return '已上传分析'
  if (status === 'failed') return '录像失败'
  if (clip?.videoUrl) return '可预览'
  return '无视频'
}

function clipStatusTagType(clip) {
  const status = clip?.providerStatus || clip?.status || ''
  if (status === 'local_downloaded' || status === 'uploaded') return 'success'
  if (status === 'ezviz_task_processing' || status === 'pending_playback') return 'warning'
  if (status === 'failed' || status === 'ezviz_task_failed') return 'danger'
  return 'info'
}

function isEzvizPlaybackUrl(rawUrl) {
  return /^ezopen:\/\//i.test(rawUrl || '')
}

function isNativeVideoUrl(rawUrl) {
  return Boolean(rawUrl) && !isEzvizPlaybackUrl(rawUrl)
}

async function loadPlayerConstructor() {
  const sdkModule = await import('ezuikit-js')
  return sdkModule.EZUIKitPlayer || sdkModule.default?.EZUIKitPlayer || sdkModule.default
}

function normalizePlaybackError(error) {
  if (!error) return 'Ezviz playback init failed'
  if (typeof error === 'string') return error
  if (error.message) return error.message
  if (error.data?.nErrorCode) return `Ezviz player error ${error.data.nErrorCode}`
  try {
    return JSON.stringify(error)
  } catch (jsonError) {
    return 'Ezviz player returned an unreadable error'
  }
}

async function ensureEzvizAccessToken() {
  if (ezvizAccessToken.value) return ezvizAccessToken.value
  const res = await getMonitorScreenConfig()
  ezvizAccessToken.value = res?.data?.accessToken || ''
  if (!ezvizAccessToken.value) {
    throw new Error('Ezviz accessToken is empty')
  }
  return ezvizAccessToken.value
}

async function teardownEzvizPlayer() {
  const player = ezvizPlayerRef.value
  ezvizPlayerRef.value = null
  ezvizPlayerReady.value = false
  if (player) {
    try {
      if (typeof player.stop === 'function') await player.stop()
    } catch (error) {
      ezvizError.value = normalizePlaybackError(error)
    }
    try {
      if (typeof player.destroy === 'function') await player.destroy()
    } catch (error) {
      ezvizError.value = normalizePlaybackError(error)
    }
  }
  const container = document.getElementById(ezvizPlayerContainerId)
  if (container) container.innerHTML = ''
}

async function setupEzvizPlayback() {
  const clip = activeClip.value
  if (!previewVisible.value || !clip || !isEzvizPlaybackUrl(clip.videoUrl)) {
    await teardownEzvizPlayer()
    return
  }
  ezvizLoading.value = true
  ezvizError.value = ''
  try {
    await teardownEzvizPlayer()
    await nextTick()
    const token = await ensureEzvizAccessToken()
    const PlayerConstructor = await loadPlayerConstructor()
    const player = new PlayerConstructor({
      id: ezvizPlayerContainerId,
      accessToken: token,
      url: clip.videoUrl,
      template: 'pcRec',
      autoplay: true,
      width: 800,
      height: 450,
      handleError: (error) => {
        ezvizError.value = normalizePlaybackError(error)
      }
    })
    ezvizPlayerRef.value = player
    ezvizPlayerReady.value = true
  } catch (error) {
    ezvizError.value = normalizePlaybackError(error)
  } finally {
    ezvizLoading.value = false
  }
}

function snapshotPersonName(row) {
  const name = (row?.displayName || person.value?.displayName || '').trim()
  return name || '未知'
}

function openSnapshotPreview(url, row) {
  snapshotPreviewUrl.value = url
  snapshotPreviewBbox.value = row?.snapshotBbox || null
  snapshotPreviewName.value = snapshotPersonName(row)
  snapshotPreviewVisible.value = true
}

function openPreview(row) {
  currentRow.value = row
  ezvizError.value = ''
  previewVisible.value = true
}

async function onPreviewClosed() {
  await teardownEzvizPlayer()
  ezvizError.value = ''
  currentRow.value = null
}

function formatDuration(seconds) {
  const total = Number(seconds) || 0
  if (total <= 0) return '—'
  if (total < 60) return `${total}秒`
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m < 60) return s ? `${m}分${s}秒` : `${m}分钟`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}小时${rm}分` : `${h}小时`
}

function formatDateTime(value) {
  if (!value) return '—'
  return proxy.parseTime(value) || value
}

async function loadPerson() {
  if (!personId.value) return
  pageLoading.value = true
  try {
    const res = await getPerson(personId.value)
    person.value = res.data
  } finally {
    pageLoading.value = false
  }
}

async function loadAttendance() {
  if (!personId.value) return
  try {
    const res = await listAttendance({
      personId: personId.value,
      statDate: defaultQueryDate(),
      limit: 1
    })
    const rows = res?.data || res || []
    attendance.value = Array.isArray(rows) && rows.length ? rows[0] : null
  } catch (e) {
    attendance.value = null
  }
}

async function loadBehaviorLogs() {
  if (!personId.value) return
  logLoading.value = true
  try {
    const res = await listBehaviorLogs({
      // 详情页不展示筛选，默认拉取近一年日志
      ...dateRangeParams(defaultDateRangeLastDays(365)),
      personId: personId.value,
      limit: 500
    })
    behaviorLogs.value = (res?.data || res || []).map(row => ({
      ...row,
      locationName: row.deviceName || row.locationName || '—'
    }))
    pageNum.value = 1
  } finally {
    logLoading.value = false
  }
}

async function loadPage() {
  await loadPerson()
  await Promise.all([loadAttendance(), loadBehaviorLogs()])
}

function goBack() {
  router.back()
}

function handleEdit() {
  if (!person.value) return
  form.value = {
    personId: person.value.personId,
    displayName: person.value.displayName,
    employeeNo: person.value.employeeNo,
    personType: person.value.personType || 'student',
    status: person.value.status || '0',
    note: person.value.note,
    phone: person.value.phone,
    gender: person.value.gender || '0'
  }
  editOpen.value = true
}

function submitEdit() {
  proxy.$refs.personRef.validate(valid => {
    if (!valid) return
    saving.value = true
    updatePerson(form.value).then(() => {
      proxy.$modal.msgSuccess('修改成功')
      editOpen.value = false
      loadPerson()
    }).finally(() => {
      saving.value = false
    })
  })
}

watch(() => route.params.personId, () => {
  loadPage()
})

watch(previewVisible, async (visible) => {
  if (!visible) {
    await teardownEzvizPlayer()
    ezvizError.value = ''
    return
  }
  await nextTick()
  await setupEzvizPlayback()
})

watch(currentRow, async () => {
  if (!previewVisible.value) return
  await nextTick()
  await setupEzvizPlayback()
})

onMounted(() => {
  loadPage()
})

onBeforeUnmount(async () => {
  await teardownEzvizPlayer()
})
</script>

<style scoped lang="scss">
.person-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.info-card,
.log-card {
  border-radius: 10px;
}

.info-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.face-panel {
  flex: 0 0 120px;
}

.face-image,
.face-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 8px;
}

.face-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #909399;
  font-size: 13px;
}

.info-descriptions {
  flex: 1;
}

.log-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ai-summary-text {
  color: #303133;
  font-size: 13px;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

.clip-status-line {
  margin-top: 4px;
}

.snapshot-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.snapshot-thumb {
  width: 120px;
  height: 72px;
  border-radius: 6px;
  background: #f5f7fa;
}

.snapshot-thumb :deep(img) {
  object-fit: contain;
  width: 100%;
  height: 100%;
}

.clip-host {
  width: 100%;
}

.clip-video {
  width: 100%;
  max-height: 70vh;
  background: #111827;
  border-radius: 4px;
}

.ezviz-player-wrap {
  position: relative;
  width: 100%;
  min-height: 450px;
  background: #111827;
  border-radius: 4px;
  overflow: hidden;
}

.ezviz-player-host {
  width: 100%;
  min-height: 450px;
}

.ezviz-player-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  background: rgba(17, 24, 39, 0.76);
}

.playback-error {
  margin-top: 10px;
}

:deep(.snapshot-preview-dialog) {
  .el-dialog__body {
    padding: 0;
    background: #111827;
  }
}

.snapshot-preview-wrap {
  width: 100%;
  height: min(72vh, 640px);
  padding-top: 22px;
  box-sizing: border-box;
  background: #111827;
  overflow: visible;
}

.muted {
  color: #9aa4b2;
}
</style>
