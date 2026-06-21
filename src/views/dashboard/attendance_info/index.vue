<template>
  <div class="app-container board-page">
    <el-form ref="queryRef" :inline="true" class="query-form">
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
        <el-button icon="RefreshRight" :loading="loading" @click="handleRefresh">刷新</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <AttendanceStatPanel title="考勤信息" :cards="statCards">
      <template #extra>
        <div class="panel-extra">
          <el-text type="info" size="small">展示人脸档案全部人员，以及所选时段内曾进门的未登记人员；按停留时长倒序</el-text>
          <el-tag type="info" size="small">每 30 秒自动刷新</el-tag>
        </div>
      </template>
    </AttendanceStatPanel>

    <div class="table-wrap">
      <el-table v-loading="loading" :data="attendanceRows" class="board-table">
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
        <el-table-column label="操作" width="100" align="center" fixed="right" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="detailVisible" title="考勤详情" width="560px">
      <el-descriptions v-if="detailRow" :column="1" border>
        <el-descriptions-item label="姓名">{{ detailRow.displayName }}</el-descriptions-item>
        <el-descriptions-item label="学工号">{{ detailRow.employeeNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="人员类型">{{ formatPersonKindLabel(detailRow.personKind) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="attendanceStatusTagType(detailRow.attendanceStatus)" size="small">
            {{ formatAttendanceStatus(detailRow.attendanceStatus) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="进出次数">{{ detailRow.passageCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="地点">{{ detailRow.locationName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="到达">{{ detailRow.arrivalAt || '—' }}</el-descriptions-item>
        <el-descriptions-item label="离开">{{ detailRow.departureAt || '—' }}</el-descriptions-item>
        <el-descriptions-item label="停留时长">
          {{ detailRow.attendanceStatus === 'absent' ? '—' : formatDuration(detailRow.dwellSeconds) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useDataBoardSummary } from '@/composables/useDataBoardSummary'
import AttendanceStatPanel from '@/views/dashboard/shared/AttendanceStatPanel.vue'
import { defaultQueryDate, isFutureDate } from '@/utils/statDateRange'
import {
  attendanceStatusTagType,
  formatAttendanceStatus,
  formatPersonKindLabel
} from '@/utils/personKind'

const queryRef = ref()
const detailVisible = ref(false)
const detailRow = ref(null)

const {
  loading,
  queryDate,
  timeRange,
  sessionFilters,
  summary,
  attendanceRows,
  personRows,
  loadSummary,
  formatDuration,
  resetQueryFilters
} = useDataBoardSummary({
  sessionFilterMode: true,
  attendanceListMode: true,
  singleDayTimeMode: true,
  recentLimit: 500
})

function formatRateDateLabel(dateStr) {
  const d = dateStr || defaultQueryDate()
  const today = defaultQueryDate()
  if (d === today) return '当日'
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[1]}-${parts[2]}`
  return d
}

const rateDateLabel = computed(() =>
  formatRateDateLabel(summary.value.beginDate || queryDate.value)
)

const statCards = computed(() => [
  {
    key: 'attendance',
    label: '考勤人数',
    value: summary.value.sessionCount ?? 0,
    tag: '汇总',
    color: 'blue',
    icon: 'Calendar',
    desc: `已知 ${summary.value.knownVisitorCount ?? 0} · 陌生 ${summary.value.strangerVisitorCount ?? 0}`
  },
  {
    key: 'open',
    label: '在场中',
    value: summary.value.openSessionCount ?? 0,
    tag: '实时',
    color: 'green',
    icon: 'View',
    desc: `当前在场人数为 ${summary.value.openSessionCount ?? 0} 人`
  },
  {
    key: 'visitor',
    label: '人员档案',
    value: personRows.value.length,
    tag: '档案',
    color: 'yellow',
    icon: 'User',
    desc: '已录入人脸与体态档案'
  },
  {
    key: 'attendanceRate',
    label: '出勤率',
    value: `${summary.value.attendanceRatePercent ?? 0}%`,
    tag: rateDateLabel.value,
    color: 'red',
    icon: 'PieChart',
    desc: `${rateDateLabel.value}出勤 ${summary.value.todayKnownAttendanceCount ?? 0} / 在案 ${summary.value.registeredPersonCount ?? 0} 人（不含陌生人）`
  }
])

function disableFutureDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return isFutureDate(`${y}-${m}-${d}`)
}

function openDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

function handleQuery() {
  loadSummary()
}

function handleRefresh() {
  loadSummary()
}

function resetQuery() {
  resetQueryFilters()
  loadSummary()
}
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';

.panel-extra {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
