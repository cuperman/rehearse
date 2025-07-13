declare module "soundtouchjs" {
  export class SoundTouch {
    constructor(sampleRate: number);
    tempo: number;
    pitch: number;
    rate: number;
  }

  export class SimpleFilter {
    constructor(source: any, soundTouch: SoundTouch);
  }

  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
    extract(target: Float32Array[], numFrames: number): number;
  }

  export function getWebAudioNode(audioCtx: BaseAudioContext, filter: SimpleFilter): AudioNode;
}
