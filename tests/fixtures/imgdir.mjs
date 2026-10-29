// 시험용 명부: 요원 한글 이름·영문명·별칭만 든 로어북 (보조 모델 이미지 자료·이미지 지침이 명부에서 조립하는지 보는 데 씀)
import { readDirectory, directoryData, withDirectory } from '../../dist-test/core.mjs';

const dirFolder = (key, comment) => ({ key, comment, mode: 'folder', content: '' });
const dirEntry = (folder, comment, key, order) => ({ comment, key, folder, insertorder: order, mode: 'normal', content: `@@dont_activate\n${comment}` });
export function imgDirLore(agents) {
  const base = [dirFolder('F:ag', '🙂요원'), dirFolder('F:set', '⚙️설정'), ...agents.map((a, i) => dirEntry('F:ag', a.name, `${a.english}, ${a.name}`, 600 + i))];
  const data = directoryData(readDirectory(base));
  for (const a of agents) if (a.aliases?.length) data['요원'][a.name].aliases = a.aliases;
  return withDirectory(base, data);
}
