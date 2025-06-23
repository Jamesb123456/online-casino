import React, { useState } from 'react';
import MainLayout from '../layouts/MainLayout';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      // In a real implementation, this would make an API call to the backend
      console.log('Login attempt with:', formData);
      
      // For demo purposes, simulate a successful login
      setTimeout(() => {
        // Redirect to home page after successful login would happen here
        console.log('Login successful');
        setLoading(false);
        window.location.href = '/'; // This would use a proper router in real implementation
      }, 1000);
      
    } catch (error) {
      console.error('Login error:', error);
      setError('Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Login</h1>
        
        {error && (
          <div className="bg-red-500 text-white p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-300 mb-2">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Enter your email"
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-300 mb-2">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Enter your password"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 rounded font-bold ${
              loading 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-amber-600 hover:bg-amber-700'
            } transition-colors`}
          >
            {loading ? 'Logging In...' : 'Login'}
          </button>
          
          <div className="mt-4 text-center text-gray-400">
            <p>
              Don't have an account? <a href="/register" className="text-amber-500 hover:underline">Register</a>
            </p>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

export default LoginPage;