const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MongoDBStore = require('connect-mongodb-session')(session);
const { MongoClient } = require('mongodb');
const multer = require('multer');
const MongoStore = require('connect-mongo')

const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const app = express();
const port = 3000;
const uri = 'mongodb+srv://srushtihemnani:Ma0K3talOfvKONFb@srush.k5kasxv.mongodb.net/node_login_app';

// Set up middlewares
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'test',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: uri,
  })
}))
// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Serve static files from the 'public' directory
app.use(express.static(__dirname + '/public'));

// Connect to MongoDB

// Connect to MongoDB

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const store = new MongoDBStore({
  uri: uri,
  databaseName: 'user_dashboard_db',
  collection: 'sessions',
});

store.on('error', (error) => {
  console.error('Session store error:', error);
});


async function connectToMongo() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const database = client.db();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
  }
}

connectToMongo().catch(console.error);
app.use((req, res, next) => {
  req.app.locals.db = client.db();
  next();
});
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    req.app.locals.db = client.db();
    next();
  } else {
    res.redirect('/login');
  }
};

// Create a storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads'); // Specify the destination directory for profile images
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname); // Generate a unique filename for each uploaded file
  },
});

// Create a multer instance with the storage engine
const upload = multer({ storage });

// Configure middleware
app.use(express.static('public'));


app.use(
  session({
    secret: 'login-app-srush',
    resave: '',
    saveUninitialized: true,
  })
);


// Define routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', {error: "", success:""});
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Find the user in the database
  const user = await req.app.locals.db.collection("users").findOne({ email })

  if (!user) {
    return res.render('login', { error: 'Invalid email or password', success : "" });
  }

  // Compare passwords
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.render('login', { error: 'Invalid email or password', success : "" });
  }

  // Store user information in the session
  req.session.user = { ...user };

  res.render('dashboard', { error: "", success : "Welcome to the Dashboard", user});
});
app.get('/register', (req, res) => {
  res.render('register');
});


app.post('/register', upload.single('profileImage'), async (req, res) => {
  const { name, email, password, title, dateOfBirth, bio } = req.body;
  const profileImage = req.file ? req.file.filename : null;
  const existingUser = await req.app.locals.db.collection("users").findOne({ email })
  // Check if the email is already registered
  if (existingUser)
    return res.render('login', { error: "Existing user!" });

  // Create a new user
  const newUser = {
    name,
    email,
    password: await bcrypt.hash(password, 10),
    title,
    dateOfBirth,
    bio,
    profileImage
  };
  const result = await req.app.locals.db.collection("users").insertOne(newUser);
  if (result.acknowledged === true) {
    // Registration successful
    req.session.user = newUser;
    return res.redirect('/dashboard');
  } else {
    // Failed to insert user
    return res.render('login', { error: 'Failed to register user' });
  }
});


app.get('/dashboard', (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.redirect('/login');
  }
  res.render('dashboard', {error: "", success :"", user });
});

app.get('/edit-profile', (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');

  res.render('edit-profile', {error:"", success:"",user });
});

app.post('/edit-profile',  upload.single('profileImage'), async (req, res) => {
  const { name, email, title, dateOfBirth, bio, oldPassword, newPassword, passwordConfirmation } = req.body;
  const userId = new ObjectId(req.session.user._id);
  const dbUser = await req.app.locals.db.collection('users').findOne({ _id: userId })
  const user = req.session.user;
  const profileImage = req.file ? req.file.filename : dbUser.profileImage;
  let hashedPassword = dbUser.password;

  if(newPassword != '' || oldPassword != '' || passwordConfirmation != ''){
    if (newPassword !== passwordConfirmation) return res.render('edit-profile', { error: 'New password and confirm password do not match', success:'', user });
    if (!dbUser) return res.render('edit-profile', { error: 'DB User Not found', success: '', user });
  
    // Compare passwords
    const isPasswordValid = await bcrypt.compare(oldPassword, dbUser.password);
  
    if (!isPasswordValid) return res.render('edit-profile', { error: 'Invalid password',success:'',  user });
  
    // Hash and update the new password
     hashedPassword = await bcrypt.hash(newPassword, 10);
  }


  let newData = {
    name,
    email,
    title,
    dateOfBirth,
    bio,
    password: hashedPassword ,
    profileImage
  }

  const result = await req.app.locals.db
      .collection('users')
      .updateOne({ _id: userId }, { $set: newData });
    
    if (result.acknowledged === true) {
      const data = await req.app.locals.db.collection('users').findOne({ _id: userId });
      // Update session with new user information
      req.session.user = {...data}
      let user = data
      if (!user) return res.redirect('/login');
      
      res.render('dashboard', {error:"", success :"Profile Updated Succesfully", user });
    }
    // return res.render('edit-profile', {error: "Somthing went wrong!"});
});

// Logout route
app.get('/logout', (req, res) => {
  // Clear user session
  req.session.user = null;
  res.redirect('/login');
});
// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
