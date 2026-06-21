<template>
  <div class="app-container monitor-screen-page">
    <el-row :gutter="20">
      <el-col :xs="24" :lg="8">
        <el-card class="config-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <svg-icon icon-class="monitor" class="card-icon" />
                播放配置
              </span>
              <el-tag size="small" type="info">后端自动取配置</el-tag>
            </div>
          </template>

          <el-alert
            title="萤石 accessToken 和设备列表已改为由后端自动获取，前端不再保存 AppSecret。"
            type="success"
            :closable="false"
            show-icon
          />

          <div class="config-status">
            <el-tag :type="configStatusType" size="small">{{ configStatusText }}</el-tag>
            <el-button link type="primary" :loading="configLoading" @click="fetchScreenConfig(true)">
              刷新配置
            </el-button>
          </div>

          <el-form
            ref="configRef"
            :model="form"
            :rules="rules"
            label-width="96px"
            class="config-form"
          >
            <el-form-item label="设备列表" prop="deviceSerial">
              <el-select
                v-model="form.deviceSerial"
                placeholder="请选择设备"
                filterable
                clearable
                :loading="configLoading"
                @change="handleDeviceChange"
              >
                <el-option
                  v-for="device in deviceOptions"
                  :key="device.deviceSerial"
                  :label="formatDeviceLabel(device)"
                  :value="device.deviceSerial"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="通道号" prop="channelNo">
              <el-input-number
                v-model="form.channelNo"
                :min="1"
                :step="1"
                controls-position="right"
              />
            </el-form-item>

            <el-form-item label="设备验证码">
              <el-input
                v-model.trim="form.validCode"
                placeholder="视频加密开启时必填；已关加密可留空"
              />
            </el-form-item>

            <el-form-item label="识别拉流">
              <el-radio-group v-model="form.streamMode">
                <el-radio label="cloud_hls">公网云转发 (推荐)</el-radio>
                <el-radio label="lan_rtsp">局域网 RTSP</el-radio>
              </el-radio-group>
              <div class="stream-mode-tip">
                公网模式经萤石云 HLS 中转（主码流）。若识别服务器与摄像头同网，优先选「局域网 RTSP」。
              </div>
              <el-alert
                v-if="form.streamMode === 'lan_rtsp'"
                type="info"
                :closable="false"
                show-icon
                class="rtsp-help-alert"
                title="萤石 App 开启 RTSP：我的 → 工具 → 局域网设备预览 → 扫描设备 → 进入设置 → 更多设置 → 本地服务 → 开启 RTSP → 保存"
              />
            </el-form-item>

            <el-form-item label="识别状态">
              <el-tag :type="recognizeStatusTagType" size="small">{{ recognizeStatusText }}</el-tag>
            </el-form-item>

            <el-alert
              v-if="recognizeStatus === 'failed' && recognizeMessage"
              type="error"
              :closable="true"
              show-icon
              class="recognize-fail-alert"
              :title="recognizeMessage"
            >
              <template v-if="recognizeLogTailPreview" #default>
                <div class="log-tail-label">日志摘要（可在 Network → live/status 查看完整 logTail）：</div>
                <pre class="log-tail-preview">{{ recognizeLogTailPreview }}</pre>
              </template>
            </el-alert>

            <el-form-item label="默认开声">
              <el-switch v-model="form.audioEnabled" />
            </el-form-item>

            <el-form-item label="播放地址">
              <el-input :model-value="playUrl" readonly />
            </el-form-item>

            <el-form-item class="action-row">
              <el-button
                type="primary"
                :loading="starting"
                :disabled="configLoading || !accessToken"
                @click="handlePreview"
              >
                开始预览
              </el-button>
              <el-button :disabled="!hasPlayer" @click="handleStop">
                停止播放
              </el-button>
            </el-form-item>

            <el-form-item class="action-row">
              <el-button
                type="success"
                :loading="recognizeStarting"
                :disabled="recognizeRunning || configLoading || !form.deviceSerial"
                @click="handleStartRecognize"
              >
                开始识别
              </el-button>
              <el-button
                type="warning"
                :disabled="!recognizeTaskId"
                :loading="recognizeStopping"
                @click="handleStopRecognize"
              >
                停止识别
              </el-button>
            </el-form-item>

            <el-form-item class="action-row">
              <el-button :disabled="!hasPlayer" @click="handleOpenSound">
                打开声音
              </el-button>
              <el-button :disabled="!hasPlayer" @click="handleCloseSound">
                关闭声音
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="tips-card" shadow="never">
          <template #header>
            <span>接入说明</span>
          </template>
          <ol class="tips-list">
            <li>后端会自动根据萤石 `appKey/appSecret` 换取 `accessToken`。</li>
            <li>页面会自动拉取设备列表，你只需要选择设备并开始播放。</li>
            <li>如果设备开启了视频加密，再手动补充设备验证码。</li>
          </ol>
          <el-text type="info" size="small">
            如果设备列表为空，通常是账号下还没有可用设备，或当前萤石账号未授权该设备。
          </el-text>
          <el-text v-if="configError" type="danger" size="small" class="config-error">
            {{ configError }}
          </el-text>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="16">
        <el-card class="player-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>实时监控</span>
              <el-tag :type="statusTagType" size="small">{{ statusText }}</el-tag>
            </div>
          </template>

          <div ref="playerShellRef" class="player-shell">
            <div id="ezviz-monitor-player" class="player-host" />
            <div v-if="!hasPlayer" class="player-empty">
              <el-empty :description="emptyDescription" />
            </div>
          </div>

          <div class="player-meta">
            <div class="meta-item">
              <span class="label">当前设备</span>
              <span class="value">{{ currentDeviceName || "-" }}</span>
            </div>
            <div class="meta-item">
              <span class="label">当前地址</span>
              <span class="value">{{ playUrl || "-" }}</span>
            </div>
            <div class="meta-item">
              <span class="label">最近错误</span>
              <span class="value error-text">{{ lastError || "无" }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="MonitorScreen">
import { useElementSize } from "@vueuse/core";
import {
  getMonitorScreenConfig
} from "@/api/monitor/screen";
import useLiveRecognizeStore from "@/store/modules/liveRecognize";

const STREAM_RTSP_LAN_REQUIRED = 4601;
const STREAM_CODEC_NOT_H264 = 4602;

const liveStore = useLiveRecognizeStore();

const PLAYER_CONTAINER_ID = "ezviz-monitor-player";

const { proxy } = getCurrentInstance();

const configRef = ref();
const playerShellRef = ref();
const playerRef = shallowRef(null);
const starting = ref(false);
const configLoading = ref(false);
const accessToken = ref("");
const deviceOptions = ref([]);
const playerStatus = ref("idle");
const configState = ref("idle");
const lastError = ref("");
const configError = ref("");

const form = reactive({
  deviceSerial: "",
  channelNo: 1,
  validCode: "",
  audioEnabled: false,
  streamMode: "cloud_hls"
});

const recognizeStarting = computed(() => liveStore.starting);
const recognizeStopping = computed(() => liveStore.stopping);
const recognizeTaskId = computed(() => liveStore.taskId);
const recognizeStatus = computed(() => liveStore.status);
const recognizeMessage = computed(() => liveStore.message);
const recognizeLogTail = computed(() => liveStore.logTail || '');
const recognizeLogTailPreview = computed(() => {
  const tail = recognizeLogTail.value.trim();
  if (!tail) {
    return '';
  }
  const lines = tail.split('\n').filter(Boolean);
  return lines.slice(-8).join('\n');
});

const rules = {
  deviceSerial: [{ required: true, message: "请选择设备", trigger: "change" }],
  channelNo: [{ required: true, message: "通道号不能为空", trigger: "change" }]
};

const { width: shellWidth } = useElementSize(playerShellRef);

const selectedDevice = computed(() =>
  deviceOptions.value.find((item) => item.deviceSerial === form.deviceSerial)
);

const currentDeviceName = computed(() => selectedDevice.value?.deviceName || "");

const playUrl = computed(() => {
  if (!form.deviceSerial) {
    return "";
  }
  return `ezopen://open.ys7.com/${form.deviceSerial.toUpperCase()}/${form.channelNo}.live`;
});

const hasPlayer = computed(() => Boolean(playerRef.value));

const emptyDescription = computed(() => {
  if (configLoading.value) {
    return "正在加载萤石播放配置";
  }
  if (!accessToken.value) {
    return "请先刷新配置";
  }
  if (!form.deviceSerial) {
    return "请选择设备后开始预览";
  }
  return "点击开始预览后显示监控画面";
});

const statusText = computed(() => {
  const statusMap = {
    idle: "待启动",
    starting: "初始化中",
    playing: "播放中",
    stopped: "已停止",
    error: "播放异常"
  };
  return statusMap[playerStatus.value] || "未知状态";
});

const statusTagType = computed(() => {
  const tagTypeMap = {
    idle: "info",
    starting: "warning",
    playing: "success",
    stopped: "info",
    error: "danger"
  };
  return tagTypeMap[playerStatus.value] || "info";
});

const configStatusText = computed(() => {
  const statusMap = {
    idle: "未加载",
    loading: "加载中",
    ready: "配置可用",
    error: "配置异常"
  };
  return statusMap[configState.value] || "未知状态";
});

const configStatusType = computed(() => {
  const tagTypeMap = {
    idle: "info",
    loading: "warning",
    ready: "success",
    error: "danger"
  };
  return tagTypeMap[configState.value] || "info";
});

const recognizeRunning = computed(() => recognizeStatus.value === "running" || recognizeStatus.value === "starting");

const recognizeStatusText = computed(() => {
  const map = {
    idle: "未启动",
    starting: "启动中",
    running: "识别中",
    stopped: "已停止",
    failed: "异常结束",
    success: "已结束"
  };
  const base = map[recognizeStatus.value] || recognizeStatus.value;
  return recognizeMessage.value ? `${base} · ${recognizeMessage.value}` : base;
});

const recognizeStatusTagType = computed(() => {
  const map = {
    idle: "info",
    starting: "warning",
    running: "success",
    stopped: "info",
    failed: "danger",
    success: "info"
  };
  return map[recognizeStatus.value] || "info";
});

async function loadPlayerConstructor() {
  const sdkModule = await import("ezuikit-js");
  return sdkModule.EZUIKitPlayer || sdkModule.default?.EZUIKitPlayer || sdkModule.default;
}

function resolvePlayerSize() {
  const width = Math.max(Math.round(shellWidth.value || 960), 360);
  const height = Math.max(Math.round((width * 9) / 16), 360);
  return { width, height };
}

function clearPlayerContainer() {
  const container = document.getElementById(PLAYER_CONTAINER_ID);
  if (container) {
    container.innerHTML = "";
  }
}

function normalizeError(error) {
  if (!error) {
    return "未知错误";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.message) {
    return error.message;
  }
  if (error.data?.nErrorCode) {
    return `错误码 ${error.data.nErrorCode}`;
  }
  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return "播放器返回了无法序列化的异常信息";
  }
}

