<template>
  <div class="app-container board-page data-board-page">
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
      <el-form-item label="监控地点" prop="locationId">
        <el-select v-model="locationId" clearable placeholder="全部地点" style="width: 200px">
          <el-option v-for="item in locationOptions" :key="item.locationId" :label="item.locationName" :value="item.locationId" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" :loading="loading" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row class="mb8">
      <el-col>
        <el-tag type="info" size="small">每 30 秒自动刷新</el-tag>
      </el-col>
    </el-row>

    <div class="stat-row stat-grid">
      <el-card v-for="card in statCards" :key="card.key" shadow="hover" class="stat-card">
        <div class="stat-label">{{ card.label }}</div>
        <div class="stat-value">{{ card.value }}</div>
      </el-card>
    </div>

    <el-tabs v-model="activeTab" class="tabs-wrap">
      <el-tab-pane :label="`停留记录(${sessionRows.length})`" name="session">
        <el-table v-loading="loading" :data="sessionRows" class="board-table">
          <el-table-column prop="sessionId" label="ID" min-width="70" />
          <el-table-column prop="locationName" label="地点" min-width="120" />
          <el-table-column prop="displayName" label="人员" min-width="140" />
          <el-table-column prop="personKind" label="类型" min-width="100">
            <template #default="{ row }">{{ row.personKind === 'known' ? '已知' : '陌生/未知' }}</template>
          </el-table-column>
          <el-table-column prop="arrivalAt" label="到达" min-width="165" />
          <el-table-column prop="departureAt" label="离开" min-width="165">
            <template #default="{ row }">{{ row.departureAt || '—' }}</template>
          </el-table-column>
          <el-table-column prop="dwellSeconds" label="停留时长" min-width="120">
            <template #default="{ row }">{{ formatDuration(row.dwellSeconds) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" min-width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'open' ? 'warning' : 'success'" size="small">
                {{ row.status === 'open' ? '在场中' : '已离开' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="faceImageUrl" label="人脸" min-width="90">
            <template #default="{ row }">
              <el-image
                v-if="rowFaceUrl(row)"
                :src="resolveMediaUrl(rowFaceUrl(row))"
                :preview-src-list="previewList(rowFaceUrl(row))"
                preview-teleported
                fit="cover"
                class="thumb thumb-preview"
              />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170" align="center" fixed="right" class-name="small-padding fixed-width">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit('session', row)">编辑</el-button>
              <el-button link type="danger" @click="removeRow('session', row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`人员档案(${personRows.length})`" name="person">
        <div class="tab-actions">
          <el-button type="primary" @click="openUploadDialog">上传人脸</el-button>
        </div>
        <el-table v-loading="loading" :data="personRows" class="board-table">
          <el-table-column prop="personId" label="ID" min-width="70" />
          <el-table-column prop="displayName" label="当前名称" min-width="160" />
          <el-table-column prop="personKind" label="类型" min-width="90">
            <template #default="{ row }">{{ row.personKind === 'known' ? '已知' : '陌生人' }}</template>
          </el-table-column>
          <el-table-column prop="tagsText" label="标签" min-width="140" />
          <el-table-column prop="note" label="备注" min-width="140">
            <template #default="{ row }">{{ row.note || '—' }}</template>
          </el-table-column>
          <el-table-column prop="faceImageUrl" label="人脸" min-width="90">
            <template #default="{ row }">
              <el-image
                v-if="rowFaceUrl(row)"
                :src="resolveMediaUrl(rowFaceUrl(row))"
                :preview-src-list="previewList(rowFaceUrl(row))"
                preview-teleported
                fit="cover"
                class="thumb thumb-preview"
              />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column prop="bodyImageUrl" label="体态" min-width="90">
            <template #default="{ row }">
              <el-image
                v-if="rowBodyUrl(row)"
                :src="resolveMediaUrl(rowBodyUrl(row))"
                :preview-src-list="previewList(rowBodyUrl(row))"
                preview-teleported
                fit="cover"
                class="thumb thumb-preview"
              />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column prop="lastSeenAt" label="最后出现时间" min-width="170" />
          <el-table-column label="操作" width="170" align="center" fixed="right" class-name="small-padding fixed-width">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit('person', row)">编辑</el-button>
              <el-button link type="danger" @click="removeRow('person', row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`陌生人研判(${strangerRows.length})`" name="stranger">
        <el-table v-loading="loading" :data="strangerRows" class="board-table">
          <el-table-column prop="trackKey" label="轨迹ID" min-width="220" />
          <el-table-column prop="displayName" label="当前名称" min-width="180" />
          <el-table-column label="身份" min-width="100">
            <template #default="{ row }">{{ row.identityType === 'known' ? '人员' : '陌生人' }}</template>
          </el-table-column>
          <el-table-column prop="tagsText" label="标签" min-width="150" />
          <el-table-column prop="faceImageUrl" label="人脸" min-width="90">
            <template #default="{ row }">
              <el-image
                v-if="rowFaceUrl(row)"
                :src="resolveMediaUrl(rowFaceUrl(row))"
                :preview-src-list="previewList(rowFaceUrl(row))"
                preview-teleported
                fit="cover"
                class="thumb thumb-preview"
              />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="210" align="center" fixed="right" class-name="small-padding fixed-width">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit('stranger', row)">编辑</el-button>
              <el-button link type="danger" @click="removeRow('stranger', row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`监控信息(${locationRows.length})`" name="location">
        <el-table v-loading="loading" :data="locationRows" class="board-table">
          <el-table-column prop="locationName" label="监控位置名" min-width="260" />
          <el-table-column prop="deviceSerial" label="设备号" min-width="180" />
          <el-table-column prop="channelNo" label="通道" min-width="100" />
          <el-table-column label="操作" width="90" align="center" fixed="right" class-name="small-padding fixed-width">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit('location', row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="editDialogVisible" title="编辑" width="560px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="名称" v-if="editMode !== 'session'">
          <el-input v-model="editForm.displayName" v-if="editMode === 'person' || editMode === 'stranger'" />
          <el-input v-model="editForm.locationName" v-else />
        </el-form-item>
        <el-form-item label="标签" v-if="editMode === 'person' || editMode === 'stranger'">
          <el-input v-model="editForm.tagsText" />
        </el-form-item>
        <el-form-item label="身份" v-if="editMode === 'stranger'">
          <el-select v-model="editForm.identityType" style="width: 100%">
            <el-option label="陌生人" value="stranger" />
            <el-option label="人员" value="known" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" v-if="editMode === 'person'">
          <el-input v-model="editForm.note" type="textarea" />
        </el-form-item>
        <el-form-item label="状态" v-if="editMode === 'session'">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option label="在场中" value="open" />
            <el-option label="已离开" value="closed" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="uploadDialogVisible" title="上传人脸" width="620px">
      <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="100px">
        <el-form-item label="姓名" prop="displayName">
          <el-input v-model="uploadForm.displayName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="uploadForm.personKind" style="width: 100%">
            <el-option label="已知人员" value="known" />
            <el-option label="陌生人" value="stranger" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="uploadForm.tagsText" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="uploadForm.note" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="头像" prop="faceImageUrl">
          <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="handleAvatarUpload">
            <el-button type="primary">选择图片</el-button>
          </el-upload>
          <el-image
            v-if="uploadForm.faceImageUrl"
            :src="uploadForm.faceImageUrl"
            :preview-src-list="[uploadForm.faceImageUrl]"
            preview-teleported
            fit="cover"
            class="upload-preview thumb-preview"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUpload">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteDataBoardPerson,
  deleteDataBoardSession,
  deleteDataBoardStranger,
  getDataBoardSummary,
  updateDataBoardLocation,
  updateDataBoardPerson,
  updateDataBoardSession,
  updateDataBoardStranger,
  uploadDataBoardFace
} from '@/api/dashboard/data_board'
import { dateRangeParams, defaultDateRange } from '@/utils/statDateRange'

const loading = ref(false)
const queryRef = ref()
const dateRange = ref(defaultDateRange())
const locationId = ref()
const summary = ref({})
const activeTab = ref('session')
const sessionRows = ref([])
const personRows = ref([])
const strangerRows = ref([])
const locationRows = ref([])
const editDialogVisible = ref(false)
const uploadDialogVisible = ref(false)
const editMode = ref('session')
const editForm = reactive({})
const uploadFormRef = ref()
const uploadForm = reactive({
  personId: null,
  displayName: '',
  personKind: 'known',
  tagsText: '',
  note: '',
  faceImageUrl: ''
})
const uploadRules = {
  displayName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  faceImageUrl: [{ required: true, message: '请上传头像', trigger: 'change' }]
}
let pollTimer = null

const locationOptions = computed(() => {
  return (summary.value.byLocation || []).map(item => ({
    locationId: item.locationId ?? item.cameraId,
    locationName: item.locationName ?? item.deviceName
  }))
})

const statCards = computed(() => {
  return [
    { key: 'visitor', label: '人员', value: personRows.value.length },
    { key: 'stranger', label: '陌生人', value: strangerRows.value.length },
    { key: 'attendance', label: '今日考勤人数', value: summary.value.sessionCount ?? 0 },
    { key: 'open', label: '在场中', value: summary.value.openSessionCount ?? 0 },
    { key: 'point', label: '点位', value: locationRows.value.length }
  ]
})

function openEdit(type, row) {
  editMode.value = type
  Object.keys(editForm).forEach(key => delete editForm[key])
  Object.assign(editForm, JSON.parse(JSON.stringify(row)))
  if (type === 'stranger') {
    editForm.identityType = editForm.identityType || 'stranger'
  }
  editDialogVisible.value = true
}

function removeRow(type, row) {
  const map = { session: '停留记录', person: '人员档案', stranger: '陌生人研判', location: '点位信息' }
  const label = map[type]
  if (type === 'location') {
    ElMessage.warning('点位删除接口尚未接入')
    return
  }
  if (!label) return
  ElMessageBox.confirm(`确认删除该${label}吗？`, '提示', { type: 'warning' })
    .then(async () => {
      if (type === 'session') {
        await deleteDataBoardSession(row.sessionId)
      } else if (type === 'person') {
        await deleteDataBoardPerson(row.personId)
      } else if (type === 'stranger') {
        await deleteDataBoardStranger(row.trackKey)
      }
      await loadSummary()
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

async function saveEdit() {
  try {
    if (editMode.value === 'session') {
      await updateDataBoardSession(editForm.sessionId, { status: editForm.status })
    } else if (editMode.value === 'person') {
      await updateDataBoardPerson(editForm.personId, {
        displayName: editForm.displayName,
        personKind: editForm.personKind,
        tagsText: editForm.tagsText,
        note: editForm.note
      })
    } else if (editMode.value === 'stranger') {
      await updateDataBoardStranger(editForm.trackKey, {
        displayName: editForm.displayName,
        tagsText: editForm.tagsText,
        identityType: editForm.identityType
      })
    } else if (editMode.value === 'location') {
      const cameraId = editForm.cameraId ?? editForm.locationId
      if (!cameraId) {
        ElMessage.error('设备 ID 缺失，无法保存')
        return
      }
      await updateDataBoardLocation(cameraId, {
        deviceName: (editForm.deviceName ?? editForm.locationName ?? '').trim()
      })
    }
    await loadSummary()
    ElMessage.success('保存成功')
  } finally {
    editDialogVisible.value = false
  }
}

function handleAvatarUpload(file) {
  uploadForm.avatarFile = file.raw
  const reader = new FileReader()
  reader.onload = e => {
    uploadForm.faceImageUrl = e.target?.result || ''
  }
  reader.readAsDataURL(file.raw)
}

function openUploadDialog() {
  Object.assign(uploadForm, {
    personId: null,
    displayName: '',
    personKind: 'known',
    tagsText: '',
    note: '',
    faceImageUrl: '',
    avatarFile: null
  })
  uploadDialogVisible.value = true
}

async function submitUpload() {
  if (!uploadFormRef.value) return
  uploadFormRef.value.validate(async valid => {
    if (!valid) return
    if (!uploadForm.avatarFile) {
      ElMessage.warning('请先选择头像图片')
      return
    }
    const formData = new FormData()
    formData.append('displayName', uploadForm.displayName)
    formData.append('personKind', uploadForm.personKind)
    formData.append('tagsText', uploadForm.tagsText || '')
    formData.append('note', uploadForm.note || '')
    formData.append('avatarfile', uploadForm.avatarFile)
    await uploadDataBoardFace(formData)
    await loadSummary()
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
  })
}

function formatDuration(seconds) {
  const total = Number(seconds) || 0
  if (total < 60) return `${total}秒`
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m < 60) return s ? `${m}分${s}秒` : `${m}分钟`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}小时${rm}分` : `${h}小时`
}

const apiBase = import.meta.env.VITE_APP_BASE_API || ''

function rowFaceUrl(row) {
  return row?.faceImageUrl || row?.face_image_url || ''
}

function rowBodyUrl(row) {
  return row?.bodyImageUrl || row?.body_image_url || ''
}

/** 库内路径 -> 后端文件接口，并加上 dev-api 代理前缀（与 ImagePreview 一致） */
function resolveMediaUrl(rawUrl) {
  if (!rawUrl) return ''
  if (/^(https?:|data:)/i.test(rawUrl)) return rawUrl

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

function loadSummary() {
  loading.value = true
  getDataBoardSummary({
    ...dateRangeParams(dateRange.value),
    cameraId: locationId.value,
    recentLimit: 20
  }).then(res => {
    const data = res.data || {}
    summary.value = data
    sessionRows.value = data.recentSessions || []
    personRows.value = data.personItems || []
    strangerRows.value = data.strangerItems || []
    strangerRows.value = strangerRows.value.map(item => ({
      ...item,
      identityType: item.identityType || 'stranger'
    }))
    locationRows.value = (data.byLocation || []).map(item => {
      const cameraId = item.cameraId ?? item.locationId
      const deviceName = item.deviceName ?? item.locationName ?? ''
      return { ...item, cameraId, locationId: cameraId, deviceName, locationName: deviceName }
    })
    if ((!dateRange.value || !dateRange.value[0]) && (data.beginDate || data.statDate)) {
      const begin = data.beginDate || data.statDate
      const end = data.endDate || begin
      dateRange.value = [begin, end]
    }
  }).finally(() => {
    loading.value = false
  })
}

function handleQuery() {
  loadSummary()
}

function resetQuery() {
  dateRange.value = defaultDateRange()
  locationId.value = undefined
  loadSummary()
}

onMounted(() => {
  dateRange.value = defaultDateRange()
  loadSummary()
  pollTimer = window.setInterval(loadSummary, 30000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';

.data-board-page {
  .toolbar {
    margin-bottom: 16px;
  }
  .toolbar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .stat-row {
    margin-bottom: 12px;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }
  .tabs-wrap {
    margin-top: 8px;
  }
  .tab-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .stat-card {
    position: relative;
    height: 96px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    border-radius: 10px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    :deep(.el-card__body) {
      padding-left: 26px;
    }
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      background: var(--accent, #409eff);
    }
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
    }
    .stat-label {
      color: #909399;
      font-size: 13px;
    }
    .stat-value {
      margin-top: 8px;
      font-size: 28px;
      font-weight: 700;
      color: var(--accent, #303133);
      line-height: 1;
    }
    &:nth-child(1) { --accent: #409eff; }
    &:nth-child(2) { --accent: #f56c6c; }
    &:nth-child(3) { --accent: #67c23a; }
    &:nth-child(4) { --accent: #e6a23c; }
    &:nth-child(5) { --accent: #909399; }
  }
  .thumb {
    width: 34px;
    height: 34px;
    border-radius: 4px;
    border: 1px solid #ebeef5;
  }
  .thumb-preview {
    :deep(.el-image__inner) {
      cursor: zoom-in;
    }
  }
  @media (max-width: 1200px) {
    .stat-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 768px) {
    .stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
</style>
