/* Copyright 2013 Chris Wilson

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
var audioInput = null,
    realAudioInput = null,
    inputPoint = null,
    audioRecorder = null;
var analyserContext = null;
var recIndex = 0;
var merger = audioContext.createChannelMerger(2);
var osc = audioContext.createOscillator();
var qq = null, qq2 = [null, null]; // asoul add
var audioHrefs = [];
var choosedIndex = null;

function drawBuffer( width, height, context, data ) {
    var step = Math.ceil( data.length / width );
    var amp = height / 2;
    context.fillStyle = "silver";
    context.clearRect(0,0,width,height);
    for(var i=0; i < width; i++){
        var min = 1.0;
        var max = -1.0;
        for (j=0; j<step; j++) {
            var datum = data[(i*step)+j]; 
            if (datum < min)
                min = datum;
            if (datum > max)
                max = datum;
        }
        context.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
    }
}

function gotBuffers( buffers ) {
    console.log("yo gotBuffers(buffers)");
    qq = buffers;
    // buffers[0] is left channel sound
    // buffers[1] is right channel sound

    // the ONLY time gotBuffers is called is right after a new recording is completed - 
    // so here's where we should set up the download.
    audioRecorder.exportWAV( doneEncoding );
}

function doneEncoding( blob ) {
    console.log("yo doneEncoding(blob)");
    Recorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
    recIndex++;
}

// function toggleRecording( e ) {
//     console.log("yo toggleRecording(e)");
//     if (e.classList.contains("recording")) {
//         // stop recording
//         audioRecorder.stop();
//         e.classList.remove("recording");
//         audioRecorder.getBuffers( gotBuffers );
//     } else {
//         // start recording
//         if (!audioRecorder)
//             return;
//         e.classList.add("recording");
//         audioRecorder.clear();
//         audioRecorder.record();
//     }
// }

function toggleRecording( e ) {
    console.log("yo toggleRecording(e)");
    if (e.classList.contains("recording")) {
        // stop recording
        audioRecorder.stop();
        e.classList.remove("recording");
        audioRecorder.savePhones();
    } else {
        // start recording
        if (!audioRecorder)
            return;
        e.classList.add("recording");
        audioRecorder.clear();
        audioRecorder.record();
    }
}

function togglePlaying( e ) {

    var audio = document.getElementById( "audio" );
    audio.onended = function() {
        togglePlaying( e );
    }

    if (e.classList.contains("playing")) {
        // stop playing    
        audio.pause();
        e.classList.remove("playing");
        document.getElementById( "play" ).src = "img/play.svg"
    } else {
        // start playing
        e.classList.add("playing");
        var blob = document.getElementById( "save" );
        audio.src = blob.href;
        document.getElementById( "play" ).src = "img/pause.svg"
        audio.play();
    }
}

function choosePhone( index ) {
    // audioRecorder.array2WAV( doneEncoding );
    // audioRecorder.array2WAV( gotBuffers );
    choosedIndex = index;
    audioRecorder.playPhone(doneEncoding, index);
}

function chooseText() {
    var text = document.getElementById('source').value;
    // var theArray = YOUR_FUNCTION(text)
    var theArray = ['AA', 'AE', '.', 'AH', 'AO', '.', 'AH', 'AO'];
    audioRecorder.sayText(doneEncoding, theArray);
}

function toggleTimbre( e ) {
    console.log("toggle timbre");

    if (e.classList.contains("playing")) {
        // stop playing
        e.classList.remove("playing");
        osc.disconnect();
    } else {
        // start playing
        e.classList.add("playing");
        
        osc.connect(merger, 0, 1);
    }
}


function gotStream(stream) {
    console.log("yo gotStream(stream)");
    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect( analyserNode );

    audioRecorder = new Recorder( inputPoint );

    zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0.0;
    inputPoint.connect( zeroGain );

    zeroGain.connect(merger, 0, 0);

    // 連結自己加的 osscillator
    var real = new Float32Array([0,0.4,0.4,1,1,1,0.3,0.7,0.6,0.5,0.9,0.8]);
    var imag = new Float32Array(real.length);
    var hornTable = audioContext.createPeriodicWave(real, imag);

    osc.setPeriodicWave(hornTable);
    osc.frequency.value = 80;
    osc.start();
    
    merger.connect( audioContext.destination );
}

function initAudio() {
    console.log("yo initAudio()");
    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!navigator.cancelAnimationFrame)
        navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
    if (!navigator.requestAnimationFrame)
        navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    navigator.getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}

window.addEventListener('load', initAudio );
