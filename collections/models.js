// using autoform, simple-schema, and Collections2 packages to validate inserts
// against schema to ensure data integrity
Matches = new Meteor.Collection('matches');
Players = new Meteor.Collection('players');
CombinedRatings = new Meteor.Collection('combined_ratings');  // all games counted
SinglesRatings = new Meteor.Collection('singles_ratings');  // just singles
OffenseRatings = new Meteor.Collection('offense_ratings');  // doubles offense
DefenseRatings = new Meteor.Collection('defense_ratings');  // doubles defense

var playerNames = function() {
  // if the value does not exist, then let's just return so that the optional
  // fields are handled correctly
  if (this.value == "undefined" || !this.value) {
    return;
  }
  // now try to find the player in our Collection
  var player = Players.findOne({name: this.value});
  // if player not found, or for some reason the name is not found, then return
  // a custom message
  if (!player || !player.name) {
    return "nameNotFound";
  }
}

// custom messages
SimpleSchema.messages({
  "nameNotFound": "Player name does not currently exist."
});

// here we are creating a SimpleSchema because date_time is in the Collection,
// but not in the form
MatchFormSchema = new SimpleSchema({
  ro: {
    type: String,
    label: "Red/Yellow Offense*",
    min: 2,
    custom: playerNames
  },
  rd: {
    type: String,
    label: "Red/Yellow Defense",
    optional: true,
    min: 2,
    custom: playerNames
  },
  bo: {
    type: String,
    label: "Blue/Black Offense*",
    min: 2,
    custom: playerNames
  },
  bd: {
    type: String,
    label: "Blue/Black Defense",
    optional: true,
    min: 2,
    custom: playerNames
  },
  rs: {
    type: Number,
    label: "Red/Yellow Score*",
    min: 0,
    max: 10
  },
  bs: {
    type: Number,
    label: "Blue/Black Score*",
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

  Meteor.publish('combined_ratings', function() {
    return CombinedRatings.find();
  })

  Meteor.publish('singles_ratings', function() {
    return SinglesRatings.find();
  })

  Meteor.publish('offense_ratings', function() {
    return OffenseRatings.find();
  })

  Meteor.publish('defense_ratings', function() {
    return DefenseRatings.find();
  })

  // define some constants for Elo Ratings
  // we are using the Bonzini USA values:
  //   http://www.bonziniusa.com/foosball/tournament/TournamentRankingSystem.html
  var K_RATING_COEFFICIENT = 50;
  var F_RATING_INTERVAL_SCALE_WEIGHT = 1000;

  var updateRating = function(player_id, rating, opponent_rating, rating_to_adjust, win, collection) {
    var S = (win ? 1 : 0);
    var We = winExpectancy(rating, opponent_rating);
    var Rn = rating_to_adjust + (K_RATING_COEFFICIENT * (S - We));

    collection.insert({
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
      date_time: Date.now(),
      name: player_name
    });

    // add a rating for each rating being tracked
    CombinedRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    SinglesRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    OffenseRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    DefenseRatings.insert({
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
      // it should never get here since the MatchFormSchema should handle
      // making sure the player exists first
      return undefined;
    }
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
        var last_ro_combined_rating, last_rd_combined_rating, last_bo_combined_rating, last_bd_combined_rating;
        var last_ro_singles_rating, last_bo_singles_rating;
        var last_ro_offense_rating, last_bo_offense_rating;
        var last_rd_defense_rating, last_bd_defense_rating;
        if (typeof doc.ro != "undefined") {
          ro_id = getPlayerId(doc.ro);
          last_ro_combined_rating = CombinedRatings.findOne({player_id: ro_id}, {sort: {date_time: -1}});
          last_ro_singles_rating = SinglesRatings.findOne({player_id: ro_id}, {sort: {date_time: -1}});
          last_ro_offense_rating = OffenseRatings.findOne({player_id: ro_id}, {sort: {date_time: -1}});
        }
        if (typeof doc.rd != "undefined") {
          rd_id = getPlayerId(doc.rd);
          last_rd_combined_rating = CombinedRatings.findOne({player_id: rd_id}, {sort: {date_time: -1}});
          last_rd_defense_rating = DefenseRatings.findOne({player_id: rd_id}, {sort: {date_time: -1}});
        }
        if (typeof doc.bo != "undefined") {
          bo_id = getPlayerId(doc.bo);
          last_bo_combined_rating = CombinedRatings.findOne({player_id: bo_id}, {sort: {date_time: -1}});
          last_bo_singles_rating = SinglesRatings.findOne({player_id: bo_id}, {sort: {date_time: -1}});
          last_bo_offense_rating = OffenseRatings.findOne({player_id: bo_id}, {sort: {date_time: -1}});
        }
        if (typeof doc.bd != "undefined") {
          bd_id = getPlayerId(doc.bd);
          last_bd_combined_rating = CombinedRatings.findOne({player_id: bd_id}, {sort: {date_time: -1}});
          last_bd_defense_rating = DefenseRatings.findOne({player_id: bd_id}, {sort: {date_time: -1}});
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
          var red_rating = (last_ro_combined_rating.rating + last_rd_combined_rating.rating) / 2.0;
          var blue_rating = (last_bo_combined_rating.rating + last_bd_combined_rating.rating) / 2.0;

          // update combined ratings
          updateRating(ro_id, red_rating, blue_rating, last_ro_combined_rating.rating, red_won, CombinedRatings);
          updateRating(rd_id, red_rating, blue_rating, last_rd_combined_rating.rating, red_won, CombinedRatings);
          updateRating(bo_id, blue_rating, red_rating, last_bo_combined_rating.rating, !red_won, CombinedRatings);
          updateRating(bd_id, blue_rating, red_rating, last_bd_combined_rating.rating, !red_won, CombinedRatings);

          // update doubles ratings, distinguishing between offense and defense
          updateRating(ro_id, red_rating, blue_rating, last_ro_offense_rating.rating, red_won, OffenseRatings);
          updateRating(rd_id, red_rating, blue_rating, last_rd_defense_rating.rating, red_won, DefenseRatings);
          updateRating(bo_id, blue_rating, red_rating, last_bo_offense_rating.rating, !red_won, OffenseRatings);
          updateRating(bd_id, blue_rating, red_rating, last_bd_defense_rating.rating, !red_won, DefenseRatings);
        } else if ((typeof doc.rd == "undefined") &&
                   (typeof doc.bd == "undefined")) {
          // 1 v 1
          // update combined ratings
          updateRating(ro_id, last_ro_combined_rating.rating, last_bo_combined_rating.rating, last_ro_combined_rating.rating, red_won, CombinedRatings);
          updateRating(bo_id, last_bo_combined_rating.rating, last_ro_combined_rating.rating, last_bo_combined_rating.rating, !red_won, CombinedRatings);

          // update singles ratings
          updateRating(ro_id, last_ro_singles_rating.rating, last_bo_singles_rating.rating, last_ro_singles_rating.rating, red_won, SinglesRatings);
          updateRating(bo_id, last_bo_singles_rating.rating, last_ro_singles_rating.rating, last_bo_singles_rating.rating, !red_won, SinglesRatings);
        } else {
          // this is where I give more value to the single player, by not dividing
          // the team rating by 2, but instead by 1.5, since they are expected to
          // win
          if (typeof doc.rd != "undefined") {
            // 2 red v 1 blue
            // update combined ratings
            var red_rating = (last_ro_combined_rating.rating + last_rd_combined_rating.rating) / 1.5;
            updateRating(ro_id, red_rating, last_bo_combined_rating.rating, last_ro_combined_rating.rating, red_won, CombinedRatings);
            updateRating(rd_id, red_rating, last_bo_combined_rating.rating, last_rd_combined_rating.rating, red_won, CombinedRatings);
            updateRating(bo_id, last_bo_combined_rating.rating, red_rating, last_bo_combined_rating.rating, !red_won, CombinedRatings);

            // update doubles ratings
            updateRating(ro_id, red_rating, last_bo_singles_rating.rating, last_ro_offense_rating.rating, red_won, OffenseRatings);
            updateRating(rd_id, red_rating, last_bo_singles_rating.rating, last_rd_defense_rating.rating, red_won, DefenseRatings);

            // update singles ratings
            updateRating(bo_id, last_bo_singles_rating.rating, red_rating, last_bo_singles_rating.rating, !red_won, SinglesRatings);
          } else {
            // 1 red v 2 blue
            var blue_rating = (last_bo_combined_rating.rating + last_bd_combined_rating.rating) / 1.5;
            updateRating(ro_id, last_ro_combined_rating.rating, blue_rating, last_ro_combined_rating.rating, red_won, CombinedRatings);
            updateRating(bo_id, blue_rating, last_ro_combined_rating.rating, last_bo_combined_rating.rating, !red_won, CombinedRatings);
            updateRating(bd_id, blue_rating, last_ro_combined_rating.rating, last_bd_combined_rating.rating, !red_won, CombinedRatings);

            // update singles ratings
            updateRating(ro_id, last_ro_singles_rating.rating, blue_rating, last_ro_singles_rating.rating, red_won, SinglesRatings);

            // update doubles ratings
            updateRating(bo_id, blue_rating, last_ro_singles_rating.rating, last_bo_offense_rating.rating, !red_won, OffenseRatings);
            updateRating(bd_id, blue_rating, last_ro_singles_rating.rating, last_bd_defense_rating.rating, !red_won, DefenseRatings);
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
