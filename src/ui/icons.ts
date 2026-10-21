// 원본 괴이봇의 유령 마스코트 (bot.lua brand-ghost)
export const GHOST_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.5 2.5C7.8 2.5 5.5 5.2 5.5 8.8V10.3L3.9 9.1C2.2 7.9 .6 10.1 2 11.5L5.5 15C5.8 19.5 9.3 22 13.7 22C18.1 22 21 19.6 22 16.8C19.4 18.3 17.5 17.8 17.5 15.5V15L21 11.5C22.4 10.1 20.8 7.9 19.1 9.1L17.5 10.3V8.5C17.5 5 15.1 2.5 11.5 2.5ZM10.2 9A1.2 1.6 0 1 0 7.8 9A1.2 1.6 0 1 0 10.2 9ZM15.2 9A1.2 1.6 0 1 0 12.8 9A1.2 1.6 0 1 0 15.2 9ZM12.5 13A1 1.5 0 1 0 10.5 13A1 1.5 0 1 0 12.5 13Z"/></svg>';

const stroke = (d: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  board: stroke('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
  map: stroke('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>'),
  mission: stroke('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  phone: stroke('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  gnet: stroke('<path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/>'),
  wiki: stroke('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 7h6M8 11h6"/>'),
  settings: stroke('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  swap: stroke('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
  idcard: stroke('<rect x="5" y="3" width="14" height="18" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8.5 16.5c.7-1.7 2-2.5 3.5-2.5s2.8.8 3.5 2.5"/>'),
  info: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  refresh: stroke('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  group: stroke('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20"/>'),
  person: stroke('<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5a7 7 0 0 1 14 0"/>'),
  org: stroke('<rect x="4" y="3.5" width="10" height="17" rx="1.5"/><path d="M14 9.5h4.5a1.5 1.5 0 0 1 1.5 1.5v9.5H14M7.5 7.5h3M7.5 11h3M7.5 14.5h3M10 20.5v-2.5"/>'),
  addUser: stroke('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>'),
  pen: stroke('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
  mail: stroke('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>'),
  call: stroke('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
  // 보내기: 굵은 위쪽 화살표 (메신저 전송 버튼)
  send: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5.5M5.5 12 12 5.5 18.5 12"/></svg>',
  plus: stroke('<path d="M12 5v14M5 12h14"/>'),
  trash: stroke('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  book: stroke('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 7h6M8 11h6"/>'),
  back: stroke('<path d="m15 5-7 7 7 7"/>'),
  // 관찰형 게임 「관리국 순찰」: 게임패드
  star: stroke('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z"/>'),
  game: stroke('<path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 3.6a2.4 2.4 0 0 1-4.2 1.1L14.5 15h-5l-1.7 2.2a2.4 2.4 0 0 1-4.2-1.1L3 12.5A4 4 0 0 1 7 8Z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>'),
  search: stroke('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  cctv: stroke('<rect x="2.5" y="4.5" width="19" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/><circle cx="7" cy="9" r="1.5" fill="currentColor" stroke="none"/>'),
  grid: stroke('<rect x="3.5" y="4" width="7" height="7" rx="1.5"/><rect x="13.5" y="4" width="7" height="7" rx="1.5"/><rect x="3.5" y="14" width="7" height="7" rx="1.5"/><rect x="13.5" y="14" width="7" height="7" rx="1.5"/>'),
  list: stroke('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>'),
  pin: stroke('<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>'),
  // 상황 딱지 (v0.16.21): 사건은 경광등, 특수는 문어 모양 유령
  siren: stroke('<path d="M6.5 17.5V12a5.5 5.5 0 0 1 11 0v5.5"/><path d="M4 17.5h16V21H4z"/><path d="M12 2v2.5M3.5 5.5l1.8 1.8M20.5 5.5l-1.8 1.8M12 10.5v3.5"/>'),
  spook: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5v10.6c0 .8.9 1.2 1.5.7l1.5-1.2 1.7 1.4c.4.3.9.3 1.3 0l1.5-1.4 1.5 1.4c.4.3.9.3 1.3 0l1.7-1.4 1.5 1.2c.6.5 1.5.1 1.5-.7V10A7.5 7.5 0 0 0 12 2.5ZM9.3 8.4a1.4 1.7 0 1 0 0 3.4a1.4 1.7 0 1 0 0-3.4Zm5.4 0a1.4 1.7 0 1 0 0 3.4a1.4 1.7 0 1 0 0-3.4Z"/></svg>',
  expand: stroke('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: stroke('<path d="M6 6l12 12M18 6 6 18"/>'),
  up: stroke('<path d="m6 15 6-6 6 6"/>'),
  down: stroke('<path d="m6 9 6 6 6-6"/>'),
  grip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
};
