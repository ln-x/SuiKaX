import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

document.documentElement.classList.add("dark");

const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBase) setBaseUrl(apiBase);

createRoot(document.getElementById("root")!).render(<App />);
