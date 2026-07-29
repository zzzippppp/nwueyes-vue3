<template>
  <el-drawer
    :model-value="visible"
    :title="drawerTitle"
    size="78%"
    destroy-on-close
    append-to-body
    class="monitor-detail-drawer"
    @close="handleClose"
  >
    <div v-loading="configLoading" class="drawer-body">
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
            title="预览与识别均走局域网 RTSP（不经萤石公网）。摄像头需配置 IP、验证码，并已开启 RTSP；浏览器预览依赖本机 go2rtc。"
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
            <el-descriptions :column="1" border size="small" class="camera-desc">
              <el-descriptions-item label="摄像头">{{ currentDeviceName || '—' }}</el-descriptions-item>
              <el-descriptions-item label="点位">{{ camera?.installLocation || selectedCamera?.installLocation || '—' }}</el-descriptions-item>
              <el-descriptions-item label="序列号">{{ form.deviceSerial || '—' }}</el-descriptions-item>
              <el-descriptions-item label="通道">{{ form.channelNo }}</el-descriptions-item>
              <el-descriptions-item label="设备类型">{{ camera?.typeName || selectedCamera?.typeName || '—' }}</el-descriptions-item>
            </el-descriptions>
            <div v-if="selectedCamera?.lineY != null || selectedCamera?.ipAddr" class="camera-meta" style="margin: 8px 0 12px;">
              <span v-if="selectedCamera?.lineY != null">门线 Y {{ selectedCamera.lineY }}</span>
              <span v-if="selectedCamera?.ipAddr"> · IP {{ selectedCamera.ipAddr }}</span>
            </div>

<el-form-item label="设备验证码">
              <el-input
                v-model.trim="form.validCode"
                placeholder="局域网 RTSP 密码（机身底座验证码，默认读库）"
              />
            </el-form-item>

            <el-form-item label="拉流方式">
              <el-tag type="success" size="small">局域网 RTSP</el-tag>
              <div class="stream-mode-tip">
                识别与预览均直连摄像头 RTSP，不占用萤石开放平台并发。
              </div>
              <el-alert
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
                :disabled="configLoading || !form.cameraId"
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
          </el-form>
        </el-card>

        <el-card class="tips-card" shadow="never">
          <template #header>
            <span>接入说明</span>
          </template>
          <ol class="tips-list">
            <li>预览经本机 go2rtc（默认 1984 端口）将 RTSP 转为 WebRTC，不走萤石公网。</li>
            <li>识别与抽帧同样直连摄像头局域网 RTSP（camera.ip_addr + verify_code）。</li>
            <li>请先启动 go2rtc（见 ruoyi/scripts/go2rtc.yaml.example），并确保服务器与摄像头同网。</li>
          </ol>
          <el-text type="info" size="small">
            若列表为空，请先在数据库 camera 表配置 serial_no、ip_addr、verify_code。
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
            <iframe
              v-if="previewUrl"
              :src="previewUrl"
              class="player-host preview-frame"
              allow="autoplay; fullscreen; microphone; camera"
              title="lan-rtsp-preview"
            />
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
  </el-drawer>
</template>

<script setup>
import {
  captureProbeFrame,
  getMonitorScreenConfig,
  startLanPreview,
  stopLanPreview
} from "@/api/monitor/screen";
import useLiveRecognizeStore from "@/store/modules/liveRecognize";

const props = defineProps({
  visible: { type: Boolean, default: false },
  camera: { type: Object, default: null }
})
const emit = defineEmits(['update:visible'])


const STREAM_RTSP_LAN_REQUIRED = 4601;
const STREAM_CODEC_NOT_H264 = 4602;

const liveStore = useLiveRecognizeStore();

const drawerTitle = computed(() => {
  const name = props.camera?.deviceName || props.camera?.deviceCode
  return name ? `监控详情 · ${name}` : '监控详情'
})


const { proxy } = getCurrentInstance();

const configRef = ref();
const playerShellRef = ref();
const starting = ref(false);
const configLoading = ref(false);
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
const previewUrl = ref("");
const previewStreamName = ref("");
const previewCameraId = ref(null);

