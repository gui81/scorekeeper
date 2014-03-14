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
    return (y + " " + m + " " + d + " " + pad(h,2) + ":" + pad(min,2) + ":" + pad(s,2));
  });

  var mForm = new AutoForm(MatchFormSchema);
  Template.game_form.helpers({
    matchForm: function() {
      return mForm;
    }
  });

  var pForm = new AutoForm(PlayerFormSchema);
  Template.player_form.helpers({
    playerForm: function() {
      return pForm;
    }
  });

  Template.header.events({
    "click #menu-toggle": function(evt, tmpl) {
      $("#wrapper").toggleClass("active");
    }
  });

  Template.individual_stats.rendered = function() {
    $("table#individual_stats_table").tablesorter({sortList:[[3,1]]});
  }

  Template.team_stats.rendered = function() {
    $("table#team_stats_table").tablesorter({sortList:[[4,1]]});
  }

  Template.last_10_matches.rendered = function() {
    $("table#last_10_matches_table").tablesorter({sortList:[[0,1]]});
  }

  Template.last_10_players.rendered = function() {
    $("table#last_10_players_table").tablesorter({sortList:[[0,1]]});
  }

  var pad = function(num, size) {
    var s = num + "";
    while (s.length < size) {
      s = "0" + s;
    }
    return s;
  }

  var addIndPlayersArray = function(players, name, win, loss) {
    if (typeof players[name] != "undefined") {
      players[name] = ({
        wins: players[name].wins + win,
        losses: players[name].losses + loss
      });
    } else {
      if (typeof name != "undefined") {
        players[name] = ({
          wins: win,
          losses: loss
        });
      }
    }
  }

  var addTeamPlayersArray = function(players, o_name, d_name, win, loss) {
    if ((typeof players[o_name] != "undefined") &&
        (typeof players[o_name][d_name] != "undefined")) {
      players[o_name][d_name] = ({
        wins: players[o_name][d_name].wins + win,
        losses: players[o_name][d_name].losses + loss
      });
    } else {
      if ( (typeof o_name != "undefined") && (typeof d_name != "undefined") ) {
        if (typeof players[o_name] == "undefined") {
          players[o_name] = [];
        }
        players[o_name][d_name] = ({
          wins: win,
          losses: loss
        });
      }
    }
  }

  Template.game_form.helpers({
    red_singles_wins: function() {
      var matches = Matches.find({});
      var wins = 0;
      matches.forEach(function(match) {
        if ((typeof match.ro != "undefined") &&
            (typeof match.rd == "undefined") &&
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
        if ((typeof match.ro != "undefined") &&
            (typeof match.rd != "undefined") &&
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
        if ((typeof match.bo != "undefined") &&
            (typeof match.bd == "undefined") &&
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
        if ((typeof match.bo != "undefined") &&
            (typeof match.bd != "undefined") &&
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

        addIndPlayersArray(players, match.ro, red_win, blue_win);
        addIndPlayersArray(players, match.rd, red_win, blue_win);
        addIndPlayersArray(players, match.bo, blue_win, red_win);
        addIndPlayersArray(players, match.bd, blue_win, red_win);
      });

      // now create a list that can be used for display
      var p = [];
      for (var player in players) {
        var per = (players[player].wins /
          (players[player].wins + players[player].losses));
        p.push({
          name: player,
          wins: players[player].wins,
          losses: players[player].losses,
          percent: (per.toFixed(2)*100) + "%"
        });
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

        addTeamPlayersArray(players, match.ro, match.rd, red_win, blue_win);
        addTeamPlayersArray(players, match.bo, match.bd, blue_win, red_win);
      });

      var teams = [];
      for (var o_name in players) {
        for (var d_name in players[o_name]) {
          var per = (players[o_name][d_name].wins /
            (players[o_name][d_name].wins + players[o_name][d_name].losses));
          teams.push({
            off_player: o_name,
            def_player: d_name,
            wins: players[o_name][d_name].wins,
            losses: players[o_name][d_name].losses,
            percent: (per.toFixed(2)*100) + "%"
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
