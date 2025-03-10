<template>
  <app-user-profile-container :class="$style.container">
    <h1>
      <translated-text
        trans-key="profile.about-company"
      />
    </h1>

    <client-only>
      <app-formgroup
        :class="$style.form"
        :errors="errors"
        :inputs="info"
        :loading="isLoading"
        @submit="handleUpdate"
      >
        <template #after>
          <div
            v-if="errors.entity.length > 0"
            :class="$style.errorContainer"
          >
            <translated-text
              v-for="err in errors.entity"
              :key="err.message"
              :trans-key="err.message"
            />
          </div>

          <div :class="$style.column2" class="text-right -mt-3">
            <p-button
              :loading="isLoading"
              class="p-button-secondary font-bold"
              type="submit"
            >
              <translated-text trans-key="form.save" />
            </p-button>
          </div>
        </template>
      </app-formgroup>
    </client-only>
  </app-user-profile-container>
</template>

<script lang="ts">
  import {
    defineComponent,
    reactive,
    ref,
    useCssModule,
  } from "vue";
  import {
    keys,
    map,
    mapObject,
    pipe,
  } from "rambdax";
  import {
    useToast,
  } from "primevue/usetoast";
  import {
    gql,
  } from "@urql/core";
  import AppUserProfileContainer from "~/components/AppUserProfileContainer.vue";
  import {
    useUserStore,
  } from "~/store/user";
  import AppFormgroup from "~/components/util/form/app-formgroup.vue";
  import TranslatedText from "~/components/TranslatedText.vue";
  import {
    useCompanyStore,
  } from "~/store/company";
  import {
    companyCreate,
  } from "~/helpers/forms/company";
  import useTitle from "~/composables/useTitle";
  import {
    useQuery,
  } from "~/composables/useQuery";
  import {
    ICompany,
    IFile,
    IImage,
    IImageVariation,
    IIndustry,
    IUpdateCompanyInfoMutationVariables,
  } from "~/graphql/schema";

  export default defineComponent({
    name: "PageProfileCompanyHome",

    components: {
      TranslatedText,
      AppFormgroup,
      AppUserProfileContainer,
    },

    async setup() {
      useTitle("profile.about-company");

      const $style = useCssModule();
      const toast = useToast();
      const userStore = useUserStore();
      const companyStore = useCompanyStore();

      const isLoading = ref(false);

      const { vat } = userStore.user!.companies[0];

      type QData = {
        industries: Pick<IIndustry, "name">[],
        company: ICompany & {
          rasterLogo: Pick<IImage, "name" | "uid"> & {
            full: Pick<IImageVariation, "mimeType">,
          },
          vectorLogo: Pick<IFile, "uid" | "name" | "mimeType">,
        },
      };
      type QArgs = {
        vat: string,
      };
      const resp = await useQuery<QData, QArgs>({
        query: gql`
            query Company($vat: String!) {
                industries {
                    name
                }
                company(vat: $vat) {
                    uid
                    legalName
                    brandName
                    descriptionEn
                    descriptionHr
                    address
                    vat
                    website
                    industry {
                        name
                    }
                    rasterLogo {
                        uid
                        name
                        full {
                            mimeType
                        }
                    }
                    vectorLogo {
                        uid
                        name
                        mimeType
                    }
                }
            }
        `,
        variables: {
          vat,
        },
      })();

      const industries = (resp?.data?.industries || []).map((x) => ({ label: x.name, value: x.name }));

      const info_ = companyCreate(resp?.data?.company)(industries);
      const info = reactive({
        ...info_,
        industry: {
          ...info_.industry,
          classes: [
            $style.column2,
          ],
        },
      });

      type AuthError = {
        message: string,
      };
      const errors = reactive(mapObject(() => [] as AuthError[], {
        ...info,
        entity: "",
      }) as Record<keyof typeof info | "entity", AuthError[]>);
      const resetErrors = () => keys(errors).forEach((key) => errors[key] = []);

      return {
        isLoading,
        info,
        errors,
        async handleUpdate() {
          resetErrors();
          const data: IUpdateCompanyInfoMutationVariables["info"] = pipe(
            (x: typeof info) => keys(x),
            map((key) => [ key, (info[key] as { value: unknown, }).value ]),
            Object.fromEntries,
          )(info);

          if ("string" === typeof data.vectorLogo) {
            delete data.vectorLogo;
          }

          if ("string" === typeof data.rasterLogo) {
            delete data.rasterLogo;
          }

          isLoading.value = true;
          const resp = await companyStore.updateCompanyInfo({
            info: data,
          });
          isLoading.value = false;

          if (!resp) {
            errors.entity.push({
              message: "errors.somethingWentWrong",
            });
            return;
          }

          const errorList = resp.errors;

          if (!errorList) {
            toast.add({
              severity: "success",
              summary: "Success",
              closable: true,
              life: 3000,
            });

            return;
          }

          for (const error of errorList) {
            errors[error.field as keyof typeof errors].push({
              message: error.message,
            });
          }
        },
      };
    },
  });
</script>

<style lang="scss" module>
  @use "sass:color";
  @import "assets/styles/include/index";

  .container {

    .form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-column-gap: min(6.25rem, 7.5vw);

      @include media(lg) {
        grid-template-columns: 1fr;
      }

      .errorContainer {
        font-weight: bold;
        display: flex;
        flex-direction: column;
        margin-top: -.75rem;
        margin-bottom: -1.5rem;
        text-align: center;
        color: $fer-error;
        grid-column: span 2;
        gap: .5rem;
      }

      .column2 {
        grid-column: 2;

        @include media(lg) {
          grid-column: initial;
        }
      }
    }
  }
</style>
