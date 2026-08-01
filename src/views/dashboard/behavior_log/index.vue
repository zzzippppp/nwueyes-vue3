<template>
  <div class="app-container board-page behavior-log-page">
    <el-form ref="queryRef" :inline="true" class="query-form" v-show="showSearch">
      <el-form-item label="日期" prop="dateRange">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          :disabled-date="disableFutureDate"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          clearable
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="人员名字" prop="displayName">
        <el-input
          v-model="displayName"
          clearable
          placeholder="请输入姓名"
          style="width: 160px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="人员类型" prop="personType">
        <el-select v-model="personType" clearable placeholder="全部类型" style="width: 140px">
          <el-option label="学生" value="student" />
          <el-option label="教职工" value="staff" />
          <el-option label="陌生人" value="stranger" />
        </el-select>
      </el-form-item>
      <el-form-item label="点位" prop="locationId">
        <el-select v-model="locationId" clearable placeholder="全部点位" style="width: 200px">
          <el-option v-for="item in locationOptions" :key="item.locationId" :label="item.locationName" :value="item.locationId" />
        </el-select>
      </el-form-item>
      <el-form-item label="行为类型" prop="eventType">
        <el-select v-model="eventType" clearable placeholder="全部行为" style="width: 200px">
          <el-option label="进门" value="enter" />
          <el-option label="出门" value="exit" />
          <el-option label="路过" value="pass" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" :loading="loading" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="RefreshRight" :loading="loading" @click="handleRefresh">
          刷新
        </el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="handleRefresh" />
    </el-row>

    <el-table
      v-loading="loading"
      :data="pagedRows"
      class="board-table"
    >
      <el-table-column prop="id" label="ID" width="74" />
      <el-table-column prop="displayName" label="名称" min-width="120" />
      <el-table-column prop="personType" label="人员类型" width="100">
        <template #default="{ row }">
          {{ formatPersonKindLabel(row.personType || row.personKind) }}
        </template>
      </el-table-column>
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
          <div class="ai-cell">
            <div v-if="row.analysisStatus && row.analysisStatus !== 'success'" class="ai-cell-head">
              <el-tag :type="analysisTagType(row.analysisStatus)" size="small">
                {{ analysisStatusText(row.analysisStatus) }}
              </el-tag>
            </div>
            <div class="ai-summary-text">{{ displayAiSummary(row) }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="视频" width="96">
        <template #default="{ row }">
          <el-button :disabled="!row.sceneClip && !row.clip" link type="primary" icon="VideoPlay" @click="openPreview(row)">
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
      v-show="rows.length > 0"
      :total="rows.length"
      v-model:page="pageNum"
      v-model:limit="pageSize"
    />

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
          <div :id="ezvizPlayerContainerId('scene')" class="ezviz-player-host" />
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
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { listBehaviorLogs } from '@/api/dashboard/behavior_log'
import { getDataBoardSummary } from '@/api/dashboard/data_board'
import { getMonitorScreenConfig } from '@/api/monitor/screen'
import { dateRangeParams, defaultDateRangeLastDays, isFutureDate } from '@/utils/statDateRange'
import { formatPersonKindLabel } from '@/utils/personKind'
import SnapshotWithBBox from '@/components/SnapshotWithBBox/index.vue'

const apiBase = import.meta.env.VITE_APP_BASE_API || ''
const loading = ref(false)
const rows = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const showSearch = ref(true)
const dateRange = ref(defaultDateRangeLastDays(30))
const displayName = ref('')
const personType = ref(undefined)
const locationId = ref(undefined)
const eventType = ref(undefined)
const locationOptions = ref([])
const queryRef = ref()
const previewVisible = ref(false)
const currentRow = ref(null)
const ezvizAccessToken = ref('')
const ezvizLoading = ref(false)
const ezvizError = ref('')
const ezvizPlayerReady = ref(false)
const ezvizPlayerRef = shallowRef(null)
const snapshotPreviewVisible = ref(false)
const snapshotPreviewUrl = ref('')
const snapshotPreviewBbox = ref(null)
const snapshotPreviewName = ref('')

const EZVIZ_PLAYER_CONTAINER_PREFIX = 'behavior-ezviz-player'

const activeClip = computed(() => {
  if (!currentRow.value) return null
  return displayClip(currentRow.value)
})

const pagedRows = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})

