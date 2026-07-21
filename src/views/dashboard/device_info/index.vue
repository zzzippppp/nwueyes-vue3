<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="设备名称" prop="deviceName">
        <el-input
          v-model="queryParams.deviceName"
          placeholder="请输入设备名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="设备序列号" prop="serialNo">
        <el-input
          v-model="queryParams.serialNo"
          placeholder="请输入设备序列号"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="在线状态" prop="onlineStatus">
        <el-select v-model="queryParams.onlineStatus" placeholder="在线状态" clearable style="width: 200px">
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Plus"
          @click="handleAdd"
          v-hasPermi="['dashboard:device-info:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['dashboard:device-info:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['dashboard:device-info:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['dashboard:device-info:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="deviceList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="设备编号" align="center" prop="id" width="90" />
      <el-table-column label="设备编码" align="center" prop="deviceCode" min-width="120" :show-overflow-tooltip="true" />
      <el-table-column label="设备名称" align="center" prop="deviceName" min-width="140" :show-overflow-tooltip="true" />
      <el-table-column label="设备序列号" align="center" prop="serialNo" min-width="140" :show-overflow-tooltip="true" />
      <el-table-column label="通道" align="center" prop="channelNo" width="80" />
      <el-table-column label="设备类型" align="center" prop="typeName" min-width="120" />
      <el-table-column label="安装位置" align="center" prop="installLocation" min-width="120" :show-overflow-tooltip="true" />
      <el-table-column label="在线状态" align="center" prop="onlineStatus" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.onlineStatus === 'online' ? 'success' : 'info'" size="small">
            {{ scope.row.onlineStatus === 'online' ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createdAt" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['dashboard:device-info:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['dashboard:device-info:remove']">删除</el-button>
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

    <el-dialog :title="title" v-model="open" width="640px" append-to-body>
      <el-form ref="deviceRef" :model="form" :rules="rules" label-width="100px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="设备名称" prop="deviceName">
              <el-input v-model="form.deviceName" placeholder="请输入设备名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设备序列号" prop="serialNo">
              <el-input v-model="form.serialNo" placeholder="萤石序列号（保存时校验是否真实设备）" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="设备编码" prop="deviceCode">
              <el-input v-model="form.deviceCode" placeholder="留空自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="通道号" prop="channelNo">
              <el-input-number v-model="form.channelNo" controls-position="right" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="设备类型" prop="typeId">
              <el-select v-model="form.typeId" placeholder="请选择设备类型" clearable style="width: 100%">
                <el-option
                  v-for="item in typeOptions"
                  :key="item.id"
                  :label="item.typeName"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="在线状态" prop="onlineStatus">
              <el-radio-group v-model="form.onlineStatus">
                <el-radio label="online">在线</el-radio>
                <el-radio label="offline">离线</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="验证码" prop="verifyCode">
              <el-input v-model="form.verifyCode" placeholder="未加密可留空" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="IP地址" prop="ipAddr">
              <el-input v-model="form.ipAddr" placeholder="可选" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="安装位置" prop="installLocation">
          <el-input v-model="form.installLocation" placeholder="可选" />
        </el-form-item>
        <el-row>
          <el-col :span="12">
            <el-form-item label="门线 Y" prop="lineY">
              <el-input-number v-model="form.lineY" controls-position="right" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="ROI" prop="roi">
              <el-input v-model="form.roi" placeholder="如 640,35,1250,680" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="DeviceInfo">
import { listDeviceInfo, getDeviceInfo, addDeviceInfo, updateDeviceInfo, delDeviceInfo } from '@/api/dashboard/device_info'
import { optionselectDeviceType } from '@/api/dashboard/device_type'

const { proxy } = getCurrentInstance()

const deviceList = ref([])
const typeOptions = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    deviceName: undefined,
    serialNo: undefined,
    onlineStatus: undefined
  },
  rules: {
    deviceName: [{ required: true, message: '设备名称不能为空', trigger: 'blur' }],
    serialNo: [{ required: true, message: '设备序列号不能为空', trigger: 'blur' }],
    channelNo: [{ required: true, message: '通道号不能为空', trigger: 'blur' }]
  }
})

const { queryParams, form, rules } = toRefs(data)

function getList() {
  loading.value = true
  listDeviceInfo(queryParams.value).then(response => {
    deviceList.value = response.rows
    total.value = response.total
    loading.value = false
  })
}

function loadTypeOptions() {
  optionselectDeviceType().then(res => {
    typeOptions.value = res.data || []
  })
}

function cancel() {
  open.value = false
  reset()
}

function reset() {
  form.value = {
    id: undefined,
    deviceCode: undefined,
    deviceName: undefined,
    serialNo: undefined,
    channelNo: 1,
    typeId: undefined,
    installLocation: undefined,
    ipAddr: undefined,
    verifyCode: '',
    onlineStatus: 'online',
    lineY: undefined,
    roi: undefined,
    refWidth: 1920,
    refHeight: 1080
  }
  proxy.resetForm('deviceRef')
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
  ids.value = selection.map(item => item.id)
  single.value = selection.length != 1
  multiple.value = !selection.length
}

function handleAdd() {
  reset()
  loadTypeOptions()
  open.value = true
  title.value = '添加设备信息'
}

function handleUpdate(row) {
  reset()
  loadTypeOptions()
  const id = row.id || ids.value
  getDeviceInfo(id).then(response => {
    form.value = response.data
    open.value = true
    title.value = '修改设备信息'
  })
}

function submitForm() {
  proxy.$refs['deviceRef'].validate(valid => {
    if (valid) {
      if (form.value.id != undefined) {
        updateDeviceInfo(form.value).then(() => {
          proxy.$modal.msgSuccess('修改成功')
          open.value = false
          getList()
        })
      } else {
        addDeviceInfo(form.value).then(() => {
          proxy.$modal.msgSuccess('新增成功')
          open.value = false
          getList()
        })
      }
    }
  })
}

function handleDelete(row) {
  const deviceIds = row.id || ids.value
  proxy.$modal.confirm('是否确认删除设备编号为"' + deviceIds + '"的数据项？').then(function () {
    return delDeviceInfo(deviceIds)
  }).then(() => {
    getList()
    proxy.$modal.msgSuccess('删除成功')
  }).catch(() => {})
}

function handleExport() {
  proxy.download('dashboard/device-info/export', {
    ...queryParams.value
  }, `device_info_${new Date().getTime()}.xlsx`)
}

loadTypeOptions()
getList()
</script>
