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
        var mimeType = config.mimeType;
        
        // The configuration is a Javascript object, which needs to be converted to a JSON string
        var configAsJson = JSON.stringify(config);
        
        var html = String.raw`
        <audio width="400" controls id="mediaSourcePlayer_` + config.id + `" ng-init='init(` + configAsJson + `)' hidden>
            <p>This browser does not support the audio element.</p>
        </audio>;
        <canvas id="mediaSourcePlayerCanvas_` + config.id + `" style="width:100%; height:120px;" height="120px"></canvas>`
        return html;
    };

    // ***********************************************************************************************
    // Server side processing
    // ***********************************************************************************************
    var ui = undefined;
    function MediaSourcePlayerNode(config) {
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
                            return orig.msg;
                        }
                    },
                    initController: function($scope, events) {
                        $scope.init = function (config) {
                            $scope.config = config;
                            /*
                            // Initialize canvas
                            $scope.canvas = document.getElementById('mediaSourcePlayerCanvas_' + $scope.config.id);
                            $scope.canvasCtx = $scope.canvas.getContext('2d');
                            $scope.canvasCtx.fillStyle = 'rgb(255, 255, 255)';
                            $scope.canvasCtx.fillRect(0, 0, $scope.canvas.width, $scope.canvas.height);
                            $scope.canvasCtx.lineWidth = 2;
                            $scope.canvasCtx.strokeStyle = 'steelblue';
                            */
                        }
                        
                        if (!window.MediaSource && !window.WebKitMediaSource) {
                            // TODO show this error in the node status (flow editor)
                            console.log("Your browser doesn't support the MediaSource API!");
                            return;
                        }
                        
                        // Watch input messages arriving from the Node-RED flow
                        $scope.$watch('msg', function(newVal, oldVal) {
                            if (!newVal || !newVal.payload) {
                                return;
                            }
                            
                            debugger;
                            
                            /*if (typeof newVal.payload !== "buffer") {
                                console.log("The msg.payload should contain an audio buffer!");
                                return;
                            }*/
                            
                            if (newVal.payload == true) {
                                // TODO aan server side tonen
                                if ($scope.mediaSource || $scope.mediaQueue || $scope.mediaBuffer) {
                                    console.log("The audio player is already started!");
                                    return;
                                }
                                
                                // TODO teruggeven naar server side ????????  Wat indien meerdere browsers ???????????
                                if (!window.MediaSource && !window.WebKitMediaSource) {
                                    console.log("Your browser doesn't support the MediaSource API!");
                                    return;
                                }
                              
                                // Try to have support for getUserMedia on as much platforms as possible
                                /*if (!navigator.getUserMedia) {
                                    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia;
                                }*/
                                
                                var audioElement = document.getElementById("mediaSourcePlayer_" + $scope.config.id);
                                $scope.mediaSource = new MediaSource();
                                audioElement.src = window.URL.createObjectURL($scope.mediaSource);
                                $scope.mediaQueue = [];

                                function updateBuffer(){
                                    if ($scope.mediaQueue.length > 0 && !$scope.mediaBuffer.updating) {
                                        $scope.mediaBuffer.appendBuffer($scope.mediaQueue.shift());
                                    }
                                }

                                $scope.mediaSource.addEventListener('sourceopen', function(){
                                    // TODO checken aan server side of het mediatype bestaat ??
                                    //if(!MediaSource.isTypeSupported(mime)) { ... }
                                    // See https://tools.ietf.org/html/rfc2361 (Appendix A.2)
                                    $scope.mediaBuffer = $scope.mediaSource.addSourceBuffer($scope.config.mimeType);
                                    $scope.mediaBuffer.mode = 'sequence';

                                    $scope.mediaBuffer.addEventListener('update', function() {
                                        console.log('update');
                                        updateBuffer();
                                    });

                                    $scope.mediaBuffer.addEventListener('updateend', function() {
                                        console.log('updateend');
                                        updateBuffer();
                                    });

                                    // From here on we can start receiving messages...
                                });
                                /*
                                // create audio analyser
                                var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                                $scope.analyser = audioCtx.createAnalyser();   
                                $scope.analyser.fftSize = 2048;
                                var bufferLength = $scope.analyser.frequencyBinCount;
                                var dataArray = new Uint8Array(bufferLength);
                                
                                // Bind our analyser to the media element source.
                                $scope.mediaSource.connect($scope.analyser);   
                                */
                            }
                            else if (newVal.payload == false) {
                                // TODO aan server side tonen
                                if (!$scope.mediaSource || !$scope.mediaQueue || !$scope.mediaBuffer) {
                                    console.log("The audio player was already stopped!");
                                    return;
                                }

                                // Stop the stream
                                $scope.mediaBuffer.abort();
        
                                // TODO Make sure we can restart the recording afterwards again
                                /*delete $scope.mediaSource;
                                delete $scope.mediaQueue;
                                delete $scope.mediaBuffer;*/
                            }
                            else if (newVal.payload instanceof ArrayBuffer) {
                                // TODO aan server side tonen
                                if (!$scope.mediaSource || !$scope.mediaQueue || !$scope.mediaBuffer) {
                                    console.log("Cannot play audio chunk when audio player is stopped!");
                                    return;
                                }
                                // See https://github.com/kmoskwiak/node-tcp-streaming-server/blob/master/client/js/app.js
                                if ($scope.mediaBuffer.updating || $scope.mediaQueue.length > 0) {
                                    $scope.mediaQueue.push(newVal.payload);
                                } else {
                                    $scope.mediaBuffer.appendBuffer(newVal.payload);
                                    
                                    var audioElement = document.getElementById("mediaSourcePlayer_" + $scope.config.id);
                                    audioElement.play();
                                }
                                /*
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
                                */
                            }
                            else {
                                // TODO dit ook al controleren in de server side kant !!!!!!!!!!!!!!!!!!
                                console.log("The msg.payload should contain a boolean or an ArrayBuffer!");
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
    RED.nodes.registerType('media-source-player', MediaSourcePlayerNode);
};
