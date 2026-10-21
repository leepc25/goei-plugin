# 공용 요원 NAI 프롬프트 (2026-10-21)

사진이 없는 요원 대신 쓰는 그림 30장입니다. 기존 요원 그림(`assets/agents/*_default`)과 톤을 맞추려고 NAI로 직접 만듭니다.

## 공통 설정

- 크기: 832×1216 (세로). 기존 요원 그림과 같음.
- 배경: 순검정. 무릎 위까지 서 있는 한 사람, 가운데.
- **얼굴이 드러나면 안 됩니다.** 여러 요원 대신 쓰는 그림이라 그림자·모자·후드·가면·머리카락으로 가립니다.
- 머리는 화면 위쪽 4분의 1 안에 (플러그인이 그 자리를 얼굴 아이콘으로 잘라 씀).
- 화풍 태그는 기존 요원 그림에 쓰던 것을 그대로 앞에 붙이세요. 아래 `[화풍]` 자리입니다.
- 파일 이름은 표의 이름 그대로 (예: `Shared Agent Suit Female 1.png`). 그 이름이 에셋 이름이 됩니다.

**공통 앞부분 (Base Prompt 맨 앞)**

```
[화풍], 1person, solo, cowboy shot, standing, facing viewer, slightly turned, black background, simple background, dark, muted colors, shaded face
```

**공통 Undesired Content**

```
lowres, bad anatomy, bad hands, extra digits, fewer digits, text, letters, watermark, signature, logo, username, emblem, insignia, detailed face, visible eyes, eye contact, multiple people, background scenery, white background, gradient background, cropped head
```

각 줄의 프롬프트를 공통 앞부분 뒤에 붙이세요. 여자는 `1girl`, 남자는 `1boy`, 성별 없는 후드 그림은 `1other, androgynous`를 `1person` 자리에 넣습니다.

## 정장 (관리국·가짜 관리국) · 6장

| 파일 이름 | 붙일 프롬프트 |
| --- | --- |
| Shared Agent Suit Female 1 | 1girl, black suit, black necktie, white collared shirt, black pants, formal, long hair, black hair, hair over eyes, shaded face, black gloves, hands at sides |
| Shared Agent Suit Female 2 | 1girl, black suit, black necktie, white collared shirt, black pants, formal, short hair, bob cut, shaded face, holding handgun, gun pointed down |
| Shared Agent Suit Female 3 | 1girl, black suit, black necktie, white collared shirt, black pants, formal, ponytail, sunglasses, shaded face, crossed arms |
| Shared Agent Suit Male 1 | 1boy, black suit, black necktie, white collared shirt, black pants, formal, short hair, shaded face, hands in pockets |
| Shared Agent Suit Male 2 | 1boy, black suit, black necktie, white collared shirt, black pants, formal, short hair, sunglasses, shaded face, adjusting cuffs |
| Shared Agent Suit Male 3 | 1boy, black suit, black necktie, white collared shirt, black pants, formal, holding umbrella, closed umbrella, shaded face, looking down |

## 가면 (백일몽) · 6장

| 파일 이름 | 붙일 프롬프트 |
| --- | --- |
| Shared Agent Masked Female 1 | 1girl, office lady suit, blazer, lanyard, id card, pencil skirt, office, fox mask, animal mask, mask covering face, long hair |
| Shared Agent Masked Female 2 | 1girl, office lady suit, blazer, lanyard, id card, pencil skirt, office, cat mask, animal mask, mask covering face, short hair, holding clipboard |
| Shared Agent Masked Female 3 | 1girl, office lady suit, blazer, lanyard, id card, pencil skirt, office, rabbit mask, animal mask, mask covering face, ponytail, cylinder container at hip |
| Shared Agent Masked Male 1 | 1boy, office lady suit, blazer, lanyard, id card, pencil skirt, office, wolf mask, animal mask, mask covering face, business suit, standing straight |
| Shared Agent Masked Male 2 | 1boy, office lady suit, blazer, lanyard, id card, pencil skirt, office, owl mask, animal mask, mask covering face, business suit, sleeves rolled up |
| Shared Agent Masked Male 3 | 1boy, office lady suit, blazer, lanyard, id card, pencil skirt, office, bear mask, animal mask, mask covering face, business suit, muscular, carrying briefcase |

## 프리랜서 (협회·중림·프리랜서) · 6장

