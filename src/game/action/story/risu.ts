// 플러그인 안에서 자유 대화를 리스 메인 모델에 잇는다. 게임 탑재 쪽이 mountStory(…, { talkModel: risuMainModel })로 넘긴다.
// 사용자가 자유 대화 창에 글을 보낼 때만 불린다. 본편 채팅에는 아무것도 쓰지 않는다.
import { runModel } from '../../../host/llm';
import type { TalkModel } from './ai';

export const risuMainModel: TalkModel = (messages) => runModel(messages, 'main');
export const risuAuxModel: TalkModel = (messages) => runModel(messages, 'aux');
