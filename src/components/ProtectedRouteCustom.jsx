import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthCustom } from './AuthContextCustom';
import { Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ProtectedRouteCustom({ children }) {
  const { user, loading } = useAuthCustom();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={createPageUrl('LoginCustom')} replace />;
  }

  return children;
}