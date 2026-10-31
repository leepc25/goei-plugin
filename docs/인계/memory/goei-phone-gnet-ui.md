---
name: goei-phone-gnet-ui
description: 괴담톡·괴담넷 화면 규칙 (두 칸 레이아웃, 휴지통, 공지, 입력줄) — read before changing phone.ts or gnet.ts UI
metadata:
  type: feedback
---

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.

both use the same two-pane layout (PC list left / content right; mobile one screen at a time), same tabs + 5-tool row + bottom composer. PC: clicking the selected item again closes it. Lists get trash icons (tap twice). Notices: PC split, mobile inline preview → expand. Mobile composer has a back button right of send. 괴담넷 on MOBILE is different: posts and DM threads expand inline in the list (no screen switching; user found list↔detail tiring). Post/notice content must look like a board post / official notice (title bar, divider lines, comment rows), not stacked boxes. Notices on mobile list show title only. My nickname shows beside the 쪽지함 tab; the tool button is just 「닉네임」. No wiki button on 괴담넷 posts. Clipboard paste of photos must keep working in every composer (tested).

v0.16.23 (2026-10-18, thread 세부 수정 5): tool row moved to the BOTTOM of the list column (PC: 65px, same height as right composer; mobile: collapsed drawer above bottom bar, tap/swipe up opens, ui/drawer.ts). Notices are toasts that fade (ui/toast.ts), never a line. Unread = red circle white number (KakaoTalk). Chips: contact groups show count; 대화·공지 have 전체/안읽음. Reply composer opens right under the comment (PC and mobile); mobile expanded post has no duplicate header. Mobile bottom bar order 위키·임무·상황판(home, center, tinted)·괴담톡·괴담넷, no looping; close hidden at both edges, pull past its width to close (ui/mbar.ts). Mobile bottom pull-up drawer (user loves it, 2026-10-18): put far-from-thumb buttons there. 임무 목표: region+place search only (filter chips stay on top: counts must be visible); 편성: 작전 메모 only (출발/임무 요청 must NOT go in a drawer); 상황판: 신분증+설정 (no section-jump buttons: scrolling is faster); wiki mobile: no rail, drawer 메인·검색·목록·설정. Wiki search and write are one (no 작성 button; no hit → 「작성하기」). Mobile swipe right anywhere = back one step (ui/swipeback.ts, backStep in app.ts). Settings: ONE settings per feature + 「기본값으로 저장」 (prefs.vars for ph/gn/nw); no 이 채팅/새 채팅 기본값 toggle.

Wiki (v0.16.23, user design 2026-10-18): rail = only 위키 메인·작성·설정; rest of rail is a toggle (chevron), click/drag opens the list drawer OVER the doc (doc pane fixed), left drawer on mobile too. Drawer: search, tabs 전체·이번 이야기·괴이·특수·인물·세력·기타 (empty hidden), 가나다 groups + thin ㄱ–ㅎ index on right edge (tap/drag jumps), RP-written docs get a dot; non-roster RP docs → 인물 if doc_type=person else 기타. Main: hero 「괴이위키」+count+search, 지금 얽힌 문서 = only where the user is now (상태창 target event + its deployed agents + 작전투입 agents + 상태창 place), NOT the whole 상황판 (user: 상황판 is background); cards are flat rows (48px photo + name), not tall photo cards; 이번 이야기에서 쓴 문서, 분류 tiles → open drawer on that tab. User REMOVED 무작위 문서 and 작성이 필요한 문서; do not re-add. Base docs: 141 hardcoded in card folder 📖위키 (card/wiki-base.json via scripts/wiki-import.mjs, titles card/wiki-titles.json), rumor-level Namuwiki snark 5–8k chars, written by GPT from /mnt/project-files/goei-plugin/docs/괴이위키_GPT지침.md; user uploads result_*.txt → validate with wiki-import. 관리국 본부 canonicalizes to 관리국.

**Why:** user asked for these one by one on 2026-10-17 and approved the result ("훌륭하다").
**How to apply:** keep phone.ts and gnet.ts visually identical in structure; related: [[goei-bot-plugin-project]].
