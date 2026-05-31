import request from '@/utils/request'

export function listBehaviorLogs(params) {
  return request({
    url: '/dashboard/behavior-log/list',
    method: 'get',
    params
  })
}

export function importBehaviorLogsFromVideo(data) {
  return request({
    url: '/dashboard/behavior-log/import-from-video',
    method: 'post',
    data,
    timeout: 60000
  })
}
