import { z } from 'zod'
import i18n from 'i18next'

/**
 * Zod's built-in messages are English ("String must contain at least 2 character(s)").
 * This map produces them in the UI language at validation time (QA-020). Custom
 * messages in schemas are `common:validation.*` keys; render them through `t()`.
 */
export function installZodErrorMap() {
  z.setErrorMap((issue, ctx) => {
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(`common:validation.${key}`, opts)

    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === 'undefined' || issue.received === 'null') return { message: t('required') }
        break
      case z.ZodIssueCode.invalid_string:
        if (issue.validation === 'email') return { message: t('email') }
        break
      case z.ZodIssueCode.too_small:
        if (issue.type === 'string')
          return { message: Number(issue.minimum) <= 1 ? t('required') : t('minLength', { count: Number(issue.minimum) }) }
        if (issue.type === 'number') return { message: t('min', { min: Number(issue.minimum) }) }
        break
      case z.ZodIssueCode.too_big:
        if (issue.type === 'string') return { message: t('maxLength', { count: Number(issue.maximum) }) }
        if (issue.type === 'number') return { message: t('max', { max: Number(issue.maximum) }) }
        break
    }
    return { message: ctx.defaultError }
  })
}
