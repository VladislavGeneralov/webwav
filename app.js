let files = [];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const dropzone = document.getElementById("dropzone");
const status = document.getElementById("status");
const bar = document.getElementById("bar");

dropzone.addEventListener("dragover", e => {
  e.preventDefault();
});

dropzone.addEventListener("drop", e => {
  e.preventDefault();
  files = [...e.dataTransfer.files].filter(f => f.name.endsWith(".wav"));

  status.innerText = `Loaded: ${files.length} files`;
  bar.style.width = "0%";
});

// ---------- CLIP ----------
function clip(x) {
  return Math.max(-1, Math.min(1, x));
}

// ---------- WAV ENCODER ----------
function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length * numChannels * 2, true);

  let offset = 44;

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = audioBuffer.getChannelData(ch)[i];
      sample = clip(sample);
      sample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return buffer;
}

// ---------- PROCESS ----------
document.getElementById("start").onclick = async () => {
  const gain = parseFloat(document.getElementById("gain").value);

  if (files.length === 0) {
    status.innerText = "no files loaded";
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    status.innerText = `Processing ${i + 1}/${files.length}: ${file.name}`;

    const progress = ((i + 1) / files.length) * 100;
    bar.style.width = progress + "%";

    const arrayBuffer = await file.arrayBuffer();

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // ---------- DSP ----------
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);

      for (let j = 0; j < data.length; j++) {
        data[j] = clip(data[j] * gain);
      }
    }

    const wavBuffer = encodeWAV(audioBuffer);

    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  }

  status.innerText = "DONE";
  bar.style.width = "100%";
};