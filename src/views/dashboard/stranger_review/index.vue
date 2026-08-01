<template>
  <div class="app-container board-page">
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

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="selectedRows.length !== 1" @click="editSelectedRow">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="!selectedRows.length" @click="removeSelectedRows">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="primary" plain icon="RefreshRight" :loading="loading" @click="handleRefresh">刷新</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="handleRefresh" />
    </el-row>

    <el-table v-loading="loading" :data="pagedStrangerRows" class="board-table" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="人脸" width="80" align="center">
        <template #default="{ row }">
          <el-avatar
            v-if="row.faceImageUrl"
            :size="48"
            :src="resolveMediaUrl(row.faceImageUrl)"
            shape="square"
            class="face-thumb"
          />
          <el-avatar v-else :size="48" icon="UserFilled" shape="square" />
        </template>
      </el-table-column>
      <el-table-column prop="displayName" label="名称" min-width="100">
        <template #default="{ row }">{{ row.displayName || '未知访客' }}</template>
      </el-table-column>
      <el-table-column prop="locationName" label="地点" min-width="140">
        <template #default="{ row }">{{ row.locationName || '—' }}</template>
      </el-table-column>
      <el-table-column prop="arrivalAt" label="首次出现" min-width="170">
        <template #default="{ row }">{{ row.arrivalAt || '—' }}</template>
      </el-table-column>
      <el-table-column prop="sessionCount" label="出现次数" width="90" align="center">
        <template #default="{ row }">{{ row.sessionCount || 1 }}次</template>
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
            <span v-else>—</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="录像" width="80" align="center">
        <template #default="{ row }">
          <el-button v-if="row.clipVideoUrl" link type="primary" icon="VideoPlay" @click="openVideoPreview(row)">播放</el-button>
          <span v-else class="text-muted">无</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" align="center" fixed="right" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button link type="primary" icon="Edit" @click="openEdit('stranger', row)">编辑</el-button>
          <el-button link type="warning" icon="Switch" @click="openMergeDialog(row)">合并</el-button>
          <el-button link type="danger" icon="Delete" @click="removeRow('stranger', row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="strangerRows.length > 0"
      :total="strangerRows.length"
      v-model:page="pageNum"
      v-model:limit="pageSize"
    />

    <!-- 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" title="陌生人研判 - 编辑基本信息" width="560px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="人脸">
          <el-avatar
            :size="64"
            :src="editForm.faceImageUrl ? resolveMediaUrl(editForm.faceImageUrl) : undefined"
            icon="UserFilled"
            shape="square"
          />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.displayName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="学工号">
          <el-input v-model="editForm.employeeNo" placeholder="请输入学工号（可选）" />
        </el-form-item>
        <el-form-item label="身份">
          <el-select v-model="editForm.personType" style="width: 100%" placeholder="请选择身份">
            <el-option label="陌生人" value="stranger" />
            <el-option label="学生" value="student" />
            <el-option label="教职工" value="staff" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="editForm.gender">
            <el-radio label="0">男</el-radio>
            <el-radio label="1">女</el-radio>
            <el-radio label="2">未知</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="editForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.note" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 合并对话框 -->
    <el-dialog v-model="mergeDialogVisible" title="合并到已有人员" width="520px">
      <div class="merge-info" v-if="mergeSource">
        <div class="merge-label">当前陌生人：</div>
        <div class="merge-source-card">
          <el-avatar :size="40" :src="mergeSource.faceImageUrl ? resolveMediaUrl(mergeSource.faceImageUrl) : undefined" icon="UserFilled" />
          <span class="merge-name">{{ mergeSource.displayName || '未知访客' }}</span>
          <el-tag size="small" type="info">{{ mergeSource.sessionCount || 1 }}次出现</el-tag>
        </div>
      </div>
      <el-divider />
      <el-form label-width="100px">
        <el-form-item label="合并到">
          <el-select
            v-model="mergeTargetId"
            filterable
            remote
            reserve-keyword
            :remote-method="loadArchivePersons"
            :loading="personSearchLoading"
            placeholder="输入姓名或学工号搜索人员档案"
            style="width: 100%"
            popper-class="merge-person-select-popper"
            clearable
          >
            <el-option
              v-for="p in personSelectOptions"
              :key="p.personId"
              :label="personOptionLabel(p)"
              :value="p.personId"
            >
              <div class="person-option">
                <el-avatar :size="28" :src="p.faceImageUrl ? resolveMediaUrl(p.faceImageUrl) : undefined" icon="UserFilled" />
                <span class="person-option-name">{{ p.displayName }}</span>
                <span class="person-option-type">{{ formatPersonKindLabel(p.personType) }}</span>
                <span class="person-option-no">{{ p.employeeNo || '' }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mergeDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!mergeTargetId" :loading="mergeLoading" @click="confirmMerge">确认合并</el-button>
      </template>
    </el-dialog>

    <!-- 视频播放对话框 -->
    <el-dialog v-model="videoDialogVisible" title="监控录像" width="720px" destroy-on-close>
      <video
        v-if="videoDialogVisible && videoUrl"
        :src="videoUrl"
        controls
        autoplay
        class="video-player"
      />
    </el-dialog>

    <!-- 监控画面预览（绿框，不显示名字） -->
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
          variant="large"
          fit="contain"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteDataBoardStranger, mergeStrangerToPerson } from '@/api/dashboard/data_board'
