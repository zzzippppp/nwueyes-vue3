<template>
  <div class="app-container board-page">
    <div class="tab-actions">
      <el-button type="primary" @click="openCreate">新增类型</el-button>
      <el-button :loading="loading" @click="loadRows">刷新</el-button>
    </div>
    <el-table v-loading="loading" :data="rows" class="board-table">
      <el-table-column prop="typeCode" label="类型编码" min-width="140" />
      <el-table-column prop="typeName" label="类型名称" min-width="160" />
      <el-table-column prop="remark" label="说明" min-width="240">
        <template #default="{ row }">{{ row.remark || '—' }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
      <el-table-column label="操作" width="160" align="center" fixed="right" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="removeRow(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="类型编码" prop="typeCode">
          <el-input v-model="form.typeCode" :disabled="!!form.id" placeholder="如 ipc / bullet" />
        </el-form-item>
        <el-form-item label="类型名称" prop="typeName">
          <el-input v-model="form.typeName" placeholder="如 枪机 / 鱼眼摄像机" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRow">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createDeviceType, deleteDeviceType, listDeviceTypes, updateDeviceType } from '@/api/dashboard/device_type'

const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增类型')
const formRef = ref()
const form = reactive({
  id: null,
  typeCode: '',
  typeName: '',
  remark: ''
})
const rules = {
  typeCode: [{ required: true, message: '请输入类型编码', trigger: 'blur' }],
  typeName: [{ required: true, message: '请输入类型名称', trigger: 'blur' }]
}

function resetForm() {
  Object.assign(form, { id: null, typeCode: '', typeName: '', remark: '' })
}

async function loadRows() {
  loading.value = true
  try {
    const res = await listDeviceTypes()
    rows.value = res?.data || res || []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogTitle.value = '新增类型'
  dialogVisible.value = true
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    typeCode: row.typeCode,
    typeName: row.typeName,
    remark: row.remark || ''
  })
  dialogTitle.value = '编辑类型'
  dialogVisible.value = true
}

async function saveRow() {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    saving.value = true
    try {
      const payload = {
        typeCode: form.typeCode,
        typeName: form.typeName,
        remark: form.remark
      }
      if (form.id) {
        await updateDeviceType(form.id, payload)
      } else {
        await createDeviceType(payload)
      }
      dialogVisible.value = false
      await loadRows()
      ElMessage.success('保存成功')
    } finally {
      saving.value = false
    }
  })
}

function removeRow(row) {
  ElMessageBox.confirm(`确认删除类型「${row.typeName}」吗？`, '提示', { type: 'warning' })
    .then(async () => {
      await deleteDeviceType(row.id)
      await loadRows()
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

onMounted(loadRows)
</script>

<style scoped lang="scss">
@import '@/views/dashboard/shared/board-page.scss';
</style>
