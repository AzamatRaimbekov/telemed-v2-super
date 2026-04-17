export interface ActionIntent {
  patterns: Record<string, string[]>;
  execute: () => void;
}

export function createActionIntents(callbacks: {
  goBack: () => void;
  refresh: () => void;
  logout: () => void;
  showHelp: () => void;
}): ActionIntent[] {
  return [
    {
      patterns: {
        ru: ["назад", "вернуться", "обратно"],
        ky: ["артка", "кайтуу"],
        en: ["back", "go back"],
      },
      execute: callbacks.goBack,
    },
    {
      patterns: {
        ru: ["обновить", "обнови", "перезагрузить"],
        ky: ["жаңылоо", "жаңырт"],
        en: ["refresh", "reload"],
      },
      execute: callbacks.refresh,
    },
    {
      patterns: {
        ru: ["выйти", "выход", "разлогиниться"],
        ky: ["чыгуу", "чыгып кетүү"],
        en: ["logout", "sign out", "log out"],
      },
      execute: callbacks.logout,
    },
    {
      patterns: {
        ru: ["помощь", "помоги", "что ты умеешь", "команды"],
        ky: ["жардам", "жардам бер"],
        en: ["help", "what can you do", "commands"],
      },
      execute: callbacks.showHelp,
    },
  ];
}
