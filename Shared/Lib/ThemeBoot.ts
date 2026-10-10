/**
 * Inline skript do <head>: nastaví motiv ještě před prvním vykreslením, jinak
 * by dark mode při startu probliknul bílou. Čte totéž, co UseSettingsStore
 * (localStorage "lockin-settings"); po hydrataci to dál drží AppShell.
 */
export const THEME_BOOT_SCRIPT = `try{var t=(JSON.parse(localStorage.getItem("lockin-settings")||"{}").state||{}).theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;