function formatDeviceLabel(device) {
  const name = device.deviceName || device.deviceSerial;
  const statusText = device.status === "1" ? "在线" : "离线";
  return `${name} (${device.deviceSerial}) - ${statusText}`;
}

function applyScreenConfig(data) {
  accessToken.value = data?.accessToken || "";
  deviceOptions.value = Array.isArray(data?.devices) ? data.devices : [];

  const currentDevice = deviceOptions.value.find((item) => item.deviceSerial === form.deviceSerial);
  if (currentDevice) {
    form.channelNo = Number(currentDevice.channelNo || form.channelNo || 1);
    return;
  }

  const firstDevice = deviceOptions.value[0];
  if (firstDevice) {
    form.deviceSerial = firstDevice.deviceSerial;
    form.channelNo = Number(firstDevice.channelNo || data?.defaultChannelNo || 1);
  } else {
    form.deviceSerial = "";
    form.channelNo = Number(data?.defaultChannelNo || 1);
  }
}

async function fetchScreenConfig(showMessage = false) {
  const hadConfig = Boolean(accessToken.value);
  configLoading.value = true;
  configState.value = hadConfig ? "ready" : "loading";
  configError.value = "";

  try {
    const response = await getMonitorScreenConfig();
    applyScreenConfig(response.data);
    configState.value = "ready";
    if (showMessage) {
      proxy.$modal.msgSuccess("播放配置已刷新");
    }
  } catch (error) {
    configError.value = normalizeError(error);
    if (!hadConfig) {
      accessToken.value = "";
      deviceOptions.value = [];
      configState.value = "error";
    } else {
      configState.value = "ready";
    }
    if (showMessage) {
      proxy.$modal.msgError(`刷新配置失败：${configError.value}`);
    }
  } finally {
    configLoading.value = false;
  }
}

