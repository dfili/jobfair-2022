<template>
  <nuxt-nested-page
    v-if="!hasCompany"
  />
  <page-not-found
    v-else
  />
</template>

<script lang="ts">
  import {
    computed,
    defineComponent,
  } from "vue";
  import {
    useUserStore,
  } from "~/store/user";
  import PageNotFound from "~/components/page-not-found.vue";

  export default defineComponent({
    name: "PageRegisterCompanyHandler",

    components: {
      PageNotFound,
    },

    setup() {
      const userStore = useUserStore();

      const hasCompany = computed(() => userStore.hasCompany);

      return {
        hasCompany,
      };
    },
  });
</script>
