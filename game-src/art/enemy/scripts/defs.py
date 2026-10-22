# 잡몹 22종 기준 그림 정의. 명세: docs/GPT요청_잡몹_공통.md 와 승강기·아파트·학교 요청서.
# gen: 생성 캔버스(pixen) · canvas: 최종 캔버스 · foot: 발바닥 줄 y · cx: 몸 중심 x · h: 목표 키(px)
STYLE=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up horror game, one full-body figure facing right in profile, "
       "crisp clean pixel clusters, single black outline, two-step shading, muted desaturated colors, transparent background. ")
HUMAN=dict(gen=(112,112),canvas=(192,144),foot=135,cx=60)
SMALL=dict(gen=(64,64),canvas=(96,72),foot=66,cx=40)
BIG=dict(gen=(176,176),canvas=(256,176),foot=170,cx=100)
WIDE=dict(gen=(256,128),canvas=(256,176),foot=170,cx=120)
M={
 # ── 승강기 고유 ──
 'lurker':dict(HUMAN,h=102,human=True,desc="A pale tired office worker standing perfectly still, realistic adult proportions about 7 heads tall, drooping shoulders, a slightly too long neck, head bowed a little, "
    "grey dress shirt, loose navy necktie, dark grey trousers, black shoes, an employee lanyard, blank face with small black dot eyes, arms hanging at the sides."),
 'hollow':dict(HUMAN,h=104,human=True,wrist=.62,desc="A gaunt shambling former passenger, adult man about 7 heads tall, worn beige zip jacket, faded blue jeans, dirty sneakers, "
    "abnormally long arms hanging down past the knees, the face is a smooth blank skin surface with no eyes nose or mouth, slightly hunched, standing."),
 'shooter':dict(HUMAN,h=100,human=True,desc="A neat government counter clerk woman about 7 heads tall standing upright, white blouse, black office arm sleeves on the forearms, dark knee-length skirt, low black shoes, "
    "hair tied back neatly, expressionless face, holding a thin dark document folder tucked under the near arm."),
 'charger':dict(HUMAN,h=96,human=True,desc="A huge hulking brute man with a massive back and short legs, upper body leaning forward with the head lower than the shoulders, torn dark security vest over a grey undershirt, "
    "grey work trousers, boots, a white square board with a black round target circle strapped to his back with cords, bald head, heavy fists."),
 'thief':dict(HUMAN,h=100,human=True,desc="A wiry survivor man about 7 heads tall leaning forward, a large overstuffed hiking backpack sticking out far behind his back, baseball cap, olive-green windbreaker, "
    "a towel wrapped around his neck, cargo trousers, hiking boots, holding a rusty steel pipe in the near hand pointing down."),
 'crawler':dict(SMALL,gen=(80,40),h=26,desc="A low wide pale grey-white spider-like creature seen from the side, flat body with no head, a small mouth at the front of the body, "
    "eight thin jointed legs and every leg ends in a human finger, standing on the legs."),
 'predator':dict(WIDE,h=110,desc="A long low grey beast seen from the side facing right, greasy ash-grey hide, the head is half mouth with rows of teeth, many small black eyes, "
    "rusty cables stuck into its back, four short thick legs, long heavy tail, walking slowly."),
 'edge':dict(SMALL,gen=(48,48),h=40,float=36,desc="A floating fragment of an impossible geometric shape like one corner of a Penrose triangle, three faces in different muted colors (dull teal, mustard yellow, plum purple), "
    "faces connecting in an impossible way, hard straight edges, no legs, floating."),
 'shade':dict(HUMAN,gen=(96,96),h=70,desc="Four pitch black shadow hands with long fingers rising straight up out of the ground, wrists side by side, dark navy rim on the outline, reaching upward."),
 'hum':dict(HUMAN,h=100,human=True,desc="A barely visible thin barefoot person, pale grey ghostly silhouette with dithered checkerboard holes in it, head tilted, arms hanging, standing, featureless face."),
 # ── 재현 아파트 ──
 'resident':dict(HUMAN,h=98,human=True,desc="A middle-aged Korean apartment neighbor man about 7 heads tall standing in a hallway pose with hands clasped behind his back, stretched white sleeveless undershirt, grey sweatpants, "
    "blue three-stripe slide sandals, slight belly, stiff frozen smile, short black hair."),
 'doorframe':dict(HUMAN,h=110,desc="A grotesque hunched human back bent into an arch like a door frame, seen from the side facing right, stretched brown cardigan, the head buried down into the chest and not visible, "
    "two long arms reaching straight down to the floor like props, wide broad back like a shield."),
 'dusty_table':dict(SMALL,h=30,desc="An old round folding low dining table covered in thick white dust, standing on four thin pale human legs instead of table legs, seen from the side."),
 'dusty_chair':dict(SMALL,h=44,desc="An old wooden chair covered in thick white dust, standing on four thin pale human legs instead of chair legs, seen from the side facing right."),
 'doorhand':dict(HUMAN,gen=(112,64),h=40,place='arm',desc="A single long pale white human arm reaching horizontally to the right with no body, the shoulder end cut off at the left edge, very long thin fingers with many joints, open hand."),
 'wallface':dict(HUMAN,gen=(64,80),h=72,place='face',desc="A human face half sunk into a wall, side profile facing right, only the face, front of the neck and front of the shoulders protruding, eyes closed, grey pale skin, no wall drawn."),
 'floorhand':dict(HUMAN,gen=(96,32),h=8,desc="A flat pale human hand lying flat on the floor seen from a low side angle, fingers spread, very thin, ochre-yellow skin like linoleum floor pattern with a hand outline."),
 'tv402':dict(WIDE,h=110,desc="A long snake body with a human head, seen from the side facing right, coiled on the floor, pale blue-grey smooth skin with no scales, the head is a messy-haired middle-aged man with empty white eyes, head raised."),
 # ── 재현 학교 ──
 'thump':dict(HUMAN,h=100,human=True,flipv=True,desc="A Korean high school boy about 7 heads tall standing upright, navy uniform trousers, white short-sleeve uniform shirt, arms pressed straight down against the body, "
    "short black hair, pale blank face, a dark red crack on the top of the head."),
 'mannequin':dict(HUMAN,h=104,human=True,desc="A school science class anatomical model mannequin standing like a person, the near side has smooth peach plastic skin, the far half shows red muscle anatomy in simple flat shapes, "
    "visible screw joints at the shoulders elbows hips and knees, painted round blue eyes, bare feet, stiff."),
 'hanged':dict(HUMAN,h=106,human=True,desc="A ghost woman about 7 heads tall in an old long white dress, long straight black hair hanging over the face hiding it, bare feet with toes pointing down standing on tiptoe, "
    "holding a rope noose loop hanging from the near hand."),
 'specimen_jar':dict(SMALL,gen=(48,48),h=40,desc="A cylindrical glass laboratory jar with a metal lid filled with pale green formalin liquid, a curled pale specimen creature inside with a big black eye, seen from the side."),
 'specimen_frog':dict(SMALL,gen=(32,32),h=18,desc="A pale yellow-grey preserved formalin frog specimen with big black eyes, crouching, seen from the side facing right."),
 'specimen_snake':dict(SMALL,gen=(64,32),h=20,desc="A thin pale yellow-grey preserved formalin snake specimen with black eyes, coiled with its head raised, seen from the side facing right."),
 'grinner':dict(BIG,h=170,human=True,desc="A huge hulking crouched monster, the head is one third of the whole body size, smooth grey-white skin, bald, two tiny black eyes, a grin torn ear to ear with rows of white teeth, "
    "hunched massive muscular body with long arms and huge hands, scraps of torn school uniform trousers, head tilted, standing hunched."),
}
PROPS={
 'shooter/knife_0':((32,32),"a small silver box cutter knife flying horizontally, side view"),
 'edge/chip':((16,16),"a tiny sharp teal and mustard geometric shard"),
 'mannequin/arm':((64,32),"a detached anatomical model arm, peach plastic with a screw joint, lying horizontally"),
 'hanged/noose':((32,32),"a rope noose loop, brown rope"),
 'tv402/tv_0':((96,80),"an old CRT television set with wooden sides, screen off and dark, side three-quarter view"),
}
