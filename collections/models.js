// using Collections2 pkg to validate inserts against schema to ensure data
// integrity
Matches = new Meteor.Collection('matches');
Players = new Meteor.Collection('players');
EloRatings = new Meteor.Collection('elo_ratings');

// here we are creating a SimpleSchema because date_time is in the Collection,
// but not in the form
MatchFormSchema = new SimpleSchema({
  ro: {
    type: String,
    label: "Red Offense*",
    min: 2
  },
  rd: {
    type: String,
    label: "Red Defense",
    optional: true,
    min: 2
  },
  bo: {
    type: String,
    label: "Blue Offense*",
    min: 2
  },
  bd: {
    type: String,
    label: "Blue Defense",
    optional: true,
    min: 2
  },
  rs: {
    type: Number,
    label: "Red Score*",
    min: 0,
    max: 10
  },
  bs: {
    type: Number,
    label: "Blue Score*",
    min: 0,
    max: 10
  }
});

PlayerFormSchema = new SimpleSchema({
  player_name: {
    type: String,
    label: "Name*",
    min: 2
  },
  rating: {
    type: Number,
    label: "Initial Rating*",
    allowedValues: [250, 750, 1250, 1750, 2250]
  }
});

if (Meteor.isServer) {
  Meteor.publish('matches', function() {
    return Matches.find();
  })

  Meteor.publish('players', function() {
    return Players.find();
  })

  Meteor.publish('elo_ratings', function() {
    return EloRatings.find();
  })

  // define some constants for Elo Ratings
  // we are using the Bonzini USA values:
  //   http://www.bonziniusa.com/foosball/tournament/TournamentRankingSystem.html
  var K_RATING_COEFFICIENT = 50;
  var F_RATING_INTERVAL_SCALE_WEIGHT = 1000;

  var updateRating = function(player_id, rating, opponent_rating, win) {
    var S = (win ? 1 : 0);
    var We = winExpectancy(rating, opponent_rating);
    var Rn = rating + (K_RATING_COEFFICIENT * (S - We));

    EloRatings.insert({
      date_time: Date.now(),
      player_id: player_id,
      rating: Rn
    });

    return Rn;
  }

  var winExpectancy = function(rating, opponent_rating) {
    var We = 1 / (
        Math.pow(10, (-(rating-opponent_rating)/F_RATING_INTERVAL_SCALE_WEIGHT))
        + 1);
    return We;
  }

  /**
   *
   * @return {String} id of the record
   */
  var addPlayer = function(player_name, rating) {
    var id = Players.findOne({name: player_name});
    if (id) {
      // player already in database, no need to add again
      console.log("id already exists: " + id._id);
      return id._id;
    }

    // didn't find player above, so add one now
    id = Players.insert({
      name: player_name
    });

    // add a rating
    EloRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    return id;
  }

  var getPlayerId = function(player_name) {
    var id = Players.findOne({name: player_name});
    if (id) {
      return id._id;
    } else {
      // if an id did not exist, then it means that they were not added through
      // the add player form, no biggie, we'll just add them as a Novice-Elite (750)
      id = addPlayer(player_name, 750);
    }

    return id;
  }

  Meteor.startup(function () {
    // code to run on server at startup
    Meteor.methods({
      add_match: function(doc) {
        check(doc, MatchFormSchema);
        //doc['date_time'] = Date.now();
        // console.log('ro = ' + doc.ro + ", rd = " + doc.rd +
        //             ', bo = ' + doc.bo + ", bd = " + doc.bd +
        //             ', rs = ' + doc.rs + ", bs = " + doc.bs +
        //             ', date_time = ' + doc.date_time);
        //Matches.insert(doc);

        var ro_id, rd_id, bo_id, bd_id;
        var last_ro_rating, last_rd_rating, last_bo_rating, last_bd_rating;
        if (typeof doc.ro != "undefined") {
          ro_id = getPlayerId(doc.ro);
          last_ro_rating = EloRatings.findOne({player_id: ro_id}, {sort: {date_time: -1}});
        }
        if (typeof doc.rd != "undefined") {
          rd_id = getPlayerId(doc.rd);
          last_rd_rating = EloRatings.findOne({player_id: rd_id}, {sort: {date_time: -1}});
        }
        if (typeof doc.bo != "undefined") {
          bo_id = getPlayerId(doc.bo);
          last_bo_rating = EloRatings.findOne({player_id: bo_id}, {sort: {date_time: -1}});
        }
        if (typeof doc.bd != "undefined") {
          bd_id = getPlayerId(doc.bd);
          last_bd_rating = EloRatings.findOne({player_id: bd_id}, {sort: {date_time: -1}});
        }

        Matches.insert({
          date_time: Date.now(),
          ro_id: ro_id,
          rd_id: rd_id,
          bo_id: bo_id,
          bd_id: bd_id,
          rs: doc.rs,
          bs: doc.bs
        });

        var red_won;
        if (parseInt(doc.rs) > parseInt(doc.bs)) {
          red_won = true;
        } else {
          red_won = false;
        }

        if ((typeof doc.rd != "undefined") &&
            (typeof doc.bd != "undefined")) {
          // 2 v 2
          var red_rating = (last_ro_rating.rating + last_rd_rating.rating) / 2.0;
          var blue_rating = (last_bo_rating.rating + last_bd_rating.rating) / 2.0;
          var ro_rn = updateRating(ro_id, red_rating, blue_rating, red_won);
          var rd_rn = updateRating(rd_id, red_rating, blue_rating, red_won);
          var bo_rn = updateRating(bo_id, blue_rating, red_rating, !red_won);
          var bd_rn = updateRating(bd_id, blue_rating, red_rating, !red_won);
        } else if ((typeof doc.rd == "undefined") &&
                   (typeof doc.bd == "undefined")) {
          // 1 v 1
          var ro_rn = updateRating(ro_id, last_ro_rating.rating, last_bo_rating.rating, red_won);
          var bo_rn = updateRating(bo_id, last_bo_rating.rating, last_ro_rating.rating, !red_won);
        } else {
          // this is where I give more value to the single player, by not dividing
          // the team rating by 2, but instead by 1.5, since they are expected to
          // win
          if (typeof doc.rd != "undefined") {
            // 2 red v 1 blue
            var red_rating = (last_ro_rating.rating + last_rd_rating.rating) / 1.5;
            var ro_rn = updateRating(ro_id, red_rating, last_bo_rating.rating, red_won);
            var rd_rn = updateRating(rd_id, red_rating, last_bo_rating.rating, red_won);
            var bo_rn = updateRating(bo_id, last_bo_rating.rating, red_rating, !red_won);
          } else {
            // 1 red v 2 blue
            var blue_rating = (last_bo_rating.rating + last_bd_rating.rating) / 1.5;
            var ro_rn = updateRating(ro_id, last_ro_rating.rating, blue_rating, red_won);
            var bo_rn = updateRating(bo_id, blue_rating, last_ro_rating.rating, !red_won);
            var bd_rn = updateRating(bd_id, blue_rating, last_ro_rating.rating, !red_won);
          }
        }
      },

      add_player: function(doc) {
        check(doc, PlayerFormSchema);
        addPlayer(doc.player_name, doc.rating);
      }
    });
  });
}
