if (Meteor.isClient) {
  SimpleSchema.debug = true;
  Meteor.Spinner.options = {
    lines: 13, // The number of lines to draw
    length: 5, // The length of each line
    width: 2, // The line thickness
    radius: 8, // The radius of the inner circle
    corners: 0.7, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#fff', // #rgb or #rrggbb
    speed: 1, // Rounds per second
    trail: 60, // Afterglow percentage
    shadow: true, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '20px', // Top position relative to parent in px
    left: 'auto' // Left position relative to parent in px
  };

  Handlebars.registerHelper("formatDate", function(datetime) {
    var monthNames = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
    var dt = new Date(datetime);
    var d = dt.getDate();
    var m = monthNames[dt.getMonth()];
    var y = dt.getFullYear();
    var h = dt.getHours();
    var min = dt.getMinutes();
    var s = dt.getSeconds();
    return (y + m + d + " " + pad(h,2) + ":" + pad(min,2) + ":" + pad(s,2));
  });

  Handlebars.registerHelper("findPlayerFromId", function(player_id) {
    var player = Players.findOne({_id: player_id});
    if (typeof player != "undefined") {
      return player.name;
    } else {
      return 'N/A';
    }
  });

  Handlebars.registerHelper("findPlayerFirstEloRatingFromId", function(player_id) {
    var elo_rating = EloRatings.findOne({player_id: player_id}, {sort: {date_time: 1}});
    if (typeof elo_rating != "undefined") {
      return elo_rating.rating;
    } else {
      return 'N/A';
    }
  });

//  var mForm = new AutoForm(MatchFormSchema);
  Template.game_form.helpers({
    matchForm: function() {
      return MatchFormSchema;
    }
  });

//  var pForm = new AutoForm(PlayerFormSchema);
  Template.player_form.helpers({
    playerForm: function() {
      return PlayerFormSchema;
    }
  });

  var findPlayerLatestEloRatingFromId = function(player_id) {
    var elo_rating = EloRatings.findOne({player_id: player_id}, {sort: {date_time: -1}});
    if (typeof elo_rating != "undefined") {
      return +elo_rating.rating.toFixed(0);
    } else {
      return 'N/A';
    }
  }

  var pad = function(num, size) {
    var s = num + "";
    while (s.length < size) {
      s = "0" + s;
    }
    return s;
  }

  var addIndPlayersArray = function(players, id, win, loss) {
    if (typeof players[id] != "undefined") {
      players[id] = ({
        wins: players[id].wins + win,
        losses: players[id].losses + loss
      });
    } else {
      if ((typeof id != "undefined") && (id)) {
        players[id] = ({
          wins: win,
          losses: loss
        });
      }
    }
  }

  var addTeamPlayersArray = function(players, o_id, d_id, win, loss) {
    if ((typeof players[o_id] != "undefined") &&
        (typeof players[o_id][d_id] != "undefined")) {
      players[o_id][d_id] = ({
        wins: players[o_id][d_id].wins + win,
        losses: players[o_id][d_id].losses + loss
      });
    } else {
      if ( (typeof o_id != "undefined") && (typeof d_id != "undefined") &&
           (o_id) && (d_id) ) {
        if (typeof players[o_id] == "undefined") {
          players[o_id] = [];
        }
        players[o_id][d_id] = ({
          wins: win,
          losses: loss
        });
      }
    }
  }

  Template.header.events({
    "click #menu-toggle": function(evt, tmpl) {
      $("#wrapper").toggleClass("active");
    }
  });

  Template.home.rendered = function() {

  }

  Template.individual_stats.rendered = function() {
    $("table#individual_stats_table").tablesorter({sortList:[[4,1]]});
  }

  Template.team_stats.rendered = function() {
    $("table#team_stats_table").tablesorter({sortList:[[4,1]]});
  }

  Template.last_10_matches.rendered = function() {
    $("table#last_10_matches_table").tablesorter({sortList:[[0,1]]});
  }

  Template.last_10_players.rendered = function() {
    $("table#last_10_players_table").tablesorter({sortList:[[0,0]]});
  }

  Template.game_form.rendered = function() {
    var players = Players.find({}).fetch();
    var names = [];
    players.forEach(function(player) {
      names.push(player.name);
    });

    $(".input_autocomplete").autocomplete({
      source: names
    });
  }

  Template.game_form.helpers({
    red_singles_wins: function() {
      var matches = Matches.find({});
      var wins = 0;
      matches.forEach(function(match) {
        if ((match.ro_id) && (!match.rd_id) &&
            (parseInt(match.rs) > parseInt(match.bs))) {
          wins += 1;
        }
      });

      return wins;
    },

    red_doubles_wins: function() {
      var matches = Matches.find({});
      var wins = 0;
      matches.forEach(function(match) {
        if ((match.ro_id) && (match.rd_id) &&
            (parseInt(match.rs) > parseInt(match.bs))) {
          wins += 1;
        }
      });

      return wins;
    },

    blue_singles_wins: function() {
      var matches = Matches.find({});
      var wins = 0;
      matches.forEach(function(match) {
        if ((match.bo_id) && (!match.bd_id) &&
            (parseInt(match.bs) > parseInt(match.rs))) {
          wins += 1;
        }
      });

      return wins;
    },

    blue_doubles_wins: function() {
      var matches = Matches.find({});
      var wins = 0;
      matches.forEach(function(match) {
        if ((match.bo_id) && (match.bd_id) &&
            (parseInt(match.bs) > parseInt(match.rs))) {
          wins += 1;
        }
      });

      return wins;
    }
  });

  Template.last_10_matches.helpers({
    matches: function() {
      return Matches.find({}, {sort: {date_time: -1}, limit: 10});
    }
  });

  Template.last_10_players.helpers({
    players: function() {
      return Players.find({}, {limit: 10});
    }
  });

  Template.individual_stats.helpers({
    score: function() {
      var cursor = Matches.find({});
      var players = {};
      // loop through Matches to find all individuals and tally up scores
      cursor.forEach(function(match) {
        var red_win = 0;
        var blue_win = 0;
        if (parseInt(match.rs) > parseInt(match.bs)) {
          red_win = 1;
        } else {
          blue_win = 1;
        }

        addIndPlayersArray(players, match.ro_id, red_win, blue_win);
        addIndPlayersArray(players, match.rd_id, red_win, blue_win);
        addIndPlayersArray(players, match.bo_id, blue_win, red_win);
        addIndPlayersArray(players, match.bd_id, blue_win, red_win);
      });

      // now create a list that can be used for display
      var p = [];
      for (var id in players) {
        var per = (players[id].wins /
          (players[id].wins + players[id].losses));
        if (typeof id != "undefined") {
          var player = Players.findOne({_id: id});
          // console.log("player = " + JSON.stringify(player, null, 4));
          p.push({
            name: player.name,
            wins: players[id].wins,
            losses: players[id].losses,
            percent: +(per*100).toFixed(0) + "%",
            rating: findPlayerLatestEloRatingFromId(id)
          });
        }
      }

      return p;
    }
  });

  Template.team_stats.helpers({
    score: function() {
      var cursor = Matches.find({});
      var players = {};

      // loop through Matches to find all teams and tally up scores
      cursor.forEach(function(match) {
        var red_win = 0;
        var blue_win = 0;
        if (parseInt(match.rs) > parseInt(match.bs)) {
          red_win = 1;
        } else {
          blue_win = 1;
        }

        addTeamPlayersArray(players, match.ro_id, match.rd_id, red_win, blue_win);
        addTeamPlayersArray(players, match.bo_id, match.bd_id, blue_win, red_win);
      });

      var teams = [];
      for (var o_id in players) {
        for (var d_id in players[o_id]) {
          var per = (players[o_id][d_id].wins /
            (players[o_id][d_id].wins + players[o_id][d_id].losses));
          var o_player = Players.findOne({_id: o_id});
          var d_player = Players.findOne({_id: d_id});
          teams.push({
            off_player: o_player.name,
            def_player: d_player.name,
            wins: players[o_id][d_id].wins,
            losses: players[o_id][d_id].losses,
            percent: +(per*100).toFixed(0) + "%"
          });
        }
      }

      return teams;
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
