import React, { Component } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error information
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // You could also log to an error reporting service here
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <Card className="w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
              <p className="text-gray-700 mb-6">
                An unexpected error has occurred. Our team has been notified.
              </p>
              <div className="bg-gray-100 p-4 rounded-md mb-4 overflow-auto max-h-64">
                <p className="font-mono text-sm text-gray-800">
                  {this.state.error && this.state.error.toString()}
                </p>
              </div>
              <div className="flex justify-between">
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="bg-primary hover:bg-primary-dark"
                >
                  Return to Home
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Refresh Page
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;