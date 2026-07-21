import request from '@/utils/request'

// 查询设备信息列表
export function listDeviceInfo(query) {
  return request({
    url: '/dashboard/device-info/list',
    method: 'get',
    params: query
  })
}

// 查询设备信息详细
export function getDeviceInfo(id) {
  return request({
    url: '/dashboard/device-info/' + id,
    method: 'get'
  })
}

// 新增设备信息（会调萤石校验，可能较慢）
export function addDeviceInfo(data) {
  return request({
    url: '/dashboard/device-info',
    method: 'post',
    data: data,
    timeout: 60000
  })
}

// 修改设备信息（改序列号时也会调萤石校验）
export function updateDeviceInfo(data) {
  return request({
    url: '/dashboard/device-info',
    method: 'put',
    data: data,
    timeout: 60000
  })
}

// 删除设备信息
export function delDeviceInfo(id) {
  return request({
    url: '/dashboard/device-info/' + id,
    method: 'delete'
  })
}
