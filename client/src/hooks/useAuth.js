import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Custom hook for using authentication context
 * @returns {Object} Authentication context
 */
export const useAuth = () => {
  const authContext = useContext(AuthContext);
  
  if (authContext === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return authContext;
};

export default useAuth;
