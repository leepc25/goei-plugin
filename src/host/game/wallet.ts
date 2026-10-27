// 게임 다리: 가계부 (core/wallet.ts). 필드 가게·거래가 본편과 같은 장부에 적는다. 게임을 연 채팅에만 쓴다 (채팅이 바뀌면 안 씀, field.ts 와 같음).
import type { GameWallet } from '../../game/bridge';
import { anchorOf } from '../../core/visit';
import { aliveAnchors, readWallet, walletBalance, walletVars, withFieldTrade, WALLET_START_DEFAULT } from '../../core/wallet';
import { colConfig } from '../../core/world/statuscols';
import { getPrefs } from '../../core/settings';
import { loadContext, updateChat } from '../risu';
import type { Chat } from '../../core/types';

const start = () => getPrefs().walletStart ?? WALLET_START_DEFAULT;
const on = (chat: Chat) => colConfig(chat.scriptstate).wallet !== 'off';
const balanceOf = (chat: Chat) => walletBalance(readWallet(chat.scriptstate, start()), aliveAnchors(chat));

export function createWallet(): GameWallet {
  const opening = loadContext();
  let chain: Promise<unknown> = Promise.resolve();
  const same = async () => {
    const origin = await opening;
    const c = await loadContext();
    if (!origin || !c || c.charIndex !== origin.charIndex || c.chatIndex !== origin.chatIndex || c.char.chaId !== origin.char.chaId || c.chat.id !== origin.chat.id) return null;
    return c;
  };
  return {
    async balance() {
      const c = await same().catch(() => null);
      return c && on(c.chat) ? balanceOf(c.chat) : null;
    },
    add(amount, memo, where) {
      // 거래 순서가 뒤바뀌지 않게 하나씩
      const run = async (): Promise<number | null> => {
        if (!Number.isFinite(amount) || !Math.trunc(amount)) return null;
        const c = await same();
        if (!c || !on(c.chat)) return null;
        let after: number | null = null;
        await updateChat(c.charIndex, c.chatIndex, (chat) => {
          if (chat.id !== c.chat.id) return null;
          const w = withFieldTrade(readWallet(chat.scriptstate, start()), anchorOf(chat), amount, String(memo ?? ''), `f_${crypto.randomUUID()}`, where ?? {});
          const next = { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(w) } };
          after = balanceOf(next);
          return next;
        });
        return after;
      };
      const next = chain.then(run, run);
      chain = next.catch(() => {});
      return next.catch(() => null);
    },
  };
}