import { listPerson } from '@/api/system/person'
import SnapshotWithBBox from '@/components/SnapshotWithBBox/index.vue'
import { useDataBoardSummary } from '@/composables/useDataBoardSummary'
import { defaultDateRangeLastDays, isFutureDate } from '@/utils/statDateRange'
import { formatPersonKindLabel } from '@/utils/personKind'

const queryRef = ref()
const selectedRows = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const showSearch = ref(true)
const {
  loading, dateRange, locationId, strangerRows, editDialogVisible,
  editForm, locationOptions, loadSummary, resolveMediaUrl,
  previewList, openEdit, removeRow, saveEdit, resetQueryFilters
} = useDataBoardSummary({
  initialDateRange: () => defaultDateRangeLastDays(30),
  recentLimit: 500
})

function disableFutureDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return isFutureDate(`${y}-${m}-${d}`)
}

const pagedStrangerRows = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return strangerRows.value.slice(start, start + pageSize.value)
})

const mergeDialogVisible = ref(false)
const mergeSource = ref(null)
const mergeTargetId = ref(null)
const mergeLoading = ref(false)
const personSearchLoading = ref(false)
const personSelectOptions = ref([])

const videoDialogVisible = ref(false)
const videoUrl = ref('')
const snapshotPreviewVisible = ref(false)
const snapshotPreviewUrl = ref('')
const snapshotPreviewBbox = ref(null)

function handleQuery() {
  pageNum.value = 1
  loadSummary()
}

function handleRefresh() {
  loadSummary()
}

function resetQuery() {
  resetQueryFilters()
  pageNum.value = 1
  loadSummary()
}

function handleSelectionChange(selection) {
  selectedRows.value = selection
}

function editSelectedRow() {
  if (selectedRows.value.length === 1) {
    openEdit('stranger', selectedRows.value[0])
  }
}

function removeSelectedRows() {
  const selected = [...selectedRows.value]
  if (!selected.length) return
  ElMessageBox.confirm(`确认删除选中的 ${selected.length} 条陌生人记录吗？`, '提示', { type: 'warning' })
    .then(async () => {
      await Promise.all(selected.map(row => deleteDataBoardStranger(row.trackKey)))
      selectedRows.value = []
      await loadSummary()
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

function personOptionLabel(person) {
  const name = person?.displayName || '未知'
  const no = person?.employeeNo ? ` (${person.employeeNo})` : ''
  const type = formatPersonKindLabel(person?.personType)
  return `${name}${no} · ${type}`
}

function buildArchiveQuery(keyword = '') {
  const q = (keyword || '').trim()
  const params = { pageNum: 1, pageSize: 100 }
  if (!q) return params
  if (/^\d+$/.test(q)) {
    params.employeeNo = q
  } else {
    params.displayName = q
  }
  return params
}

async function loadArchivePersons(keyword = '') {
  personSearchLoading.value = true
  try {
    const res = await listPerson(buildArchiveQuery(keyword))
    const sourcePersonId = mergeSource.value?.mergedPersonId
    personSelectOptions.value = (res.rows || []).filter(p => {
      if (sourcePersonId != null && Number(p.personId) === Number(sourcePersonId)) {
        return false
      }
      return p.personType === 'student' || p.personType === 'staff'
    })
  } catch (e) {
    personSelectOptions.value = []
  } finally {
    personSearchLoading.value = false
  }
}

async function openMergeDialog(row) {
  mergeSource.value = row
  mergeTargetId.value = null
  mergeDialogVisible.value = true
  await loadArchivePersons()
}

async function confirmMerge() {
  if (!mergeSource.value || !mergeTargetId.value) return
  mergeLoading.value = true
  try {
    await mergeStrangerToPerson(mergeSource.value.trackKey, Number(mergeTargetId.value))
    ElMessage.success('合并成功')
    mergeDialogVisible.value = false
    await loadSummary()
  } catch (e) {
    ElMessage.error('合并失败')
  } finally {
    mergeLoading.value = false
  }
}

function openSnapshotPreview(url, row) {
  snapshotPreviewUrl.value = url
  snapshotPreviewBbox.value = row?.snapshotBbox || null
  snapshotPreviewVisible.value = true
}

function openVideoPreview(row) {
  const apiBase = import.meta.env.VITE_APP_BASE_API || ''
  let url = row.clipVideoUrl || ''
  if (url && !/^https?:/i.test(url)) {
    url = apiBase + url
  }
  videoUrl.value = url
  videoDialogVisible.value = true
}
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';

.monitor-thumb {
  width: 128px;
  height: 72px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #111827;
}

.snapshot-cell {
  display: flex;
  justify-content: center;
  align-items: center;
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

.face-thumb {
  border: 1px solid #e4e7ed;
}

.text-muted {
  color: #c0c4cc;
  font-size: 12px;
}

.video-player {
  width: 100%;
  max-height: 420px;
  border-radius: 6px;
  background: #000;
}

/* 合并对话框 */
.merge-info {
  .merge-label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
  }
  .merge-source-card {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .merge-name {
    font-weight: 600;
    font-size: 15px;
  }
}

.person-option {
  display: grid;
  grid-template-columns: 28px 72px 56px 1fr;
  align-items: center;
  column-gap: 10px;
  width: 100%;

  .person-option-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .person-option-type {
    color: #606266;
    font-size: 12px;
    white-space: nowrap;
  }

  .person-option-no {
    color: #909399;
    font-size: 12px;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

<style lang="scss">
.merge-person-select-popper {
  .el-select-dropdown__item {
    height: auto;
    line-height: 1.4;
    padding: 8px 12px;
  }
}
</style>
