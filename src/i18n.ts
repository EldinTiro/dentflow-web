import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// EN
import enCommon from './locales/en/common.json'
import enDashboard from './locales/en/dashboard.json'
import enPatients from './locales/en/patients.json'
import enStaff from './locales/en/staff.json'
import enAppointments from './locales/en/appointments.json'
import enAuth from './locales/en/auth.json'
import enSettings from './locales/en/settings.json'
import enAdmin from './locales/en/admin.json'
import enErrors from './locales/en/errors.json'
import enBilling from './locales/en/billing.json'

// BS
import bsCommon from './locales/bs/common.json'
import bsDashboard from './locales/bs/dashboard.json'
import bsPatients from './locales/bs/patients.json'
import bsStaff from './locales/bs/staff.json'
import bsAppointments from './locales/bs/appointments.json'
import bsAuth from './locales/bs/auth.json'
import bsSettings from './locales/bs/settings.json'
import bsAdmin from './locales/bs/admin.json'
import bsErrors from './locales/bs/errors.json'
import bsBilling from './locales/bs/billing.json'

// DE
import deCommon from './locales/de/common.json'
import deDashboard from './locales/de/dashboard.json'
import dePatients from './locales/de/patients.json'
import deStaff from './locales/de/staff.json'
import deAppointments from './locales/de/appointments.json'
import deAuth from './locales/de/auth.json'
import deSettings from './locales/de/settings.json'
import deAdmin from './locales/de/admin.json'
import deErrors from './locales/de/errors.json'
import deBilling from './locales/de/billing.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        dashboard: enDashboard,
        patients: enPatients,
        staff: enStaff,
        appointments: enAppointments,
        auth: enAuth,
        settings: enSettings,
        admin: enAdmin,
        errors: enErrors,
        billing: enBilling,
      },
      bs: {
        common: bsCommon,
        dashboard: bsDashboard,
        patients: bsPatients,
        staff: bsStaff,
        appointments: bsAppointments,
        auth: bsAuth,
        settings: bsSettings,
        admin: bsAdmin,
        errors: bsErrors,
        billing: bsBilling,
      },
      de: {
        common: deCommon,
        dashboard: deDashboard,
        patients: dePatients,
        staff: deStaff,
        appointments: deAppointments,
        auth: deAuth,
        settings: deSettings,
        admin: deAdmin,
        errors: deErrors,
        billing: deBilling,
      },
    },
    defaultNS: 'common',
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  })

export default i18n
