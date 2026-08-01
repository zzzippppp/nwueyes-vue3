import request from '@/utils/request'

export function listAttendance(query) {
  return request({
    url: '/dashboard/attendance/list',
    method: 'get',
    params: query
  })
}

export function getAttendanceDashboard(params) {
  return request({
    url: '/dashboard/attendance/dashboard',
    method: 'get',
    params
  })
}

export function addAttendance(data) {
  return request({
    url: '/dashboard/attendance/manual',
    method: 'post',
    data
  })
}

export function updateAttendance(data) {
  return request({
    url: '/dashboard/attendance/manual',
    method: 'put',
    data
  })
}