function handleDeviceChange(deviceSerial) {
  const targetDevice = deviceOptions.value.find((item) => item.deviceSerial === deviceSerial);
  form.channelNo = Number(targetDevice?.channelNo || 1);
}

async function teardownPlayer(nextStatus = "stopped") {
  const currentPlayer = playerRef.value;
  playerRef.value = null;

  if (currentPlayer) {
    try {
      if (typeof currentPlayer.stop === "function") {
        await currentPlayer.stop();
      }
    } catch (error) {
      lastError.value = normalizeError(error);
    }

    try {
      if (typeof currentPlayer.destroy === "function") {
        await currentPlayer.destroy();
      }
    } catch (error) {
      lastError.value = normalizeError(error);
    }
  }

  clearPlayerContainer();
  playerStatus.value = nextStatus;
}

async function handlePreview() {
  if (!accessToken.value) {
    proxy.$modal.msgError("尚未获取到萤石 accessToken，请先刷新配置");
    return;
  }

  const isValid = await configRef.value.validate().catch(() => false);
  if (!isValid) {
    return;
  }

  starting.value = true;
  playerStatus.value = "starting";
  lastError.value = "";

  try {
    await teardownPlayer("idle");
    await nextTick();

    const PlayerConstructor = await loadPlayerConstructor();
    const { width, height } = resolvePlayerSize();

    const player = new PlayerConstructor({
      id: PLAYER_CONTAINER_ID,
      accessToken: accessToken.value,
      url: playUrl.value,
      validCode: form.validCode || undefined,
      template: "pcLive",
      audio: form.audioEnabled,
      autoplay: true,
      width,
      height,
      handleError: (error) => {
        playerStatus.value = "error";
        lastError.value = normalizeError(error);
      }
    });

    playerRef.value = player;
    playerStatus.value = "playing";
    proxy.$modal.msgSuccess("监控画面已开始预览");
  } catch (error) {
    playerStatus.value = "error";
    lastError.value = normalizeError(error);
    proxy.$modal.msgError(`播放器初始化失败：${lastError.value}`);
  } finally {
    starting.value = false;
  }
}

