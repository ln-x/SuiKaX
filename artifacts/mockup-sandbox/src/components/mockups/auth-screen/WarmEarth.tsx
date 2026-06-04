import React, { useState } from "react";
import "./_group.css";

export function WarmEarth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="warm-earth-bg min-h-screen w-full flex flex-col justify-center items-center px-8 py-12 text-[#e8dbce] overflow-hidden">
      <div className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="mb-16 text-center">
          <h1 className="text-5xl font-['Lora'] text-[#c97b3a] mb-3 tracking-wide font-medium">
            SuiKa
          </h1>
          <p className="text-[#a39081] text-xs tracking-widest uppercase font-light">
            Find your center again
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-8 mb-12">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-transparent border-b border-[#8a7260] px-2 py-3 text-[#e8dbce] placeholder:text-[#6e5c4f] focus:outline-none focus:border-[#c97b3a] transition-colors rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent border-b border-[#8a7260] px-2 py-3 text-[#e8dbce] placeholder:text-[#6e5c4f] focus:outline-none focus:border-[#c97b3a] transition-colors rounded-none"
            />
          </div>
          
          <button
            type="submit"
            className="mt-6 w-full rounded-full border border-[#c97b3a] py-4 text-[#e8dbce] font-medium tracking-wider uppercase text-sm hover:bg-[#c97b3a]/10 transition-colors focus:outline-none focus:ring-1 focus:ring-[#c97b3a] focus:ring-offset-2 focus:ring-offset-[#1a1008]"
          >
            {isLogin ? "Sign In" : "Begin Journey"}
          </button>
        </form>

        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="text-[#965a29] text-sm hover:text-[#c97b3a] transition-colors focus:outline-none underline-offset-4 hover:underline"
        >
          {isLogin 
            ? "New here? Create an account" 
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
