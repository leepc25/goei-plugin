# 능력 뱃지 한 판(512x256, 64px 메달 32개)을 1회로 뽑는다. 사용: python3 gen_sheet.py <판번호>
# 그림 목록: docs/퍽/뱃지_그림_문구_1101.md (사용자 결정: 은메달 + 선글라스 요원, 등급 색은 코드로)
import sys, pathlib, json, urllib.request, time, base64, os
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4] / "tools"))
import pixellab_gate as gate
API = "https://api.pixellab.ai/v2"
OUT = os.path.dirname(os.path.abspath(__file__))
SHEETS = {1: [
 "jab with bandaged fist", "arms blurred into three afterimages", "sliding on the floor kicking up dust",
 "punch sending a round air ring forward", "flicking an enemy's forehead, wavy lines above", "a blue shadow copy punching behind him",
 "sliding and tripping an enemy's shoe", "huge cracked fist punch", "wide crescent arc swing",
 "uppercut with up arrow and stars", "chopping down on a staggering enemy", "pinning an enemy into a cracked brick wall",
 "fist smashing the floor, round cracks", "chop with three red drops", "slamming an enemy onto the floor, dust",
 "two enemies bumping heads like billiard balls", "kicking, black shackle on enemy ankle", "aiming a pistol, one eye closed",
 "rapid fire, several muzzle flashes", "crosshair with a near dot and a far dot", "fanning a steaming gun barrel",
 "throwing a ballpoint pen", "aiming at an eye target", "pistol firing a bullet that splits into two",
 "bullet piercing two folders", "bullet bouncing off a wall on a bent path", "sparking explosive bullet",
 "red target mark over an enemy's head", "enemy raising hands in fear at his gun", "thrown pen curving back to his hand",
 "red hot gun bursting steam", "running with winged shoes"]}
SHEETS[2] = [
 "agent dodging sideways leaving three afterimages", "agent finishing a roll and standing ready, circular arrow", "a punch passing through the agent's see-through body",
 "agent sliding far with long speed lines", "agent jumping up on spring shoes, three steps in the air", "agent dodging away leaving a lit bomb behind",
 "enemy punching a hollow agent outline while the real agent stands aside", "agent dashing through an enemy along a dotted arrow", "agent rolling up from the floor along a bent arrow",
 "agent charging shoulder first knocking an enemy away", "agent blocking with a thick folder shield", "a fist stopped flat against the agent's shield",
 "agent batting a bullet back with a tray", "agent's sunglasses flashing as he counterpunches", "enemy fist pricked on the agent's spiked shield",
 "agent's shield shattering with shards flying outward", "dizzy enemy walking the wrong way, agent holding a shield", "agent reading a manual and pressing a glowing button",
 "agent releasing a doubled burst of light from his hand", "agent's hand with a glowing bar filling up fast", "agent releasing a big charged ring of light",
 "agent with a star gauge glowing on his chest", "agent unleashing a huge star burst", "agent entering a door with a half filled star gauge above",
 "agent staggering from a hit, stars bursting from him", "agent pressing two glowing buttons with both hands", "agent holding a swirling magnet pulling enemies in",
 "agent pointing, spiral spinning over a hit enemy", "agent's beam hits an enemy, iron ball chained to its foot", "agent finger to lips, X tape on enemy's mouth",
 "agent bowing with a bouquet, shadow agent behind casting again", "agent withdrawing his hand blade beside a long bleeding cut"]
SHEETS[3] = [
 "agent flipping a big full hourglass", "agent poking an enemy's wound with a needle", "agent inside a water bubble, icons bouncing off",
 "agent with earmuffs and crossed arms, thick wall around his head", "agent scratching with blackened nails", "agent turning away as black smoke spreads from a fallen enemy",
 "agent sneaking behind an enemy raising a dagger", "agent landing the first punch, ice shards cracking", "bloodied agent grinning and charging, half empty heart",
 "small agent standing before a big crowned enemy", "agent facing an enemy between two crossed swords", "agent beside a fallen enemy whose skull bomb explodes",
 "agent standing as trembling enemies step back", "agent lifting a dumbbell, red heart on chest", "agent covered in band aids, cross heart",
 "agent thumping his chest in a bulletproof vest", "agent gritting teeth wrapping a bandage on a cracked heart", "agent rooted to the ground like a stake while hit",
 "agent kneeling on one knee holding on, bandaged skull", "agent wrapped in a glowing hexagon shield", "agent's heavy blow bursting an enemy's wounds",
 "agent pulling a string that carries a target mark to another enemy", "agent with a magnifying glass sticking a target mark on an enemy", "agent slapping the back of a fleeing enemy",
 "agent slowly aiming at a roped target", "agent's blow making a head clutching enemy see stars", "agent with crossed arms watching a dizzy enemy slap his ally",
 "agent slamming an enemy with frozen feet into the floor", "agent pushing over an enemy with X tape on mouth", "agent's beam burning black stains off an enemy",
 "agent holding bandage ends linking a fallen enemy to another", "agent shooting a staggering enemy's knee"]
