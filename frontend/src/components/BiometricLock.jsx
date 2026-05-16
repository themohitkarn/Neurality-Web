import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, ShieldCheck, KeyRound, Unlock } from "lucide-react";

export default function BiometricLock({ onUnlock }) {
  const [status, setStatus] = useState("idle"); // idle, authenticating, success, error
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const handleBiometricAuth = async () => {
    setStatus("authenticating");
    
    // Simulate biometric delay
    setTimeout(() => {
      // In a real app, we'd use navigator.credentials.get() with WebAuthn
      setStatus("success");
      setTimeout(onUnlock, 800);
    }, 1500);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === "1234") { // Mock PIN
      setStatus("success");
      setTimeout(onUnlock, 500);
    } else {
      setStatus("error");
      setPin("");
      setTimeout(() => setStatus("idle"), 1000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[1000] bg-zinc-950 flex flex-col items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-12">
        <header className="space-y-4">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-400 mx-auto border border-indigo-500/20">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight italic">NEURALITY SECURE</h1>
            <p className="text-zinc-500 text-sm font-medium mt-2">Biometric authentication required</p>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {!showPin ? (
            <motion.div 
              key="biometric"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full flex flex-col items-center gap-8"
            >
              <button 
                onClick={handleBiometricAuth}
                disabled={status === "authenticating" || status === "success"}
                className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                  status === "success" ? "bg-emerald-500 text-black" : 
                  status === "error" ? "bg-rose-500 text-white" : 
                  "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {status === "authenticating" && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full"
                  />
                )}
                {status === "success" ? <Unlock size={48} /> : <Fingerprint size={48} />}
              </button>
              
              <button 
                onClick={() => setShowPin(true)}
                className="text-indigo-400 text-xs font-black uppercase tracking-[0.2em] hover:text-indigo-300 transition-colors"
              >
                Use Security PIN
              </button>
            </motion.div>
          ) : (
            <motion.form 
              key="pin"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              onSubmit={handlePinSubmit}
              className="w-full space-y-8"
            >
              <div className="flex justify-center gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full border-2 border-indigo-500/50 transition-all duration-300 ${pin.length > i ? "bg-indigo-500 scale-125" : ""}`} 
                  />
                ))}
              </div>
              
              <input 
                type="password"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="sr-only"
              />
              
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "back", 0, "clear"].map((val, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (val === "back") setPin(p => p.slice(0, -1));
                      else if (val === "clear") setPin("");
                      else if (typeof val === "number" && pin.length < 4) setPin(p => p + val);
                    }}
                    className="w-full aspect-square rounded-2xl bg-white/5 text-xl font-bold text-white hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center"
                  >
                    {val === "back" ? <KeyRound size={20} /> : val === "clear" ? "C" : val}
                  </button>
                ))}
              </div>

              <button 
                type="button"
                onClick={() => setShowPin(false)}
                className="text-zinc-500 text-xs font-black uppercase tracking-[0.2em]"
              >
                Return to Biometrics
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <footer className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-bold">
          End-to-End Encryption Verified
        </footer>
      </div>
    </motion.div>
  );
}
