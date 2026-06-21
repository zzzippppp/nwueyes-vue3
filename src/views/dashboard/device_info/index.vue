<template>
  <div class="app-container board-page">
    <div class="tab-actions">
      <el-button :loading="loading" @click="loadSummary">刷新</el-button>
    </div>
    <el-table v-loading="loading" :data="locationRows" class="board-table">
      <el-table-column prop="locationName" label="设备名称" min-width="260" />
      <el-table-column prop="deviceSerial" label="设备序列号" min-width="180" />
      <el-table-column prop="channelNo" label="通道" min-width="100" />
      <el-table-column label="操作" width="90" align="center" fixed="right" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit('location', row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="editDialogVisible" title="编辑设备信息" width="560px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="设备名称">
          <el-input v-model="editForm.locationName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { useDataBoardSummary } from '@/composables/useDataBoardSummary'

const {
  loading, locationRows, editDialogVisible, editForm,
  loadSummary, openEdit, saveEdit
} = useDataBoardSummary({ pollInterval: 0 })
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';
</style>
