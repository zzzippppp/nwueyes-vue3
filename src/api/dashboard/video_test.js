import request from '@/utils/request'

export function uploadVideoTestFile(formData, onUploadProgress) {
  return request({
    url: '/common/upload',
    method: 'post',
    data: formData,
    timeout: 120000,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress
  })
}

export function getPresenceDoorConfig() {
  return request({
    url: '/ingest/presence/door-config',
    method: 'get'
  })
}

export function startVideoAnalyzeTest(data) {
  return request({
    url: '/ingest/presence/analyze/start',
    method: 'post',
    data
  })
}

export function getVideoAnalyzeStatus(taskId) {
  return request({
    url: `/ingest/presence/replay/status/${taskId}`,
    method: 'get'
  })
}

export function embedAnalyzeCaptures(taskId) {
  return request({
    url: `/ingest/presence/analyze/embed/${taskId}`,
    method: 'post',
    timeout: 300000
  })
}

export function matchAnalyzeEvents(taskId) {
  return request({
    url: `/ingest/presence/analyze/match/${taskId}`,
    method: 'post',
    timeout: 600000
  })
}
