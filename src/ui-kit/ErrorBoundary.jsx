import React from 'react';
import { tRuntime } from '../domains/settings/i18n/runtime.js';
import { ErrorBoundaryCore } from './ErrorBoundaryCore.jsx';

export class ErrorBoundary extends React.Component {
    render() {
        return (
            <ErrorBoundaryCore translate={tRuntime}>
                {this.props.children}
            </ErrorBoundaryCore>
        );
    }
}
