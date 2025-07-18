const express = require('express');
const app = express();
const path = require('path');
const port = process.env.PORT||3000;
const adminRoute = require('./route/adminRoute');
const userRoute = require('./route/userRoute');
const connectDb = require('./db/connect');
const passport = require('passport');
const flash = require('connect-flash');
require('./config/passportConfig');

// Connect to the database
connectDb();

// Built-in middleware for parsing JSON and URL-encoded form data
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 


const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET, //-----------------------------------------------------
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

app.use((req, res, next) => {
    res.locals.session = req.session; 
    next();
});

app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === 'production') { //-----------------------------------------------------
  app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] !== 'https') {
          return res.redirect(`https://${req.headers.host}${req.url}`);
      }
      next();
  });
}


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));

const nocache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };
  
  app.use(['/login', '/home' ,'/admin','/admin/home'], nocache);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Routes
app.use('/', userRoute);
app.use('/admin', adminRoute);

// Catch-all route for undefined user routes
app.use('/', (req, res, next) => {
    if (!req.route) {
      return res.status(404).render('404', { title: 'Page Not Found' });
    }
    next();
  });
  
  // Catch-all route for undefined admin routes
  app.use('/admin', (req, res, next) => {
    if (!req.route) {
      return res.status(404).render('admin/404', { title: 'Admin Page Not Found' });
    }
    next();
  });


  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal server error',
        errorDetails: err.message
    });
  });

  
  // General 404 fallback for other unexpected routes
  app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
  });
  
  app.use(flash())
// Start the server
app.listen(port, () => console.log(`App listening on port ${port}!`));



