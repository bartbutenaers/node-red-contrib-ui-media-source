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
        // No html content, to allow the user to use other widgets to enable/disable the audio capture
        var mimeType = config.mimeType;
        return "";
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
                            return orig.msg;
                        }
                    },
                    initController: function($scope, events) {
                        debugger;
                        
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
                                
                                // Start capturing by getting access to the microphone (e.g. Chrome will display a popup here ...)
                                navigator.getUserMedia({ audio: true, video: false }, function(stream) {
                                    $scope.mediaStream = stream;
                                    
                                    // Start a WEB AUDIO process chain
                                    $scope.context = new AudioContext();
                                    $scope.mediaSource = $scope.context.createMediaStreamSource($scope.mediaStream);
                                    $scope.recorderProcessor = $scope.context.createScriptProcessor(1024, 1, 1);

                                    $scope.mediaSource.connect($scope.recorderProcessor);
                                    $scope.recorderProcessor.connect($scope.context.destination);

                                    $scope.recorderProcessor.onaudioprocess = function(e) {
                                        // Send the audio chunk to the output of the node (in the Node-RED flow)
                                        $scope.send({payload: e.inputBuffer});
                                    };
                                    
                                    // When the buffer source stops playing, disconnect everything
                                    $scope.mediaSource.onplaying = function() {
                                        // TODO update the node status in the flow editor
                                    }
     
                                    // When the buffer source stops playing, disconnect everything
                                    $scope.mediaSource.onended = function() {
                                        // TODO update the node status in the flow editor
                                    }
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
};