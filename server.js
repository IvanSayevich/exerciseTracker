const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

mongoose.Promise = global.Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var Schema = mongoose.Schema;

var logSchema = new Schema({
  "description": String,
  "duration": Number,
  "date": Date
});

var userSchema = new Schema({
    username: String,
    log: [logSchema]
});

var User= mongoose.model('User', userSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.get("/api/exercise/users", function (req, res) {
  User.find({}, function (err, data) {
    if(err) return console.error(err);
    res.json(data);
  });
});


app.get("/api/exercise/log", function (req, res) {
  var id = req.query.userId;
  var from = req.query.from ? new Date(req.query.from) : new Date('1950-01-01');
  var to = req.query.to ? new Date(req.query.to) : new Date('2150-01-01');
  var limit = parseInt(req.query.limit) || Infinity;
  
  User.aggregate([
    { $match: { 
      _id: mongoose.Types.ObjectId(id)
    }},
    {  
      $project: {
        count: { $size: "$log" },
        log: {  
            $filter: {
               input: "$log",
               as: "exercise",
               cond: { $and: [
                    { $lte: [ "$$exercise.duration", limit] },
                    { $lte: [ "$$exercise.date", to ] },
                    { $gte: [ "$$exercise.date", from ] }      
                ] }
               
            }
         }
      }
    },
    {
     $addFields: {
       count: { $size: "$log" } 
     }
   }
  ],function (err, result) {
        if (err) {
            console.log(err);
            return;
        }
        res.json(result[0]);
        console.log(result);
    });
});


app.post('/api/exercise/new-user', (req, res) => {
  var name = req.body.username;
  var user = new User({username: name});
          user.save(function(err, data) {
            if(err) return console.error(err);
            res.json({username: user.username, _id: user._id});
          });
});

app.post('/api/exercise/add', (req, res) => {
  var userId = req.body.userId;
  var description = req.body.description;
  var duration = req.body.duration;
  
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1; 
  var yyyy = today.getFullYear();

  if (dd < 10) {
    dd = '0' + dd;
  }

  if (mm < 10) {
    mm = '0' + mm;
  }
  
  today = yyyy+ '-' +mm+ '-' +dd
  
  var date = req.body.date ? req.body.date : today;
  
          User.findByIdAndUpdate(userId, { $push: { log: {
            "description": description,
            "duration": duration,
            "date": date
          } } }, function (err, user) {
            if(err) console.error(err);
            console.log(user);
            if (user) { 
              res.json({ "username": user.username,"description": description, "duration": duration, "_id": userId, "date": date});
            } else {
              res.status(404).send("Sorry can't find this ID!");
            }
          });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
