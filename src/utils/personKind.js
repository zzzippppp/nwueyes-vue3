const KNOWN_TYPES = new Set(['student', 'staff', 'known'])

const PERSON_KIND_LABELS = {
  student: '学生',
  staff: '教职工',
  stranger: '陌生人',
  known: '已知'
}

export function formatPersonKindLabel(kind) {
  if (!kind) return '未知'
  if (PERSON_KIND_LABELS[kind]) return PERSON_KIND_LABELS[kind]
  if (KNOWN_TYPES.has(kind)) return '已知'
  return kind
}

export function normalizeSessionRow(row) {
  if (!row) return row
  return {
    ...row,
    locationName: row.locationName || row.deviceName || '—',
    faceImageUrl: row.faceImageUrl || row.face_image_url || ''
  }
}

const ATTENDANCE_STATUS_LABELS = {
  absent: '未出勤',
  present: '在场中',
  left: '已离场'
}

const ATTENDANCE_STATUS_TAG = {
  absent: 'info',
  present: 'warning',
  left: 'success'
}

export function formatAttendanceStatus(status) {
  return ATTENDANCE_STATUS_LABELS[status] || status || '—'
}

export function attendanceStatusTagType(status) {
  return ATTENDANCE_STATUS_TAG[status] || 'info'
}
