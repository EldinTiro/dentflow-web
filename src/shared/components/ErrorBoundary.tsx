import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  children: ReactNode
  /** When this value changes the boundary clears its error — pass the route path so navigating away recovers. */
  resetKey?: unknown
}

interface State {
  error: Error | null
  resetKey: unknown
}

/**
 * Without a boundary, any render error unmounts the whole React tree and leaves a
 * blank page that only a full reload recovers from (QA-001).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) return <ErrorFallback onRetry={() => this.setState({ error: null })} />
    return this.props.children
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('common')
  return (
    <div role="alert" className="m-6 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">{t('errorBoundary.title')}</p>
      <p className="mt-1">{t('errorBoundary.description')}</p>
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={onRetry} className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-700">
          {t('errorBoundary.retry')}
        </button>
        <button type="button" onClick={() => window.location.reload()} className="rounded-md border border-red-300 px-3 py-1.5 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900">
          {t('errorBoundary.reload')}
        </button>
      </div>
    </div>
  )
}
