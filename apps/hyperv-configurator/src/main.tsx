import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

/** Shows a recovery message instead of a blank page if a section fails to render. */
class ErrorBoundary extends React.Component<React.PropsWithChildren, { error: string }> {
  state = { error: '' }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'Unexpected error' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Hyper-V Configurator failed to render', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="panel">
        <h1>Unable to display the design</h1>
        <p>{this.state.error}</p>
        <p>Your saved draft remains in this browser. Reload to recover it; an unreadable draft is preserved and reported when the application opens.</p>
        <button onClick={() => location.reload()}>Reload application</button>
      </main>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>,
)
