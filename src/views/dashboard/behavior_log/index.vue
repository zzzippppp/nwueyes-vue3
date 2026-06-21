<template>
  <div class="app-container board-page behavior-log-page">
    <el-form ref="queryRef" :inline="true" class="query-form">
      <el-form-item label="统计日期" prop="dateRange">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          clearable
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="监控点位" prop="locationId">
        <el-select v-model="locationId" clearable placeholder="全部点位" style="width: 200px">
          <el-option v-for="item in locationOptions" :key="item.locationId" :label="item.locationName" :value="item.locationId" />
        </el-select>
      </el-form-item>
      <el-form-item label="行为类型" prop="eventType">
        <el-select v-model="eventType" clearable placeholder="全部行为" style="width: 200px">
          <el-option label="进门" value="enter" />
          <el-option label="出门" value="exit" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" :loading="loading" @click="handleQuery">搜索</el-button>
        <el-button icon="RefreshRight" :loading="loading" @click="handleRefresh">刷新</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
      <el-form-item v-if="sceneFilter">
        <el-button type="warning" plain @click="clearSceneFilter">清除场景筛选</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="rows" class="board-table">
      <el-table-column prop="id" label="ID" width="74" />
      <el-table-column prop="displayName" label="名称" min-width="140" />
      <el-table-column prop="eventType" label="行为" width="86">
        <template #default="{ row }">
          <el-tag :type="row.eventType === 'enter' ? 'success' : 'warning'" size="small">
            {{ row.eventType === 'enter' ? '进门' : '出门' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="eventTime" label="时间" min-width="162" />
      <el-table-column prop="locationName" label="点位" min-width="120" />
      <el-table-column prop="trackKey" label="轨迹" min-width="118" />
      <el-table-column prop="sceneGroupId" label="场景组" min-width="150">
        <template #default="{ row }">
          <el-button v-if="row.sceneGroupId" link type="primary" @click="filterScene(row.sceneGroupId)">
            {{ shortScene(row.sceneGroupId) }}
          </el-button>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="AI 分析" min-width="142">
        <template #default="{ row }">
          <el-tag :type="analysisTagType(row.analysisStatus)" size="small">
            {{ analysisStatusText(row.analysisStatus) }}
          </el-tag>
          <span class="model-count">{{ modelCount(row) }} 模型</span>
        </template>
      </el-table-column>
      <el-table-column label="视频" width="96">
        <template #default="{ row }">
          <el-button :disabled="!row.clip && !row.sceneClip" link type="primary" @click="openPreview(row)">
            预览
          </el-button>
          <div v-if="displayClip(row)" class="clip-status-line">
            <el-tag :type="clipStatusTagType(displayClip(row))" size="small">
              {{ clipStatusText(displayClip(row)) }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="监控画面" width="148">
        <template #default="{ row }">
          <el-image
            v-if="row.snapshotUrl"
            :src="resolveMediaUrl(row.snapshotUrl)"
            :preview-src-list="previewList(row.snapshotUrl)"
            preview-teleported
            fit="cover"
            class="snapshot-thumb"
          />
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="center" fixed="right" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button link type="danger" @click="removeRow(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="previewVisible" size="76%" class="analysis-drawer" :with-header="false">
      <div v-if="currentRow" class="drawer-shell">
        <div class="drawer-head">
          <div>
            <div class="drawer-title">{{ currentRow.displayName || '行为记录' }}</div>
            <div class="drawer-subtitle">{{ currentRow.eventTime }} / {{ currentRow.locationName || '-' }}</div>
          </div>
          <el-button @click="previewVisible = false">关闭</el-button>
        </div>

        <div class="drawer-grid">
          <section class="video-panel">
            <el-tabs v-model="activeVideoTab" class="video-tabs">
              <el-tab-pane label="个人会话" name="person" :disabled="!currentRow.clip">
                <div v-if="currentRow.clip" class="clip-host">
                  <video v-if="isNativeVideoUrl(currentRow.clip.videoUrl)" class="clip-video" controls :src="resolveMediaUrl(currentRow.clip.videoUrl)" />
                  <div v-else-if="isEzvizPlaybackUrl(currentRow.clip.videoUrl)" class="ezviz-player-wrap">
                    <div :id="ezvizPlayerContainerId('person')" class="ezviz-player-host" />
                    <div v-if="ezvizLoading || !ezvizPlayerReady" class="ezviz-player-mask">
                      {{ ezvizLoading ? '正在加载萤石回放' : '萤石回放待初始化' }}
                    </div>
                  </div>
                  <el-alert v-else type="warning" :closable="false" title="当前视频地址暂不支持预览" />
                </div>
                <el-empty v-else description="暂无个人会话视频" />
              </el-tab-pane>
              <el-tab-pane label="多人场景" name="scene" :disabled="!currentRow.sceneClip">
                <div v-if="currentRow.sceneClip" class="clip-host">
                  <video v-if="isNativeVideoUrl(currentRow.sceneClip.videoUrl)" class="clip-video" controls :src="resolveMediaUrl(currentRow.sceneClip.videoUrl)" />
                  <div v-else-if="isEzvizPlaybackUrl(currentRow.sceneClip.videoUrl)" class="ezviz-player-wrap">
                    <div :id="ezvizPlayerContainerId('scene')" class="ezviz-player-host" />
                    <div v-if="ezvizLoading || !ezvizPlayerReady" class="ezviz-player-mask">
                      {{ ezvizLoading ? '正在加载萤石回放' : '萤石回放待初始化' }}
                    </div>
                  </div>
                  <el-alert v-else type="warning" :closable="false" title="当前视频地址暂不支持预览" />
                </div>
                <el-empty v-else description="暂无场景组视频" />
              </el-tab-pane>
            </el-tabs>
            <el-alert v-if="ezvizError" class="playback-error" type="error" :closable="false" :title="ezvizError" />
            <el-alert
              v-if="activeClip?.providerErrorMessage"
              class="playback-error"
              type="warning"
              :closable="false"
              :title="activeClip.providerErrorMessage"
            />

            <div class="clip-meta">
              <div>轨迹：{{ currentRow.trackKey || '-' }}</div>
              <div>场景组：{{ currentRow.sceneGroupId || '-' }}</div>
              <div>来源：{{ currentRow.source || '-' }}</div>
              <div>录像状态：{{ clipStatusText(activeClip) }}</div>
              <div>分析地址：{{ activeClip?.publicVideoUrl ? '已上传' : '待上传' }}</div>
              <div>来源地址：{{ providerSourceText(activeClip) }}</div>
            </div>

            <div class="model-picker">
              <div class="model-picker-title">选择分析模型</div>
              <el-select
                v-model="selectedModelKeys"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择一个或多个模型"
                class="model-select"
              >
                <el-option
                  v-for="model in modelOptions"
                  :key="model.modelKey"
                  :label="model.modelName || model.modelKey"
                  :value="model.modelKey"
                  :disabled="model.enabled === false"
                />
              </el-select>
              <div class="analysis-actions">
                <el-button
                  type="primary"
                  :disabled="!canRunPersonalAnalysis"
                  :loading="analysisRunning"
                  @click="runSelectedAnalysis('clip')"
                >
                  分析个人片段
                </el-button>
                <el-button
                  type="success"
                  :disabled="!canRunSceneAnalysis"
                  :loading="analysisRunning"
                  @click="runSelectedAnalysis('scene_group')"
                >
                  分析多人场景
                </el-button>
                <el-button :loading="loading" @click="refreshCurrentRow">刷新结果</el-button>
              </div>
            </div>
          </section>

          <section class="analysis-panel">
            <div class="panel-title">模型对比</div>
            <el-tabs v-model="activeAnalysisTab">
              <el-tab-pane label="个人片段" name="person">
                <AnalysisList :items="currentRow.analysisResults || []" />
              </el-tab-pane>
              <el-tab-pane label="多人场景" name="scene">
                <AnalysisList :items="currentRow.sceneAnalysisResults || []" />
              </el-tab-pane>
            </el-tabs>
          </section>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteBehaviorLog, listAiAnalysisModels, listBehaviorLogs, runAiAnalysis } from '@/api/dashboard/behavior_log'
import { getDataBoardSummary } from '@/api/dashboard/data_board'
import { getMonitorScreenConfig } from '@/api/monitor/screen'
import { dateRangeParams, defaultDateRange } from '@/utils/statDateRange'

const AnalysisList = defineComponent({
  name: 'AnalysisList',
  props: {
    items: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    return () => {
      if (!props.items.length) {
        return h('div', { class: 'empty-analysis' }, '暂无分析结果')
      }
      return h('div', { class: 'analysis-list' }, props.items.map(item => h('div', { class: 'analysis-card', key: item.id || item.modelKey }, [
        h('div', { class: 'analysis-card-head' }, [
          h('span', { class: 'model-name' }, item.modelName || item.modelKey || '模型'),
          h('span', { class: `status-pill status-${item.status || 'pending'}` }, analysisStatusText(item.status))
        ]),
        h('div', { class: 'analysis-section' }, [h('b', null, '概要'), h('p', null, item.summary || '-')]),
        h('div', { class: 'analysis-section' }, [h('b', null, '外观'), h('p', null, item.appearance || '-')]),
        h('div', { class: 'analysis-section' }, [h('b', null, '行为'), h('p', null, item.behavior || '-')]),
        h('div', { class: 'risk-line' }, `风险：${item.riskLevel || 'unknown'}`),
        item.errorMessage ? h('div', { class: 'error-line' }, item.errorMessage) : null
      ])))
    }
  }
})

const apiBase = import.meta.env.VITE_APP_BASE_API || ''
const loading = ref(false)
const analysisRunning = ref(false)
const rows = ref([])
const allRows = ref([])
const modelOptions = ref([])
const selectedModelKeys = ref([])
const dateRange = ref(defaultDateRange())
const locationId = ref(undefined)
const eventType = ref(undefined)
const locationOptions = ref([])
const queryRef = ref()
const previewVisible = ref(false)
const currentRow = ref(null)
const activeVideoTab = ref('person')
const activeAnalysisTab = ref('person')
const sceneFilter = ref('')
const ezvizAccessToken = ref('')
const ezvizLoading = ref(false)
const ezvizError = ref('')
const ezvizPlayerReady = ref(false)
const ezvizPlayerRef = shallowRef(null)

const EZVIZ_PLAYER_CONTAINER_PREFIX = 'behavior-ezviz-player'

const filteredRows = computed(() => {
  if (!sceneFilter.value) return allRows.value
  return allRows.value.filter(row => row.sceneGroupId === sceneFilter.value)
})

const canRunPersonalAnalysis = computed(() => {
  return canSubmitAnalysis(currentRow.value?.clip)
})

const canRunSceneAnalysis = computed(() => {
  return currentRow.value?.sceneGroupId && canSubmitAnalysis(currentRow.value?.sceneClip)
})

const activeClip = computed(() => {
  if (!currentRow.value) return null
  return activeVideoTab.value === 'scene' ? currentRow.value.sceneClip : currentRow.value.clip
})

function personKindText(kind) {
  if (kind === 'known') return '已知'
  if (kind === 'stranger') return '陌生'
  return '未知'
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

function modelCount(row) {
  return (row.analysisResults?.length || 0) + (row.sceneAnalysisResults?.length || 0)
}

function displayClip(row) {
  return row?.clip || row?.sceneClip || null
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

function providerSourceText(clip) {
  const url = clip?.providerSourceUrl || clip?.videoUrl || ''
  if (!url) return '-'
  if (url.startsWith('/dashboard/storage/file/clip/')) return '本地片段'
  if (/^ezopen:\/\//i.test(url)) return '萤石 ezopen'
  if (/^https?:\/\//i.test(url)) return '萤石地址'
  return '其他'
}

function canSubmitAnalysis(clip) {
  if (!clip?.id || !selectedModelKeys.value.length || analysisRunning.value) return false
  const status = clip.providerStatus || clip.status || ''
  if (status === 'ezviz_task_processing' || status === 'pending_playback' || status === 'failed' || status === 'ezviz_task_failed') {
    return false
  }
  if (clip.publicVideoUrl) return true
  if (!clip.videoUrl || isEzvizPlaybackUrl(clip.videoUrl)) return false
  return true
}

function shortScene(sceneGroupId) {
  if (!sceneGroupId) return '-'
  return sceneGroupId.length > 18 ? `...${sceneGroupId.slice(-15)}` : sceneGroupId
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

function ezvizPlayerContainerId(tabName = activeVideoTab.value) {
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
  ;['person', 'scene'].forEach((tab) => {
    const container = document.getElementById(ezvizPlayerContainerId(tab))
    if (container) container.innerHTML = ''
  })
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
      id: ezvizPlayerContainerId(),
      accessToken: token,
      url: clip.videoUrl,
      template: 'pcRec',
      autoplay: true,
      width: 720,
      height: 405,
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
  activeVideoTab.value = row.clip ? 'person' : 'scene'
  activeAnalysisTab.value = row.analysisResults?.length ? 'person' : 'scene'
  ezvizError.value = ''
  if (!selectedModelKeys.value.length) {
    selectedModelKeys.value = modelOptions.value.filter(item => item.enabled !== false).slice(0, 3).map(item => item.modelKey)
  }
  previewVisible.value = true
}

function filterScene(sceneGroupId) {
  sceneFilter.value = sceneFilter.value === sceneGroupId ? '' : sceneGroupId
  rows.value = filteredRows.value
}

function clearSceneFilter() {
  sceneFilter.value = ''
  rows.value = filteredRows.value
}

async function runSelectedAnalysis(targetType) {
  if (!currentRow.value || !selectedModelKeys.value.length) return
  const targetId = targetType === 'scene_group'
    ? currentRow.value.sceneGroupId
    : String(currentRow.value.clip?.id || '')
  if (!targetId) return
  analysisRunning.value = true
  try {
    await runAiAnalysis({
      targetType,
      targetId,
      modelKeys: selectedModelKeys.value
    })
    ElMessage.success('分析任务已提交')
    await refreshCurrentRow()
  } finally {
    analysisRunning.value = false
  }
}

async function refreshCurrentRow() {
  const rowId = currentRow.value?.id
  await loadRows()
  if (rowId) {
    currentRow.value = allRows.value.find(row => row.id === rowId) || currentRow.value
  }
  await nextTick()
  await setupEzvizPlayback()
}

async function loadLocations() {
  const res = await getDataBoardSummary({ ...dateRangeParams(dateRange.value), recentLimit: 1 })
  const data = res?.data || res || {}
  locationOptions.value = (data.byLocation || []).map(item => ({
    locationId: item.locationId ?? item.cameraId,
    locationName: item.locationName ?? item.deviceName
  }))
}

async function loadModels() {
  const res = await listAiAnalysisModels()
  modelOptions.value = res?.data || res || []
  selectedModelKeys.value = modelOptions.value.filter(item => item.enabled !== false).slice(0, 3).map(item => item.modelKey)
}

async function loadRows() {
  loading.value = true
  try {
    const res = await listBehaviorLogs({
      ...dateRangeParams(dateRange.value),
      cameraId: locationId.value,
      eventType: eventType.value
    })
    allRows.value = res?.data || res || []
    rows.value = filteredRows.value
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  loadRows()
}

function handleRefresh() {
  loadRows()
}

function resetQuery() {
  dateRange.value = defaultDateRange()
  locationId.value = undefined
  eventType.value = undefined
  sceneFilter.value = ''
  loadRows()
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

watch(activeVideoTab, async () => {
  if (!previewVisible.value) return
  await nextTick()
  await setupEzvizPlayback()
})

watch(currentRow, async () => {
  if (!previewVisible.value) return
  await nextTick()
  await setupEzvizPlayback()
})

function removeRow(row) {
  ElMessageBox.confirm('确认删除该行为日志吗？', '提示', { type: 'warning' })
    .then(async () => {
      await deleteBehaviorLog(row.id)
      await loadRows()
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

onMounted(async () => {
  await Promise.all([loadLocations(), loadModels()])
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
    background: #111827;
  }

  .thumb {
    width: 46px;
    height: 46px;
    border-radius: 4px;
  }

  .muted {
    color: #9aa4b2;
  }

  .model-count {
    margin-left: 8px;
    color: #6b7280;
    font-size: 12px;
  }

  .clip-status-line {
    margin-top: 4px;
  }
}

.drawer-shell {
  padding: 18px;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.drawer-title {
  font-size: 20px;
  font-weight: 700;
  color: #151923;
}

.drawer-subtitle {
  margin-top: 4px;
  color: #6b7280;
}

.drawer-grid {
  display: grid;
  grid-template-columns: minmax(420px, 1.1fr) minmax(390px, 0.9fr);
  gap: 16px;
}

.video-panel,
.analysis-panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 14px;
}

.clip-video {
  width: 100%;
  max-height: 500px;
  background: #111827;
  border-radius: 4px;
}

.clip-host {
  width: 100%;
}

.ezviz-player-wrap {
  position: relative;
  width: 100%;
  min-height: 405px;
  background: #111827;
  border-radius: 4px;
  overflow: hidden;
}

.ezviz-player-host {
  width: 100%;
  min-height: 405px;
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

.clip-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  color: #4b5563;
  font-size: 12px;
  word-break: break-word;
}

.model-picker {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}

.model-picker-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.model-select {
  width: 100%;
}

.analysis-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}

:deep(.analysis-list) {
  display: grid;
  gap: 10px;
}

:deep(.analysis-card) {
  border: 1px solid #dbe2ea;
  border-radius: 6px;
  padding: 12px;
  background: #fbfcfe;
}

:deep(.analysis-card-head) {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

:deep(.model-name) {
  font-weight: 700;
  color: #111827;
}

:deep(.status-pill) {
  color: #4b5563;
  font-size: 12px;
}

:deep(.analysis-section) {
  margin-bottom: 8px;
}

:deep(.analysis-section p) {
  margin: 4px 0 0;
  color: #374151;
  line-height: 1.55;
}

:deep(.risk-line) {
  color: #92400e;
  font-weight: 600;
}

:deep(.error-line) {
  color: #b91c1c;
  margin-top: 8px;
}

:deep(.empty-analysis) {
  color: #9aa4b2;
  padding: 30px 0;
  text-align: center;
}

@media (max-width: 1180px) {
  .drawer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
