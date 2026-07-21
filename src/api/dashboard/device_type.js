import request from '@/utils/request'

// 查询设备类型列表
export function listDeviceType(query) {
  return request({
    url: '/dashboard/device-type/list',
    method: 'get',
    params: query
  })
}

// 查询设备类型详细
export function getDeviceType(id) {
  return request({
    url: '/dashboard/device-type/' + id,
    method: 'get'
  })
}

// 新增设备类型
export function addDeviceType(data) {
  return request({
    url: '/dashboard/device-type',
    method: 'post',
    data: data
  })
}

// 修改设备类型
export function updateDeviceType(data) {
  return request({
    url: '/dashboard/device-type',
    method: 'put',
    data: data
  })
}

// 删除设备类型
export function delDeviceType(id) {
  return request({
    url: '/dashboard/device-type/' + id,
    method: 'delete'
  })
}

// 设备类型下拉
export function optionselectDeviceType() {
  return request({
    url: '/dashboard/device-type/optionselect',
    method: 'get'
  })
}

/** @deprecated 兼容旧调用 */
export function listDeviceTypes() {
  return listDeviceType({ pageNum: 1, pageSize: 1000 }).then(res => ({
    ...res,
    data: res.rows || []
  }))
}

/** @deprecated */
export function createDeviceType(data) {
  return addDeviceType(data)
}

/** @deprecated */
export function deleteDeviceType(id) {
  return delDeviceType(id)
}
