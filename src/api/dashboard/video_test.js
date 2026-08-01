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

/** 对 YOLO 分析任务源视频做 AI 样貌/行为理解 */
export function runVideoAnalyzeAi(taskId, data = {}) {
  return request({
    url: `/ingest/presence/analyze/ai/${taskId}`,
    method: 'post',
    data,
    timeout: 60000
  })
}

/** 两张人脸对比：gallery=人脸库，camera=摄像头抓拍 */
export function compareFaces(formData) {
  return request({
    url: '/ingest/presence/face-compare',
    method: 'post',
    data: formData,
    timeout: 180000,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
