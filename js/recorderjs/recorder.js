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

(function(window){

  var WORKER_PATH = 'js/recorderjs/recorderWorker.js';

  var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 4096;
    this.context = source.context;
    if(!this.context.createScriptProcessor){
       this.node = this.context.createJavaScriptNode(bufferLen, 2, 2);
    } else {
       this.node = this.context.createScriptProcessor(bufferLen, 2, 2);
    }
   
    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate
      }
    });
    var recording = false,
      currCallback;

    this.node.onaudioprocess = function(e){
      if (!recording) return;
      worker.postMessage({
        command: 'record',
        buffer: [
          e.inputBuffer.getChannelData(0),
          e.inputBuffer.getChannelData(1)
        ]
      });
    }

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
      recording = true;
    }

    this.stop = function(){
      recording = false;
    }

    this.clear = function(){
      worker.postMessage({ command: 'clear' });
    }

    this.getBuffers = function(cb) {
      console.log("recorder.getBuffers()");
      currCallback = cb || config.callback;
      worker.postMessage({ command: 'getBuffers' });
    }

    this.savePhones = function() {
      worker.postMessage({ command: 'savePhones' });
    }

    // this.array2WAV = function(cb) {
    //   currCallback = cb || config.callback;
    //   var buffer = [];
    //   buffer.push(FUCKING_ARRAY);
    //   buffer.push(FUCKING_ARRAY);
    //   currCallback(buffer);
    // }

    function mergeSound(sound1, sound2) {
      var len = (sound1.length > sound2.length)? sound2.length: sound1.length;
      var output = [];
      for (var i = 0; i < len; i++) {
        output.push((sound1[i] + sound2[i])/2);
      }
      return output;
    }    

    function getSmoothArray(array) {
      var smoothed = [];
      var len = array.length;
      for ( var i = 0; i < len; i++ ) {
        smoothed.push(array[i] * Math.sin(Math.PI * i / len));
      }
      return smoothed;
    }

    this.array2WAV = function(cb, type, array) {
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');

      worker.postMessage({
        command: 'array2WAV',
        type: type,
        // array: getSmoothArray(Array(30).join(FUCKING_ARRAY.slice(280, 1218)+',').split(','))
        // array: FUCKING_ARRAY
        // array: getSmoothArray(mergeSound(FUCKING_ARRAY, FUCKING_ARRAY2))
        array: [1,2,3]
      });
    }

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
      });
    }

    this.playPhone = function(cb, index){
      console.log("recorder playphone");
      console.log(index);
      currCallback = cb || config.callback;
      index = index || 0;
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'playPhone',
        type: 'audio/wav',
        idx: index
      });
    }

    this.sayText = function(cb, array) {
      console.log("recorder sayText");
      currCallback = cb || config.callback;
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'concatPhones',
        type: 'audio/wav',
        series: array
      });
    }

    worker.onmessage = function(e){
      var blob = e.data;
      currCallback(blob);
    }

    source.connect(this.node);
    this.node.connect(this.context.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.
  };

  Recorder.setupDownload = function(blob, filename){
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var link = document.getElementById("save");
    link.href = url;
    link.download = filename || 'output.wav';
  }

  window.Recorder = Recorder;

})(window);
