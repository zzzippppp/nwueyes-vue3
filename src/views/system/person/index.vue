<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="姓名" prop="displayName">
        <el-input
          v-model="queryParams.displayName"
          placeholder="请输入姓名"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="学工号" prop="employeeNo">
        <el-input
          v-model="queryParams.employeeNo"
          placeholder="请输入学工号"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="人员类型" prop="personType">
        <el-select v-model="queryParams.personType" placeholder="人员类型" clearable style="width: 200px">
          <el-option label="学生" value="student" />
          <el-option label="教职工" value="staff" />
          <el-option label="陌生人" value="stranger" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 200px">
          <el-option
            v-for="dict in sys_normal_disable"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:person:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate" v-hasPermi="['system:person:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['system:person:remove']">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="personList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="personId" width="80" />
      <el-table-column label="人脸" align="center" width="90">
        <template #default="scope">
          <el-image
            v-if="scope.row.faceImageUrl"
            :src="resolveMediaUrl(scope.row.faceImageUrl)"
            :preview-src-list="previewList(scope.row.faceImageUrl)"
            preview-teleported
            fit="cover"
            style="width: 48px; height: 48px; border-radius: 4px"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="姓名" align="center" prop="displayName" min-width="120" :show-overflow-tooltip="true" />
      <el-table-column label="学工号" align="center" prop="employeeNo" min-width="120" :show-overflow-tooltip="true">
        <template #default="scope">
          <span>{{ scope.row.employeeNo || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="人员类型" align="center" prop="personType" width="100">
        <template #default="scope">
          <el-tag :disable-transitions="true">{{ formatPersonKindLabel(scope.row.personType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="90">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="备注" align="center" prop="note" min-width="140" :show-overflow-tooltip="true" />
      <el-table-column label="创建时间" align="center" prop="createdAt" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="handleDetail(scope.row)" v-hasPermi="['system:person:query']">详情</el-button>
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:person:edit']">修改</el-button>
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

    <!-- 新增 / 修改 -->
    <el-dialog :title="title" v-model="open" width="560px" append-to-body>
      <el-form ref="personRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="姓名" prop="displayName">
          <el-input v-model="form.displayName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="学工号" prop="employeeNo">
          <el-input v-model="form.employeeNo" placeholder="请输入学工号（必填，不可重复）" />
        </el-form-item>
        <el-form-item label="人员类型" prop="personType">
          <el-select v-model="form.personType" placeholder="请选择类型" style="width: 100%">
            <el-option label="学生" value="student" />
            <el-option label="教职工" value="staff" />
            <el-option label="陌生人" value="stranger" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio label="0">男</el-radio>
            <el-radio label="1">女</el-radio>
            <el-radio label="2">未知</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号（可选）" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio
              v-for="dict in sys_normal_disable"
              :key="dict.value"
              :label="dict.value"
            >{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!form.personId" label="人脸照片" prop="faceFile">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept="image/*"
            list-type="picture-card"
            :on-change="onFaceChange"
            :on-remove="onFaceRemove"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注" prop="note">
          <el-input v-model="form.note" type="textarea" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 详情页已独立为 /system/person-detail/index/:personId -->
  </div>
</template>

<script setup name="PersonArchive">
import { Plus } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { listPerson, getPerson, addPerson, updatePerson, delPerson } from '@/api/system/person'
import { formatPersonKindLabel } from '@/utils/personKind'

const { proxy } = getCurrentInstance()
const { sys_normal_disable } = proxy.useDict('sys_normal_disable')
const router = useRouter()

const personList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const faceFile = ref(null)

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    displayName: undefined,
    employeeNo: undefined,
    personType: undefined,
    status: undefined
  },
  rules: {
    displayName: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
    employeeNo: [{ required: true, message: '学工号不能为空', trigger: 'blur' }],
    personType: [{ required: true, message: '人员类型不能为空', trigger: 'change' }]
  }
})

const { queryParams, form, rules } = toRefs(data)

const apiBase = import.meta.env.VITE_APP_BASE_API || ''

/** 库内路径 -> 后端文件接口，并加上 dev-api 代理前缀 */
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

function getList() {
  loading.value = true
  listPerson(queryParams.value).then(response => {
    personList.value = response.rows || []
    total.value = response.total || 0
    loading.value = false
  }).catch(() => {
    loading.value = false
  })
}

function cancel() {
  open.value = false
  reset()
}

function reset() {
  form.value = {
    personId: undefined,
    displayName: undefined,
    employeeNo: undefined,
    personType: 'student',
    status: '0',
    note: undefined,
    phone: undefined,
    gender: '0'
  }
  faceFile.value = null
  proxy.resetForm('personRef')
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}

function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.personId)
  single.value = selection.length !== 1
  multiple.value = !selection.length
}

function handleAdd() {
  reset()
  open.value = true
  title.value = '新增人员'
}

function handleUpdate(row) {
  reset()
  const personId = row?.personId || ids.value[0]
  getPerson(personId).then(response => {
    form.value = {
      personId: response.data.personId,
      displayName: response.data.displayName,
      employeeNo: response.data.employeeNo,
      personType: response.data.personType || 'student',
      status: response.data.status || '0',
      note: response.data.note,
      phone: response.data.phone,
      gender: response.data.gender || '0'
    }
    open.value = true
    title.value = '修改人员'
  })
}

function handleDetail(row) {
  router.push(`/system/person-detail/index/${row.personId}`)
}

function onFaceChange(file) {
  faceFile.value = file?.raw || null
}

function onFaceRemove() {
  faceFile.value = null
}

function submitForm() {
  proxy.$refs['personRef'].validate(valid => {
    if (!valid) return
    if (form.value.personId) {
      updatePerson(form.value).then(() => {
        proxy.$modal.msgSuccess('修改成功')
        open.value = false
        getList()
      })
      return
    }
    if (!faceFile.value) {
      proxy.$modal.msgError('请上传人脸照片')
      return
    }
    const fd = new FormData()
    fd.append('displayName', form.value.displayName || '')
    fd.append('personType', form.value.personType || 'student')
    if (form.value.employeeNo) fd.append('employeeNo', form.value.employeeNo)
    fd.append('status', form.value.status || '0')
    if (form.value.note) fd.append('note', form.value.note)
    if (form.value.phone) fd.append('phone', form.value.phone)
    fd.append('gender', form.value.gender || '0')
    if (faceFile.value) fd.append('faceFile', faceFile.value)
    addPerson(fd).then(() => {
      proxy.$modal.msgSuccess('新增成功')
      open.value = false
      getList()
    })
  })
}

function handleDelete(row) {
  const personIds = row?.personId || ids.value
  proxy.$modal.confirm('是否确认删除人员编号为"' + personIds + '"的数据项？').then(() => {
    return delPerson(personIds)
  }).then(() => {
    getList()
    proxy.$modal.msgSuccess('删除成功')
  }).catch(() => {})
}

onActivated(() => {
  getList()
})

getList()
</script>
