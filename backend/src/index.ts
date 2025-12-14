 import express from 'express';

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend ready!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
