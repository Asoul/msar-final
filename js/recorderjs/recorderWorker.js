/*License (MIT)

Copyright © 2013 Matt Diamond

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and 
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of 
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO 
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
DEALINGS IN THE SOFTWARE.
*/

var recLength = 0,
  recBuffersL = [],
  recBuffersR = [],
  sampleRate;

this.onmessage = function(e){
  switch(e.data.command){
    case 'init':
      init(e.data.config);
      break;
    case 'record':
      record(e.data.buffer);
      break;
    case 'array2WAV':
      array2WAV(e.data.type, e.data.array);
      break;
    case 'exportWAV':
      exportWAV(e.data.type);
      break;
    case 'getBuffers':
      getBuffers();
      break;
    case 'clear':
      clear();
      break;
  }
};

function array2WAV(type, array) {
  var interleaved = interleave(array, array);
  var dataview = encodeWAV(interleaved);
  var audioBlob = new Blob([dataview], { type: type });

  this.postMessage(audioBlob);
}

function init(config){
  sampleRate = config.sampleRate;
}

function record(inputBuffer){
  recBuffersL.push(inputBuffer[0]);
  recBuffersR.push(inputBuffer[1]);
  recLength += inputBuffer[0].length;
}

function exportWAV(type){
  var bufferL = mergeBuffers(recBuffersL, recLength);
  var bufferR = mergeBuffers(recBuffersR, recLength);
  var interleaved = interleave(bufferL, bufferR);

  // add voice filter
  var voicePart = getVoicePart(interleaved);

  var dataview = encodeWAV(voicePart);
  var audioBlob = new Blob([dataview], { type: type });
  
  this.postMessage(audioBlob);
}

function getBuffers() {
  var buffers = [];
  buffers.push( mergeBuffers(recBuffersL, recLength) );
  buffers.push( mergeBuffers(recBuffersR, recLength) );
  this.postMessage(buffers);
}

function clear(){
  recLength = 0;
  recBuffersL = [];
  recBuffersR = [];
}

function mergeBuffers(recBuffers, recLength){
  var result = new Float32Array(recLength);
  var offset = 0;
  for (var i = 0; i < recBuffers.length; i++){
    result.set(recBuffers[i], offset);
    offset += recBuffers[i].length;
  }
  return result;
}

function echo(array, delay) {
  var len = array.length;
  if (len < delay) return array;
  for (var i = delay; i < len; i++) {
    array[i] = array[i] + 0.8 * array[i-delay];
  }
  return array;
}

Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};

function getVoicePart( input ) {
  var frameSize = 2048;
  var frameOverlap = 0;
  var sampleRate = 44100;

  var frameStep = frameSize - frameOverlap;
  var len = input.length;

  var squares = [];
  var volumes = [];

  // 先算出平方的 input
  for (var i = 0; i < len; i++) squares.push(Math.pow(input[i],2));

  // 算出每個 frame 中的 volume 平方
  for (var i = 0; i < len; i += frameStep) {
    var sumSquare = 0;
    for (var j = i; j < Math.min(i+frameSize, len); j++) {
      sumSquare = sumSquare + Math.pow(squares[j],2);
    }
    volumes.push(sumSquare);
  }

  var maxVol = volumes.max();
  var minVol = volumes.min();
  var volThresholdRate = 0.1;
  console.log("maxVol = " , maxVol, ",minVol = ", minVol);
  
  // 提取出需要的片段
  var output = [];
  for (var i = 0; i < volumes.length; i++) {
    if (volumes[i] > (maxVol - minVol) * volThresholdRate + minVol) {
      for ( var j = i*frameStep; j < Math.min((i+1)*frameStep, len); j++ ) {
        output.push(input[j]);
      }
    }
  }
  console.log(input.length ," to ", output.length);
  return hammingWindow(output);
}

function hammingWindow(input) {
  var output = [];
  var alpha = 0.46;
  var len = input.length;
  for (var i = 0; i < len; i++) {
    var tmp = ((1-alpha) - alpha*Math.cos(2*Math.PI*i/len)) * input[i];
    output.push(tmp);
  }
  return output;
}


function interleave(inputL, inputR){
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);

  var index = 0,
    inputIndex = 0;

  while (index < length){
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input){
  for (var i = 0; i < input.length; i++, offset+=2){
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string){
  for (var i = 0; i < string.length; i++){
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samples, mono){
  var buffer = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 32 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, mono?1:2, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 4, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 4, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return view;
}
