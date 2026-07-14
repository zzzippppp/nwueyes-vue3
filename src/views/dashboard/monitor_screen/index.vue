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
            title="摄像头列表来自数据库，已包含萤石序列号、通道与门线配置；预览与识别共用同一设备。"
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
            <el-form-item label="摄像头" prop="cameraId">
              <el-select
                v-model="form.cameraId"
                placeholder="请选择摄像头"
                filterable
                clearable
                :loading="configLoading"
                @change="handleCameraChange"
              >
                <el-option
                  v-for="camera in cameraOptions"
                  :key="camera.id"
                  :label="formatCameraLabel(camera)"
                  :value="camera.id"
                />
              </el-select>
              <div v-if="selectedCamera" class="camera-meta">
                序列号 {{ form.deviceSerial || '—' }} · 通道 {{ form.channelNo }}
                <span v-if="selectedCamera.lineY != null"> · 门线 Y {{ selectedCamera.lineY }}</span>
              </div>
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
                :disabled="recognizeRunning || configLoading || !form.cameraId"
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
              <el-button
                type="primary"
                plain
                :loading="probeLoading"
                :disabled="configLoading || !form.cameraId"
                @click="handleCaptureProbe"
              >
                抽帧标定门线
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
            <li>后端自动换取萤石 accessToken，摄像头从数据库加载。</li>
            <li>选择摄像头后即可预览、抽帧标定或开始识别。</li>
            <li>视频加密开启时，可在验证码栏补充或修改（默认读库）。</li>
          </ol>
          <el-text type="info" size="small">
            若列表为空，请先在数据库 camera 表配置 serial_no 与通道号。
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

    <el-dialog v-model="probeVisible" title="门线标定抽帧" width="720px" destroy-on-close>
      <div v-if="probeResult" class="probe-dialog-body">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="请使用「原图」在 1920×1080 坐标系下标注 line_y 与 roi，写回 camera 表或设备管理。"
        />
        <div class="probe-meta">
          <span>分辨率：{{ probeResult.width }}×{{ probeResult.height }}</span>
          <span v-if="probeResult.lineY">当前门线 Y：{{ probeResult.lineY }}</span>
          <span v-if="probeResult.roi">ROI：{{ probeResult.roi }}</span>
        </div>
        <div class="probe-images">
          <div class="probe-image-block">
            <div class="probe-image-title">原图（用于标注）</div>
            <el-image
              v-if="probeResult.rawImageUrl"
              :src="resolveMediaUrl(probeResult.rawImageUrl)"
              :preview-src-list="[resolveMediaUrl(probeResult.rawImageUrl)]"
              fit="contain"
              class="probe-image"
            />
          </div>
          <div v-if="probeResult.overlayImageUrl" class="probe-image-block">
            <div class="probe-image-title">叠加当前门线/ROI</div>
            <el-image
              :src="resolveMediaUrl(probeResult.overlayImageUrl)"
              :preview-src-list="[resolveMediaUrl(probeResult.overlayImageUrl)]"
              fit="contain"
              class="probe-image"
            />
          </div>
        </div>
        <div class="probe-path">
          本地路径：{{ storageRootHint }}/log_library/probe/camera_{{ probeResult.cameraId }}_raw.jpg
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup name="MonitorScreen">
import { useElementSize } from "@vueuse/core";
import {
  captureProbeFrame,
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
const cameraOptions = ref([]);
const probeLoading = ref(false);
const probeVisible = ref(false);
const probeResult = ref(null);
const storageRootHint = ref("storageRoot");
const playerStatus = ref("idle");
const configState = ref("idle");
const lastError = ref("");
const configError = ref("");

const form = reactive({
  cameraId: undefined,
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
  cameraId: [{ required: true, message: "请选择摄像头", trigger: "change" }]
};

const { width: shellWidth } = useElementSize(playerShellRef);

const selectedCamera = computed(() =>
  cameraOptions.value.find((item) => item.id === form.cameraId)
);

const currentDeviceName = computed(() => {
  const camera = selectedCamera.value;
  if (!camera) return "";
  return camera.deviceName || camera.deviceCode || "";
});

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
  if (!form.cameraId || !form.deviceSerial) {
    return "请选择摄像头后开始预览";
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

function formatCameraLabel(camera) {
  const name = camera.deviceName || camera.deviceCode || `摄像头${camera.id}`;
  const serial = (camera.serialNo || camera.deviceSerial || "").toUpperCase();
  const loc = camera.installLocation ? ` · ${camera.installLocation}` : "";
  const ezviz = deviceOptions.value.find(
    (d) => (d.deviceSerial || "").toUpperCase() === serial
  );
  let statusText = "";
  if (ezviz) {
    statusText = ezviz.status === "1" ? " · 在线" : " · 离线";
  } else if (camera.onlineStatus) {
    statusText = camera.onlineStatus === "online" ? " · 在线" : " · 离线";
  }
  return `${name}${loc} (${serial})${statusText}`;
}

function resolveMediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = import.meta.env.VITE_APP_BASE_API || "";
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function applyScreenConfig(data) {
  accessToken.value = data?.accessToken || "";
  deviceOptions.value = Array.isArray(data?.devices) ? data.devices : [];
  cameraOptions.value = Array.isArray(data?.cameras) ? data.cameras : [];

  if (form.cameraId && cameraOptions.value.some((c) => c.id === form.cameraId)) {
    applyCameraToForm(selectedCamera.value);
    return;
  }

  const firstCamera = cameraOptions.value[0];
  if (firstCamera) {
    form.cameraId = firstCamera.id;
    applyCameraToForm(firstCamera);
  } else {
    form.cameraId = undefined;
    form.deviceSerial = "";
    form.channelNo = Number(data?.defaultChannelNo || 1);
  }
}

function applyCameraToForm(camera) {
  if (!camera) return;
  if (camera.serialNo || camera.deviceSerial) {
    form.deviceSerial = (camera.serialNo || camera.deviceSerial).toUpperCase();
  }
  form.channelNo = Number(camera.channelNo || 1);
  if (camera.verifyCode) {
    form.validCode = camera.verifyCode;
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

function handleCameraChange(cameraId) {
  const camera = cameraOptions.value.find((item) => item.id === cameraId);
  applyCameraToForm(camera);
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
  if (liveStore.cameraId) {
    form.cameraId = liveStore.cameraId;
    applyCameraToForm(cameraOptions.value.find((c) => c.id === liveStore.cameraId));
  }
  if (liveStore.deviceSerial) {
    form.deviceSerial = liveStore.deviceSerial;
  }
  if (liveStore.streamMode) {
    form.streamMode = liveStore.streamMode;
  }
}

async function handleCaptureProbe() {
  const isValid = await configRef.value.validate().catch(() => false);
  if (!isValid) return;
  probeLoading.value = true;
  try {
    const res = await captureProbeFrame({
      cameraId: form.cameraId,
      deviceSerial: form.deviceSerial,
      channelNo: form.channelNo,
      validCode: form.validCode || undefined,
      streamMode: form.streamMode
    });
    probeResult.value = res?.data || res;
    probeVisible.value = true;
    proxy.$modal.msgSuccess(probeResult.value?.message || "抽帧成功");
  } catch (error) {
    proxy.$modal.msgError(`抽帧失败：${normalizeError(error)}`);
  } finally {
    probeLoading.value = false;
  }
}

async function handleStartRecognize() {
  const isValid = await configRef.value.validate().catch(() => false);
  if (!isValid) {
    return;
  }
  try {
    const task = await liveStore.startRecognize({
      cameraId: form.cameraId,
      deviceSerial: form.deviceSerial,
      channelNo: form.channelNo,
      validCode: form.validCode || undefined,
      streamMode: form.streamMode
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

  .camera-meta {
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

  .probe-dialog-body {
    display: grid;
    gap: 12px;
  }

  .probe-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .probe-images {
    display: grid;
    gap: 16px;
  }

  .probe-image-title {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
  }

  .probe-image {
    width: 100%;
    max-height: 360px;
    background: #0f172a;
  }

  .probe-path {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    word-break: break-all;
  }
}
</style>
