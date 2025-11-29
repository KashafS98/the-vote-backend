const { questions } = require("./questions");
const { sampleSize } = require("./utils");

function initGame(data) {
  const state = createGameState(data);
  return state;
}

function createGameState(data) {
  // Ensure unique questions for each game session
  console.log("Creating game:", data);
  // TODO: add number of questions to the frontend setup
  let pool =
    data.gameType === "nsfw"
      ? [...questions.nsfw_prompts, ...questions.general_prompts]
      : [...questions.general_prompts, questions.questions];
  let questionsArr = [];
  while (questionsArr.length < 10 && pool.length > 0) {
    // number of qs
    const idx = Math.floor(Math.random() * pool.length);
    questionsArr.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return {
    players: [],
    gameCode: data.roomName,
    gameType: data.gameType,
    maxPlayers: 12,
    maxQuestions: 10, // number of qs
    round: 0,
    questions: questionsArr,
    answers: questionsArr.reduce(
      (o, key) => Object.assign(o, { [key]: [] }),
      {}
    ),
    scores: {}, // playerid: score
    votes: {}, // question: [{ voter: id, votedFor: id }]
    finished: false,
  };
}

module.exports = {
  initGame,
};