| 파일 이름 | 붙일 프롬프트 |
| --- | --- |
| Shared Agent Freelancer Female 1 | 1girl, streetwear, tactical vest, cargo pants, combat boots, hooded jacket, hood up, shadow over eyes, holding baton |
| Shared Agent Freelancer Female 2 | 1girl, streetwear, tactical vest, cargo pants, combat boots, leather jacket, baseball cap, cap over eyes, knife sheath, thigh strap |
| Shared Agent Freelancer Female 3 | 1girl, streetwear, tactical vest, cargo pants, combat boots, long coat, scarf over mouth, gloves, hair over eyes |
| Shared Agent Freelancer Male 1 | 1boy, streetwear, tactical vest, cargo pants, combat boots, bomber jacket, baseball cap, cap over eyes, duffel bag, bag over shoulder |
| Shared Agent Freelancer Male 2 | 1boy, streetwear, tactical vest, cargo pants, combat boots, hoodie, utility vest, face mask, mouth mask, bandaged hands |
| Shared Agent Freelancer Male 3 | 1boy, streetwear, tactical vest, cargo pants, combat boots, trench coat, popped collar, collar covering face, holding crowbar |

## 민간인 · 6장

| 파일 이름 | 붙일 프롬프트 |
| --- | --- |
| Shared Agent Civilian Female 1 | 1girl, casual clothes, everyday clothes, hoodie, long coat, backpack, looking away, hair over face |
| Shared Agent Civilian Female 2 | 1girl, casual clothes, everyday clothes, cardigan, pleated skirt, surgical mask, bangs over eyes |
| Shared Agent Civilian Female 3 | 1girl, casual clothes, everyday clothes, blouse, slacks, holding phone, phone covering face, looking at phone |
| Shared Agent Civilian Male 1 | 1boy, casual clothes, everyday clothes, shirt, open jacket, baseball cap, cap over eyes, shaded face |
| Shared Agent Civilian Male 2 | 1boy, casual clothes, everyday clothes, delivery rider, motorcycle helmet, visor down, helmet covering face, jacket |
| Shared Agent Civilian Male 3 | 1boy, casual clothes, everyday clothes, college hoodie, hood up, earphones, looking down, holding phone, shadow over face |

## 후드 성직자 (교황청·이슬람, 성별 모를 때) · 3장

| 파일 이름 | 붙일 프롬프트 |
| --- | --- |
| Shared Agent Religious 1 | 1other, androgynous, cassock, long robe, hood up, hooded robe, dark robe, shadow over face, face hidden, prayer beads, beads on wrist, hands clasped |
| Shared Agent Religious 2 | 1other, androgynous, cassock, long robe, hood up, hooded robe, dark robe, shadow over face, face hidden, veil, nun habit, hands folded |
| Shared Agent Religious 3 | 1other, androgynous, cassock, long robe, hood up, hooded robe, dark robe, shadow over face, face hidden, wide sleeves, holding lantern |

## 후드 마법사 (발푸르기스·교단, 성별 모를 때) · 3장

| 파일 이름 | 붙일 프롬프트 |
| --- | --- |
| Shared Agent Occult 1 | 1other, androgynous, dark cloak, hooded cloak, hood up, shadow over face, face hidden, cloak trim, glowing runes, magic circle around hands, sand |
| Shared Agent Occult 2 | 1other, androgynous, dark cloak, hooded cloak, hood up, shadow over face, face hidden, tattered cloak, holding staff, charms on staff |
| Shared Agent Occult 3 | 1other, androgynous, dark cloak, hooded cloak, hood up, shadow over face, face hidden, layered cloak, talisman, ofuda, paper charms |

## 플러그인이 고르는 법

- 소속 조직으로 묶음을 정합니다: 관리국·가짜 관리국 → Suit, 백일몽 → Masked, 프리랜서·협회·중림 → Freelancer, 민간인 → Civilian, 교황청·이슬람 → Religious, 발푸르기스·교단 → Occult.
- 성별은 명부 「성별」 칸, 비어 있으면 요원 로어북의 `Gender:` 줄. 모르면 후드 그림.
- 묶음 3장 중 하나를 요원 이름으로 정해서 같은 요원은 늘 같은 그림입니다. 3장 중 일부만 있어도 있는 것 중에서 고릅니다.
