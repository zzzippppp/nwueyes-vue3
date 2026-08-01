import request from '@/utils/request'

export function listPerson(query) {
  return request({
    url: '/system/person/list',
    method: 'get',
    params: query
  })
}

export function getPerson(personId) {
  return request({
    url: '/system/person/' + personId,
    method: 'get'
  })
}

export function addPerson(formData) {
  return request({
    url: '/system/person',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function updatePerson(data) {
  return request({
    url: '/system/person',
    method: 'put',
    data: data
  })
}

export function delPerson(personId) {
  return request({
    url: '/system/person/' + personId,
    method: 'delete'
  })
}
