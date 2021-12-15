<template>
  <nav class="tabs">
    <router-link to="/assets" active-class="active" class="w-full tab-item">
      <vue-feather type="pie-chart" size="22px" />
    </router-link>
    <router-link to="/" active-class="active" class="w-full tab-item">
      <vue-feather type="image" size="22px" />
    </router-link>
    <router-link to="/transactions" active-class="active" class="w-full tab-item">
      <vue-feather type="clock" size="22px" />
    </router-link>
    <router-link to="/receive" active-class="active" class="w-full tab-item">
      <vue-feather type="download" size="22px" />
    </router-link>
    <router-link to="/send" active-class="active" class="w-full tab-item">
      <vue-feather type="send" size="22px" />
    </router-link>
  </nav>
</template>
