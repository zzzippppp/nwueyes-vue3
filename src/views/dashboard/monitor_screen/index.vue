<template>
  <div class="app-container board-page">
    <el-form ref="queryRef" :model="queryParams" :inline="true" class="query-form">
      <el-form-item label="摄像头名称" prop="deviceName">
        <el-input
          v-model="queryParams.deviceName"
          clearable
          placeholder="请输入摄像头名称"
          style="width: 180px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="点位" prop="installLocation">
        <el-input
          v-model="queryParams.installLocation"
          clearable
          placeholder="请输入点位"
          style="width: 160px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="在线状态" prop="onlineStatus">
        <el-select v-model="queryParams.onlineStatus" clearable placeholder="全部状态" style="width: 140px">
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
        </el-select>
      </el-form-item>
      <el-form-item label="设备类型" prop="typeId">
        <el-select v-model="queryParams.typeId" clearable placeholder="全部类型" style="width: 160px">
          <el-option
            v-for="item in typeOptions"
            :key="item.id"
            :label="item.typeName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" :loading="loading" @click="handleQuery">搜索</el-button>
        <el-button icon="RefreshRight" :loading="loading" @click="handleRefresh">刷新</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="table-wrap">
      <el-table v-loading="loading" :data="deviceList" class="board-table">
        <el-table-column prop="id" label="ID" min-width="70" />
        <el-table-column prop="deviceName" label="摄像头名称" min-width="140">
          <template #default="{ row }">{{ row.deviceName || row.deviceCode || '—' }}</template>
        </el-table-column>
        <el-table-column prop="installLocation" label="点位" min-width="140">
          <template #default="{ row }">{{ row.installLocation || '—' }}</template>
        </el-table-column>
        <el-table-column prop="serialNo" label="序列号" min-width="150">
          <template #default="{ row }">{{ (row.serialNo || '').toUpperCase() || '—' }}</template>
        </el-table-column>
        <el-table-column prop="channelNo" label="通道" min-width="80">
          <template #default="{ row }">{{ row.channelNo ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="typeName" label="设备类型" min-width="110">
          <template #default="{ row }">{{ row.typeName || '—' }}</template>
        </el-table-column>
        <el-table-column label="识别/在线状态" min-width="180">
          <template #default="{ row }">
            <div class="status-cell">
              <el-tag :type="recognizeTagType(row)" size="small">{{ recognizeLabel(row) }}</el-tag>
              <el-tag :type="onlineTagType(row)" size="small">{{ onlineLabel(row) }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="推流类型" min-width="130">
          <template #default>局域网 RTSP</template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center" fixed="right" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        :total="total"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        @pagination="getList"
      />
    </div>

    <MonitorDetailDrawer
      v-model:visible="detailVisible"
      :camera="detailCamera"
    />
  </div>
</template>

<script setup name="MonitorScreen">
import { listDeviceInfo } from '@/api/dashboard/device_info'
import { optionselectDeviceType } from '@/api/dashboard/device_type'
import { getMonitorScreenConfig } from '@/api/monitor/screen'
import useLiveRecognizeStore from '@/store/modules/liveRecognize'
import MonitorDetailDrawer from './MonitorDetailDrawer.vue'

const { proxy } = getCurrentInstance()
const liveStore = useLiveRecognizeStore()

const queryRef = ref()
const loading = ref(false)
const deviceList = ref([])
const total = ref(0)
const typeOptions = ref([])
const ezvizStatusMap = ref({})
const detailVisible = ref(false)
const detailCamera = ref(null)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  deviceName: undefined,
  installLocation: undefined,
  onlineStatus: undefined,
  typeId: undefined
})

function isOnline(row) {
  const serial = (row.serialNo || row.deviceSerial || '').toUpperCase()
  const ezviz = serial ? ezvizStatusMap.value[serial] : null
  if (ezviz === '1' || ezviz === 1 || ezviz === true) return true
  if (ezviz === '0' || ezviz === 0 || ezviz === false) return false
  return row.onlineStatus === 'online'
}

function onlineLabel(row) {
  return isOnline(row) ? '在线' : '离线'
}

function onlineTagType(row) {
  return isOnline(row) ? 'success' : 'info'
}

function isRecognizingCamera(row) {
  return liveStore.isCameraRecognizing(row?.id, row?.serialNo || row?.deviceSerial)
}

function recognizeLabel(row) {
  const cameraId = row?.id
  if (isRecognizingCamera(row)) {
    const status = liveStore.statusOf(cameraId)
    if (status === 'starting' || liveStore.isCameraStarting(cameraId)) return '启动中'
    if (status === 'reconnecting') return '重连中'
    if (status === 'running') return '运行中'
    if (status === 'failed') return '异常'
  }
  if (liveStore.isCameraFailed(row?.id, row?.serialNo || row?.deviceSerial)) {
    return '异常'
  }
  return '未启动'
}

function recognizeTagType(row) {
  const label = recognizeLabel(row)
  if (label === '运行中') return 'success'
  if (label === '启动中' || label === '重连中') return 'warning'
  if (label === '异常') return 'danger'
  return 'info'
}

function openDetail(row) {
  detailCamera.value = { ...row }
  detailVisible.value = true
}

function buildQuery() {
  return {
    pageNum: queryParams.pageNum,
    pageSize: queryParams.pageSize,
    deviceName: queryParams.deviceName || undefined,
    installLocation: queryParams.installLocation || undefined,
    onlineStatus: queryParams.onlineStatus || undefined,
    typeId: queryParams.typeId || undefined
  }
}

async function loadTypeOptions() {
  try {
    const res = await optionselectDeviceType()
    typeOptions.value = res.data || res.rows || []
  } catch {
    typeOptions.value = []
  }
}

async function loadEzvizStatus() {
  try {
    const res = await getMonitorScreenConfig()
    const devices = Array.isArray(res.data?.devices) ? res.data.devices : []
    const map = {}
    devices.forEach((item) => {
      const serial = (item.deviceSerial || item.serialNo || '').toUpperCase()
      if (serial) {
        map[serial] = item.status
      }
    })
    ezvizStatusMap.value = map
  } catch {
    // ignore
  }
}

async function getList() {
  loading.value = true
  try {
    const res = await listDeviceInfo(buildQuery())
    deviceList.value = res.rows || []
    total.value = res.total || 0
  } catch (error) {
    deviceList.value = []
    total.value = 0
    proxy.$modal.msgError(`加载摄像头列表失败：${error?.message || error}`)
  } finally {
    loading.value = false
  }
}

async function handleQuery() {
  queryParams.pageNum = 1
  await getList()
}

async function handleRefresh() {
  await Promise.all([loadEzvizStatus(), liveStore.syncFromServer()])
  await getList()
}

function resetQuery() {
  queryParams.deviceName = undefined
  queryParams.installLocation = undefined
  queryParams.onlineStatus = undefined
  queryParams.typeId = undefined
  queryParams.pageNum = 1
  queryRef.value?.resetFields?.()
  getList()
}

onMounted(async () => {
  // 列表优先：不等配置接口，避免进页先空白再靠「重置」才出数据
  const listPromise = getList()
  liveStore.bootstrap().catch(() => {})
  loadTypeOptions()
  loadEzvizStatus()
  await listPromise
})
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';

.status-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
