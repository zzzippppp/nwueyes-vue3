import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteDataBoardPerson,
  deleteDataBoardSession,
  deleteDataBoardStranger,
  getDataBoardSummary,
  updateDataBoardLocation,
  updateDataBoardPerson,
  updateDataBoardSession,
  updateDataBoardStranger,
  uploadDataBoardFace
} from '@/api/dashboard/data_board'
import { dateRangeParams, defaultDateRange, defaultDateRangeLastDays, defaultTimeRange, defaultQueryDate, singleDayTimeParams } from '@/utils/statDateRange'
import { formatPersonKindLabel, normalizeSessionRow } from '@/utils/personKind'

export function useDataBoardSummary(options = {}) {
  const {
    pollInterval = 30000,
    autoLoad = true,
    initialDateRange = defaultDateRange,
    sessionFilterMode = false,
    attendanceListMode = false,
    singleDayHourMode = false,
    singleDayTimeMode = false,
    recentLimit = 20
  } = options

  const useSingleDayTime = singleDayTimeMode || singleDayHourMode

  const loading = ref(false)
  const dateRange = ref(initialDateRange())
  const queryDate = ref(defaultQueryDate())
  const timeRange = ref(defaultTimeRange())
  const hourRange = timeRange
  const locationId = ref()
  const sessionFilters = ref({
    displayName: '',
    employeeNo: '',
    personType: '',
    sessionStatus: ''
  })
  const summary = ref({})
  const tableHeight = ref(420)
  const sessionRows = ref([])
  const attendanceRows = ref([])
  const personRows = ref([])
  const strangerRows = ref([])
  const locationRows = ref([])
  const editDialogVisible = ref(false)
  const uploadDialogVisible = ref(false)
  const editMode = ref('session')
  const editForm = reactive({})
  const uploadFormRef = ref()
  const uploadForm = reactive({
    personId: null,
    displayName: '',
    personKind: 'known',
    tagsText: '',
    note: '',
    faceImageUrl: ''
  })
  const uploadRules = {
    displayName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    faceImageUrl: [{ required: true, message: '请上传头像', trigger: 'change' }]
  }

  let pollTimer = null
  const apiBase = import.meta.env.VITE_APP_BASE_API || ''

  function updateTableHeight() {
    tableHeight.value = Math.max(360, window.innerHeight - 320)
  }

  const locationOptions = computed(() => {
    return (summary.value.byLocation || []).map(item => ({
      locationId: item.locationId ?? item.cameraId,
      locationName: item.locationName ?? item.deviceName
    }))
  })

  function rowFaceUrl(row) {
    return row?.faceImageUrl || row?.face_image_url || ''
  }

  function rowBodyUrl(row) {
    return row?.bodyImageUrl || row?.body_image_url || ''
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

  function buildSessionFilterParams() {
    if (!sessionFilterMode) {
      return {}
    }
    const params = {}
    const f = sessionFilters.value
    if (f.displayName?.trim()) params.displayName = f.displayName.trim()
    if (f.employeeNo?.trim()) params.employeeNo = f.employeeNo.trim()
    if (f.personType) params.personType = f.personType
    if (f.sessionStatus) params.sessionStatus = f.sessionStatus
    return params
  }

  function buildQueryParams() {
    if (useSingleDayTime) {
      return singleDayTimeParams(queryDate.value, timeRange.value)
    }
    return dateRangeParams(dateRange.value)
  }

  function normalizeLocationRow(item) {
    const cameraId = item.cameraId ?? item.locationId
    const deviceName = item.deviceName ?? item.locationName ?? ''
    return {
      ...item,
      cameraId,
      locationId: cameraId,
      deviceName,
      locationName: deviceName
    }
  }

  function loadSummary() {
    loading.value = true
    return getDataBoardSummary({
      ...buildQueryParams(),
      cameraId: locationId.value,
      recentLimit,
      ...buildSessionFilterParams()
    }).then(res => {
      const data = res.data || {}
      summary.value = data
      sessionRows.value = (data.recentSessions || []).map(normalizeSessionRow)
      attendanceRows.value = (data.attendanceItems || []).map(row => ({
        ...row,
        locationName: row.locationName || row.deviceName || '—'
      }))
      personRows.value = (data.personItems || []).map(row => ({
        ...row,
        faceImageUrl: row.faceImageUrl || row.face_image_url || '',
        bodyImageUrl: row.bodyImageUrl || row.body_image_url || ''
      }))
      strangerRows.value = (data.strangerItems || []).map(item => ({
        ...item,
        identityType: item.identityType || 'stranger'
      }))
      locationRows.value = (data.byLocation || []).map(normalizeLocationRow)
      if (useSingleDayTime) {
        if (data.beginDate || data.statDate) {
          queryDate.value = data.beginDate || data.statDate
        }
      } else if ((!dateRange.value || !dateRange.value[0]) && (data.beginDate || data.statDate)) {
        const begin = data.beginDate || data.statDate
        const end = data.endDate || begin
        dateRange.value = [begin, end]
      }
    }).finally(() => {
      loading.value = false
    })
  }

  function openEdit(type, row) {
    editMode.value = type
    Object.keys(editForm).forEach(key => delete editForm[key])
    Object.assign(editForm, JSON.parse(JSON.stringify(row)))
    if (type === 'stranger') {
      editForm.identityType = editForm.identityType || 'stranger'
    }
    editDialogVisible.value = true
  }

  function removeRow(type, row) {
    const map = { session: '停留记录', person: '人员档案', stranger: '陌生人研判', location: '设备信息' }
    const label = map[type]
    if (type === 'location') {
      ElMessage.warning('设备删除接口尚未接入')
      return
    }
    if (!label) return
    ElMessageBox.confirm(`确认删除该${label}吗？`, '提示', { type: 'warning' })
      .then(async () => {
        if (type === 'session') await deleteDataBoardSession(row.sessionId)
        else if (type === 'person') await deleteDataBoardPerson(row.personId)
        else if (type === 'stranger') await deleteDataBoardStranger(row.trackKey)
        await loadSummary()
        ElMessage.success('删除成功')
      })
      .catch(() => {})
  }

  async function saveEdit() {
    try {
      if (editMode.value === 'session') {
        await updateDataBoardSession(editForm.sessionId, { status: editForm.status })
      } else if (editMode.value === 'person') {
        await updateDataBoardPerson(editForm.personId, {
          displayName: editForm.displayName,
          personKind: editForm.personKind,
          tagsText: editForm.tagsText,
          note: editForm.note
        })
      } else if (editMode.value === 'stranger') {
        await updateDataBoardStranger(editForm.trackKey, {
          displayName: editForm.displayName,
          tagsText: editForm.tagsText,
          identityType: editForm.identityType
        })
      } else if (editMode.value === 'location') {
        const cameraId = editForm.cameraId ?? editForm.locationId
        if (!cameraId) {
          ElMessage.error('设备 ID 缺失，无法保存')
          return
        }
        await updateDataBoardLocation(cameraId, {
          deviceName: (editForm.deviceName ?? editForm.locationName ?? '').trim()
        })
      }
      await loadSummary()
      ElMessage.success('保存成功')
    } finally {
      editDialogVisible.value = false
    }
  }

  function handleAvatarUpload(file) {
    uploadForm.avatarFile = file.raw
    const reader = new FileReader()
    reader.onload = e => {
      uploadForm.faceImageUrl = e.target?.result || ''
    }
    reader.readAsDataURL(file.raw)
  }

  function openUploadDialog() {
    Object.assign(uploadForm, {
      personId: null,
      displayName: '',
      personKind: 'known',
      tagsText: '',
      note: '',
      faceImageUrl: '',
      avatarFile: null
    })
    uploadDialogVisible.value = true
  }

  async function submitUpload() {
    if (!uploadFormRef.value) return
    uploadFormRef.value.validate(async valid => {
      if (!valid) return
      if (!uploadForm.avatarFile) {
        ElMessage.warning('请先选择头像图片')
        return
      }
      const formData = new FormData()
      formData.append('displayName', uploadForm.displayName)
      formData.append('personKind', uploadForm.personKind)
      formData.append('tagsText', uploadForm.tagsText || '')
      formData.append('note', uploadForm.note || '')
      formData.append('avatarfile', uploadForm.avatarFile)
      await uploadDataBoardFace(formData)
      await loadSummary()
      ElMessage.success('上传成功')
      uploadDialogVisible.value = false
    })
  }

  function resetQueryFilters() {
    if (useSingleDayTime) {
      queryDate.value = defaultQueryDate()
      timeRange.value = defaultTimeRange()
    } else {
      dateRange.value = initialDateRange()
    }
    locationId.value = undefined
    if (sessionFilterMode) {
      sessionFilters.value = {
        displayName: '',
        employeeNo: '',
        personType: '',
        sessionStatus: ''
      }
    }
  }

  onMounted(() => {
    updateTableHeight()
    window.addEventListener('resize', updateTableHeight)
    if (autoLoad) {
      loadSummary()
      if (pollInterval > 0) {
        pollTimer = window.setInterval(loadSummary, pollInterval)
      }
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateTableHeight)
    if (pollTimer) clearInterval(pollTimer)
  })

  return {
    loading,
    dateRange,
    queryDate,
    timeRange,
    hourRange,
    locationId,
    sessionFilters,
    summary,
    tableHeight,
    sessionRows,
    attendanceRows,
    personRows,
    strangerRows,
    locationRows,
    editDialogVisible,
    uploadDialogVisible,
    editMode,
    editForm,
    uploadFormRef,
    uploadForm,
    uploadRules,
    locationOptions,
    loadSummary,
    rowFaceUrl,
    rowBodyUrl,
    resolveMediaUrl,
    previewList,
    formatDuration,
    openEdit,
    removeRow,
    saveEdit,
    handleAvatarUpload,
    openUploadDialog,
    submitUpload,
    resetQueryFilters,
    defaultDateRange,
    defaultDateRangeLastDays,
    defaultQueryDate,
    defaultTimeRange,
    defaultHourRange: defaultTimeRange,
    formatPersonKindLabel
  }
}
