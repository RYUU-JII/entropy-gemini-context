import React from 'react';
import { ENTROPY_RUNTIME_BUILD_INFO } from '../platform/build/runtimeBuildInfo.js';

export class ErrorBoundaryCore extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo, ENTROPY_RUNTIME_BUILD_INFO);
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (typeof this.props.renderError === 'function') {
        return this.props.renderError({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
        });
      }
      const { translate } = this.props;
      if (typeof translate !== 'function') {
        throw new Error('ERROR_BOUNDARY_TRANSLATOR_REQUIRED');
      }
      const unknownBuildInfo = translate('common:error_boundary.unknown');
      const buildInfoLines = [
        `${translate('common:error_boundary.build_id')}: ${ENTROPY_RUNTIME_BUILD_INFO.buildId || unknownBuildInfo}`,
        `${translate('common:error_boundary.build_created_at')}: ${ENTROPY_RUNTIME_BUILD_INFO.createdAt || unknownBuildInfo}`,
        `${translate('common:error_boundary.build_target')}: ${ENTROPY_RUNTIME_BUILD_INFO.extensionTarget || unknownBuildInfo}`,
      ];
      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-start justify-start p-8 bg-[#0a0a0a] text-red-500 overflow-auto font-mono text-sm leading-tight">
          <h1 className="text-xl font-bold mb-4 border-b border-red-900 w-full pb-2 uppercase tracking-widest">
            {translate('common:error_boundary.crash_title')}
          </h1>
          <div className="mb-4">
            <h2 className="text-white/50 mb-1 text-xs uppercase">{translate('common:error_boundary.error_message')}</h2>
            <pre className="bg-[#111] p-4 rounded border border-red-900/30 whitespace-pre-wrap">
              {this.state.error?.toString()}
            </pre>
          </div>
          <div className="mb-4">
            <h2 className="text-white/50 mb-1 text-xs uppercase">{translate('common:error_boundary.build_info')}</h2>
            <pre className="bg-[#111] p-4 rounded border border-red-900/30 text-xs text-white/50 whitespace-pre-wrap">
              {buildInfoLines.join('\n')}
            </pre>
          </div>
          <div>
            <h2 className="text-white/50 mb-1 text-xs uppercase">{translate('common:error_boundary.stack_trace')}</h2>
            <pre className="bg-[#111] p-4 rounded border border-red-900/30 text-xs text-white/40 whitespace-pre overflow-x-auto">
              {this.state.errorInfo?.componentStack}
            </pre>
          </div>
          <button
            className="mt-8 px-6 py-3 border border-red-900 text-red-500 hover:bg-red-900/10 transition-colors uppercase tracking-widest font-bold"
            onClick={() => window.location.reload()}
          >
            {translate('common:error_boundary.reboot')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
