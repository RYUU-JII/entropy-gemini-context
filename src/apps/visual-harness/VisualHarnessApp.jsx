import React from 'react';

class VisualHarnessErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.error) {
      return (
        <VisualHarnessErrorSurface error={this.state.error} />
      );
    }
    return this.props.children;
  }
}

export function VisualHarnessErrorSurface({ error }) {
  const errorCode = typeof error?.code === 'string' ? error.code : 'VISUAL_SCENE_RENDER_FAILED';
  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    <main className="visual-harness-error" data-visual-harness-error={errorCode}>
      <p className="visual-harness-error__eyebrow">Visual harness failure</p>
      <h1>{errorCode}</h1>
      <pre>{errorMessage}</pre>
    </main>
  );
}

export default function VisualHarnessApp({ runtime, scene }) {
  const SceneComponent = scene.Component;
  const signalReady = React.useCallback(() => {
    runtime.markReady();
  }, [runtime]);

  return (
    <VisualHarnessErrorBoundary onError={runtime.markError}>
      <SceneComponent signalReady={signalReady} />
    </VisualHarnessErrorBoundary>
  );
}
