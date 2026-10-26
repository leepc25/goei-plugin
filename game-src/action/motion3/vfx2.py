"""캐릭터 그림을 넣어(크기·톤 맞춤) PixelLab pro 이펙트를 뽑고, 캐릭터를 지우고, 이펙트 기준점으로 다시 맞춘다(게임에서 1배).
사용: python3 vfx2.py <이름> "<설명>" <캐릭터 그림 png> <W|E> <bottom|center> [키]"""
import sys
import vfx
name, desc, sprite, d, mode = sys.argv[1:6]; key = sys.argv[6] if len(sys.argv) > 6 else "vfx"
vfx.main(name, desc, key, sprite, "pro", west=(d == "W"))
vfx.repivot(name, mode)
print(name, "끝", flush=True)
