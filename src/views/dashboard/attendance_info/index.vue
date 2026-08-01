<template>
  <div class="app-container board-page">
    <el-form ref="queryRef" :inline="true" class="query-form" v-show="showSearch">
      <el-form-item label="人名" prop="displayName">
        <el-input
          v-model="sessionFilters.displayName"
          clearable
          placeholder="请输入姓名"
          style="width: 160px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="学工号" prop="employeeNo">
        <el-input
          v-model="sessionFilters.employeeNo"
          clearable
          placeholder="请输入学工号"
          style="width: 160px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="日期" prop="queryDate">
        <el-date-picker
          v-model="queryDate"
          type="date"
          value-format="YYYY-MM-DD"
          :disabled-date="disableFutureDate"
          placeholder="选择日期"
          clearable
          style="width: 160px"
        />
      </el-form-item>
      <el-form-item label="时段" prop="timeRange">
        <el-time-picker
          v-model="timeRange"
          is-range
          format="HH:mm"
          value-format="HH:mm"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item label="人员类型" prop="personType">
        <el-select v-model="sessionFilters.personType" clearable placeholder="全部类型" style="width: 140px">
          <el-option label="学生" value="student" />
          <el-option label="教职工" value="staff" />
          <el-option label="陌生人" value="stranger" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="sessionStatus">
        <el-select v-model="sessionFilters.sessionStatus" clearable placeholder="全部状态" style="width: 140px">
          <el-option label="未出勤" value="absent" />
          <el-option label="在场中" value="present" />
          <el-option label="已离场" value="left" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" :loading="loading" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="!currentRow" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="primary" plain icon="RefreshRight" :loading="loading" @click="handleRefresh">刷新</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="handleRefresh" />
    </el-row>

    <div class="table-wrap list-table-wrap">
      <el-table
        v-loading="loading"
        :data="pagedAttendanceRows"
        class="board-table"
        highlight-current-row
        @current-change="row => (currentRow = row)"
      >
        <el-table-column prop="personId" label="ID" min-width="70" />
        <el-table-column prop="locationName" label="地点" min-width="120">
          <template #default="{ row }">{{ row.locationName || '—' }}</template>
        </el-table-column>
        <el-table-column prop="displayName" label="人员" min-width="120" />
        <el-table-column prop="employeeNo" label="学工号" min-width="120">
          <template #default="{ row }">{{ row.employeeNo || '—' }}</template>
        </el-table-column>
        <el-table-column prop="personKind" label="人员类型" min-width="100">
          <template #default="{ row }">{{ formatPersonKindLabel(row.personKind) }}</template>
        </el-table-column>
        <el-table-column prop="passageCount" label="进出次数" min-width="100" />
        <el-table-column prop="arrivalAt" label="到达" min-width="165">
          <template #default="{ row }">{{ row.arrivalAt || '—' }}</template>
        </el-table-column>
        <el-table-column prop="departureAt" label="离开" min-width="165">
          <template #default="{ row }">{{ row.departureAt || '—' }}</template>
        </el-table-column>
        <el-table-column prop="dwellSeconds" label="停留时长" min-width="120">
          <template #default="{ row }">
            {{ row.attendanceStatus === 'absent' ? '—' : formatDuration(row.dwellSeconds) }}
          </template>
        </el-table-column>
        <el-table-column prop="attendanceStatus" label="状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="attendanceStatusTagType(row.attendanceStatus)" size="small">
              {{ formatAttendanceStatus(row.attendanceStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center" fixed="right" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-button link type="primary" icon="View" @click="openDetail(row)">详情</el-button>
            <el-button link type="primary" icon="Edit" @click="handleUpdate(row)">修改</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <pagination
      v-show="attendanceRows.length > 0"
      :total="attendanceRows.length"
      v-model:page="pageNum"
      v-model:limit="pageSize"
    />

    <el-dialog v-model="formOpen" :title="formTitle" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="人员" prop="personId">
          <el-select
            v-model="form.personId"
            filterable
            remote
            clearable
            :disabled="isEdit"
            :remote-method="searchPersons"
            :loading="personLoading"
            placeholder="输入姓名或学工号搜索"
            style="width: 100%"
          >
            <el-option
              v-for="p in personOptions"
              :key="p.personId"
              :label="`${p.displayName}${p.employeeNo ? '（' + p.employeeNo + '）' : ''}`"
              :value="p.personId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="地点" prop="cameraId">
          <el-select
            v-model="form.cameraId"
            clearable
            filterable
            placeholder="请选择地点"
            style="width: 100%"
            :disabled="form.attendanceStatus === 'absent'"
          >
            <el-option
              v-for="item in cameraOptions"
              :key="item.locationId"
              :label="item.locationName"
              :value="item.locationId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="在场状态" prop="attendanceStatus">
          <el-select v-model="form.attendanceStatus" placeholder="请选择在场状态" style="width: 100%">
            <el-option label="未出勤" value="absent" />
            <el-option label="在场中" value="present" />
            <el-option label="已离场" value="left" />
          </el-select>
        </el-form-item>
        <el-form-item label="到达时间" prop="arrivalAt" v-if="form.attendanceStatus !== 'absent'">
          <el-date-picker
            v-model="form.arrivalAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="到达时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="离开时间" prop="departureAt" v-if="form.attendanceStatus === 'left'">
          <el-date-picker
            v-model="form.departureAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="离开时间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { addAttendance, updateAttendance } from '@/api/dashboard/attendance'
import { listDeviceInfo } from '@/api/dashboard/device_info'
import { listPerson } from '@/api/system/person'
import { useDataBoardSummary } from '@/composables/useDataBoardSummary'
import { isFutureDate } from '@/utils/statDateRange'
import {
  attendanceStatusTagType,
  formatAttendanceStatus,
  formatPersonKindLabel
} from '@/utils/personKind'

const { proxy } = getCurrentInstance()
const router = useRouter()

const queryRef = ref()
const formRef = ref()
const currentRow = ref(null)
const pageNum = ref(1)
const pageSize = ref(10)
const showSearch = ref(true)
const formOpen = ref(false)
const formTitle = ref('')
const isEdit = ref(false)
const saving = ref(false)
const personLoading = ref(false)
const personOptions = ref([])
const deviceOptions = ref([])

const form = reactive({
  personId: undefined,
  cameraId: undefined,
  attendanceStatus: 'present',
  arrivalAt: undefined,
  departureAt: undefined,
  displayName: undefined,
  employeeNo: undefined
})

const formRules = {
  personId: [{ required: true, message: '请选择人员', trigger: 'change' }],
  attendanceStatus: [{ required: true, message: '请选择在场状态', trigger: 'change' }],
  cameraId: [{
    validator: (_r, v, cb) => {
      if (form.attendanceStatus === 'absent') return cb()
      if (!v) return cb(new Error('请选择地点'))
      cb()
    },
    trigger: 'change'
  }]
}

const {
  loading,
  queryDate,
  timeRange,
  sessionFilters,
  attendanceRows,
  locationOptions,
  loadSummary,
  formatDuration,
  resetQueryFilters
} = useDataBoardSummary({
  sessionFilterMode: true,
  attendanceListMode: true,
  singleDayTimeMode: true,
  recentLimit: 500
})

const cameraOptions = computed(() => {
  const fromSummary = (locationOptions.value || []).map(item => ({
    locationId: item.locationId,
    locationName: item.locationName
  }))
  if (fromSummary.length) return fromSummary
  return deviceOptions.value
})

const pagedAttendanceRows = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return attendanceRows.value.slice(start, start + pageSize.value)
})

function loadDevices() {
  listDeviceInfo({ pageNum: 1, pageSize: 100 }).then(res => {
    deviceOptions.value = (res.rows || []).map(item => ({
      locationId: item.id,
      locationName: item.deviceName || item.deviceCode || `设备${item.id}`
    }))
  }).catch(() => {
    deviceOptions.value = []
  })
}

onMounted(() => {
  loadDevices()
})

function disableFutureDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return isFutureDate(`${y}-${m}-${d}`)
}

