// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var serv = require('../..')(server);
var redis = require("redis");
var sub=redis.createClient();
var pub=redis.createClient();

var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});
var io = serv.of('/');
// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;
var users=[];
var rooms=["default"];
function checkRoom(room){
var index= rooms.indexOf(room);
console.log(index);
if(index>-1)
	return true;
else return false;
}



sub.on("message", function (channel, data) {
        data = JSON.parse(data);
        console.log("Inside Redis_Sub: data from channel " + channel + ": " + (data.sendType));
        if (parseInt("sendToSelf".localeCompare(data.sendType)) === 0) {
             serv.emit(data.sendTo, data.data);
        }else if (parseInt("sendToAllConnectedClients".localeCompare(data.sendType)) === 0) {
             serv.sockets.emit(data.sendTo, data.data);
        }else if (parseInt("sendToAllClientsInRoom".localeCompare(data.sendType)) === 0) {
			console.log("emiting to "+channel +"and to method "+data.sendTo);
            serv.sockets.in(channel).emit(data.sendTo, data.data);
        }       

    });




io.on('connection', function (socket) {
  var addedUser = false;

  io.emit('room added', {
	  
	  rooms:rooms
	  });// when the client emits 'new message', this listens and executes
  socket.on('new message', function (msg) {
    // we tell the client to execute 'new message'
	
	 var reply = JSON.stringify({
                method: 'message', 
                sendType: 'sendToAllClientsInRoom',
                data:{username: socket.username,
				room:socket.room,message: msg},
				sendTo:'new message'
            });
        pub.publish(socket.room,reply);
	
	/*
    socket.broadcast.to(socket.room).emit('new message', {
      username: socket.username,
      message: msg
    });*/
  });
  
  socket.on('add room',function(room){
	  if(checkRoom(room))return;
	  rooms.push(room);
	  //console.log("room added would be broadcasted"+rooms[0]);
	  
		var reply = JSON.stringify({
                method: 'message', 
                sendType: 'sendToAllConnectedClients',
                data:{username: socket.username,
				rooms:rooms},
				sendTo:'room added'
            });
        pub.publish(socket.room,reply);






	/* io.emit('room added', {
	  username: socket.username,
	  rooms:rooms
	  });*/
	  /*socket.emit('login', {
      numUsers: numUsers
    });
	 */
	  
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
	socket.room="default";
	socket.join(socket.room);
	users.push(username);
    addedUser = true;
	//var room = io.adapter.rooms[socket.room];
	sub.subscribe("default");	
    socket.emit('login', {
      numUsers: numUsers,
	  room:socket.room
    });
	console.log(users);
    // echo globally (all clients) that a person has connected
	
	
	 var reply = JSON.stringify({
                method: 'message', 
                sendType: 'sendToAllClientsInRoom',
                data:{username: socket.username,
				room:socket.room},
				sendTo:'user joined'
            });
        pub.publish(socket.room,reply);
	
	
  /*  socket.broadcast.to(socket.room).emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
	  room:socket.room
    });*/
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.to(socket.room).emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.to(socket.room).emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;
		var index = users.indexOf(socket.username);
		if (index > -1) {
    users.splice(index, 1);
}

var reply = JSON.stringify({
                method: 'message', 
                sendType: 'sendToAllClientsInRoom',
                data:{username: socket.username,
				room:socket.room},
				sendTo:'user left'
            });
        pub.publish(socket.room,reply);

	sub.quit();
        pub.publish("chatting","User is disconnected :" + socket.id);

      // echo globally that this client has left
     /* socket.broadcast.to(socket.room).emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });*/
	  socket.leave(socket.room);
	  console.log(users);
	  
	  
	  
	  
	     }
  });
  
  
  
  
  socket.on('switchRoom', function(data){
		// leave the current room (stored in session)
		socket.leave(socket.room);
		// join new room, received as function parameter
		var newroom=data.newroom;
		socket.join(newroom);
			
    
		//socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
		// sent message to OLD room
		//socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room');
		socket.emit('clear');
		
		socket.broadcast.to(socket.room).emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
		// update socket session room title
		
		
var reply = JSON.stringify({
                method: 'message', 
                sendType: 'sendToAllClientsInRoom',
                data:{username: socket.username,
				numUsers: numUsers,
				room:socket.room},
				sendTo:'user left'
            });
        pub.publish(socket.room,reply);
		
		
		socket.room = newroom;
		sub.subscribe(newroom);
		
		
		/*
		 socket.broadcast.to(socket.room).emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
	  room:socket.room
    });
	*/
	//socket.emit('updaterooms', rooms, newroom);
	 reply = JSON.stringify({
                method: 'message', 
                sendType: 'sendToAllClientsInRoom',
                data:{username: socket.username,
				room:socket.room},
				sendTo:'user joined'
            });
        pub.publish(socket.room,reply);
	
	
	
	
	});
  
  sub.on("subscribe", function(channel, count) {
        console.log("Subscribed to " + channel + ". Now subscribed to " + count + " channel(s).");
    });

  
  
  
  
  
  
  
});
