/**
 * Copyright 2018 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
module.exports = function(RED) {
    function checkConfig(node, conf) {
        if (!conf || !conf.hasOwnProperty("group")) {
            node.error(RED._("ui_list.error.no-group"));
            return false;
        }
        return true;
    }

    // ***********************************************************************************************
    // Client side (Dashboard)
    // ***********************************************************************************************
    function HTML(config) {
        // The configuration is a Javascript object, which needs to be converted to a JSON string
        var configAsJson = JSON.stringify(config);
        
        // Load the MP3 encoder library.
        return String.raw`
        <script src="media_source/js/lame.min.js" ng-init='init(` + configAsJson + `)'></script>
        <canvas id="mediaSourceRecorderCanvas_` + config.id + `" style="width:100%; height:120px;" height="120px"></canvas>`;
    };

    // ***********************************************************************************************
    // Server side processing
    // ***********************************************************************************************
    var ui = undefined;
    function MediaSourceRecorderNode(config) {
        try {
            var node = this;
            if(ui === undefined) {
                ui = RED.require("node-red-dashboard")(RED);
            }
            RED.nodes.createNode(this, config);
            var done = null;
            if (checkConfig(node, config)) {
                var html = HTML(config);
                done = ui.addWidget({
                    node: node,
                    width: config.width,
                    height: config.height,
                    format: html,
                    templateScope: "local",
                    group: config.group,
                    emitOnlyNewValues: false,
                    forwardInputMessages: false,
                    storeFrontEndInputAsState: false,
                    convertBack: function (value) {
                        return value;
                    },
                    /*beforeEmit: function(msg, value) {
                        return { msg: { items: value } };
                    },*/
                    beforeEmit: function(msg, value) {
                        return { msg: msg };
                    },
                    beforeSend: function (msg, orig) {
                        if (orig) {
                            // The buffer contains an ArrayBuffer, so let's convert it to a NodeJs Buffer
                            // See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
                            //orig.msg.payload = Buffer.from(orig.msg.payload);
                            return orig.msg;
                        }
                    },
                    initController: function($scope, events) {
                        $scope.init = function (config) {
                            $scope.config = config;
                            
                            debugger;
                            // Initialize canvas
                            $scope.canvas = document.getElementById('mediaSourceRecorderCanvas_' + $scope.config.id);
                            $scope.canvasCtx = $scope.canvas.getContext('2d');
                            $scope.canvasCtx.fillStyle = 'rgb(255, 255, 255)';
                            $scope.canvasCtx.fillRect(0, 0, $scope.canvas.width, $scope.canvas.height);
                            $scope.canvasCtx.lineWidth = 2;
                            $scope.canvasCtx.strokeStyle = 'steelblue';
                        }
                        
                        if (!window.MediaSource && !window.WebKitMediaSource) {
                            // TODO show this error in the node status (flow editor)
                            console.log("Your browser doesn't support the MediaSource API!");
                            return;
                        }
                                                
                        // Watch input messages arriving from the Node-RED flow
                        $scope.$watch('msg', function(newVal, oldVal) {
                            if (!newVal) {
                                return;
                            }
                            
                            if (typeof newVal.payload !== "boolean") {
                                console.log("The msg.payload should contain a boolean!");
                                return;
                            }
                            
                            if (newVal.payload == true) {
                                if ($scope.context || $scope.mediaSource || $scope.recorderProcessor) {
                                    console.log("The audio capture is already started!");
                                    return;
                                }
                                
                                if (!window.MediaSource && !window.WebKitMediaSource) {
                                    console.log("Your browser doesn't support the MediaSource API!");
                                    return;
                                }
                                
                                // Try to have support for getUserMedia on as much platforms as possible
                                if (!navigator.getUserMedia) {
                                    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia;
                                }
                                
                                // Configure the user media based on the settings on the config screen
                                var userMediaConfig = {
                                    audio: {
                                        echoCancellation: $scope.config.echoCancellation,
                                        noiseSuppression: $scope.config.noiseSuppression,
                                        autoGainControl: $scope.config.gainControl
                                    }
                                };
                                
                                // Start capturing by getting access to the microphone (e.g. Chrome will display a popup here ...)
                                navigator.getUserMedia(userMediaConfig, function(stream) {
                                    const numChannels = 1; // TODO can this be determined automatically ???   -->  1 for mono or 2 for stereo
                                    const bitRate = 128; // kbps TODO adjustable ???
                                    const sampleRate = 44100; // 44.1khz (this is a normal mp3 samplerate)
                                    const sampleBlockSize = 1152; //can be anything but make it a multiple of 576 to make encoders life easier
                    
                                    $scope.mediaStream = stream;
                                    
                                    // Start a WEB AUDIO process chain
                                    $scope.context = new AudioContext();
                                    $scope.mediaSource = $scope.context.createMediaStreamSource($scope.mediaStream);
                                    $scope.recorderProcessor = $scope.context.createScriptProcessor(parseInt($scope.config.bufferLength), numChannels, numChannels);

                                    $scope.mediaSource.connect($scope.recorderProcessor);
                                    $scope.recorderProcessor.connect($scope.context.destination);

                                    if (!$scope.mp3encoder) {
                                        // TODO perhaps do the encoding in a separate worker process (https://github.com/jsalsman/speakclearly/blob/master/index.html)
                                        $scope.mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitRate);
                                    }
                                    
                                    debugger;
                                    
                                    // Handle audio chunks from the microphone
                                    $scope.recorderProcessor.onaudioprocess = function(event) {
                                        // The inputBuffer is a raw audio buffer (PCM)
                                        // Caution: above the number of channels has been hardcoded to 1, so let's take that channel.
                                        var typedBuffer = event.inputBuffer.getChannelData(0);
                                        
                                        if ($scope.config.encoding === "mp3") {                
                                            // See https://github.com/zhuker/lamejs/issues/10#issuecomment-150711192
                                            var lo = typedBuffer; //the decoded data range: -1 +1
                                            var l = new Float32Array(lo.length); 
                                            for(var i = 0; i < lo.length; i++) {
                                                l[i] = lo[i] * 32767.5; // TODO is this required ???
                                            }
                                            
                                            // Convert the raw audio to mp3
                                            typedBuffer = $scope.mp3encoder.encodeBuffer(l);
                                        }
                                        
                                        // The typedBuffer will now contain a Float32Array, since the MediaSource API uses typed arrays.
                                        // A typed array is normal ArrayBuffer with a typed view wrapping it.
                                        // Don't pass the typed array to Node-RED because it would be converted to an object:
                                        // {0: <value0>, 1: <value1>, 2: <value2>, ...{
                                        // Instead we will return the underlying ArrayBuffer, so no copy of the data is required.
                                        // See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
                                        var arrayBuffer = typedBuffer.buffer;

                                        // Send the audio chunk to the output of the node (in the Node-RED flow)
                                        $scope.send({payload: arrayBuffer});
                                        
                                        // https://medium.com/@duraraxbaccano/computer-art-visualize-your-music-in-javascript-with-your-browser-part-2-fa1a3b73fdc6
                                        var bufferLength = $scope.analyser.frequencyBinCount;
                                        var dataArray = new Uint8Array(bufferLength);
                                        $scope.analyser.getByteTimeDomainData(dataArray);
                                        
                                        // clear the previous shape
                                        $scope.canvasCtx.fillRect(0, 0, $scope.canvas.width, $scope.canvas.height);
                                        $scope.canvasCtx.beginPath();
                                        var sliceWidth = $scope.canvas.width * 1.0 / bufferLength;
                                        var x = 0;
                                        for(var i = 0; i < bufferLength; i++) {
                                            var v = dataArray[i] / 128.0;
                                            var y = v * $scope.canvas.height / 2;
                                            if(i === 0) {
                                                $scope.canvasCtx.moveTo(x, y);
                                            }
                                            else {
                                                $scope.canvasCtx.lineTo(x, y);
                                            }
                                            x += sliceWidth;
                                        }
                                        $scope.canvasCtx.lineTo($scope.canvas.width, $scope.canvas.height / 2);
                                        $scope.canvasCtx.stroke();
                                    };
                                    
                                    // When the buffer source stops playing, disconnect everything
                                    $scope.mediaSource.onplaying = function() {
                                        // TODO update the node status in the flow editor
                                    }
     
                                    // When the buffer source stops playing, disconnect everything
                                    $scope.mediaSource.onended = function() {
                                        // TODO update the node status in the flow editor
                                    }
                                    
                                    // create audio analyser
                                    $scope.analyser = $scope.context.createAnalyser();     
                                    $scope.analyser.fftSize = 2048;
                                    var bufferLength = $scope.analyser.frequencyBinCount;
                                    var dataArray = new Uint8Array(bufferLength);
                                    
                                    // Bind our analyser to the media element source.
                                    $scope.mediaSource.connect($scope.analyser);   
                                },
                                function(err) {
                                    // TODO update the node status in the flow editor
                                    console.log(err);
                                });
                            }
                            else {
                                if (!$scope.mediaSource || !$scope.recorderProcessor || !$scope.mediaStream) {
                                    console.log("The audio capture was already stopped!");
                                    return;
                                }

                                // Stop recording
                                $scope.mediaSource.disconnect();
                                $scope.recorderProcessor.disconnect();
                                $scope.recorderProcessor.onaudioprocess = null;
                                
                                // The 'stop' function in the MediaStream is obsolete.
                                // When not available, create a custom 'stop' method that stops all tracks
                                // See https://stackoverflow.com/questions/11642926/stop-close-webcam-which-is-opened-by-navigator-getusermedia
                                if (typeof $scope.mediaStream.stop === "function") {
                                    $scope.mediaStream.stop();
                                }
                                else {
                                    $scope.mediaStream.getTracks().forEach(function(track) {
                                            track.stop();
                                    });
                                }
        
                                // Make sure we can restart the recording afterwards again
                                delete $scope.mediaStream;
                                delete $scope.context;
                                delete $scope.recorderProcessor;
                                delete $scope.mediaSource;
                            }
                        })
                    }
                });
            }
        }
        catch (e) {
            console.log(e);
        }
        node.on("close", function() {
            if (done) {
                done();
            }
        });
    }
    RED.nodes.registerType('media-source-recorder', MediaSourceRecorderNode);
	
    // Make all the static resources from this node public available (i.e. Mp3LameEncoder.min.js file).
    RED.httpNode.get('/ui/media_source/js/*', function(req, res){
        var options = {
            root: __dirname + '/lib/',
            dotfiles: 'deny'
        };
       
        // Send the requested file to the client (in this case it will be Mp3LameEncoder.min.js)
        res.sendFile(req.params[0], options)
    });
};
