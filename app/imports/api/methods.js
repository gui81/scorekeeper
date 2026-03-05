import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import {
  Matches,
  Players,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
} from './collections';

// Bonzini USA Elo rating constants
// http://www.bonziniusa.com/foosball/tournament/TournamentRankingSystem.html
const K_RATING_COEFFICIENT = 50;
const F_RATING_INTERVAL_SCALE_WEIGHT = 1000;

function winExpectancy(rating, opponentRating) {
  return 1 / (Math.pow(10, (-(rating - opponentRating) / F_RATING_INTERVAL_SCALE_WEIGHT)) + 1);
}

async function updateRating(date, playerId, rating, opponentRating, ratingToAdjust, win, collection) {
  const S = win ? 1 : 0;
  const We = winExpectancy(rating, opponentRating);
  const Rn = ratingToAdjust + (K_RATING_COEFFICIENT * (S - We));

  await collection.insertAsync({
    date_time: date,
    player_id: playerId,
    rating: Rn,
  });

  return Rn;
}

async function getPlayerId(playerName) {
  const player = await Players.findOneAsync({ name: playerName });
  return player ? player._id : undefined;
}

async function getPlayerName(playerId) {
  const player = await Players.findOneAsync({ _id: playerId });
  return player ? player.name : undefined;
}

async function update2v2Ratings(rv) {
  const redRating = (rv.lastRoCombined.rating + rv.lastRdCombined.rating) / 2.0;
  const blueRating = (rv.lastBoCombined.rating + rv.lastBdCombined.rating) / 2.0;

  // Combined ratings
  await updateRating(rv.date, rv.roId, redRating, blueRating, rv.lastRoCombined.rating, rv.redWon, CombinedRatings);
  await updateRating(rv.date, rv.rdId, redRating, blueRating, rv.lastRdCombined.rating, rv.redWon, CombinedRatings);
  await updateRating(rv.date, rv.boId, blueRating, redRating, rv.lastBoCombined.rating, !rv.redWon, CombinedRatings);
  await updateRating(rv.date, rv.bdId, blueRating, redRating, rv.lastBdCombined.rating, !rv.redWon, CombinedRatings);

  // Offense/Defense ratings
  await updateRating(rv.date, rv.roId, redRating, blueRating, rv.lastRoOffense.rating, rv.redWon, OffenseRatings);
  await updateRating(rv.date, rv.rdId, redRating, blueRating, rv.lastRdDefense.rating, rv.redWon, DefenseRatings);
  await updateRating(rv.date, rv.boId, blueRating, redRating, rv.lastBoOffense.rating, !rv.redWon, OffenseRatings);
  await updateRating(rv.date, rv.bdId, blueRating, redRating, rv.lastBdDefense.rating, !rv.redWon, DefenseRatings);
}

async function update1v1Ratings(rv) {
  // Combined ratings
  await updateRating(rv.date, rv.roId, rv.lastRoCombined.rating, rv.lastBoCombined.rating, rv.lastRoCombined.rating, rv.redWon, CombinedRatings);
  await updateRating(rv.date, rv.boId, rv.lastBoCombined.rating, rv.lastRoCombined.rating, rv.lastBoCombined.rating, !rv.redWon, CombinedRatings);

  // Singles ratings
  await updateRating(rv.date, rv.roId, rv.lastRoSingles.rating, rv.lastBoSingles.rating, rv.lastRoSingles.rating, rv.redWon, SinglesRatings);
  await updateRating(rv.date, rv.boId, rv.lastBoSingles.rating, rv.lastRoSingles.rating, rv.lastBoSingles.rating, !rv.redWon, SinglesRatings);
}

