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

    <el-dialog
      v-model="probeVisible"
      title="门框与门线标定"
      width="1120px"
      top="4vh"
      destroy-on-close
      @opened="openCalibrationEditor"
    >
      <div v-if="probeResult" class="probe-dialog-body">
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="请先用红色矩形标注门框区域，再用蓝色横线标注门线。系统以人员脚点跨过蓝线作为一次进门或出门事件。"
        />

        <div class="calibration-guide">
          <div class="guide-copy">
            <div class="guide-title">标注说明</div>
            <div class="guide-item">
              <span class="guide-swatch guide-swatch-roi" />
              <span><b>红色门框：</b>框住人员通过门口时会出现的有效区域。</span>
            </div>
            <div class="guide-item">
              <span class="guide-swatch guide-swatch-line" />
              <span><b>蓝色门线：</b>放在门槛附近，人员脚点跨线时计为一次进出门事件。</span>
            </div>
            <div class="guide-note">建议门线横穿红框，且避开画面边缘、阴影和容易遮挡的位置。</div>
          </div>
          <div class="example-card">
            <div class="example-title">实验室门口正确标注示例</div>
            <el-image
              :src="doorCalibrationExample"
              :preview-src-list="[doorCalibrationExample]"
              preview-teleported
              fit="contain"
              class="example-image"
            />
          </div>
        </div>

        <div class="calibration-toolbar">
          <div class="tool-buttons">
            <el-button
              :type="calibrationTool === 'roi' ? 'danger' : 'default'"
              :plain="calibrationTool !== 'roi'"
              icon="Crop"
              @click="calibrationTool = 'roi'"
            >
              画红色门框
            </el-button>
            <el-button
              :type="calibrationTool === 'line' ? 'primary' : 'default'"
              :plain="calibrationTool !== 'line'"
              icon="Minus"
              @click="calibrationTool = 'line'"
            >
              画蓝色门线
            </el-button>
          </div>
          <div class="probe-meta">
            <el-tag type="info">分辨率 {{ probeResult.width }}×{{ probeResult.height }}</el-tag>
            <el-tag type="danger">门框 {{ calibrationRoiText || '未标注' }}</el-tag>
            <el-tag type="primary">门线 Y={{ calibration.lineY ?? '未标注' }}</el-tag>
          </div>
        </div>

        <div class="calibration-stage" :class="`tool-${calibrationTool}`">
          <canvas
            ref="calibrationCanvasRef"
            class="calibration-canvas"
            @pointerdown="handleCalibrationPointerDown"
            @pointermove="handleCalibrationPointerMove"
            @pointerup="handleCalibrationPointerUp"
            @pointercancel="handleCalibrationPointerUp"
          />
        </div>
        <div class="calibration-hint">
          当前工具：{{ calibrationTool === 'roi' ? '按住并拖动鼠标画红色门框' : '在图片上单击或拖动确定蓝色门线高度' }}
        </div>
      </div>
      <template #footer>
        <el-button @click="resetCalibration">恢复当前配置</el-button>
        <el-button @click="probeVisible = false">取消</el-button>
        <el-button type="primary" :loading="calibrationSaving" @click="saveCalibration">
          保存标定
        </el-button>
      </template>
    </el-dialog>
    </div>
  </el-drawer>
</template>

<script setup>
import {
  captureProbeFrame,
  getMonitorScreenConfig,
  startLanPreview,
  stopLanPreview,
  updateDoorConfig
} from "@/api/monitor/screen";
import useLiveRecognizeStore from "@/store/modules/liveRecognize";
import doorCalibrationExample from "@/assets/images/door-calibration-example.jpg";

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
const calibrationCanvasRef = ref(null);
const calibrationImageRef = ref(null);
const calibrationTool = ref("roi");
const calibrationSaving = ref(false);
const calibration = reactive({
  roi: null,
  lineY: null,
  startX: 0,
  startY: 0,
  dragging: false
});
const calibrationRoiText = computed(() =>
  Array.isArray(calibration.roi) ? calibration.roi.map((v) => Math.round(v)).join(",") : ""
);
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

const recognizeRunning = computed(() =>
  recognizeStatus.value === "running"
  || recognizeStatus.value === "starting"
  || recognizeStatus.value === "reconnecting"
);

