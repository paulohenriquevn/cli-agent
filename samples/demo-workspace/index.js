// Demo JavaScript file
const express = require('express');
const app = express();

// Added error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Something broke!");
});
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Port configuration from environment
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port 3000');
});