// using Collections2 pkg to validate inserts against schema to ensure data
// integrity
Matches = new Meteor.Collection('matches');

// here we are creating a SimpleSchema because date_time is in the Collection,
// but not in the form
MatchFormSchema = new SimpleSchema({
  ro: {
    type: String,
    label: "Red Offensive Player*",
    min: 2
  },
  rd: {
    type: String,
    label: "Red Defensive Player",
    optional: true,
    min: 2
  },
  bo: {
    type: String,
    label: "Blue Offensive Player*",
    min: 2
  },
  bd: {
    type: String,
    label: "Blue Defensive Player",
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

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    Meteor.methods({
      add_match: function(doc) {
        check(doc, MatchFormSchema);
        doc_with_date_time = doc;
        doc_with_date_time['date_time'] = Date.now;
        // console.log('ro = ' + doc.ro + ", rd = " + doc.rd +
        //             ', bo = ' + doc.bo + ", bd = " + doc.bd +
        //             ', rs = ' + doc.rs + ", bs = " + doc.bs);

        Matches.insert(doc_with_date_time);
      }
    });
  });
}
