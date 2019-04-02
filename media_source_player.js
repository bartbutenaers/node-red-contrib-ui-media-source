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
        <audio width="400" controls id="mediaSourcePlayer_` + config.id`" ng-init='init(` + configAsJson + `)>
            <p>This browser does not support the audio element.</p>
        </video>;`
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
                        debugger;
                        
                        $scope.init = function (config) {
                            $scope.config = config;
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
                            
                            /*if (typeof newVal.payload !== "buffer") {
                                console.log("The msg.payload should contain an audio buffer!");
                                return;
                            }*/
                            
                            if (newVal.payload == true) {
                                if ($scope.mediaSource || $scope.mediaQueue || $scope.mediaBuffer) {
                                    console.log("The audio player is already started!");
                                    return;
                                }
                                
                                if (!window.MediaSource && !window.WebKitMediaSource) {
                                    console.log("Your browser doesn't support the MediaSource API!");
                                    return;
                                }
                              
                                // Try to have support for getUserMedia on as much platforms as possible
                                /*if (!navigator.getUserMedia) {
                                    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia;
                                }*/
                                
                                var audioElement = document.getElementById("mediaSourcePlayer_" + config.id);
                                $scope.mediaSource = new MediaSource();
                                audioElement.src = window.URL.createObjectURL($scope.mediaSource);
                                $scope.mediaQueue = [];

                                function updateBuffer(){
                                    if ($scope.mediaQueue.length > 0 && !$scope.mediaBuffer.updating) {
                                        $scope.mediaBuffer.appendBuffer($scope.mediaQueue.shift());
                                    }
                                }

                                $scope.mediaSource.addEventListener('sourceopen', function(){
                                    // TODO mime type uit $scope.init halen
                                    // See https://tools.ietf.org/html/rfc2361 (Appendix A.2)
                                    $scope.mediaBuffer = $scope.mediaSource.addSourceBuffer('audio/wav; codecs=1');
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

                            }
                            else if (newVal.payload == false) {
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
                            else if (typeof newVal.payload !== "buffer") {
                                // See https://github.com/kmoskwiak/node-tcp-streaming-server/blob/master/client/js/app.js
                                if ($scope.mediaBuffer.updating || $scope.mediaQueue.length > 0) {
                                    $scope.mediaQueue.push(msg.payload);
                                } else {
                                    $scope.mediaBuffer.appendBuffer(msg.payload);
                                    video.play();
                                }
                            }
                            else {
                                console.log("The msg.payload should contain a boolean or a buffer!");
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