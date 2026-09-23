<template>
  <div class="app-container home-dashboard">
    <!-- 顶部考勤信息卡片 -->
    <div class="stat-cards">
      <div class="stat-card is-blue">
        <div class="stat-card-icon"><el-icon :size="60"><Calendar /></el-icon></div>
        <div class="stat-card-label">考勤人数</div>
        <div class="stat-card-value">{{ knownAttendanceCount }}</div>
        <div class="stat-card-desc">今日考勤 {{ knownAttendanceCount }} 人</div>
      </div>
      <div class="stat-card is-green">
        <div class="stat-card-icon"><el-icon :size="60"><View /></el-icon></div>
        <div class="stat-card-label">在场中</div>
        <div class="stat-card-value">{{ knownOpenCount }}</div>
        <div class="stat-card-desc">当前在场 {{ knownOpenCount }} 人</div>
      </div>
      <div class="stat-card is-yellow">
        <div class="stat-card-icon"><el-icon :size="60"><User /></el-icon></div>
        <div class="stat-card-label">人员档案</div>
        <div class="stat-card-value">{{ registeredPersonCount }}</div>
        <div class="stat-card-desc">已录入学生和教职工档案</div>
      </div>
      <div class="stat-card is-red">
        <div class="stat-card-icon"><el-icon :size="60"><PieChart /></el-icon></div>
        <div class="stat-card-label">出勤率</div>
        <div class="stat-card-value">{{ summary.attendanceRatePercent ?? 0 }}%</div>
        <div class="stat-card-desc">出勤 {{ summary.todayKnownAttendanceCount ?? 0 }} / 在案 {{ summary.registeredPersonCount ?? 0 }} 人</div>
      </div>
    </div>

    <!-- 主体内容 -->
    <div class="main-content">
      <!-- 左侧：折线图 + 排行榜 -->
      <div class="left-panel">
        <!-- 周考勤折线图 -->
        <div class="panel-box chart-box">
          <div class="panel-title">
            <span class="title-accent" />
            近一周考勤人数
          </div>
          <div ref="chartRef" class="chart-container" />
        </div>

        <!-- 停留时长排行榜 -->
        <div class="panel-box rank-box">
          <div class="panel-title">
            <span class="title-accent" />
            停留时长排行
          </div>
          <el-table :data="rankRows" class="rank-table" size="small" :show-header="true" max-height="260">
            <el-table-column type="index" label="#" width="40" align="center" />
            <el-table-column prop="displayName" label="姓名" min-width="80" />
            <el-table-column prop="personKind" label="类型" width="70" align="center">
              <template #default="{ row }">{{ formatPersonKindLabel(row.personKind) }}</template>
            </el-table-column>
            <el-table-column prop="dwellSeconds" label="停留时长" width="100" align="center">
              <template #default="{ row }">{{ formatDuration(row.dwellSeconds) }}</template>
            </el-table-column>
            <el-table-column label="是否在场" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.attendanceStatus === 'present' ? 'warning' : 'success'" size="small">
                  {{ row.attendanceStatus === 'present' ? '在场' : '已离开' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进/出" width="80" align="center">
              <template #default="{ row }">{{ row.enterCount ?? 0 }}/{{ row.exitCount ?? 0 }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- 右侧：进出信息 -->
      <div class="right-panel">
        <div class="panel-box session-box">
          <div class="panel-title">
            <span class="title-accent" />
            最近进出记录
          </div>
          <div class="session-list">
            <div v-for="(item, idx) in recentLogs" :key="idx" class="session-item">
              <div class="session-avatar">
                <el-avatar :size="36" :src="resolveMediaUrl(item.faceImageUrl)" icon="UserFilled" />
              </div>
              <div class="session-info">
                <div class="session-name">
                  <span>{{ item.displayName || '未知' }}</span>
                  <el-tag :type="eventTagType(item.eventType)" size="small" class="session-tag">
                    {{ eventLabel(item.eventType) }}
                  </el-tag>
                </div>
                <div class="session-meta">
                  <span>{{ item.eventTime ? formatTime(item.eventTime) : '—' }}</span>
                </div>
              </div>
            </div>
            <div v-if="recentLogs.length === 0" class="empty-tip">暂无进出记录</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="Index">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Calendar, View, User, PieChart } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { getDataBoardSummary } from '@/api/dashboard/data_board'
import { formatPersonKindLabel } from '@/utils/personKind'

const chartRef = ref(null)
let chartInstance = null

const summary = ref({})
const personRows = ref([])
const recentLogs = ref([])
const weeklyData = ref([])

const apiBase = import.meta.env.VITE_APP_BASE_API || ''

const knownAttendanceCount = computed(() => Number(summary.value.todayKnownAttendanceCount ?? 0))
const knownOpenCount = computed(() => Number(summary.value.openSessionCount ?? 0))
const registeredPersonCount = computed(() => Number(summary.value.registeredPersonCount ?? 0))

const rankRows = computed(() => {
  const rows = [...(summary.value.attendanceItems || [])]
    .filter(r => r.attendanceStatus !== 'absent')
    .sort((a, b) => (b.dwellSeconds || 0) - (a.dwellSeconds || 0))
  return rows.slice(0, 10)
})

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

function formatTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function resolveMediaUrl(rawUrl) {
  if (!rawUrl) return ''
  if (/^(https?:|data:)/i.test(rawUrl)) return rawUrl
  let path = rawUrl
  if (path.startsWith('/face-library/')) {
    path = `/dashboard/data-board/file/face/${path.split('/').pop()}`
  } else if (path.startsWith('/body-library/')) {
    path = `/dashboard/data-board/file/body/${path.split('/').pop()}`
  }
  if (apiBase && path.startsWith(apiBase)) return path
  return apiBase ? apiBase + path : path
}

function eventLabel(eventType) {
  const map = { enter: '进门', exit: '出门' }
  return map[eventType] || eventType || '—'
}

function eventTagType(eventType) {
  const map = { enter: 'success', exit: 'warning' }
  return map[eventType] || 'info'
}

function getToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDateBefore(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekdayLabel(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const d = new Date(dateStr)
  return days[d.getDay()]
}

async function loadTodayData() {
  const today = getToday()
  try {
    const res = await getDataBoardSummary({
      beginDate: today,
      endDate: today,
      recentLimit: 20
    })
    const data = res.data || {}
    summary.value = data
    personRows.value = data.personItems || []
    recentLogs.value = (data.recentLogs || []).slice(0, 10)
  } catch (e) {
    console.error('加载今日数据失败', e)
  }
}

async function loadWeeklyData() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    days.push(getDateBefore(i))
  }

  const results = await Promise.all(
    days.map(date =>
      getDataBoardSummary({ beginDate: date, endDate: date, recentLimit: 1 }).then(res => ({
        date,
        label: getWeekdayLabel(date),
        count: res.data?.todayKnownAttendanceCount || 0
      })).catch(() => ({ date, label: getWeekdayLabel(date), count: 0 }))
    )
  )

  weeklyData.value = results
  renderChart()
}

