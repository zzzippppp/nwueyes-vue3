<template>
  <div class="attendance-stat-panel">
    <div class="attendance-stat-panel-head">
      <h2 class="attendance-stat-panel-title">
        <span class="title-accent" />
        {{ title }}
      </h2>
      <slot name="extra" />
    </div>
    <el-row :gutter="16" class="attendance-stat-row">
      <el-col v-for="card in cards" :key="card.key" :xs="12" :sm="12" :md="6" :lg="6">
        <div
          class="attendance-stat-card"
          :class="`is-${card.color || 'blue'}`"
          @click="emit('card-click', card)"
        >
          <div class="attendance-stat-card-icon">
            <el-icon :size="88">
              <component :is="resolveIcon(card.icon)" />
            </el-icon>
          </div>
          <div class="attendance-stat-card-head">
            <span class="attendance-stat-card-label">{{ card.label }}</span>
            <span v-if="card.tag" class="attendance-stat-card-tag">{{ card.tag }}</span>
          </div>
          <div class="attendance-stat-card-value">{{ card.value }}</div>
          <div class="attendance-stat-card-desc">{{ card.desc }}</div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { Calendar, List, PieChart, User, View } from '@element-plus/icons-vue'

defineProps({
  title: {
    type: String,
    default: '考勤信息'
  },
  cards: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['card-click'])

const iconMap = {
  Calendar,
  View,
  User,
  List,
  PieChart
}

function resolveIcon(name) {
  return iconMap[name] || Calendar
}
</script>

<style scoped lang="scss">
.attendance-stat-panel {
  margin-bottom: 16px;
  padding: 24px 24px 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.attendance-stat-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.attendance-stat-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  color: #303133;
}

.title-accent {
  width: 4px;
  height: 22px;
  border-radius: 2px;
  background: linear-gradient(180deg, #409eff 0%, #337ecc 100%);
}

.attendance-stat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 160px;
  margin-bottom: 12px;
  padding: 18px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  color: #fff;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
    transform: translateY(-2px);

    .attendance-stat-card-icon {
      transform: scale(1.06);
    }
  }

  &.is-blue {
    background: linear-gradient(135deg, #007bff 0%, #0062cc 100%);
  }

  &.is-green {
    background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
  }

  &.is-yellow {
    background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
    color: #1f2d3d;

    .attendance-stat-card-icon {
      color: rgba(31, 45, 61, 0.32);
    }

    .attendance-stat-card-tag {
      background: rgba(31, 45, 61, 0.12);
      color: #1f2d3d;
    }

    .attendance-stat-card-desc {
      color: rgba(31, 45, 61, 0.72);
    }
  }

  &.is-red {
    background: linear-gradient(135deg, #dc3545 0%, #bd2130 100%);
  }
}

.attendance-stat-card-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 0;
  opacity: 0.3;
  transition: transform 0.25s ease;
  pointer-events: none;
}

.attendance-stat-card-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.attendance-stat-card-label {
  font-size: 15px;
  font-weight: 600;
}

.attendance-stat-card-tag {
  padding: 3px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}

.attendance-stat-card-value {
  position: relative;
  z-index: 1;
  margin-top: 14px;
  font-size: 42px;
  font-weight: 700;
  line-height: 1.1;
}

.attendance-stat-card-desc {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding-top: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.82);
}
</style>
