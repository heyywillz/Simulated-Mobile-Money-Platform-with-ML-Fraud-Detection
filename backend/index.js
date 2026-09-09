// require('dotenv').config();
// const express = require('express');
// const userRegisterRoutes = require('./routers/userRegister');
// const { connectMongoose } = require('./utils/connectMongose');

// const cookiesParser = require('cookie-parser');
// const userInputs = require('./routers/userInputs');
// const cors = require('cors');

// const app = express();

// //middlewares
// app.use(express.json());
// app.use(cookiesParser());
// app.use(
//   cors({
//     origin: [
//       'http://localhost:5173',
//       'http://localhost:5175',
//       'http://localhost:5176',
//       'http://localhost:5174',
//       'http://localhost:8081',
//     ],
//     credentials: true,
//   }),
// );

// const PORT = process.env.PORT || 4000;

// //connecting the database

// connectMongoose();

// app.use('/', userRegisterRoutes);
// app.use('/transaction', userInputs);

// app.listen(PORT, () => console.log(`listening to port`, PORT));

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const userRegisterRoutes = require('./routers/userRegister');
const userInputs = require('./routers/userInputs');
const adminRouter = require('./routers/admin');
const { connectMongoose } = require('./utils/connectMongose');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:8081',
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : []),
].filter(Boolean);

const corsOriginCheck = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.onrender.com')
  ) {
    return callback(null, true);
  }
  return callback(null, true); // Permissive in cloud simulation mode
};

const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

app.use(express.json());

app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true,
  }),
);

app.use(cookieParser());

const PORT = process.env.PORT || 4000;

connectMongoose();

app.use('/', userRegisterRoutes);
app.use('/transaction', userInputs);
app.use('/admin', adminRouter);

server.listen(PORT, () => {
  console.log(`listening to port ${PORT}`);
});