async function handleStop() {
  await teardownPlayer();
}

function syncFormFromLiveStore() {
  if (liveStore.deviceSerial) {
    form.deviceSerial = liveStore.deviceSerial;
  }
  if (liveStore.streamMode) {
    form.streamMode = liveStore.streamMode;
  }
}

async function handleStartRecognize() {
  const isValid = await configRef.value.validate().catch(() => false);
  if (!isValid) {
    return;
  }
  try {
    const task = await liveStore.startRecognize({
      deviceSerial: form.deviceSerial,
      channelNo: form.channelNo,
      validCode: form.validCode || undefined,
      streamMode: form.streamMode,
      locationId: 1
    });
    syncFormFromLiveStore();
    if (liveStore.status === "running") {
      proxy.$modal.msgSuccess("直播识别已启动");
    } else if (liveStore.status === "starting") {
      proxy.$modal.msgSuccess("正在连接直播流，请稍候…");
    }
    if (task?.status === "failed" && task?.message) {
      proxy.$modal.msgError(`直播识别失败：${task.message}`);
    }
  } catch (error) {
    const code = error?.response?.data?.code;
    const msg = error?.response?.data?.msg || normalizeError(error);
    if (!code && /timeout/i.test(msg)) {
      await liveStore.syncFromServer();
      if (liveStore.active) {
        liveStore.startPoll();
        syncFormFromLiveStore();
        proxy.$modal.msgWarning("连接较慢，已在后台继续尝试打开直播流…");
        return;
      }
    }
    if (code === STREAM_RTSP_LAN_REQUIRED) {
      await proxy.$modal.confirm(
        "RTSP 需要识别服务器与摄像头在同一局域网。是否切换为「公网云转发」？",
        "RTSP 连接失败",
        { confirmButtonText: "切换公网云转发", cancelButtonText: "取消", type: "warning" }
      ).then(() => {
        form.streamMode = "cloud_hls";
        proxy.$modal.msgInfo("已切换为公网云转发，请再次点击「开始识别」");
      }).catch(() => {});
    } else if (code === STREAM_CODEC_NOT_H264) {
      proxy.$modal.msgError(`启动识别失败：${msg}`);
      proxy.$modal.msgWarning("请在萤石 App 将摄像头视频编码改为 H264，或填写验证码后使用局域网 RTSP");
    } else {
      proxy.$modal.msgError(`启动识别失败：${msg}`);
    }
    liveStore.$patch({ status: 'failed', message: msg });
    liveStore.persist();
  }
}

