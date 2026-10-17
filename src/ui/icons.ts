// 원본 괴이봇의 유령 마스코트 (bot.lua brand-ghost)
export const GHOST_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.5 2.5C7.8 2.5 5.5 5.2 5.5 8.8V10.3L3.9 9.1C2.2 7.9 .6 10.1 2 11.5L5.5 15C5.8 19.5 9.3 22 13.7 22C18.1 22 21 19.6 22 16.8C19.4 18.3 17.5 17.8 17.5 15.5V15L21 11.5C22.4 10.1 20.8 7.9 19.1 9.1L17.5 10.3V8.5C17.5 5 15.1 2.5 11.5 2.5ZM10.2 9A1.2 1.6 0 1 0 7.8 9A1.2 1.6 0 1 0 10.2 9ZM15.2 9A1.2 1.6 0 1 0 12.8 9A1.2 1.6 0 1 0 15.2 9ZM12.5 13A1 1.5 0 1 0 10.5 13A1 1.5 0 1 0 12.5 13Z"/></svg>';

const stroke = (d: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  board: stroke('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
  map: stroke('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>'),
  mission: stroke('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  phone: stroke('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>'),
  gnet: stroke('<path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/>'),
  wiki: stroke('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 7h6M8 11h6"/>'),
  settings: stroke('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  info: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  refresh: stroke('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  group: stroke('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20"/>'),
  addUser: stroke('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>'),
  call: stroke('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
  send: stroke('<path d="M4 12 20 4l-6 16-3-7-7-1Z"/>'),
  plus: stroke('<path d="M12 5v14M5 12h14"/>'),
  trash: stroke('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  book: stroke('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 7h6M8 11h6"/>'),
  back: stroke('<path d="m15 5-7 7 7 7"/>'),
  close: stroke('<path d="M6 6l12 12M18 6 6 18"/>'),
};
