import {
  defineStore,
} from "pinia";
import {
  useState as useGtagState,
} from "vue-gtag-next";
import {
  unref,
} from "vue";
import {
  useCookie,
} from "#app";

const COOKIE_NAME = "jf-meetup-cookie-consent";

enum ConsentState {
  Accepted = "ACCEPTED",
  Denied = "DENIED",
  Undecided = "UNDECIDED",
}

const consentCookie = () => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return useCookie<ConsentState>(
    COOKIE_NAME,
    {
      expires: nextMonth,
      path: "/",
      sameSite: "strict",
    },
  );
};

export const useCookieConsentStore = defineStore(
  "cookieConsent",
  {
    state: () => ({
      consent: ConsentState.Denied,
    }),

    getters: {
      hasConsent(state) {
        return state.consent === ConsentState.Accepted;
      },

      showConsent(state) {
        return state.consent === ConsentState.Undecided;
      },
    },

    actions: {
      fetchConsent() {
        const consent = unref(consentCookie());

        this.processConsent(consent || ConsentState.Undecided);
      },

      processConsent(status: ConsentState) {
        this.consent = status;

        const cookie = consentCookie();
        const cookieValue = unref(cookie);
        const cookieValueMatches = cookieValue === status;

        if (!cookieValue || !cookieValueMatches) {
          cookie.value = status;
        }

        const {
          isEnabled,
        } = useGtagState();

        if (!isEnabled) {
          return;
        }

        switch (status) {
          case ConsentState.Accepted:
            isEnabled.value = true;
            break;

          default:
            isEnabled.value = false;
            break;
        }
      },

      acceptConsent() {
        this.processConsent(ConsentState.Accepted);
      },

      denyConsent() {
        this.processConsent(ConsentState.Denied);
      },

      clearConsent() {
        this.processConsent(ConsentState.Undecided);
      },
    },
  },
);
