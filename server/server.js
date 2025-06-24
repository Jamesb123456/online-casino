"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
var express_1 = require("express");
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var cors_1 = require("cors");
var cookie_parser_1 = require("cookie-parser");
var dotenv_1 = require("dotenv");
var helmet_1 = require("helmet");
var morgan_1 = require("morgan");
// import initChatHandlers from './src/socket/chatHandler.js';
// import initLiveGamesHandlers from './src/socket/liveGamesHandler.js';
// Drizzle Database Connection
var db_js_1 = require("./drizzle/db.js");
// Routes
var auth_js_1 = require("./routes/auth.js");
var users_js_1 = require("./routes/users.js");
var games_js_1 = require("./routes/games.js");
var admin_js_1 = require("./routes/admin.js");
// Config
dotenv_1.default.config();
// Initialize Express app
var app = (0, express_1.default)();
var server = http_1.default.createServer(app);
var io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});
exports.io = io;
// Middleware
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
// Routes
app.use('/api/auth', auth_js_1.default);
app.use('/api/users', users_js_1.default);
app.use('/api/games', games_js_1.default);
app.use('/api/admin', admin_js_1.default);
// Root route
app.get('/', function (req, res) {
    res.send('Platinum Casino API is running');
});
// Define all namespaces outside the main connection handler
// Crash game namespace
var crashNamespace = io.of('/crash');
crashNamespace.on('connection', function (socket) {
    console.log('Client connected to crash namespace:', socket.id);
    // Get user from socket (simplified - in real app would use authentication)
    var user = { _id: socket.id, balance: 1000 };
    // Initialize crash handlers
    // require('./src/socket/crashHandler')(crashNamespace);
    // Handle disconnection
    socket.on('disconnect', function () {
        console.log('Client disconnected from crash namespace:', socket.id);
    });
});
// Roulette game namespace
var rouletteNamespace = io.of('/roulette');
rouletteNamespace.on('connection', function (socket) {
    console.log('Client connected to roulette namespace:', socket.id);
    // Get user from socket (simplified - in real app would use authentication)
    var user = { _id: socket.id, balance: 1000 };
    // Initialize roulette handlers
    // require('./src/socket/rouletteHandler').initRouletteHandlers(io, socket, user);
    // Handle disconnection
    socket.on('disconnect', function () {
        console.log('Client disconnected from roulette namespace:', socket.id);
    });
});
// Landmines game namespace
var landminesNamespace = io.of('/landmines');
landminesNamespace.on('connection', function (socket) {
    console.log('Client connected to landmines namespace:', socket.id);
    // Get user from socket (simplified - in real app would use authentication)
    var user = { _id: socket.id, balance: 1000 };
    // Initialize landmines handlers
    // require('./src/socket/landminesHandler').initLandminesHandlers(io, socket, user);
    // Handle disconnection
    socket.on('disconnect', function () {
        console.log('Client disconnected from landmines namespace:', socket.id);
    });
});
// Blackjack game namespace
var blackjackNamespace = io.of('/blackjack');
blackjackNamespace.on('connection', function (socket) {
    console.log('Client connected to blackjack namespace:', socket.id);
    // Get user from socket (simplified - in real app would use authentication)
    var user = { _id: socket.id, balance: 1000 };
    // Initialize blackjack handlers
    // require('./src/socket/blackjackHandler')(blackjackNamespace, socket);
    // Handle disconnection
    socket.on('disconnect', function () {
        console.log('Client disconnected from blackjack namespace:', socket.id);
    });
});
// Socket.io main namespace connection
io.on('connection', function (socket) {
    console.log('New client connected:', socket.id);
    // Game rooms
    socket.on('joinGame', function (gameType) {
        socket.join(gameType);
        console.log("User ".concat(socket.id, " joined ").concat(gameType));
    });
    // Handle disconnection from main namespace
    socket.on('disconnect', function () {
        console.log('Client disconnected:', socket.id);
    });
});
// Initialize chat handlers
// initChatHandlers(io);
// Initialize live games handlers
// initLiveGamesHandlers(io);
// Graceful shutdown
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('SIGINT received, shutting down gracefully...');
                return [4 /*yield*/, (0, db_js_1.closeDB)()];
            case 1:
                _a.sent();
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); });
process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('SIGTERM received, shutting down gracefully...');
                return [4 /*yield*/, (0, db_js_1.closeDB)()];
            case 1:
                _a.sent();
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); });
// Start server
var PORT = process.env.PORT || 5000; // Default port 5000
server.listen(PORT, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Server running on port ".concat(PORT));
                return [4 /*yield*/, (0, db_js_1.connectDB)()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
