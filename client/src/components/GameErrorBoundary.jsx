import React, { Component } from 'react';

/**
 * Game-specific error boundary that catches errors within individual games
 * without crashing the entire application
 */
class GameErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Could log to an error reporting service
    console.error(`Game error in ${this.props.gameName || 'unknown'}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="bg-bg-card border border-border rounded-xl p-8 max-w-md text-center shadow-card">
            <div className="text-accent-gold text-4xl mb-4">&#9888;</div>
            <h2 className="text-xl font-heading font-bold text-text-primary mb-2">
              {this.props.gameName || 'Game'} Error
            </h2>
            <p className="text-text-secondary mb-6">
              Something went wrong while loading this game. Please try again.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="bg-accent-gold text-bg-base font-bold rounded-lg px-6 py-2 transition-colors duration-200 hover:bg-accent-gold-dark cursor-pointer"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/games'}
                className="bg-bg-elevated text-text-secondary hover:text-text-primary rounded-lg px-6 py-2 transition-colors duration-200 cursor-pointer"
              >
                Back to Games
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GameErrorBoundary;
