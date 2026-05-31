import request from "@/utils/request";

export function getMonitorScreenConfig() {
  return request({
    url: "/monitor/screen/config",
    method: "get"
  });
}

export function startLiveRecognize(data) {
  return request({
    url: "/monitor/screen/live/start",
    method: "post",
    data,
    timeout: 90000
  });
}

export function stopLiveRecognize(taskId) {
  return request({
    url: `/monitor/screen/live/stop/${taskId}`,
    method: "post",
    timeout: 30000
  });
}

export function getLiveRecognizeStatus(taskId) {
  return request({
    url: `/monitor/screen/live/status/${taskId}`,
    method: "get"
  });
}

export function getActiveLiveRecognize() {
  return request({
    url: "/monitor/screen/live/active",
    method: "get"
  });
}
