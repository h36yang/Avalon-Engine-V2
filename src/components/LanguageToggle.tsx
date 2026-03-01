import React from 'react';
import { useGameStore } from '../store';
import { Globe } from 'lucide-react';

export function LanguageToggle() {
  const language = useGameStore(state => state.language);
  const setLanguage = useGameStore(state => state.setLanguage);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 text-white/80 hover:text-white hover:bg-black/70 transition-all shadow-lg"
      aria-label="Toggle Language"
    >
      <Globe className="w-4 h-4" />
      <span className="text-xs font-medium uppercase tracking-wider">
        {language === 'en' ? 'EN' : '中'}
      </span>
    </button>
  );
}
