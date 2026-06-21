<template>
  <div class="stat-small-box" :class="`is-${color}`">
    <div class="stat-small-box-inner">
      <div class="stat-small-box-value">{{ value }}</div>
      <div class="stat-small-box-label">{{ label }}</div>
    </div>
    <div class="stat-small-box-icon">
      <el-icon :size="88">
        <component :is="iconComponent" />
      </el-icon>
    </div>
    <a class="stat-small-box-footer" href="javascript:void(0)" @click.prevent="emit('more')">
      更多信息
      <el-icon><ArrowRight /></el-icon>
    </a>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowRight, Calendar, List, User, View } from '@element-plus/icons-vue'

const props = defineProps({
  value: {
    type: [String, Number],
    default: 0
  },
  label: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: 'blue',
    validator: value => ['blue', 'green', 'yellow', 'red'].includes(value)
  },
  icon: {
    type: String,
    default: 'Calendar'
  }
})

const emit = defineEmits(['more'])

const iconMap = {
  Calendar,
  View,
  User,
  List
}

const iconComponent = computed(() => iconMap[props.icon] || Calendar)
</script>

<style scoped lang="scss">
.stat-small-box {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 158px;
  margin-bottom: 12px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  color: #fff;
  overflow: hidden;

  &.is-blue {
    background: #007bff;

    .stat-small-box-footer {
      background: rgba(0, 0, 0, 0.1);
    }
  }

  &.is-green {
    background: #28a745;

    .stat-small-box-footer {
      background: rgba(0, 0, 0, 0.1);
    }
  }

  &.is-yellow {
    background: #ffc107;
    color: #1f2d3d;

    .stat-small-box-icon {
      color: rgba(31, 45, 61, 0.35);
    }

    .stat-small-box-footer {
      background: rgba(0, 0, 0, 0.08);
      color: rgba(31, 45, 61, 0.85);

      &:hover {
        color: #1f2d3d;
        background: rgba(0, 0, 0, 0.12);
      }
    }
  }

  &.is-red {
    background: #dc3545;

    .stat-small-box-footer {
      background: rgba(0, 0, 0, 0.1);
    }
  }

  &:hover .stat-small-box-icon {
    transform: scale(1.06);
  }
}

.stat-small-box-inner {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 22px 18px 18px;
}

.stat-small-box-value {
  font-size: 42px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-small-box-label {
  margin-top: 10px;
  font-size: 15px;
  font-weight: 500;
}

.stat-small-box-icon {
  position: absolute;
  top: 16px;
  right: 14px;
  z-index: 0;
  opacity: 0.28;
  transition: transform 0.25s ease;
  pointer-events: none;
}

.stat-small-box-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 9px 0;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    color: #fff;
    background: rgba(0, 0, 0, 0.14);
  }

  .el-icon {
    font-size: 12px;
  }
}
</style>
