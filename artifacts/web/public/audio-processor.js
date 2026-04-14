class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffers = [];
    this._sampleCount = 0;
    this._closed = false;

    this.port.onmessage = (e) => {
      if (e.data === "stop") {
        this._closed = true;
        const merged = this._merge(this._buffers, this._sampleCount);
        this.port.postMessage({ type: "done", buffer: merged }, [merged.buffer]);
      }
    };
  }

  _merge(buffers, totalSamples) {
    const out = new Float32Array(totalSamples);
    let offset = 0;
    for (const b of buffers) {
      out.set(b, offset);
      offset += b.length;
    }
    return out;
  }

  process(inputs) {
    if (this._closed) return false;
    const input = inputs[0];
    if (input && input[0]) {
      const channel = input[0];
      this._buffers.push(new Float32Array(channel));
      this._sampleCount += channel.length;
    }
    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
