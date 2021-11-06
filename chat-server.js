// Require the packages we will use:
var users = [];
var rooms = [];
const http = require("http"),
    fs = require("fs");

const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer(function (req, res) {
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile(file, function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.

        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    // This callback runs when a new Socket.IO connection is established.

    console.log("connect: "+ socket.id);

    socket.on("saveUser", function (data) {
        const userName = data.name;
        const room = "";
        const currentUser = getCurrentUser(socket.id);
        if (currentUser != undefined) {//current id already has a name. Change it to new name
            for (let index = 0; index < users.length; index++) {
                if (currentUser==users[index]) {
                    users[index].username = userName;
                    break;
                }
            }
        }
        else {//register new user 
            const user = userJoin(socket.id, userName, room);
        }
        
    });
    
    socket.on('joinRoom', function (userdata) {
        console.log("joinroom " + socket.id);
        const currentUser = getCurrentUser(socket.id);
        const roomname = userdata.room;
        const password = userdata.passWord;
        const Room = getRoombyName(roomname);
 
        if (currentUser!=undefined) {
            for (let index = 0; index < users.length; index++) {
                if (currentUser == users[index] && Room.password == password && !userBan(roomname,currentUser.username)) {
                    socket.leave(users[index].room);
                    io.in(users[index].room).emit("Userleft",{room:users[index].room});
                    socket.join(roomname);
                    users[index].room = roomname;
                    console.log("room set: " + users[index].room);
                    io.to(socket.id).emit("enterSuccess");
                    break;
                }
            }
        }
        
    });
    
    socket.on("message_to_server", function (msg) {
        // This callback runs when the server receives a new message from the client.
        console.log("message: " + msg.message); // log it to the Node.JS output
        const user = getCurrentUser(socket.id);
        if (user != undefined) {
            io.in(user.room).emit("message_to_client", { message: msg.message, _user:user.username });
        }
    });

    socket.on("privateMsgtoServer", function (data) {
        const sender = getCurrentUser(socket.id);
        const reveiver = getUserbyName(data.to);
        if (sender != undefined && reveiver != undefined) {
            io.to(reveiver.id).emit("pvt_msg_to_client", { message: data.message, senderName: sender.username });
            io.to(sender.id).emit("pvt_msg_to_client", { message: data.message, senderName: sender.username });
        }
    });
    
    
    
    socket.on("Room_msg", function (data) {
        var repeat = false;
        for (let index = 0; index < rooms.length; index++) {
            if (data._newRoomName == rooms[index].roomname) {//Room already exists
                repeat = true;
                break;
            };
        }
        if (!repeat) {
            const banlist = [];
            var newroomlist = addRoom(data._newRoomName, data._newRoomPass, socket.id, banlist);
            io.emit("newrooms", {newrooms:newroomlist});
        }
    });

    //send all rooms back to client
    socket.on("getRoomlist", function () {
        var rooms = getRoom();
        io.emit("getRooms", { roomlist: rooms });
    });
    
    //send all users in room to client
    socket.on("getUsersinRoom", function (data) {
        const users = getRoomUsers(data._tempRoom);
        io.in(data._tempRoom).emit("getUsers", { userlist: users });
        
    });

    socket.on("kickUser", function (data) {
        const kick_user = getUserbyName(data.name);
        if (kick_user != undefined) {
            const kick_usersRoom = getRoombyName(kick_user.room);
            if (kick_usersRoom.ownerid == socket.id) {
                io.to(kick_user.id).emit("LeaveRoom");
            }
        }
    });

    socket.on("banUser", function (data) {
        const ban_user = getUserbyName(data.name);
        if (ban_user != undefined) {
            const ban_usersRoom = getRoombyName(ban_user.room);
            console.log("got room");
            if (ban_usersRoom.ownerid == socket.id) {
                console.log("verified owner");
                io.to(ban_user.id).emit("LeaveRoom");
                ban_usersRoom.banList.push(ban_user.username);
            }
        }
    });



    socket.on("LetMeLeave", function () {
        const user = getCurrentUser(socket.id);
        io.in(user.room).emit("Userleft",{room:user.room});
        socket.leave(user.room);
        for (let index = 0; index < users.length; index++) {
            if (user == users[index]) {
                users[index].room = "";
            }
        }
    });
});


function userJoin(id, username, room) {
    const user = { id, username, room };
    users.push(user);
    return user;
}

function addRoom(roomname,password,ownerid,banList) {
    const room = { roomname, password,ownerid,banList };
    rooms.push(room);
    return rooms;
}

function getRoom() {
    return rooms;
}
  
function getCurrentUser(id) {
    return users.find(user => user.id === id);
}

function getUserbyName(name) {
    return users.find(user => user.username === name);
}
  
function getRoomUsers(room) {
    return users.filter(user => user.room === room);
}

function getRoombyName(Roomname) {
    return rooms.find(room => room.roomname === Roomname);
}

function userBan(Roomname,username) {
    const tempRoom = getRoombyName(Roomname);
    const banList = tempRoom.banList;
    return banList.includes(username);
}
  

