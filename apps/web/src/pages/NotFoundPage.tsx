import React from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineHome, HiOutlineArrowLeft } from 'react-icons/hi2';

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
    <div className="text-center max-w-md w-full">
      <div className="text-6xl sm:text-8xl font-black text-gray-200 dark:text-gray-800 mb-4">404</div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Page Not Found</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm sm:text-base">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
        <button onClick={() => window.history.back()} className="btn-secondary w-full sm:w-auto">
          <HiOutlineArrowLeft className="w-4 h-4" /> Go Back
        </button>
        <Link to="/" className="btn-primary w-full sm:w-auto">
          <HiOutlineHome className="w-4 h-4" /> Dashboard
        </Link>
      </div>
    </div>
  </div>
);
export default NotFoundPage;