import React from 'react';
import Button from './Button';

interface ApiErrorProps {
  onRetry: () => void;
}

const ApiError: React.FC<ApiErrorProps> = ({ onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] bg-black/20 backdrop-blur-md border border-red-500/50 rounded-xl p-8 text-center">
      <div className="w-16 h-16 flex items-center justify-center bg-red-500/10 rounded-full mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Connection to Server Failed</h2>
      <p className="text-gray-400 max-w-md mb-6">
        The application could not connect to the backend server. Please check your internet connection and try again. If the problem persists, the server may be temporarily unavailable.
      </p>
      <Button onClick={onRetry} variant="primary">
        Retry Connection
      </Button>
    </div>
  );
};

export default ApiError;