async function update2v1Ratings(doc, rv) {
  if (!doc) return;

  if (typeof doc.rd !== 'undefined') {
    // 2 red v 1 blue — give more value to the single player (divide by 1.5 instead of 2)
    const redRating = (rv.lastRoCombined.rating + rv.lastRdCombined.rating) / 1.5;

    // Combined
    await updateRating(rv.date, rv.roId, redRating, rv.lastBoCombined.rating, rv.lastRoCombined.rating, rv.redWon, CombinedRatings);
    await updateRating(rv.date, rv.rdId, redRating, rv.lastBoCombined.rating, rv.lastRdCombined.rating, rv.redWon, CombinedRatings);
    await updateRating(rv.date, rv.boId, rv.lastBoCombined.rating, redRating, rv.lastBoCombined.rating, !rv.redWon, CombinedRatings);

    // Offense/Defense for team side
    await updateRating(rv.date, rv.roId, redRating, rv.lastBoSingles.rating, rv.lastRoOffense.rating, rv.redWon, OffenseRatings);
    await updateRating(rv.date, rv.rdId, redRating, rv.lastBoSingles.rating, rv.lastRdDefense.rating, rv.redWon, DefenseRatings);

    // Singles for solo player
    await updateRating(rv.date, rv.boId, rv.lastBoSingles.rating, redRating, rv.lastBoSingles.rating, !rv.redWon, SinglesRatings);
  } else {
    // 1 red v 2 blue
    const blueRating = (rv.lastBoCombined.rating + rv.lastBdCombined.rating) / 1.5;

    // Combined
    await updateRating(rv.date, rv.roId, rv.lastRoCombined.rating, blueRating, rv.lastRoCombined.rating, rv.redWon, CombinedRatings);
    await updateRating(rv.date, rv.boId, blueRating, rv.lastRoCombined.rating, rv.lastBoCombined.rating, !rv.redWon, CombinedRatings);
    await updateRating(rv.date, rv.bdId, blueRating, rv.lastRoCombined.rating, rv.lastBdCombined.rating, !rv.redWon, CombinedRatings);

    // Singles for solo player
    await updateRating(rv.date, rv.roId, rv.lastRoSingles.rating, blueRating, rv.lastRoSingles.rating, rv.redWon, SinglesRatings);

    // Offense/Defense for team side
    await updateRating(rv.date, rv.boId, blueRating, rv.lastRoSingles.rating, rv.lastBoOffense.rating, !rv.redWon, OffenseRatings);
    await updateRating(rv.date, rv.bdId, blueRating, rv.lastRoSingles.rating, rv.lastBdDefense.rating, !rv.redWon, DefenseRatings);
  }
}

async function updateAllRatings(doc, date) {
  if (!doc) {
    console.log('updateAllRatings: error: found empty doc');
    return;
  }

  const rv = { date, redWon: parseInt(doc.rs) > parseInt(doc.bs) };

  if (typeof doc.ro !== 'undefined') {
    rv.roId = await getPlayerId(doc.ro);
    rv.lastRoCombined = await CombinedRatings.findOneAsync({ player_id: rv.roId }, { sort: { date_time: -1 } });
    rv.lastRoSingles = await SinglesRatings.findOneAsync({ player_id: rv.roId }, { sort: { date_time: -1 } });
    rv.lastRoOffense = await OffenseRatings.findOneAsync({ player_id: rv.roId }, { sort: { date_time: -1 } });
  }
  if (typeof doc.rd !== 'undefined') {
    rv.rdId = await getPlayerId(doc.rd);
    rv.lastRdCombined = await CombinedRatings.findOneAsync({ player_id: rv.rdId }, { sort: { date_time: -1 } });
    rv.lastRdDefense = await DefenseRatings.findOneAsync({ player_id: rv.rdId }, { sort: { date_time: -1 } });
  }
  if (typeof doc.bo !== 'undefined') {
    rv.boId = await getPlayerId(doc.bo);
    rv.lastBoCombined = await CombinedRatings.findOneAsync({ player_id: rv.boId }, { sort: { date_time: -1 } });
    rv.lastBoSingles = await SinglesRatings.findOneAsync({ player_id: rv.boId }, { sort: { date_time: -1 } });
    rv.lastBoOffense = await OffenseRatings.findOneAsync({ player_id: rv.boId }, { sort: { date_time: -1 } });
  }
  if (typeof doc.bd !== 'undefined') {
    rv.bdId = await getPlayerId(doc.bd);
    rv.lastBdCombined = await CombinedRatings.findOneAsync({ player_id: rv.bdId }, { sort: { date_time: -1 } });
    rv.lastBdDefense = await DefenseRatings.findOneAsync({ player_id: rv.bdId }, { sort: { date_time: -1 } });
  }

  if (typeof doc.rd !== 'undefined' && typeof doc.bd !== 'undefined') {
    await update2v2Ratings(rv);
  } else if (typeof doc.rd === 'undefined' && typeof doc.bd === 'undefined') {
    await update1v1Ratings(rv);
  } else {
    await update2v1Ratings(doc, rv);
  }
}

