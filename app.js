const express = require("express");
const http = require("http");
const socket = require("socket.io");
const { makeid } = require("./utils");
const { initGame } = require("./game");

const app = express();
const server = http.createServer(app);

app.get("/", (req, res) => {
  res.send("Server is running");
});

// Prevent idle shutdown on Railway
setInterval(() => {
  fetch(`http://localhost:${process.env.PORT}`).catch(() => {});
}, 25000);

const io = socket(server, {
  cors: {
    origin: "https://the-vote.vercel.app", // no trailing slash
    methods: ["GET", "POST"],
  },
});

const state = {};
let users = [];
const clientRooms = {};

io.on("connection", (client) => {
  console.log("Client connected:", client.id);

  client.on("create-game", (data) => {
    try {
      handleNewGame(data);
    } catch (err) {
      console.error("Error in create-game:", err);
      client.emit("error", { message: "Failed to create game" });
    }
  });

  client.on("join-game", async (data) => {
    try {
      await handleJoinGame(data);
    } catch (err) {
      console.error("Error in join-game:", err);
      client.emit("error", { message: "Failed to join game" });
    }
  });

  client.on("start-game", (roomname) => {
    try {
      const creatorId = state[roomname]?.players?.[0]?.id;
      if (creatorId && client.id === creatorId) handleStartGame(roomname);
      else
        client.emit("error", {
          message: "Only room creator can start the game.",
        });
    } catch (err) {
      console.error("Error in start-game:", err);
    }
  });

  client.on("answer", (data) => {
    try {
      handleAnswers(data);
    } catch (err) {
      console.error("Error in answer:", err);
    }
  });

  client.on("disconnect", () => {
    try {
      console.log("Client disconnected:", client.id);
      const roomname = clientRooms[client.id];
      if (!roomname) return;

      users = users.filter((u) => u.id !== client.id);
      const game = state[roomname];
      if (!game) return;

      game.users = users.filter((u) => u.roomname === roomname);
      game.players = game.players.filter((p) => p.id !== client.id);
      delete game.scores[client.id];

      io.sockets.in(roomname).emit("new-player", game.users);
      delete clientRooms[client.id];
    } catch (err) {
      console.error("Error on disconnect:", err);
    }
  });

  /*** FUNCTIONS ***/
  function handleNewGame(data) {
    const { name, avatar, gameType } = data;
    const roomName = makeid(5);
    clientRooms[client.id] = roomName;
    client.join(roomName);
    state[roomName] = initGame({ roomName, gameType });
    handleNewUser(name, avatar, roomName, client.id);
    client.emit("gameCode", roomName);
    console.log("Creating game:", { roomName, gameType });
  }

  async function handleJoinGame(data) {
    const { name, avatar, roomname } = data;
    const room = io.sockets.adapter.rooms.get(roomname);
    if (!room) return client.emit("unknownCode");
    if (room.size >= 12) return client.emit("tooManyPlayers");

    clientRooms[client.id] = roomname;
    client.join(roomname);
    handleNewUser(name, avatar, roomname, client.id);
    client.emit("init", room.size);
    console.log("Player joined room:", roomname);
  }

  function handleNewUser(name, avatar, roomname, id) {
    const user = { name, avatar, roomname, id };
    users.push(user);
    state[roomname].users = users.filter((u) => u.roomname === roomname);
    state[roomname].players.push({ name, avatar, id, score: 0 });
    state[roomname].scores[id] = 0;
    io.sockets.in(roomname).emit("new-player", state[roomname].users);
  }

  function handleStartGame(roomname) {
    console.log("Starting game in room:", roomname);
    const game = state[roomname];
    if (!game) return;

    game.round = 0;
    game.finished = false;
    game.scores = {};
    game.players.forEach((p) => (p.score = 0));
    game.answers = {};
    game.votes = {};

    io.sockets.in(roomname).emit("start", game);
    emitQuestion(roomname);
  }

  function emitQuestion(roomname) {
    console.log("Emitting question for room:", roomname);
    const game = state[roomname];
    console.log(
      `Emitting question for room ${roomname} to ${game?.players.length} players`
    );
    if (!game || game.finished) return;

    if (game.round >= game.maxQuestions) {
      game.finished = true;
      io.sockets.in(roomname).emit("game-end", {
        scores: game.scores,
        players: game.players,
      });
      return;
    }

    const question = game.questions[game.round];
    game.answers[question] = [];
    game.votes[question] = [];

    io.sockets.in(roomname).emit("question", {
      question,
      round: game.round + 1,
    });
  }

  function handleAnswers({ roomname, playerid, question, answer }) {
    console.log("Received answer from", playerid, "in room", roomname);
    const game = state[roomname];
    if (!game) return;

    if (game.answers[question].some((a) => a.playerid === playerid)) return;

    game.answers[question].push({ playerid, answer });
    game.votes[question].push({ voter: playerid, votedFor: answer.id });

    const totalPlayers = game.players.length;

    if (game.answers[question].length === totalPlayers) {
      const freq = {};
      game.answers[question].forEach((a) => {
        freq[a.answer.id] = (freq[a.answer.id] || 0) + 1;
      });

      const maxVotes = Math.max(...Object.values(freq));
      const winners = Object.keys(freq).filter((id) => freq[id] === maxVotes);

      winners.forEach((id) => {
        game.scores[id] = (game.scores[id] || 0) + 1;
        const player = game.players.find((p) => p.id === id);
        if (player) player.score = game.scores[id];
      });

      io.sockets.in(roomname).emit("result", {
        winners: game.players.filter((p) => winners.includes(p.id)),
        votes: game.votes[question],
        scores: game.scores,
        players: game.players,
        result: game,
      });

      game.round += 1;
      setTimeout(() => emitQuestion(roomname), 1000);
    }
  }
});

const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
