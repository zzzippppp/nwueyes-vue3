import request from '@/utils/request'

export function listDeviceTypes() {
  return request({
    url: '/dashboard/device-type/list',
    method: 'get'
  })
}

export function createDeviceType(data) {
  return request({
    url: '/dashboard/device-type',
    method: 'post',
    data
  })
}

export function updateDeviceType(id, data) {
  return request({
    url: `/dashboard/device-type/${id}`,
    method: 'put',
    data
  })
}

export function deleteDeviceType(id) {
  return request({
    url: `/dashboard/device-type/${id}`,
    method: 'delete'
  })
}
