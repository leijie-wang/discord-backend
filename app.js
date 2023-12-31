import 'dotenv/config';
import express from 'express';
import discordRouter from './routes/discord.js';
import reactRouter from './routes/react.js';

const app = express();
const PORT = process.env.PORT || 3000;
app.use('/react', reactRouter);
app.use('/', discordRouter);


app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
