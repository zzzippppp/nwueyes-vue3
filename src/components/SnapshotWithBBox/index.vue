<template>
  <div
    ref="hostRef"
    class="snapshot-with-bbox"
    :class="[variant, { clickable: preview }]"
    :style="hostStyle"
    @click="handleClick"
  >
    <img
      ref="imgRef"
      :src="src"
      class="snapshot-img"
      :style="imgStyle"
      alt="监控画面"
      @load="updateOverlay"
    />
    <div
      v-if="overlayStyle"
      class="bbox-overlay"
      :style="overlayStyle"
    >
      <span v-if="showNameTag" class="bbox-name">{{ personName }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
  bbox: { type: [Object, String], default: null },
  /** 绿框左上角显示的人员名字 */
  personName: { type: String, default: '' },
  /** thumb 用 cover 填满格子；large 用 contain 保比例 */
  fit: { type: String, default: '' },
  preview: { type: Boolean, default: false },
  /** thumb: 列表缩略图；large: 弹窗大图 */
  variant: { type: String, default: 'thumb' }
})

const emit = defineEmits(['preview'])

const hostRef = ref(null)
const imgRef = ref(null)
const overlayStyle = ref(null)

const resolvedFit = computed(() => {
  if (props.fit) return props.fit
  return props.variant === 'large' ? 'contain' : 'cover'
})

/** 仅大图预览展示名字，缩略图不挡画面 */
const showNameTag = computed(() => {
  return props.variant === 'large' && !!(props.personName && String(props.personName).trim())
})

/** 列表固定约 16:9 横长方形，避免被表格样式拉成正方形 */
const hostStyle = computed(() => {
  if (props.variant === 'large') {
    return {
      width: '100%',
      height: '100%'
    }
  }
  return {
    width: '136px',
    height: '76px',
    minWidth: '136px',
    maxWidth: '136px',
    minHeight: '76px',
    maxHeight: '76px'
  }
})

const imgStyle = computed(() => ({
  objectFit: resolvedFit.value,
  objectPosition: 'center center',
  width: '100%',
  height: '100%'
}))

const parsedBbox = computed(() => {
  if (!props.bbox) return null
  if (typeof props.bbox === 'object') return props.bbox
  try {
    return JSON.parse(props.bbox)
  } catch {
    return null
  }
})

function updateOverlay() {
  const img = imgRef.value
  const host = hostRef.value
  const bbox = parsedBbox.value
  if (!img || !host || !bbox || bbox.x1 == null || bbox.y1 == null || bbox.x2 == null || bbox.y2 == null) {
    overlayStyle.value = null
    return
  }
  const nw = img.naturalWidth || bbox.frameWidth || 1
  const nh = img.naturalHeight || bbox.frameHeight || 1
  const cw = host.clientWidth
  const ch = host.clientHeight
  if (!cw || !ch || !nw || !nh) {
    overlayStyle.value = null
    return
  }
  const fit = resolvedFit.value
  const scale = fit === 'cover'
    ? Math.max(cw / nw, ch / nh)
    : Math.min(cw / nw, ch / nh)
  const dw = nw * scale
  const dh = nh * scale
  const ox = (cw - dw) / 2
  const oy = (ch - dh) / 2
  const x1 = ox + Number(bbox.x1) * dw
  const y1 = oy + Number(bbox.y1) * dh
  const x2 = ox + Number(bbox.x2) * dw
  const y2 = oy + Number(bbox.y2) * dh
  overlayStyle.value = {
    left: `${x1}px`,
    top: `${y1}px`,
    width: `${Math.max(2, x2 - x1)}px`,
    height: `${Math.max(2, y2 - y1)}px`
  }
}

function handleClick() {
  if (props.preview) {
    emit('preview', props.src)
  }
}

let resizeObs = null

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && hostRef.value) {
    resizeObs = new ResizeObserver(() => updateOverlay())
    resizeObs.observe(hostRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObs?.disconnect()
})

watch(() => [props.src, props.bbox, props.variant, props.fit], async () => {
  overlayStyle.value = null
  await nextTick()
  updateOverlay()
})
</script>

<style scoped lang="scss">
.snapshot-with-bbox {
  position: relative;
  display: block;
  box-sizing: border-box;
  background: #111827;
  border-radius: 4px;
  overflow: hidden;
  line-height: 0;
  flex: 0 0 auto;

  &.clickable {
    cursor: zoom-in;
  }

  &.large {
    border-radius: 0;
    overflow: visible;
  }
}

.snapshot-img {
  display: block;
  box-sizing: border-box;
  border: 0;
  vertical-align: top;
  border-radius: inherit;
}

.large .snapshot-img {
  border-radius: 0;
}

.bbox-overlay {
  position: absolute;
  border: 2px solid #67c23a;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  box-sizing: border-box;
}

.bbox-name {
  position: absolute;
  left: -2px;
  top: -2px;
  transform: translateY(-100%);
  max-width: min(220px, 50vw);
  padding: 2px 8px;
  font-size: 13px;
  line-height: 1.4;
  color: #fff;
  background: #67c23a;
  border-radius: 3px 3px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
}
</style>