async function handleStopRecognize() {
  if (!recognizeTaskId.value) {
    return;
  }
  try {
    await liveStore.stopRecognize();
    proxy.$modal.msgSuccess("直播识别已停止");
  } catch (error) {
    proxy.$modal.msgError(`停止识别失败：${normalizeError(error)}`);
  }
}

async function handleOpenSound() {
  if (!playerRef.value || typeof playerRef.value.openSound !== "function") {
    proxy.$modal.msgWarning("当前播放器不支持开声操作");
    return;
  }
  try {
    await playerRef.value.openSound();
  } catch (error) {
    lastError.value = normalizeError(error);
    proxy.$modal.msgError(`打开声音失败：${lastError.value}`);
  }
}

async function handleCloseSound() {
  if (!playerRef.value || typeof playerRef.value.closeSound !== "function") {
    proxy.$modal.msgWarning("当前播放器不支持静音操作");
    return;
  }
  try {
    await playerRef.value.closeSound();
  } catch (error) {
    lastError.value = normalizeError(error);
    proxy.$modal.msgError(`关闭声音失败：${lastError.value}`);
  }
}

onMounted(async () => {
  await liveStore.bootstrap();
  syncFormFromLiveStore();
  await fetchScreenConfig();
});

watch(recognizeStatus, (status, prev) => {
  if (status === 'failed' && prev !== 'failed' && recognizeMessage.value) {
    proxy.$modal.msgError(`识别异常结束：${recognizeMessage.value}`);
  }
});

onBeforeUnmount(() => {
  // 仅销毁预览播放器；识别任务与轮询由全局 store 维持，直到用户点击「停止识别」
  teardownPlayer("idle");
});
</script>

<style lang="scss" scoped>
.monitor-screen-page {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .card-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .card-icon {
    font-size: 18px;
    color: #409eff;
  }

  .config-card,
  .tips-card,
  .player-card {
    margin-bottom: 20px;
  }

  .config-form {
    margin-top: 16px;
  }

  .config-status {
    margin-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .action-row :deep(.el-form-item__content) {
    gap: 12px;
  }

  .tips-list {
    margin: 0 0 12px;
    padding-left: 18px;
    color: var(--el-text-color-regular);
    line-height: 1.8;
  }

  .config-error {
    display: block;
    margin-top: 12px;
  }

  .stream-mode-tip {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }

  .recognize-fail-alert {
    margin-bottom: 16px;
  }

  .log-tail-label {
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .log-tail-preview {
    margin: 0;
    padding: 8px;
    max-height: 140px;
    overflow: auto;
    font-size: 11px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .player-shell {
    position: relative;
    min-height: 420px;
    border-radius: 8px;
    overflow: hidden;
    background: #0f172a;
  }

  .player-host {
    width: 100%;
    min-height: 420px;
  }

  .player-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .player-meta {
    margin-top: 16px;
    display: grid;
    gap: 12px;
  }

  .meta-item {
    display: grid;
    gap: 6px;
  }

  .label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .value {
    word-break: break-all;
    color: var(--el-text-color-primary);
  }

  .error-text {
    color: var(--el-color-danger);
  }
}
</style>