function openDetail(row) {
  if (!row?.personId) {
    proxy.$modal.msgWarning('该记录未关联人员')
    return
  }
  router.push(`/system/person-detail/index/${row.personId}`)
}

function resetForm() {
  form.personId = undefined
  form.cameraId = undefined
  form.attendanceStatus = 'present'
  form.arrivalAt = undefined
  form.departureAt = undefined
  form.displayName = undefined
  form.employeeNo = undefined
  personOptions.value = []
  proxy.resetForm('formRef')
}

function handleAdd() {
  resetForm()
  isEdit.value = false
  formTitle.value = '新增考勤'
  if (cameraOptions.value?.length === 1) {
    form.cameraId = cameraOptions.value[0].locationId
  }
  formOpen.value = true
  searchPersons('')
}

function handleUpdate(row) {
  const target = row || currentRow.value
  if (!target) {
    proxy.$modal.msgWarning('请先选择一条考勤记录')
    return
  }
  resetForm()
  isEdit.value = true
  formTitle.value = '修改考勤'
  form.personId = target.personId
  form.cameraId = target.cameraId
  form.attendanceStatus = target.attendanceStatus || 'absent'
  form.arrivalAt = target.arrivalAt || undefined
  form.departureAt = target.departureAt || undefined
  form.displayName = target.displayName
  form.employeeNo = target.employeeNo
  personOptions.value = [{
    personId: target.personId,
    displayName: target.displayName,
    employeeNo: target.employeeNo
  }]
  if (!form.cameraId && cameraOptions.value?.length === 1) {
    form.cameraId = cameraOptions.value[0].locationId
  }
  formOpen.value = true
}

function searchPersons(keyword) {
  personLoading.value = true
  listPerson({
    pageNum: 1,
    pageSize: 20,
    displayName: keyword || undefined,
    employeeNo: /^\d+$/.test(keyword || '') ? keyword : undefined
  }).then(res => {
    personOptions.value = res.rows || []
  }).finally(() => {
    personLoading.value = false
  })
}

function submitForm() {
  formRef.value?.validate(valid => {
    if (!valid) return
    if (!queryDate.value) {
      proxy.$modal.msgWarning('请先选择日期')
      return
    }
    const payload = {
      personId: form.personId,
      cameraId: form.cameraId,
      attendanceStatus: form.attendanceStatus,
      statDate: queryDate.value,
      arrivalAt: form.attendanceStatus === 'absent' ? undefined : form.arrivalAt,
      departureAt: form.attendanceStatus === 'left' ? form.departureAt : undefined
    }
    saving.value = true
    const req = isEdit.value ? updateAttendance(payload) : addAttendance(payload)
    req.then(() => {
      proxy.$modal.msgSuccess(isEdit.value ? '修改成功' : '新增成功')
      formOpen.value = false
      loadSummary()
    }).catch(e => {
      proxy.$modal.msgError(e?.message || (isEdit.value ? '修改失败' : '新增失败'))
    }).finally(() => {
      saving.value = false
    })
  })
}

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
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';

.list-table-wrap {
  margin-top: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
</style>
