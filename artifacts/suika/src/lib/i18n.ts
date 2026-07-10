import { create } from "zustand";

export type Language = "en" | "de" | "es" | "zh";

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const getInitialLang = (): Language => {
  const saved = localStorage.getItem("suika_lang") as Language;
  if (saved && ["en", "de", "es", "zh"].includes(saved)) {
    return saved;
  }
  return "en";
};

export const useI18nStore = create<I18nState>((set) => ({
  language: getInitialLang(),
  setLanguage: (lang: Language) => {
    localStorage.setItem("suika_lang", lang);
    set({ language: lang });
  },
}));

const translations = {
  en: {
    "nav.home": "Home",
    "nav.earth": "Earth",
    "nav.local": "Local",
    "nav.action": "Action",
    "nav.health": "Health",
    "nav.insights": "Insights",
    "nav.login": "Log in",
    "auth.tagline": "A quiet sanctuary for nervous system recovery.",
    "auth.signin": "Sign In",
    "auth.create": "Create Account",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.submit": "Enter",
  },
  de: {
    "nav.home": "Start",
    "nav.earth": "Erde",
    "nav.local": "Lokal",
    "nav.action": "Aktion",
    "nav.health": "Gesundheit",
    "nav.insights": "Einblicke",
    "nav.login": "Anmelden",
    "auth.tagline": "Ein ruhiger Zufluchtsort für die Erholung des Nervensystems.",
    "auth.signin": "Anmelden",
    "auth.create": "Konto erstellen",
    "auth.username": "Benutzername",
    "auth.password": "Passwort",
    "auth.submit": "Eintreten",
  },
  es: {
    "nav.home": "Inicio",
    "nav.earth": "Tierra",
    "nav.local": "Local",
    "nav.action": "Acción",
    "nav.health": "Salud",
    "nav.insights": "Perspectivas",
    "nav.login": "Iniciar sesión",
    "auth.tagline": "Un santuario tranquilo para la recuperación del sistema nervioso.",
    "auth.signin": "Iniciar sesión",
    "auth.create": "Crear cuenta",
    "auth.username": "Usuario",
    "auth.password": "Contraseña",
    "auth.submit": "Entrar",
  },
  zh: {
    "nav.home": "首页",
    "nav.earth": "地球",
    "nav.local": "本地",
    "nav.action": "行动",
    "nav.health": "健康",
    "nav.insights": "洞察",
    "nav.login": "登录",
    "auth.tagline": "神经系统恢复的宁静避难所。",
    "auth.signin": "登录",
    "auth.create": "创建账户",
    "auth.username": "用户名",
    "auth.password": "密码",
    "auth.submit": "进入",
  }
};

export const useTranslation = () => {
  const language = useI18nStore((state) => state.language);
  
  const t = (key: keyof typeof translations.en) => {
    return translations[language]?.[key] || translations.en[key] || key;
  };
  
  return { t, language, setLanguage: useI18nStore.getState().setLanguage };
};
