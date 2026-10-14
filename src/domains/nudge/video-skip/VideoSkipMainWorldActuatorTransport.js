import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { runtimeSendMessageReliable } from '../../../platform/messaging/runtime/runtimeMessaging.js';
import {
  VIDEO_SKIP_MAIN_WORLD_COMMANDS,
  createVideoSkipMainWorldCommandRequest,
  requireVideoSkipMainWorldActuatorResult,
} from './videoSkipMainWorldActuator.js';

const VIDEO_SKIP_MAIN_WORLD_COMMAND_TIMEOUT_MS = 2000;

export class VideoSkipMainWorldActuatorTransport {
  static getInstance() {
    if (!VideoSkipMainWorldActuatorTransport.instance) {
      VideoSkipMainWorldActuatorTransport.instance = new VideoSkipMainWorldActuatorTransport();
    }
    return VideoSkipMainWorldActuatorTransport.instance;
  }

  async execute(request) {
    const command = createVideoSkipMainWorldCommandRequest(request);
    const result = await runtimeSendMessageReliable({
      action: MESSAGE_ACTIONS.EXECUTE_VIDEO_SKIP_MAIN_WORLD_COMMAND,
      ...command,
    }, {
      timeoutMs: VIDEO_SKIP_MAIN_WORLD_COMMAND_TIMEOUT_MS,
    });

    if (!result.ok) {
      throw new Error(`VIDEO_SKIP_MAIN_WORLD_TRANSPORT_FAILED:${result.error || 'UNKNOWN'}`);
    }
    if (result.response?.success !== true) {
      throw new Error(result.response?.error || 'VIDEO_SKIP_MAIN_WORLD_COMMAND_REJECTED');
    }
    const actuatorResult = requireVideoSkipMainWorldActuatorResult(result.response.result, {
      expectedCommand: command.command,
    });
    if (actuatorResult.ok !== true) {
      throw new Error(`VIDEO_SKIP_MAIN_WORLD_COMMAND_FAILED:${actuatorResult.reason}`);
    }
    return actuatorResult;
  }

  seek(targetTime, mediaToken) {
    return this.execute({
      command: VIDEO_SKIP_MAIN_WORLD_COMMANDS.SEEK,
      targetTime,
      mediaToken,
    });
  }

  play(mediaToken) {
    return this.execute({ command: VIDEO_SKIP_MAIN_WORLD_COMMANDS.PLAY, mediaToken });
  }
}

export default VideoSkipMainWorldActuatorTransport;