function snapshotPersonName(row) {
  const name = (row?.displayName || '').trim()
  return name || '未知'
}

function openSnapshotPreview(url, row) {
  snapshotPreviewUrl.value = url
  snapshotPreviewBbox.value = row?.snapshotBbox || null
  snapshotPreviewName.value = snapshotPersonName(row)
  snapshotPreviewVisible.value = true
}

function analysisStatusText(status) {
  if (status === 'success') return '完成'
  if (status === 'partial') return '部分完成'
  if (status === 'failed') return '失败'
  if (status === 'skipped') return '跳过'
  if (status === 'none') return '无视频'
  if (status === 'pending') return '分析中'
  return '未分析'
}

function analysisTagType(status) {
  if (status === 'success') return 'success'
  if (status === 'partial') return 'warning'
  if (status === 'failed') return 'danger'
  if (status === 'skipped' || status === 'none') return 'info'
  return 'primary'
}

function preferredAnalysisItems(row) {
  const scene = (row?.sceneAnalysisResults || []).filter(item => item && item.status === 'success' && item.summary)
  if (scene.length) return scene
  const person = (row?.analysisResults || []).filter(item => item && item.status === 'success' && item.summary)
  if (person.length) return person
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

function resolveMediaUrl(rawUrl) {
  if (!rawUrl) return ''
  if (/^(https?:|data:|blob:|ezopen:)/i.test(rawUrl)) return rawUrl
  let path = rawUrl
  if (path.startsWith('/face-library/')) {
    path = `/dashboard/data-board/file/face/${path.split('/').pop()}`
  } else if (path.startsWith('/body-library/')) {
    path = `/dashboard/data-board/file/body/${path.split('/').pop()}`
  }
  if (apiBase && path.startsWith(apiBase)) return path
  return apiBase ? apiBase + path : path
}

function isEzvizPlaybackUrl(rawUrl) {
  return /^ezopen:\/\//i.test(rawUrl || '')
}

function isNativeVideoUrl(rawUrl) {
  return Boolean(rawUrl) && !isEzvizPlaybackUrl(rawUrl)
}

function ezvizPlayerContainerId(tabName = 'scene') {
  return `${EZVIZ_PLAYER_CONTAINER_PREFIX}-${tabName}`
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
  const container = document.getElementById(ezvizPlayerContainerId('scene'))
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
      id: ezvizPlayerContainerId('scene'),
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

function previewList(rawUrl) {
  const url = resolveMediaUrl(rawUrl)
  return url ? [url] : []
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

async function loadLocations() {
  const res = await getDataBoardSummary({ ...dateRangeParams(dateRange.value), recentLimit: 1 })
  const data = res?.data || res || {}
  locationOptions.value = (data.byLocation || []).map(item => ({
    locationId: item.locationId ?? item.cameraId,
    locationName: item.locationName ?? item.deviceName
  }))
}

async function loadRows() {
  loading.value = true
  try {
    const res = await listBehaviorLogs({
      ...dateRangeParams(dateRange.value),
      cameraId: locationId.value,
      eventType: eventType.value,
      displayName: displayName.value || undefined,
      personType: personType.value
    })
    rows.value = (res?.data || res || []).map(row => ({
      ...row,
      locationName: row.deviceName || row.locationName || '—'
    }))
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  pageNum.value = 1
  loadRows()
}

function handleRefresh() {
  loadRows()
}

function resetQuery() {
  dateRange.value = defaultDateRangeLastDays(30)
  displayName.value = ''
  personType.value = undefined
  locationId.value = undefined
  eventType.value = undefined
  pageNum.value = 1
  loadRows()
}

function disableFutureDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return isFutureDate(`${y}-${m}-${d}`)
}

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

onMounted(async () => {
  await loadLocations()
  await loadRows()
})

onBeforeUnmount(async () => {
  await teardownEzvizPlayer()
})
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';

.behavior-log-page {
  background: #f6f8fb;
  min-height: calc(100vh - 84px);

  .snapshot-thumb {
    width: 128px;
    height: 72px;
    border-radius: 4px;
    background: #f5f7fa;
  }

  .muted {
    color: #9aa4b2;
  }

  .ai-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    line-height: 1.45;
  }

  .ai-cell-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ai-summary-text {
    color: #303133;
    font-size: 13px;
    white-space: normal;
    word-break: break-word;
  }

  .clip-status-line {
    margin-top: 4px;
  }
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

.snapshot-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
