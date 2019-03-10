# node-red-contrib-media-source
Node-RED widget nodes for supporting the MediaSource API in a dashboard.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-ui-media-source@1.0.0-beta.1
```

## Recorder node
Node-RED widget node to record audio in a Node-RED dashboard.  This means capturing audio from the microphone of the machine where the dashboard is started in a browser.

The status of the recording can be controlled using the ```msg.payload``` of the input message:
+ **true** : The recording is started, when not started yet.
+ **false** : The recording is stopped, when not stopped yet.

During the recording, output messages will be send containing audio chunks (of raw audio samples) in the ```msg.payload```.

Example flow with a Switch on the dashboard to control the recording:

![Recorder flow](/images/media_source_recorder_flow.png)

```
[{"id":"6ee33526.bf411c","type":"debug","z":"95744d6c.fa339","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":1170,"y":360,"wires":[]},{"id":"366e2be9.6479a4","type":"ui_switch","z":"95744d6c.fa339","name":"","label":"Enable microphone","tooltip":"","group":"85148c3d.ed438","order":0,"width":0,"height":0,"passthru":false,"decouple":"false","topic":"","style":"","onvalue":"true","onvalueType":"bool","onicon":"","oncolor":"","offvalue":"false","offvalueType":"bool","officon":"","offcolor":"","x":830,"y":360,"wires":[["a57be101.8c6e5"]]},{"id":"a57be101.8c6e5","type":"media-source-recorder","z":"95744d6c.fa339","group":"e65830a3.ac40a","name":"","order":0,"width":0,"height":0,"x":1020,"y":360,"wires":[["6ee33526.bf411c"]]},{"id":"85148c3d.ed438","type":"ui_group","z":"","name":"Heatmap","tab":"846910.e7e126f","disp":true,"width":"6","collapse":false},{"id":"e65830a3.ac40a","type":"ui_group","z":"","name":"Default","tab":"846910.e7e126f","disp":true,"width":"6","collapse":false},{"id":"846910.e7e126f","type":"ui_tab","z":"","name":"Heatmap","icon":"dashboard","disabled":false,"hidden":false}]
```