function renderChart() {
  if (!chartRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const labels = weeklyData.value.map(d => d.label)
  const totalData = weeklyData.value.map(d => d.count)

  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: params => {
        let html = `<div style="font-weight:600;margin-bottom:6px">${params[0].name}</div>`
        params.forEach(p => {
          html += `<div>${p.marker} ${p.seriesName}：<b>${p.value}</b> 人</div>`
        })
        return html
      }
    },
    legend: {
      data: ['考勤人员'],
      bottom: 0,
      textStyle: { fontSize: 12 }
    },
    grid: {
      left: 40,
      right: 20,
      top: 20,
      bottom: 36
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#e0e0e0' } },
      axisLabel: { color: '#666', fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      name: '人数',
      nameTextStyle: { color: '#999', fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
      axisLabel: { color: '#999', fontSize: 12 }
    },
    series: [
      {
        name: '考勤人员',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64,158,255,0.25)' },
            { offset: 1, color: 'rgba(64,158,255,0.02)' }
          ])
        },
        data: totalData
      }
    ]
  })
}

let pollTimer = null

onMounted(() => {
  loadTodayData()
  loadWeeklyData()
  pollTimer = setInterval(() => {
    loadTodayData()
  }, 30000)

  nextTick(() => {
    renderChart()
  })

  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  chartInstance?.dispose()
  window.removeEventListener('resize', () => { chartInstance?.resize() })
})
</script>

<style scoped lang="scss">
.home-dashboard {
  padding: 16px 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 84px);
}

/* 顶部卡片 */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 120px;
  padding: 18px 20px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  color: #fff;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
  }

  &.is-blue { background: linear-gradient(135deg, #007bff 0%, #0062cc 100%); }
  &.is-green { background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%); }
  &.is-yellow {
    background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
    color: #1f2d3d;
    .stat-card-desc { color: rgba(31, 45, 61, 0.72); }
  }
  &.is-red { background: linear-gradient(135deg, #dc3545 0%, #bd2130 100%); }
}

.stat-card-icon {
  position: absolute;
  top: 10px;
  right: 14px;
  opacity: 0.25;
  pointer-events: none;
}

.stat-card-label {
  font-size: 14px;
  font-weight: 600;
  position: relative;
  z-index: 1;
}

.stat-card-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 8px;
  position: relative;
  z-index: 1;
}

.stat-card-desc {
  font-size: 12px;
  margin-top: auto;
  padding-top: 8px;
  color: rgba(255, 255, 255, 0.82);
  position: relative;
  z-index: 1;
}

/* 主体两栏 */
.main-content {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.right-panel {
  display: flex;
  flex-direction: column;
}

.panel-box {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  padding: 18px 20px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 14px;
}

.title-accent {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, #409eff 0%, #337ecc 100%);
}

/* 折线图 */
.chart-box {
  flex: 1;
  min-height: 280px;
}

.chart-container {
  width: 100%;
  height: 260px;
}

/* 排行榜 */
.rank-box {
  :deep(.rank-table.el-table) {
    font-size: 13px;
    .el-table__header-wrapper th {
      text-align: center;
      font-size: 13px;
      padding: 10px 0;
      background: #fafafa;
    }
    .el-table__body-wrapper td {
      text-align: center;
      padding: 8px 0;
    }
  }
}

/* 进出记录 */
.session-box {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  max-height: 520px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child { border-bottom: none; }
}

.session-avatar {
  flex-shrink: 0;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.session-tag {
  font-size: 11px !important;
  transform: scale(0.9);
  transform-origin: left center;
}

.session-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.empty-tip {
  text-align: center;
  color: #c0c4cc;
  padding: 40px 0;
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 1200px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .main-content {
    grid-template-columns: 1fr;
  }
}
</style>