async function addPlayer(playerName, rating) {
  const existing = await Players.findOneAsync({ name: playerName });
  if (existing) {
    return existing._id;
  }

  const id = await Players.insertAsync({
    date_time: Date.now(),
    name: playerName,
  });

  const initRating = { date_time: Date.now(), player_id: id, rating };
  await CombinedRatings.insertAsync({ ...initRating });
  await SinglesRatings.insertAsync({ ...initRating });
  await OffenseRatings.insertAsync({ ...initRating });
  await DefenseRatings.insertAsync({ ...initRating });

  return id;
}

async function insertMatch(doc) {
  const roId = typeof doc.ro !== 'undefined' ? await getPlayerId(doc.ro) : undefined;
  const rdId = typeof doc.rd !== 'undefined' ? await getPlayerId(doc.rd) : undefined;
  const boId = typeof doc.bo !== 'undefined' ? await getPlayerId(doc.bo) : undefined;
  const bdId = typeof doc.bd !== 'undefined' ? await getPlayerId(doc.bd) : undefined;

  await Matches.insertAsync({
    date_time: Date.now(),
    ro_id: roId,
    rd_id: rdId,
    bo_id: boId,
    bd_id: bdId,
    rs: doc.rs,
    bs: doc.bs,
  });
}

// Validation schema for match input
const matchPattern = {
  ro: String,
  rd: Match.Optional(String),
  bo: String,
  bd: Match.Optional(String),
  rs: Match.Integer,
  bs: Match.Integer,
};

const playerPattern = {
  playername: String,
  rating: Match.Where((x) => [250, 750, 1250, 1750, 2250].includes(x)),
};

Meteor.methods({
  async add_match(doc) {
    check(doc, matchPattern);

    if (doc.rs < 0 || doc.rs > 10 || doc.bs < 0 || doc.bs > 10) {
      throw new Meteor.Error('invalid-score', 'Scores must be between 0 and 10');
    }

    // Verify players exist
    const roPlayer = await Players.findOneAsync({ name: doc.ro });
    if (!roPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.ro}" not found`);
    const boPlayer = await Players.findOneAsync({ name: doc.bo });
    if (!boPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.bo}" not found`);
    if (doc.rd) {
      const rdPlayer = await Players.findOneAsync({ name: doc.rd });
      if (!rdPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.rd}" not found`);
    }
    if (doc.bd) {
      const bdPlayer = await Players.findOneAsync({ name: doc.bd });
      if (!bdPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.bd}" not found`);
    }

    await insertMatch(doc);
    await updateAllRatings(doc, Date.now());
  },

  async add_player(doc) {
    check(doc, playerPattern);

    if (doc.playername.length < 2) {
      throw new Meteor.Error('invalid-name', 'Player name must be at least 2 characters');
    }

    await addPlayer(doc.playername, doc.rating);
  },
});

// Rating recalculation on startup (controlled by settings.json)
if (Meteor.isServer) {
  Meteor.startup(async () => {
    if (Meteor.settings.recalculate_ratings === 'true') {
      console.log('Recalculating ratings...');

      await CombinedRatings.removeAsync({});
      await SinglesRatings.removeAsync({});
      await OffenseRatings.removeAsync({});
      await DefenseRatings.removeAsync({});

      const INITIAL_RATING = 1250;
      const players = await Players.find({}, { sort: { date_time: 1 } }).fetchAsync();

      for (const player of players) {
        console.log('Adding initial rating for player: ' + player.name);
        const initRating = { date_time: player.date_time, player_id: player._id, rating: INITIAL_RATING };
        await CombinedRatings.insertAsync({ ...initRating });
        await SinglesRatings.insertAsync({ ...initRating });
        await OffenseRatings.insertAsync({ ...initRating });
        await DefenseRatings.insertAsync({ ...initRating });
      }

      const matches = await Matches.find({}, { sort: { date_time: 1 } }).fetchAsync();

      for (const match of matches) {
        const doc = {
          ro: await getPlayerName(match.ro_id),
          rd: await getPlayerName(match.rd_id),
          bo: await getPlayerName(match.bo_id),
          bd: await getPlayerName(match.bd_id),
          rs: match.rs,
          bs: match.bs,
        };
        await updateAllRatings(doc, match.date_time);
      }

      console.log('Rating recalculation complete.');
    }
  });
}
