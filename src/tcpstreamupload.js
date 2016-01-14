/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* global $ */
'use strict';

var initSocket = require('./socket').initSocket;
var display = require('./views/displaymetadata');
var net = require('net');
var blobUtil = require('blob-util');
var BlobBuilder = require('BlobBuilder');
var server;
exports.finiTcpServer = function() {
  if (!server) {
    return;
  }
  console.log('shut down the server at', server.address().address, ':', server.address().port);
  server.close();
}
exports.initTcpServer = function(args) {
  var model = args.model;
  var token = args.token;
  if (model.indexOf('Narrowband') == -1) {
    console.log('Phone conversation transcription must use narrowband models, '+
      'please select another');
    return false;
  }

  // Test out websocket
  var baseString = '';
  var baseJSON = '';


  server = net.createServer(function (socket) {

    // raw pcm incoming socket
    socket.name = socket.remoteAddress + ":" + socket.remotePort
    console.log('new connection from ', socket.name);
    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': 'audio/l16;rate=8000',
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3,
      'inactivity_timeout': 600
    };
    options.model = model;
    options.peername = socket.name;


    function onOpenWebsock(webSocket) {
      console.log('ws socket: opened');
      //socket.webSocket = webSocket;
    }

    function onListeningWebsock(webSocket) {
      console.log('ws socket: listening');
      socket.webSocket = webSocket;
      function toArrayBuffer(buffer) {
          var ab = new ArrayBuffer(buffer.length);
          var view = new Uint8Array(ab);
          for (var i = 0; i < buffer.length; ++i) {
              view[i] = buffer[i];
          }
          return view;
      }
      // Handle incoming messages from clients.
      socket.on('data', function (data) {
        // send data over websocket to watson
        if (!socket.webSocket) {
          console.log('drop ', data.length, 'bytes - no ws yet');
        }
        try {
          // var b = blobUtil.createBlob([data], {type: 'audio/l16'});
          //var b = new BlobBuilder;
          //b.append(toArrayBuffer(data));
          socket.webSocket.send(data, { binary: true, mask: true });
          console.log('pushed ', data.length, 'bytes');
        }
        catch (e) { console.log('ws send error', e); }
      });

    }

    function onMessageWebsock(msg) {
      console.log('on message', msg);
      if (msg.results) {
        baseString = display.showResult(msg, baseString, model);
        baseJSON = display.showJSON(msg, baseJSON);
        console.log(baseString);
      }
    }

    function onErrorWebsock() {
      console.log('ws socket err: ', err);
      socket.close();
    }

    function onCloseWebsock(evt) {
      console.log('ws socket close: ', evt);
      socket.destroy();
    }

    // init web socket t/w watson
    initSocket(options, onOpenWebsock, onListeningWebsock, onMessageWebsock, onErrorWebsock, onCloseWebsock);



    // Remove the client from the list when it leaves
    socket.on('end', function () {
      console.log("tcp socket from ", socket.name, " closed");
      if (socket.webSocket) {
        socket.webSocket.close();
      }
    });
  });
  server.listen(5000);
  console.log('got a tcp server at', server.address().address);
}
