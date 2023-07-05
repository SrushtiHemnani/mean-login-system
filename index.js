// Import required packages
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');


// Create Express app
const app = express();
const port = 3000;
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Connect to MongoDB
mongoose.connect('mongodb://0.0.0.0:27017/login_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Configure middleware
app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true,
  })
);

// Define the User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  dateOfBirth: Date,
  email: String,
});

const User = mongoose.model('User', userSchema);

// Define routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Find the user in the database
  const user = await User.findOne({ username });

  if (!user) {
    return res.send('Invalid username or password');
  }

  // Compare passwords
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.send('Invalid username or password');
  }

  // Store user information in the session
  req.session.user = {
    username: user.username,
    dateOfBirth: user.dateOfBirth,
    email: user.email,
  };

  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.redirect('/login');
  }

  res.render('dashboard', { user });
});

app.get('/change-password', (req, res) => {
  res.render('change-password');
});

app.post('/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = req.session.user;

  if (!user) {
    return res.redirect('/login');
  }

  // Find the user in the database
  const dbUser = await User.findOne({ username: user.username });

  if (!dbUser) {
    return res.send('User not found');
  }

  // Compare passwords
  const isPasswordValid = await bcrypt.compare(oldPassword, dbUser.password);

  if (!isPasswordValid) {
    return res.send('Invalid password');
  }

  // Hash and update the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  dbUser.password = hashedPassword;
  await dbUser.save();

  res.send('Password changed successfully');
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
