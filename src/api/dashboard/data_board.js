import request from '@/utils/request'

// 数据看板汇总
export function getDataBoardSummary(params) {
  return request({
    url: '/dashboard/data-board/summary',
    method: 'get',
    params
  })
}

export function updateDataBoardPerson(personId, data) {
  return request({
    url: `/dashboard/data-board/persons/${personId}`,
    method: 'put',
    data
  })
}

export function deleteDataBoardPerson(personId) {
  return request({
    url: `/dashboard/data-board/persons/${personId}`,
    method: 'delete'
  })
}

export function updateDataBoardSession(sessionId, data) {
  return request({
    url: `/dashboard/data-board/sessions/${sessionId}`,
    method: 'put',
    data
  })
}

export function deleteDataBoardSession(sessionId) {
  return request({
    url: `/dashboard/data-board/sessions/${sessionId}`,
    method: 'delete'
  })
}

export function updateDataBoardStranger(trackKey, data) {
  return request({
    url: `/dashboard/data-board/strangers/${encodeURIComponent(trackKey)}`,
    method: 'put',
    data
  })
}

export function deleteDataBoardStranger(trackKey) {
  return request({
    url: `/dashboard/data-board/strangers/${encodeURIComponent(trackKey)}`,
    method: 'delete'
  })
}

export function updateDataBoardLocation(locationId, data) {
  return request({
    url: `/dashboard/data-board/cameras/${locationId}`,
    method: 'put',
    data
  })
}

export function mergeStrangerToPerson(trackKey, targetPersonId) {
  return request({
    url: `/dashboard/data-board/strangers/${encodeURIComponent(trackKey)}/merge`,
    method: 'post',
    data: { targetPersonId }
  })
}

export function searchPersons(keyword = ' ') {
  // RuoYi 的 tansParams 会过滤空字符串，预加载人员列表时传空格占位
  const q = keyword === '' || keyword == null ? ' ' : keyword
  return request({
    url: '/dashboard/data-board/persons/search',
    method: 'get',
    params: { keyword: q }
  })
}

export function uploadDataBoardFace(formData) {
  return request({
    url: '/dashboard/data-board/persons/upload-face',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
