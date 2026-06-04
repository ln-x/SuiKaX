import React, { useState } from 'react';

export function Lunar() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#03050d' }}
    >
      {/* Subtle celestial glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] md:w-[600px] md:h-[400px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle at top center, rgba(184, 212, 255, 0.05) 0%, rgba(3, 5, 13, 0) 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="w-full max-w-sm px-8 z-10 flex flex-col">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-['Playfair_Display'] text-white tracking-widest font-light mb-4">
            SuiKa
          </h1>
          <p className="text-[#8e95a5] text-xs uppercase tracking-[0.3em]">
            Recover your rhythm
          </p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-10" onSubmit={(e) => e.preventDefault()}>
          <div className="relative">
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-transparent border-b border-[#3b4154] text-gray-200 placeholder-[#7b8191] pb-3 text-sm tracking-widest focus:outline-none focus:border-[#b8d4ff] transition-colors duration-500 rounded-none font-light"
            />
          </div>
          
          <div className="relative">
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent border-b border-[#3b4154] text-gray-200 placeholder-[#7b8191] pb-3 text-sm tracking-widest focus:outline-none focus:border-[#b8d4ff] transition-colors duration-500 rounded-none font-light"
            />
          </div>

          <button 
            type="submit"
            className="mt-4 w-full py-4 rounded-full border border-[#3b4154] text-gray-300 text-xs uppercase tracking-[0.2em] transition-all duration-700 hover:border-[#b8d4ff] hover:text-[#b8d4ff] hover:shadow-[0_0_20px_rgba(184,212,255,0.15)] bg-transparent"
          >
            {isLogin ? 'Enter' : 'Begin'}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-20 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-[#555a69] text-[10px] uppercase tracking-widest hover:text-[#b8d4ff] transition-colors duration-500"
          >
            {isLogin ? 'Create an account' : 'I already have an account'}
          </button>
        </div>
      </div>
    </div>
  );
}
