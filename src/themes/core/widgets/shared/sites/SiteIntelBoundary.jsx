import React from 'react';

// Contain malformed readings without unmounting policy controls or the list.
// A newly admitted profile is a fresh attempt; polling status is not a reset.
export default class SiteIntelBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[SiteIntel] reading failed:', error, info); }
  componentDidUpdate(previous) {
    if (this.state.error && (previous.domain !== this.props.domain || previous.profile !== this.props.profile)) {
      this.setState({ error: null });
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    const { t } = this.props;
    return <>{this.props.errorContent}<div className="site-intel__failure" role="alert">
      <h3>{t('site_workspace.zone_failure_label')}</h3>
      <p>{t('site_workspace.zone_failure_body')}</p>
      <code>{this.state.error.message || String(this.state.error)}</code>
    </div></>;
  }
}
