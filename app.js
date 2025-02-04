require("dotenv").config(); // Load environment variables
const express = require("express");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const mqtt = require("mqtt");
const http = require("http");
const cors = require("cors");
const { queryDatabase } = require("./db"); // Ganti dengan path ke file koneksi database

const createStatusTable = require("./statusDB");
createStatusTable();

// App setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for testing. Restrict this in production.
  },
});

// Load configuration from .env
const PORT = process.env.PORT || 3000;
const MQTT_BROKER = process.env.MQTT_BROKER;

// MQTT client setup
const mqttClient = mqtt.connect(MQTT_BROKER);
const MQTT_TOPICS = {
  STATUS: "esp01/status/#", // example: ESP8266/status/id_001
  DATA: "esp01/data/#", // example: ESP8266/status/
};

// Express middleware
app.use(cors());
app.use(bodyParser.json());

let userStatus = {};
let userTimeouts = {};

// MQTT event listeners
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe(Object.values(MQTT_TOPICS), (err) => {
    if (!err) {
      console.log(`Subscribed to topics: ${Object.values(MQTT_TOPICS)}`);
    }
  });
});

// Helper function: Save user log to database
async function saveUserLog(customId, newStatus) {
  const query = "INSERT INTO status (customID, status) VALUES (?, ?)";
  try {
    await queryDatabase(query, [customId, newStatus]);
    console.log(`User log saved: customId=${customId}, status=${newStatus}`);
  } catch (err) {
    console.error("Database insert error for user log:", err);
  }
}

// Reset timeout for marking user offline
function resetUserTimeout(customId) {
  if (userTimeouts[customId]) {
    clearTimeout(userTimeouts[customId]);
    console.log(`[DEBUG] Timeout cleared for ${customId}`);
  }

  userTimeouts[customId] = setTimeout(() => {
    console.log(`[DEBUG] Timeout executed for ${customId}, marking as offline`);
    setUserOffline(customId);
  }, 10000);

  console.log(`[DEBUG] Timeout set for ${customId}, will expire in 10s`);
}

// Handle MQTT status messages
function handleStatusMessage(customId, payload) {
  const newStatus = payload.message.toString().toUpperCase(); // Status from MQTT payload

  if (
    !userStatus[customId] ||
    userStatus[customId].previousStatus !== newStatus
  ) {
    console.log(`Status change detected for ${customId}: ${newStatus}`);

    saveUserLog(customId, newStatus);

    if (!userStatus[customId]) {
      userStatus[customId] = {};
    }
    userStatus[customId].previousStatus = newStatus;
  } else {
    console.log(`No status change for ${customId}: ${newStatus}`);
  }

  if (userStatus[customId] && userStatus[customId].socketId) {
    io.to(userStatus[customId].socketId).emit("mqtt-status", payload);
  }

  resetUserTimeout(customId);
}

// Mark user as offline
function setUserOffline(customId) {
  if (!userStatus[customId]) {
    return;
  }

  const currentStatus = userStatus[customId].previousStatus;
  if (currentStatus !== "OFFLINE") {
    console.log(`User ${customId} marked as offline`);

    saveUserLog(customId, "OFFLINE");

    userStatus[customId].previousStatus = "OFFLINE";

    if (userStatus[customId].socketId) {
      io.to(userStatus[customId].socketId).emit("mqtt-status", {
        topic: MQTT_TOPICS.STATUS,
        message: "OFFLINE",
      });
    }
  }

  // Hapus timeout agar tidak ada eksekusi ulang
  if (userTimeouts[customId]) {
    clearTimeout(userTimeouts[customId]);
    delete userTimeouts[customId];
  }
}

// MQTT event listeners
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe(Object.values(MQTT_TOPICS), (err) => {
    if (!err) {
      console.log(`Subscribed to topics: ${Object.values(MQTT_TOPICS)}`);
    }
  });
});

mqttClient.on("message", (topic, message) => {
  const filterTopic = topic.split("/")[1];
  const customId = topic.split("/").pop();
  const payload = { topic, message: message.toString() };

  if (filterTopic === "status") {
    handleStatusMessage(customId, payload);
  } else if (filterTopic === "light") {
    // handleLightMessage(customId, payload);
  }
});

// WebSocket event listeners
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  let customId = null;

  socket.on("set-custom-id", (id) => {
    customId = id;
    if (!userStatus[customId]) {
      userStatus[customId] = {};
    }
    userStatus[customId].socketId = socket.id;
    console.log(`User ${customId} connected`);

    resetUserTimeout(customId);
  });

  socket.on("disconnect", () => {
    if (customId) {
      console.log(`User ${customId} disconnected`);
      delete userStatus[customId];
      clearTimeout(userTimeouts[customId]);
    }
  });

  socket.on("publish", ({ topic, message }) => {
    mqttClient.publish(topic, message, (err) => {
      if (err) {
        console.error("MQTT Publish Error:", err);
      } else {
        console.log(`Published: ${message} to ${topic}`);
      }
    });
  });
});

// API endpoint: Check server status
app.get("/", (req, res) => {
  res.send("MQTT Backend is running");
});

// Start server
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
