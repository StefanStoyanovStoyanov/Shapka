// public/words.js - WHOLE FILE

const socket = io();

// Get both the roomId and name from the URL.
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const name = urlParams.get("name");

// Get references to HTML elements.
const wordsForm = document.getElementById("wordsForm");
const statusDiv = document.getElementById("status");
const submitButton = wordsForm.querySelector("button");

// *** THE FIX IS HERE ***
if (roomId && name) {
    // Re-join the room with the correct player details.
    // This now sends the object the server is expecting.
    socket.emit("joinRoom", { roomId, name });
} else {
    statusDiv.textContent = "Error: Could not identify player or room.";
}

wordsForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Collect all 5 words from the input fields.
    const words = [
        document.getElementById("word1").value,
        document.getElementById("word2").value,
        document.getElementById("word3").value,
        document.getElementById("word4").value,
        document.getElementById("word5").value,
    ];

    // Send the words to the server.
    socket.emit("submitWords", words);

    // Disable the form after submission to prevent resubmitting.
    submitButton.disabled = true;
    submitButton.textContent = "Words Submitted!";
    statusDiv.textContent = "Your words have been submitted. Waiting for other players...";
});

// Listen for updates on how many players have submitted their words.
socket.on("wordsUpdate", (count) => {
    statusDiv.textContent = `Waiting for players... ${count}/4 players have submitted their words.`;
});

// Listen for the signal to start round 1. Redirect to blank page instead.
socket.on("startRound1", () => {
    // Redirect all players to the game page.
    window.location.href = `/game.html?roomId=${roomId}&name=${encodeURIComponent(name)}`;
});
