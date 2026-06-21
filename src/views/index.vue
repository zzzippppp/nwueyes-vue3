<template>
  <div class="app-container home">
    <div class="home-hero">
      <h1 class="home-title">基于大模型的安全监测预警平台</h1>
      <p class="home-subtitle">智能视频分析 · 行为识别 · 安全预警</p>
    </div>
  </div>
</template>

<script setup name="Index">
</script>

<style scoped lang="scss">
.home {
  padding: 0;
  min-height: calc(100vh - 50px - 40px);
  height: calc(100vh - 50px - 40px);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.home-hero {
  text-align: center;
  padding: 0 32px;
}

.home-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: 1px;
}

.home-subtitle {
  margin: 18px 0 0;
  font-size: 16px;
  color: #6b7280;
}
</style>