SHEETS[4] = [
 "agent punching a dazed enemy with stars over its head", "agent poking the side of a confused enemy in a swirl", "agent firing right after a roll, afterimage behind",
 "agent with a row of fallen enemies behind him, three skulls", "agent fixing his tie in a spotless suit", "agent writing tally marks in a notebook",
 "agent dropping a red bead into a piggy bank", "agent leaning back as a blade cuts one hair", "agent punching faster, three rising bars",
 "agent blocking with a vein on forehead, boiling kettle", "agent's shoulder with stars added on the epaulette", "agent loading a big bullet over a pile of shells",
 "agent writing in a ledger with burning eyes", "agent covering ears as three bombs explode in a row", "agent stepping back from a spreading blood pool",
 "agent watching a bullet split in two off a wall", "agent rolling, a bullet bouncing back to the shooter", "agent punching with two shadow agents beside him",
 "agent falling from above like a meteor", "agent circling a marked enemy", "agent in front of a big swirl pulling enemies together",
 "agent in a mask as black fog fills the room", "agent's shield bursting then glowing back", "agent springing up as an hourglass spins backward",
 "agent rolling up his sleeves over a fallen enemy, down arrow", "agent standing tall among yawning enemies, wall clock", "agent slamming a desk, enemies flinching",
 "agent rubbing a ring, small glowing heart", "agent holding a chain linking two staggering enemies", "agent shaking a flask and rolling a dice",
 "agent showing a stamped document and swapping it", "agent pushing back an offered envelope with his palm"]
SHEETS[5] = [
 "agent calmly filling a three cell bar while being hit", "agent squatting beside a fallen enemy, looking down", "agent cornering an enemy against a narrow corridor wall",
 "red drops drawn from an enemy into the agent's hand", "agent swatting a bullet away with the back of his hand", "agent denting a sandbag with a punch",
 "agent shooting a flying coin", "agent carrying a heavy load on his shoulders, red heart", "agent with an open book, glowing brain above",
 "agent meditating with eyes closed, soft light ring", "agent throwing away a cracked shield and charging with a sword", "agent firing a cannonball from a cracked glass bottle",
 "agent walking slowly in turtle shell armor", "agent tossing off armor and leaping like a feather", "agent shooting wildly with eyes shut, shells flying",
 "agent with a big hammer on his shoulder", "bloodied agent roaring with glowing eyes", "agent gripping an overflowing lightning bar",
 "agent turning a cracked hourglass backward", "agent with a nosebleed bursting a blood star", "agent crouching low dodging like a rabbit",
 "agent staring at his hand wrapped in black aura", "agent tossing a dice and firing a pistol", "agent with an iron weight on his ankle standing firm",
 "agent hugging a sack of coins while being hit", "agent standing firm before an empty bowl", "agent throwing his pistol to the floor and making a fist",
 "agent walking down one straight road, back view", "agent grinning with fangs",
 "agent opening a first aid box and pulling out a vial", "agent with a bulging suit pocket", "agent pouring a single drop from a vial"]
SHEETS[6] = [
 "agent sipping from a vial and sparkling", "agent quick drawing a vial from a hip holster", "agent falling as a first aid box opens by itself",
 "agent with two bare fists turning out empty pockets", "laurel wreath on the bottom half only, empty token center", "laurel wreath all the way around, empty token center",
 "plain empty token", "plain empty token"]
n = int(sys.argv[1]); items = SHEETS[n]
import re
def short(t):  # 2,000자 제한(422) — 머리말은 1판 그대로 두고 칸 설명만 줄인다(앞 agent·관사·색 낱말 빼기)
    t = re.sub(r"^agent's ", "his ", t); t = re.sub(r"^agent ", "", t)
    t = re.sub(r"\b(red|blue|black)\s", "", t); t = re.sub(r"\b(a|an|the)\s", "", t); return t
lst = "; ".join(f"{i+1} {short(t) if n > 1 else t}" for i, t in enumerate(items))
assert len(items) == 32, "1판과 같은 512x256 8x4만 쓴다"
# 1판(사용자 승인, sheet1_token.log) 머리말 글자 그대로 — 고치지 말 것
desc = ("pixel art icon sheet, 8 columns x 4 rows of 32 single-color silver tokens, each 64x64, evenly spaced. "
        "Each token is a thick 3D silver coin seen from the front with a visible beveled rim and shading, all silver. "
        "The same small agent with sunglasses is embossed in silver relief on each token, doing one action. "
        f"Silver only, no other colors. Left to right, top to bottom: {lst}. No text. Everything else is up to you.")
assert len(desc) <= 2000, len(desc)
ROWS = 4
TAG = sys.argv[2] if len(sys.argv) > 2 else ""
print(len(desc), desc, flush=True)
body = {"description": desc, "image_size": {"width": 512, "height": 64 * ROWS}, "no_background": True}
def post(p, b):
    r = urllib.request.Request(API + p, data=json.dumps(b).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer x"})
    return json.load(urllib.request.urlopen(r, timeout=90))
def get(p):
    return json.load(urllib.request.urlopen(urllib.request.Request(API + p, headers={"Authorization": "Bearer x"}), timeout=60))
gate.spend(f"능력 뱃지 {n}판 512x{64*ROWS} generate-ui-v2")
res = post("/generate-ui-v2", body); print("sent", json.dumps(res)[:300], flush=True)
jid = res.get("background_job_id")
for _ in range(240):
    time.sleep(5)
    r = get(f"/background-jobs/{jid}")
    if r.get("status") in ("completed", "failed", "error"): break
imgs = (r.get("last_response") or {}).get("images") or []
for i, im in enumerate(imgs):
    b = im.get("base64") if isinstance(im, dict) else im
    if "," in b[:40]: b = b.split(",", 1)[1]
    open(f"{OUT}/sheet{n}{TAG}_{i}.png", "wb").write(base64.b64decode(b))
for im in imgs:
    if isinstance(im, dict): im.pop("base64", None)
json.dump(r, open(f"{OUT}/sheet{n}{TAG}_job.json", "w"), ensure_ascii=False)
print("DONE", r.get("status"), len(imgs), json.dumps(r.get("usage") or {}), flush=True)
