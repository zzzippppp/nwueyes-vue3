<template>
  <div class="app-container behavior-log-page">
    <el-row :gutter="12" class="toolbar">
      <el-col :span="6">
        <el-date-picker
          v-model="statDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
          @change="loadRows"
        />
      </el-col>
      <el-col :span="6">
        <el-select v-model="locationId" clearable placeholder="全部地点" style="width: 100%" @change="loadRows">
          <el-option v-for="item in locationOptions" :key="item.locationId" :label="item.locationName" :value="item.locationId" />
        </el-select>
      </el-col>
      <el-col :span="6">
        <el-select v-model="eventType" clearable placeholder="全部行为" style="width: 100%" @change="loadRows">
          <el-option label="进门" value="enter" />
          <el-option label="出门" value="exit" />
        </el-select>
      </el-col>
      <el-col :span="6" class="toolbar-actions">
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
      </el-col>
    </el-row>

    <el-table v-loading="loading" :data="rows" size="small" border stripe :height="tableHeight">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="displayName" label="名称" min-width="140" />
      <el-table-column prop="eventType" label="行为" width="90">
        <template #default="{ row }">
          <el-tag :type="row.eventType === 'enter' ? 'success' : 'warning'" size="small">
            {{ row.eventType === 'enter' ? '进门' : '出门' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="eventTime" label="时间" min-width="165" />
      <el-table-column prop="locationName" label="地点" min-width="120" />
      <el-table-column prop="trackKey" label="轨迹" min-width="120" />
      <el-table-column prop="personKind" label="类型" width="90">
        <template #default="{ row }">{{ personKindText(row.personKind) }}</template>
      </el-table-column>
      <el-table-column prop="source" label="来源" width="100" />
      <el-table-column label="人脸" width="90">
        <template #default="{ row }">
          <el-image
            v-if="row.faceImageUrl"
            :src="resolveMediaUrl(row.faceImageUrl)"
            :preview-src-list="previewList(row.faceImageUrl)"
            preview-teleported
            fit="cover"
            class="thumb"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="人体" width="90">
        <template #default="{ row }">
          <el-image
            v-if="row.bodyImageUrl"
            :src="resolveMediaUrl(row.bodyImageUrl)"
            :preview-src-list="previewList(row.bodyImageUrl)"
            preview-teleported
            fit="cover"
            class="thumb"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { listBehaviorLogs } from '@/api/dashboard/behavior_log'
import { getDataBoardSummary } from '@/api/dashboard/data_board'

const apiBase = import.meta.env.VITE_APP_BASE_API || ''
const loading = ref(false)
const rows = ref([])
const statDate = ref(defaultStatDate())
const locationId = ref(undefined)
const eventType = ref(undefined)
const locationOptions = ref([])
const tableHeight = ref(560)

function defaultStatDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function personKindText(kind) {
  if (kind === 'known') return '已知'
  if (kind === 'stranger') return '陌生'
  return '未知'
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

function previewList(rawUrl) {
  const url = resolveMediaUrl(rawUrl)
  return url ? [url] : []
}

async function loadLocations() {
  const res = await getDataBoardSummary({ statDate: statDate.value, recentLimit: 1 })
  const data = res?.data || res || {}
  locationOptions.value = data.locations || []
}

async function loadRows() {
  loading.value = true
  try {
    const res = await listBehaviorLogs({
      statDate: statDate.value,
      locationId: locationId.value,
      eventType: eventType.value
    })
    rows.value = res?.data || res || []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadLocations()
  await loadRows()
})
</script>

<style scoped lang="scss">
.behavior-log-page {
  .toolbar {
    margin-bottom: 12px;
  }

  .toolbar-actions {
    display: flex;
    justify-content: flex-end;
  }

  .thumb {
    width: 48px;
    height: 48px;
    border-radius: 4px;
  }
}
</style>
