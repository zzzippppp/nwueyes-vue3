<template>
  <div
    class="sidebar-logo-container"
    :class="{ collapse }"
    :style="{ backgroundColor: sideTheme === 'theme-dark' ? variables.menuBackground : variables.menuLightBackground }"
  >
    <router-link class="sidebar-logo-link" to="/">
      <span
        class="sidebar-title"
        :class="{ 'sidebar-title--collapse': collapse }"
        :style="{ color: sideTheme === 'theme-dark' ? variables.logoTitleColor : variables.logoLightTitleColor }"
      >
        {{ collapse ? '考勤' : title }}
      </span>
    </router-link>
  </div>
</template>

<script setup>
import variables from '@/assets/styles/variables.module.scss'
import useSettingsStore from '@/store/modules/settings'

defineProps({
  collapse: {
    type: Boolean,
    required: true
  }
})

const title = import.meta.env.VITE_APP_TITLE
const settingsStore = useSettingsStore()
const sideTheme = computed(() => settingsStore.sideTheme)
</script>

<style lang="scss" scoped>
.sidebar-logo-container {
  width: 100%;
  height: 50px;
  box-sizing: border-box;
  border-bottom: 1px solid #ebeef5;

  &.collapse {
    .sidebar-logo-link {
      justify-content: center;
      padding: 0 8px;
    }
  }
}

.sidebar-logo-link {
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 50px;
  padding: 0 16px;
  box-sizing: border-box;
  text-decoration: none;
}

.sidebar-title {
  display: block;
  flex: 1;
  margin: 0;
  padding: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  color: #1f2937;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-title--collapse {
  font-size: 14px;
  text-align: center;
}
</style>
