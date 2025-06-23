import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainLayout from '../components/layouts/MainLayout';
import { AuthContext } from '../contexts/AuthContext';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Use the real authentication service
      console.log('Login attempt with:', formData);
      
      // Call the login function from AuthContext
      const user = await login(formData);
      console.log('Login successful:', user);
      
      // Redirect based on user role
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-[#0f1923] to-[#1a2c3d]">
        <div className="w-full max-w-md">
          {/* Card with gold accent border */}
          <div className="bg-[#192c3d] rounded-lg shadow-2xl overflow-hidden border border-[#2a3f52]">
            {/* Gold header strip */}
            <div className="bg-gradient-to-r from-[#ffc107] to-[#ff9800] h-2"></div>
            
            {/* Logo/branding area */}
            <div className="text-center pt-8 pb-4">
              <h1 className="text-3xl font-bold text-white mb-1">
                <span className="text-[#ffc107]">Virtual</span> Casino
              </h1>
              <p className="text-gray-400 text-sm">Sign in to your account</p>
            </div>
            
            {/* Error message */}
            {error && (
              <div className="mx-6 mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-md text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            
            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 pt-2">
              <div className="mb-5">
                <label htmlFor="username" className="block text-gray-300 text-sm font-medium mb-2">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#0f1923] border border-[#2a3f52] rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ffc107] focus:border-transparent transition-colors"
                    placeholder="Enter your username"
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-gray-300 text-sm font-medium">Password</label>
                  <Link to="/forgot-password" className="text-xs text-[#ffc107] hover:text-[#ffcd38] transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#0f1923] border border-[#2a3f52] rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ffc107] focus:border-transparent transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-md font-bold text-gray-900 transition-all duration-200 ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-[#ffc107] to-[#ff9800] hover:shadow-lg hover:from-[#ffcd38] hover:to-[#ffab33]'}`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing In...
                  </div>
                ) : 'Sign In'}
              </button>
              
              <div className="mt-6 text-center text-gray-400">
                <p className="text-sm">
                  Don't have an account? <Link to="/register" className="text-[#ffc107] hover:text-[#ffcd38] font-medium transition-colors">Create Account</Link>
                </p>
              </div>
            </form>
          </div>
          
          {/* Security notice */}
          <div className="mt-6 text-center text-xs text-gray-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secure, encrypted connection
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LoginPage;