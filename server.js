"use strict";

require('dotenv').config();

const PORT           = process.env.PORT || 8080;
const ENV            = process.env.ENV || "development";
const express        = require("express");
const bodyParser     = require("body-parser");
const sass           = require("node-sass-middleware");
const app            = express();

const knexConfig     = require("./knexfile");
const knex           = require("knex")(knexConfig[ENV]);
const morgan         = require('morgan');
const knexLogger     = require('knex-logger');
const bcrypt         = require('bcrypt');
const cookieSession  = require('cookie-session');
const takeScreenshot = require('./webshot');
const methodOverride = require("method-override");

// Seperated Routes for each Resource
const usersRoutes = require("./routes/users");
const resourcesRoutes = require("./routes/resources");
const carouselResources = require("./routes/carousel");


// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(methodOverride("_method"));
app.use(morgan('dev'));
app.use(cookieSession({
  name: 'session',
  keys: ['keys1', 'keys2']
}));

// Log knex SQL queries to STDOUT as well
//app.use(knexLogger(knex));

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
app.use("/api/users", usersRoutes(knex));
app.use("/api/resources", resourcesRoutes(knex));
app.use("/api/carousel", carouselResources(knex));

/* ----------- LANDING PAGE ---------- */
app.get("/", (req, res) => {
  knex('resources')
    .count('id')
    .then((count) => {
      knex('resources')
        .select('id', 'title', 'description', 'screenshot')
        .where('id', ((count[0].count) - 2))
        .then((results) => {
          let templateVars = {
            username: req.session.username,
            resourceActive: results[0]
          };
          res.render('index', templateVars);
        });
    })
    .catch((error) => console.log(error));
});

/* ----------- REGISTRATION ---------- */
  // TO DO:
  // ADD ERROR CHECKS FOR BLANK INPUTS OR IF USERNAME/EMAIL/PASSWORD ALREADY IN DATABASE
app.get("/registration", (req, res) => {
  const currentUser = req.session.username;
  if (currentUser) {
    res.redirect("/");
  }

  let templateVars = {
    username: req.session.username,
    blank: false,
    un: false,
    email: false
  };

  if (req.session.blank) {
    templateVars.blank = true;
    req.session = null;
  } else if (req.session.un) {
    templateVars.un = true;
    req.session = null;
  } else if (req.session.email) {
    templateVars.email = true;
    req.session = null;
  }
  res.render("registration", templateVars);
});

app.post("/registration", (req, res) => {

  // Checks for blank inputs as well as duplicates in the database
  if (req.body.username === '' || req.body.email === '' || req.body.password === '') {
    req.session.blank = true;
    res.redirect("/registration");
  } else {
      knex('users')
        .where('username', req.body.username)
        .orWhere('email', req.body.email)
        .then((result) => {

          if (result.length !== 0) { // username or email already exists in database
            knex.column('username').select().from('users')
              .where('username', req.body.username)
              .then((result) => {
                if (result.length !== 0) { // username exists
                  req.session.un = true;
                  res.redirect("/registration");
                } else { // email exists
                  req.session.email = true;
                  res.redirect("/registration");
                }
              })
              .catch((error) => {
                console.log(error);
              });

          } else { // username and email is available for creation
              // Hash the password
              const hashedPassword = bcrypt.hashSync(req.body.password, 15);
              knex("users")
                .insert({
                  username: req.body.username,
                  email: req.body.email,
                  password: hashedPassword
                })
                .then(() => {
                  // Sets cookie for the user
                  req.session.username = req.body.username;
                  res.redirect("/resources");
                })
                .catch((error) => {
                  console.error(error);
                });
            }
        })
        .catch((error) => {
                console.log(error);
        });
    } // else
}); // post registration


/* ---------- LOGIN ---------- */
// Login Page
app.get("/login", (req, res) => {

  const currentUser = req.session.username;
  if (!currentUser) {
    let templateVars = { username: req.session.username,};
    res.render("login", templateVars);
  } else {
    res.redirect("/");
  }

});

app.post("/login", (req, res) => {
  knex('users')
    .where('username', req.body.username)
    .andWhere('password', req.body.password)
    .then((result) => {
      if (result.length !== 0) {
        // Sets cookie for the user
        req.session.username = req.body.username;
        res.redirect("/resources/:id");
      } else {
        res.redirect("/login");
      }
    })
    .catch((error) => console.log(error));
});


/* ---------- LOGOUT ---------- */
app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});


/* ----------- RESOURCES ---------- */
app.get("/resources", (req, res) => {

  const currentUser = req.session.username;
  if (currentUser) {
    let templateVars = { username: req.session.username,};
    res.render("resources", templateVars);
  } else {
    res.redirect("/");
  }

});


/* ----------- ADD NEW RESOURCE ---------- */
app.get("/resources/new", (req, res) => {

  const currentUser = req.session.username;
  if (currentUser) {
    let templateVars = { username: req.session.username,};
    res.render("resource_new", templateVars);
  } else {
    res.redirect("/");
  }

});

// Retrieves the screenshot from the database
app.get("/resources/:id/screenshot", (req, res) => {

  knex.select('screenshot')
    .from('resources')
    .where('id', req.params.id)
    .then((results) => {

        res.header('Content-Type', 'image/png');
        res.send(results[0].screenshot);
    });
});

// Stores new resources into the database
// and including screenshot taken by webshot
// ***************** REMINDER: Add user_id to the new resource!!**********************
function insertResourceTags(tagsArray, resourceId) {
  tagsArray.forEach((tag) => {
    knex("tags")
      .select("id")
      .where("type", tag)
      .then((result) => {
        let tagId = result[0].id;
        knex('resources_tags')
          .insert({tag_id: tagId, resource_id: resourceId})
          .then();
      });
  });
}

app.post("/resources", (req, res) => {
  takeScreenshot(req.body.url)
    .then((screenshot) => {
        return knex("resources")
          .insert({
            url: req.body.url,
            title: req.body.title,
            description: req.body.description,
            screenshot: screenshot
          })
          .then(() => {
            knex("resources")
              .select("id")
              .where("url", req.body.url)
              .then((result) => {
                let tagsArray = [];
                typeof(req.body.tags) === 'string' ? tagsArray.push(req.body.tags) : tagsArray = req.body.tags;
                insertResourceTags(tagsArray, result[0].id);
              }) // .then to use resource id
          }) // .then to select resource id
    }) // .then to insert new resource
    .then(() => {res.redirect("/resources");});
}); // POST resources


/* ----------- MY RESOURCES ---------- */
app.get("/resources/:id", (req, res) => {

  const currentUser = req.session.username;
  if (currentUser) {
    let templateVars = { username: req.session.username,};
    res.render("resource_user", templateVars);
  } else {
    res.redirect("/");
  }

});

/* ----------- UPDATE PROFILE ---------- */
app.get("/update_profile", (req, res) => {

  const currentUser = req.session.username;
  if (currentUser) {
    let templateVars = { username: req.session.username,};
    res.render("update_profile", templateVars);
  } else {
    res.redirect("/");
  }

});

app.put("/update_profile", (req, res) => {

  // Checks for blank inputs
  if (req.body.email === '' || req.body.password === '') {
    res.status(403).send("Oh no! You need to fill in all of those fields.");
  } else {
      knex('users')
        .where('username', req.session.username)
        .update({
          email: req.body.email,
          password: req.body.password
        })
        .then((result) => {
            res.redirect("/resources")
        })
        .catch((error) => {
            console.log(error);
        });
    } // else
}); // Put profile_update

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
