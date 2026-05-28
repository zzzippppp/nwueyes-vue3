import request from "@/utils/request";

// 获取监控大屏播放配置
export function getMonitorScreenConfig() {
  return request({
    url: "/monitor/screen/config",
    method: "get"
  });
}