const form = reactive({
  cameraId: undefined,
  deviceSerial: "",
  channelNo: 1,
  validCode: "",
  streamMode: "lan_rtsp"
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

const selectedCamera = computed(() =>
  cameraOptions.value.find((item) => item.id === form.cameraId)
);

const currentDeviceName = computed(() => {
  const camera = selectedCamera.value;
  if (!camera) return "";
  return camera.deviceName || camera.deviceCode || "";
});

const playUrl = computed(() => previewUrl.value || "");

const hasPlayer = computed(() => Boolean(previewUrl.value));

const emptyDescription = computed(() => {
  if (configLoading.value) {
    return "正在加载摄像头配置";
  }
  if (!form.cameraId || !form.deviceSerial) {
    return "请选择摄像头后开始预览";
  }
  return "点击开始预览后显示监控画面（需本机 go2rtc）";
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
  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return "无法序列化的异常信息";
  }
}

function formatCameraLabel(camera) {
  const name = camera.deviceName || camera.deviceCode || `摄像头${camera.id}`;
  const serial = (camera.serialNo || camera.deviceSerial || "").toUpperCase();
  const loc = camera.installLocation ? ` · ${camera.installLocation}` : "";
  const ip = camera.ipAddr ? ` · ${camera.ipAddr}` : "";
  const ezviz = deviceOptions.value.find(
    (d) => (d.deviceSerial || "").toUpperCase() === serial
  );
  let statusText = "";
  if (ezviz) {
    statusText = ezviz.status === "1" ? " · 在线" : " · 离线";
  } else if (camera.onlineStatus) {
    statusText = camera.onlineStatus === "online" ? " · 在线" : " · 离线";
  }
  return `${name}${loc}${ip} (${serial})${statusText}`;
}

function resolveMediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = import.meta.env.VITE_APP_BASE_API || "";
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function applyScreenConfig(data) {
  deviceOptions.value = Array.isArray(data?.devices) ? data.devices : [];
  cameraOptions.value = Array.isArray(data?.cameras) ? data.cameras : [];

  const fromProp = props.camera
  const matched = fromProp
    ? (cameraOptions.value.find((c) => c.id === fromProp.id) || fromProp)
    : null

  if (matched) {
    form.cameraId = matched.id
    applyCameraToForm(matched)
    return
  }

  if (form.cameraId && cameraOptions.value.some((c) => c.id === form.cameraId)) {
    applyCameraToForm(selectedCamera.value);
    return;
  }

  form.cameraId = undefined;
  form.deviceSerial = "";
  form.channelNo = Number(data?.defaultChannelNo || 1);
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
  const hadConfig = configState.value === "ready";
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

async function handleCameraChange(cameraId) {
  const camera = cameraOptions.value.find((item) => item.id === cameraId);
  applyCameraToForm(camera);
  if (hasPlayer.value) {
    await teardownPlayer("idle");
  }
}

async function teardownPlayer(nextStatus = "stopped") {
  const cameraId = previewCameraId.value;
  previewUrl.value = "";
  previewStreamName.value = "";
  previewCameraId.value = null;
  if (cameraId) {
    try {
      await stopLanPreview(cameraId);
    } catch (error) {
      lastError.value = normalizeError(error);
    }
  }
  playerStatus.value = nextStatus;
}

async function handlePreview() {
  const isValid = await configRef.value.validate().catch(() => false);
  if (!isValid) {
    return;
  }

  starting.value = true;
  playerStatus.value = "starting";
  lastError.value = "";

  try {
    await teardownPlayer("idle");
    const response = await startLanPreview({
      cameraId: form.cameraId,
      deviceSerial: form.deviceSerial,
      channelNo: form.channelNo,
      validCode: form.validCode || undefined,
      streamMode: "lan_rtsp"
    });
    const data = response?.data || response;
    previewUrl.value = data?.previewUrl || "";
    previewStreamName.value = data?.streamName || "";
    previewCameraId.value = data?.cameraId || form.cameraId;
    if (!previewUrl.value) {
      throw new Error("后端未返回预览地址，请确认 go2rtc 已启动");
    }
    playerStatus.value = "playing";
    proxy.$modal.msgSuccess("局域网预览已启动");
  } catch (error) {
    playerStatus.value = "error";
    lastError.value = normalizeError(error);
    proxy.$modal.msgError(`预览失败：${lastError.value}`);
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
  form.streamMode = "lan_rtsp";
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
      streamMode: "lan_rtsp"
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
      streamMode: "lan_rtsp"
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
      proxy.$modal.msgError("RTSP 连接失败：请确认识别服务器与摄像头同网，且已开启 RTSP、填写 IP/验证码");
    } else if (code === STREAM_CODEC_NOT_H264) {
      proxy.$modal.msgError(`启动识别失败：${msg}`);
      proxy.$modal.msgWarning("请在萤石 App 将摄像头视频编码改为 H264，并确认验证码正确");
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

function handleClose() {
  teardownPlayer("idle");
  emit("update:visible", false);
}

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      if (props.camera) {
        form.cameraId = props.camera.id
        applyCameraToForm(props.camera)
      }
      form.streamMode = "lan_rtsp"
      await liveStore.bootstrap();
      syncFormFromLiveStore();
      await fetchScreenConfig();
    } else {
      await teardownPlayer("idle");
    }
  }
);

watch(recognizeStatus, (status, prev) => {
  if (status === 'failed' && prev !== 'failed' && recognizeMessage.value && props.visible) {
    proxy.$modal.msgError(`识别异常结束：${recognizeMessage.value}`);
  }
});

onBeforeUnmount(() => {
  teardownPlayer("idle");
});
</script>

<style lang="scss" scoped>
.drawer-body {
  min-height: 420px;
}

.camera-desc {
  margin-bottom: 12px;
}

.monitor-screen-page, .drawer-body {
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
    border: 0;
  }

  .preview-frame {
    display: block;
    background: #000;
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