const recognizeStatusText = computed(() => {
  const map = {
    idle: "未启动",
    starting: "启动中",
    running: "识别中",
    reconnecting: "重连中",
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
    reconnecting: "warning",
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

function parseCalibrationRoi(raw) {
  if (!raw) return null;
  const parts = String(raw).split(",").map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return parts;
}

function resetCalibration() {
  const sourceRoi = probeResult.value?.roi || selectedCamera.value?.roi || "";
  const sourceLineY = probeResult.value?.lineY ?? selectedCamera.value?.lineY ?? null;
  calibration.roi = parseCalibrationRoi(sourceRoi);
  calibration.lineY = sourceLineY == null ? null : Number(sourceLineY);
  calibration.dragging = false;
  redrawCalibrationCanvas();
}

function openCalibrationEditor() {
  calibrationImageRef.value = null;
  resetCalibration();
  const canvas = calibrationCanvasRef.value;
  const rawImageUrl = resolveMediaUrl(probeResult.value?.rawImageUrl);
  if (!canvas || !rawImageUrl) return;

  const width = Number(probeResult.value?.width || selectedCamera.value?.refWidth || 1920);
  const height = Number(probeResult.value?.height || selectedCamera.value?.refHeight || 1080);
  canvas.width = width;
  canvas.height = height;

  const image = new Image();
  image.onload = () => {
    calibrationImageRef.value = image;
    redrawCalibrationCanvas();
  };
  image.onerror = () => {
    proxy.$modal.msgError("标定图片加载失败，请重新抽帧");
  };
  image.src = rawImageUrl;
}

function calibrationPoint(event) {
  const canvas = calibrationCanvasRef.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = Math.max(0, Math.min(canvas.width - 1, ((event.clientX - rect.left) * canvas.width) / rect.width));
  const y = Math.max(0, Math.min(canvas.height - 1, ((event.clientY - rect.top) * canvas.height) / rect.height));
  return { x, y };
}

function handleCalibrationPointerDown(event) {
  const point = calibrationPoint(event);
  if (!point) return;
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  if (calibrationTool.value === "line") {
    calibration.lineY = Math.round(point.y);
    calibration.dragging = true;
  } else {
    calibration.startX = point.x;
    calibration.startY = point.y;
    calibration.roi = [point.x, point.y, point.x, point.y];
    calibration.dragging = true;
  }
  redrawCalibrationCanvas();
}

function handleCalibrationPointerMove(event) {
  if (!calibration.dragging) return;
  const point = calibrationPoint(event);
  if (!point) return;
  if (calibrationTool.value === "line") {
    calibration.lineY = Math.round(point.y);
  } else {
    calibration.roi = [calibration.startX, calibration.startY, point.x, point.y];
  }
  redrawCalibrationCanvas();
}

function handleCalibrationPointerUp(event) {
  if (!calibration.dragging) return;
  if (calibrationTool.value === "roi" && Array.isArray(calibration.roi)) {
    const [x1, y1, x2, y2] = calibration.roi;
    calibration.roi = [
      Math.round(Math.min(x1, x2)),
      Math.round(Math.min(y1, y2)),
      Math.round(Math.max(x1, x2)),
      Math.round(Math.max(y1, y2))
    ];
  }
  calibration.dragging = false;
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
  redrawCalibrationCanvas();
}

function redrawCalibrationCanvas() {
  const canvas = calibrationCanvasRef.value;
  const image = calibrationImageRef.value;
  if (!canvas || !image) return;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const scale = Math.max(1, canvas.width / 960);
  if (Array.isArray(calibration.roi)) {
    const [x1, y1, x2, y2] = calibration.roi;
    context.save();
    context.strokeStyle = "#ef4444";
    context.lineWidth = 4 * scale;
    context.setLineDash([12 * scale, 7 * scale]);
    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
    context.setLineDash([]);
    context.fillStyle = "rgba(239, 68, 68, 0.92)";
    context.font = `700 ${14 * scale}px sans-serif`;
    context.fillText("门框 ROI", x1 + 8 * scale, Math.max(20 * scale, y1 - 8 * scale));
    context.restore();
  }

  if (calibration.lineY != null) {
    const lineStart = Array.isArray(calibration.roi) ? calibration.roi[0] : 0;
    const lineEnd = Array.isArray(calibration.roi) ? calibration.roi[2] : canvas.width;
    context.save();
    context.strokeStyle = "#2563eb";
    context.lineWidth = 5 * scale;
    context.beginPath();
    context.moveTo(lineStart, calibration.lineY);
    context.lineTo(lineEnd, calibration.lineY);
    context.stroke();
    context.fillStyle = "rgba(37, 99, 235, 0.94)";
    context.font = `700 ${14 * scale}px sans-serif`;
    context.fillText(
      `门线 Y=${Math.round(calibration.lineY)}`,
      lineStart + 8 * scale,
      Math.max(20 * scale, calibration.lineY - 10 * scale)
    );
    context.restore();
  }
}

async function saveCalibration() {
  if (!Array.isArray(calibration.roi)) {
    proxy.$modal.msgWarning("请先用红色矩形标注门框区域");
    return;
  }
  const [x1, y1, x2, y2] = calibration.roi.map(Math.round);
  if (x2 - x1 < 10 || y2 - y1 < 10) {
    proxy.$modal.msgWarning("门框区域过小，请重新拖动标注");
    return;
  }
  if (calibration.lineY == null) {
    proxy.$modal.msgWarning("请再用蓝色横线标注门线");
    return;
  }

  calibrationSaving.value = true;
  try {
    const response = await updateDoorConfig({
      cameraId: form.cameraId,
      lineY: Math.round(calibration.lineY),
      roi: [x1, y1, x2, y2].join(","),
      refWidth: Number(probeResult.value.width),
      refHeight: Number(probeResult.value.height)
    });
    const updated = response?.data || response;
    if (selectedCamera.value && updated) {
      Object.assign(selectedCamera.value, updated);
    }
    if (props.camera && updated) {
      Object.assign(props.camera, updated);
    }
    probeResult.value.lineY = Math.round(calibration.lineY);
    probeResult.value.roi = [x1, y1, x2, y2].join(",");
    redrawCalibrationCanvas();
    proxy.$modal.msgSuccess("门框和门线已保存，后续识别将使用新标定");
    probeVisible.value = false;
  } catch (error) {
    proxy.$modal.msgError(`保存标定失败：${normalizeError(error)}`);
  } finally {
    calibrationSaving.value = false;
  }
}

async function handleCaptureProbe() {
  if (!form.cameraId) {
    proxy.$modal.msgWarning("请先在详情里确认已选择摄像头");
    return;
  }
  const isValid = await configRef.value?.validate?.().catch(() => false);
  if (!isValid) {
    proxy.$modal.msgWarning("请先完善摄像头配置后再抽帧");
    return;
  }
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
    proxy.$modal.msgSuccess("已抽取当前监控帧，请完成门框和门线标注");
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
    } else if (liveStore.status === "starting" || liveStore.status === "reconnecting") {
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

  .calibration-guide {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.8fr);
    gap: 14px;
    align-items: stretch;
  }

  .guide-copy,
  .example-card {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    padding: 12px;
    background: var(--el-fill-color-blank);
  }

  .guide-title,
  .example-title {
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 700;
  }

  .guide-item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 8px;
    font-size: 13px;
    line-height: 1.5;
  }

  .guide-note {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .guide-swatch {
    width: 14px;
    height: 14px;
    margin-top: 3px;
    border-radius: 3px;
    flex: 0 0 auto;
  }

  .guide-swatch-roi {
    background: #ef4444;
  }

  .guide-swatch-line {
    background: #2563eb;
  }

  .example-image {
    width: 100%;
    height: 140px;
    background: #0f172a;
  }

  .calibration-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
  }

  .tool-buttons,
  .probe-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .calibration-stage {
    overflow: auto;
    max-height: min(58vh, 620px);
    border: 1px solid var(--el-border-color);
    border-radius: 10px;
    background: #0f172a;
  }

  .calibration-stage.tool-roi {
    cursor: crosshair;
  }

  .calibration-stage.tool-line {
    cursor: ns-resize;
  }

  .calibration-canvas {
    display: block;
    width: 100%;
    height: auto;
    touch-action: none;
    user-select: none;
  }

  .calibration-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  @media (max-width: 960px) {
    .calibration-guide {
      grid-template-columns: 1fr;
    }
  }
}
</style>
