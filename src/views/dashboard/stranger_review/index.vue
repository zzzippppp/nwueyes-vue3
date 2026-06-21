<template>
  <div class="app-container board-page">
    <el-form ref="queryRef" :inline="true" class="query-form">
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

    <el-dialog v-model="editDialogVisible" title="陌生人研判" width="560px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="editForm.displayName" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editForm.tagsText" />
        </el-form-item>
        <el-form-item label="身份">
          <el-select v-model="editForm.identityType" style="width: 100%">
            <el-option label="陌生人" value="stranger" />
            <el-option label="人员" value="known" />
          </el-select>
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
import { ref } from 'vue'
import { useDataBoardSummary } from '@/composables/useDataBoardSummary'

const queryRef = ref()
const {
  loading, locationId, strangerRows, editDialogVisible,
  editForm, locationOptions, loadSummary, rowFaceUrl, resolveMediaUrl,
  previewList, openEdit, removeRow, saveEdit, resetQueryFilters
} = useDataBoardSummary()

function handleQuery() {
  loadSummary()
}

function resetQuery() {
  resetQueryFilters()
  loadSummary()
}
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';
</style>
