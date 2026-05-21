import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isRecovering: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    const isChunkLoadError = error?.name === 'ChunkLoadError' || 
                             error?.message?.includes('Failed to fetch dynamically imported module') ||
                             error?.message?.includes('text/html') ||
                             error?.message?.includes('dynamically imported module');

    if (isChunkLoadError && !this.state.isRecovering) {
      this.setState({ isRecovering: true });
      console.log("ChunkLoadError detected. Attempting to unregister Service Worker and reload...");
      
      // Try to unregister service workers to clear stale caches
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let registration of registrations) {
            registration.unregister();
          }
          // Force a hard reload from server
          window.location.reload(true);
        }).catch(err => {
          console.error("Failed to unregister SW:", err);
          window.location.reload(true);
        });
      } else {
        window.location.reload(true);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isRecovering) {
        return (
          <div style={{ height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b', color: 'white' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Updating App...</h2>
            <p style={{ color: '#a1a1aa' }}>Fetching the latest version.</p>
          </div>
        );
      }
      return (
        <div style={{ height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b', color: 'white' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Something went wrong.</h2>
          <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>Please refresh the page to try again.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#e11d48', color: 'white', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}
          >
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
