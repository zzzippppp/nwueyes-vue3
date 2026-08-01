import request from "@/utils/request";

export function getMonitorScreenConfig() {
  return request({
    url: "/monitor/screen/config",
    method: "get"
  });
}

export function startLanPreview(data) {
  return request({
    url: "/monitor/screen/preview/start",
    method: "post",
    data,
    timeout: 30000
  });
}

export function stopLanPreview(cameraId) {
  return request({
    url: `/monitor/screen/preview/stop/${cameraId}`,
    method: "post",
    timeout: 15000
  });
}

export function startLiveRecognize(data) {
  return request({
    url: "/monitor/screen/live/start",
    method: "post",
    data,
    timeout: 30000
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

export function captureProbeFrame(data) {
  return request({
    url: "/monitor/screen/probe-frame",
    method: "post",
    data,
    timeout: 120000
  });
}

export function updateDoorConfig(data) {
  return request({
    url: "/monitor/screen/door-config",
    method: "post",
    data,
    timeout: 30000
  });
}
