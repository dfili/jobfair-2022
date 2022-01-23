import {
  createClient,
  dedupExchange,
  fetchExchange,
} from "@urql/core";
import {
  unref,
} from "vue";
import {
  mergeDeepRight,
} from "rambdax";
import {
  defineNuxtPlugin,
  useCookie,
  useRuntimeConfig,
} from "#app";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  return {
    provide: {
      urql: createClient({
        url: `${ config.API_BASE as string }/graphql`,
        exchanges: [
          dedupExchange,
          fetchExchange,
        ],
        fetchOptions: () => {
          let config: RequestInit = {};

          // Session ID header for server
          {
            const sessionId = unref(useCookie("jobfair-session"));

            if (sessionId) {
              config = mergeDeepRight(config, {
                headers: {
                  "x-session-id": sessionId,
                },
              });
            }
          }

          return config;
        },
      }),
    },
  };
});
