"use strict";

require('dotenv').config();

const PORT        = process.env.PORT || 8080;
const ENV         = process.env.ENV || "development";
const express     = require("express");
const bodyParser  = require("body-parser");
const sass        = require("node-sass-middleware");
const app         = express();

const knexConfig  = require("./knexfile");
const knex        = require("knex")(knexConfig[ENV]);
const morgan      = require('morgan');
const knexLogger  = require('knex-logger');
const bcrypt      = require('bcrypt');
const cookieSession = require('cookie-session');

// Seperated Routes for each Resource
const usersRoutes = require("./routes/users");
const resourcesRoutes = require("./routes/resources");

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan('dev'));
app.use(cookieSession({
  name: 'session',
  keys: ['keys1', 'keys2']
}));

// Log knex SQL queries to STDOUT as well
app.use(knexLogger(knex));

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", sass({
  src: __dirname + "/styles",
  dest: __dirname + "/public/styles",
  debug: true,
  outputStyle: 'expanded'
}));
app.use(express.static("public"));

app.use(cookieSession({
  name: "session",
  keys: ['key1', 'key2']
}));

// Mount all resource routes
// app.use("/api/users", usersRoutes(knex));
app.use("/api/resources", resourcesRoutes(knex));

// HARDCODED DB, REMOVE ONCE ACTUAL DB IS INSTALLED
const userDB = {};

// Home page
app.get("/", (req, res) => {
  res.render("index");
});

//Resources Page
app.get("/resources", (req, res) => {
  res.render("resources");
});

/* ----------- REGISTRATION ---------- */
// Render the registration page.
app.get("/registration", (req, res) => {
  // // Checks if the user is logged in by looking for the cookie
  // if (req.session.username) {
  //   res.redirect("/my-resources"); // ==>Still need to add a my-resources page
  //   return;
  // }


  // TO DO:
  // ADD ERROR CHECKS FOR BLANK INPUTS OR IF USERNAME/EMAIL/PASSWORD ALREADY IN DATABASE

  res.render("registration");
});

app.post("/registration", (req, res) => {
  // Hash the password
  const hashedPassword = bcrypt.hashSync(req.body.password, 15);

  // Sets cookie for the username
  req.session.username = req.body.username;

  // Adds to the test DB until actual DB is ready
  userDB[(Math.floor((Math.random() * 100) + 1))] = {
    username: req.body.username,
    email: req.body.email,
    password: hashedPassword
  };

  // TO DO:
  // ADD ERROR CHECKS FOR BLANK INPUTS OR IF USERNAME/EMAIL/PASSWORD ALREADY IN DATABASE
  // ADD REGISTRATION INFO TO DATABASE HERE

  res.redirect("/resources"); // ==>Change to my-resources page once created
});


/* ---------- LOGIN ---------- */
// Login Page
app.get("/login", (req, res) => {
  res.render("login");
});


/* ---------- LOGOUT ---------- */
app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
