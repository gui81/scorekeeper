Matches = new Meteor.Collection('matches');

if (Meteor.isClient) {
  Template.game_form.events({
    'click #submit': function (evt, tmpl) {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined') {
        // players
        var ro = document.getElementById('ro').value;
        var rd = document.getElementById('rd').value;
        var bo = document.getElementById('bo').value;
        var bd = document.getElementById('bd').value;

        // score
        var rs = document.getElementById('rs').value;
        var bs = document.getElementById('bs').value;

        Matches.insert({
          date_time: Date.now(),
          ro: ro,
          rd: rd,
          bo: bo,
          bd: bd,
          rs: rs,
          bs: bs
        });
      }
    }
  });

  Template.individual_scores.helpers({
    score: function() {
      var cursor = Matches.find({});
      var empl = [];
      cursor.forEach(function(match) {
        console.log("match = " + match.ro);

        empl.push({
          name: match.ro,
          wins: 1,
          losses: 1
        });
      });

      return empl;
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
