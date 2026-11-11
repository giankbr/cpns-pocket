export const THEME_STORAGE_KEY = "cpns-theme";

/**
 * Runs in <head> before paint: resolves the stored preference (or the OS setting)
 * to data-theme="light|dark" so there is no flash of the wrong theme.
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.dataset.themePref=p;}catch(e){}})();`;

