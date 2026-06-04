import React, { useState } from 'react';
import './_group.css';

export function Bioluminescent() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center px-8 relative overflow-hidden" style={{ backgroundColor: '#020d0c' }}>
      {/* Background radial glow */}
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] rounded-full pointer-events-none animate-pulse-glow"
        style={{ background: 'radial-gradient(circle, rgba(0, 201, 167, 0.12) 0%, rgba(2, 13, 12, 0) 60%)' }}
      />

      <div className="z-10 w-full max-w-sm mx-auto flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-16 relative">
          <h1 
            className="text-4xl text-white font-sans font-light tracking-[0.25em] uppercase mb-4"
            style={{ fontFamily: '"DM Sans", "Space Grotesk", sans-serif' }}
          >
            SuiKa
          </h1>
          <p className="text-[#00c9a7]/60 text-sm tracking-wider font-light uppercase">
            A Living System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-transparent border-0 border-b border-[#04332e] text-[#00e5c0] text-lg py-2 focus:ring-0 focus:outline-none transition-all placeholder:text-[#04332e]/50 bio-input"
                autoComplete="off"
              />
            </div>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-transparent border-0 border-b border-[#04332e] text-[#00e5c0] text-lg py-2 focus:ring-0 focus:outline-none transition-all placeholder:text-[#04332e]/50 bio-input"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-4 w-full py-4 rounded-full border border-[#00e5c0]/50 text-[#00e5c0] text-sm uppercase tracking-widest hover:bg-[#00e5c0]/5 transition-colors animate-breathe focus:outline-none focus:ring-1 focus:ring-[#00e5c0]"
          >
            {isLogin ? 'Enter' : 'Initiate'}
          </button>
        </form>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="mt-12 text-[#00c9a7]/40 text-xs uppercase tracking-widest hover:text-[#00c9a7]/80 transition-colors focus:outline-none"
        >
          {isLogin ? 'Regenerate System' : 'Return to Core'}
        </button>
      </div>
    </div>
  );
}
