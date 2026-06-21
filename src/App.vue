<template>
  <router-view />
</template>

<script setup>
import useSettingsStore from '@/store/modules/settings'
import useLiveRecognizeStore from '@/store/modules/liveRecognize'
import { handleThemeStyle } from '@/utils/theme'

onMounted(() => {
  nextTick(() => {
    handleThemeStyle(useSettingsStore().theme)
    useLiveRecognizeStore().bootstrap()
  })
})
</script>
