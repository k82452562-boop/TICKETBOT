const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is online 24/7!');
});

app.listen(PORT, () => {
    console.log(`[Server] Server is running on port ${PORT}`);
});
