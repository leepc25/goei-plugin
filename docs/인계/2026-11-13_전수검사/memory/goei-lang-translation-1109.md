---
name: goei-lang-translation-1109
description: 11-09 user facts — plugin features output Korean only (keep it); RisuAI 후번역 is manual and always runs LAST, after plugin display handlers, so [▣]/[shop] tags never break
metadata:
  type: project
  modified: 2026-11-09T15:15:37.126Z
---
11-09 15:10 KST (thread 릴리스본 버그 고치기): user asked whether 괴담넷·괴담톡 etc. output only Korean → yes; `$st_lang` (start screen ko/en) only picks the first-scene text; all feature guides fix "Write in Korean"; only 인물 기록 has its own 기록 언어 setting. User decided: keep Korean (「그냥 한글로 두는게 낫겠군」) because RisuAI post-translation only touches chat bubbles, never plugin windows.
User facts about RisuAI (treat as authoritative): 「리수가 번역을 먼저 돌리는 경우는 없어」「번역은 수동이라 무조껀 제일 마지막이야」 — post-translation is manual and always the last step, after the plugin's 'display' script handler has already stripped `[▣|…]`/`[shop: …]` and drawn the status box / 상점 열기 card. So no extra safeguard is needed for English-output users (「영출」 is common among users). Plugin parsing (ledger, points, items, orders) reads stored message.data anyway. RisuAI source (ChatBody.svelte markParsing, 2026-10) confirms: default path ParseMarkdown('pretranslate', runs editdisplay plugin handlers) → translateHTML → postTranslationParse. Only exception: translatorType 'llm' + translateBeforeHTMLFormatting=true (default off) translates the raw text first.
**How to apply:** don't propose translation safeguards or multi-language guides again unless the user asks; if English output is ever wanted, the plugin would have to call a translator itself for its own windows.
