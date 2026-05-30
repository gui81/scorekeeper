import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import {
  Matches,
  Players,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
  TeamRatings,
} from './collections';
import { OrganizationMembers } from './organizations';

async function requireOrgMember(orgId) {
  if (!Meteor.userId()) {
    throw new Meteor.Error('not-authorized', 'You must be logged in');
  }
  const member = await OrganizationMembers.findOneAsync({
    org_id: orgId,
    user_id: Meteor.userId(),
  });
  if (!member) {
    throw new Meteor.Error('not-authorized', 'You are not a member of this organization');
  }
  return member;
}

// Bonzini USA Elo rating constants
// http://www.bonziniusa.com/foosball/tournament/TournamentRankingSystem.html
const K_RATING_COEFFICIENT = 50;
const F_RATING_INTERVAL_SCALE_WEIGHT = 1000;

function winExpectancy(rating, opponentRating) {
  return 1 / (Math.pow(10, -(rating - opponentRating) / F_RATING_INTERVAL_SCALE_WEIGHT) + 1);
}

async function updateRating(
  date,
  playerId,
  rating,
  opponentRating,
  ratingToAdjust,
  score,
  collection,
) {
  const S = score;
  const We = winExpectancy(rating, opponentRating);
  const Rn = ratingToAdjust + K_RATING_COEFFICIENT * (S - We);

  await collection.insertAsync({
    date_time: date,
    player_id: playerId,
    rating: Rn,
  });

  return Rn;
}

async function getPlayerId(playerName, orgId) {
  const query = { name: playerName };
  if (orgId) query.org_id = orgId;
  const player = await Players.findOneAsync(query);
  return player ? player._id : undefined;
}

async function getPlayerName(playerId) {
  const player = await Players.findOneAsync({ _id: playerId });
  return player ? player.name : undefined;
}

const INITIAL_TEAM_RATING = 1250;

async function getLastTeamRating(offenseId, defenseId) {
  const rating = await TeamRatings.findOneAsync(
    { offense_id: offenseId, defense_id: defenseId },
    { sort: { date_time: -1 } },
  );
  return rating || { rating: INITIAL_TEAM_RATING };
}

async function updateTeamRating(
  date,
  offenseId,
  defenseId,
  teamRating,
  opponentRating,
  currentRating,
  score,
) {
  const S = score;
  const We = winExpectancy(teamRating, opponentRating);
  const Rn = currentRating + K_RATING_COEFFICIENT * (S - We);

  await TeamRatings.insertAsync({
    date_time: date,
    offense_id: offenseId,
    defense_id: defenseId,
    rating: Rn,
  });

  return Rn;
}

async function update2v2Ratings(rv) {
  const redRating = (rv.lastRoCombined.rating + rv.lastRdCombined.rating) / 2.0;
  const blueRating = (rv.lastBoCombined.rating + rv.lastBdCombined.rating) / 2.0;

  // Combined ratings
  await updateRating(
    rv.date,
    rv.roId,
    redRating,
    blueRating,
    rv.lastRoCombined.rating,
    rv.redScore,
    CombinedRatings,
  );
  await updateRating(
    rv.date,
    rv.rdId,
    redRating,
    blueRating,
    rv.lastRdCombined.rating,
    rv.redScore,
    CombinedRatings,
  );
  await updateRating(
    rv.date,
    rv.boId,
    blueRating,
    redRating,
    rv.lastBoCombined.rating,
    rv.blueScore,
    CombinedRatings,
  );
  await updateRating(
    rv.date,
    rv.bdId,
    blueRating,
    redRating,
    rv.lastBdCombined.rating,
    rv.blueScore,
    CombinedRatings,
  );

  // Offense/Defense ratings
  await updateRating(
    rv.date,
    rv.roId,
    redRating,
    blueRating,
    rv.lastRoOffense.rating,
    rv.redScore,
    OffenseRatings,
  );
  await updateRating(
    rv.date,
    rv.rdId,
    redRating,
    blueRating,
    rv.lastRdDefense.rating,
    rv.redScore,
    DefenseRatings,
  );
  await updateRating(
    rv.date,
    rv.boId,
    blueRating,
    redRating,
    rv.lastBoOffense.rating,
    rv.blueScore,
    OffenseRatings,
  );
  await updateRating(
    rv.date,
    rv.bdId,
    blueRating,
    redRating,
    rv.lastBdDefense.rating,
    rv.blueScore,
    DefenseRatings,
  );

  // Team ratings
  const lastRedTeam = await getLastTeamRating(rv.roId, rv.rdId);
  const lastBlueTeam = await getLastTeamRating(rv.boId, rv.bdId);
  await updateTeamRating(
    rv.date,
    rv.roId,
    rv.rdId,
    lastRedTeam.rating,
    lastBlueTeam.rating,
    lastRedTeam.rating,
    rv.redScore,
  );
  await updateTeamRating(
    rv.date,
    rv.boId,
    rv.bdId,
    lastBlueTeam.rating,
    lastRedTeam.rating,
    lastBlueTeam.rating,
    rv.blueScore,
  );
}

async function update1v1Ratings(rv) {
  // Combined ratings
  await updateRating(
    rv.date,
    rv.roId,
    rv.lastRoCombined.rating,
    rv.lastBoCombined.rating,
    rv.lastRoCombined.rating,
    rv.redScore,
    CombinedRatings,
  );
  await updateRating(
    rv.date,
    rv.boId,
    rv.lastBoCombined.rating,
    rv.lastRoCombined.rating,
    rv.lastBoCombined.rating,
    rv.blueScore,
    CombinedRatings,
  );

  // Singles ratings
  await updateRating(
    rv.date,
    rv.roId,
    rv.lastRoSingles.rating,
    rv.lastBoSingles.rating,
    rv.lastRoSingles.rating,
    rv.redScore,
    SinglesRatings,
  );
  await updateRating(
    rv.date,
    rv.boId,
    rv.lastBoSingles.rating,
    rv.lastRoSingles.rating,
    rv.lastBoSingles.rating,
    rv.blueScore,
    SinglesRatings,
  );
}

async function update2v1Ratings(doc, rv) {
  if (!doc) return;

  if (typeof doc.rd !== 'undefined') {
    // 2 red v 1 blue — give more value to the single player (divide by 1.5 instead of 2)
    const redRating = (rv.lastRoCombined.rating + rv.lastRdCombined.rating) / 1.5;

    // Combined
    await updateRating(
      rv.date,
      rv.roId,
      redRating,
      rv.lastBoCombined.rating,
      rv.lastRoCombined.rating,
      rv.redScore,
      CombinedRatings,
    );
    await updateRating(
      rv.date,
      rv.rdId,
      redRating,
      rv.lastBoCombined.rating,
      rv.lastRdCombined.rating,
      rv.redScore,
      CombinedRatings,
    );
    await updateRating(
      rv.date,
      rv.boId,
      rv.lastBoCombined.rating,
      redRating,
      rv.lastBoCombined.rating,
      rv.blueScore,
      CombinedRatings,
    );

    // Offense/Defense for team side
    await updateRating(
      rv.date,
      rv.roId,
      redRating,
      rv.lastBoSingles.rating,
      rv.lastRoOffense.rating,
      rv.redScore,
      OffenseRatings,
    );
    await updateRating(
      rv.date,
      rv.rdId,
      redRating,
      rv.lastBoSingles.rating,
      rv.lastRdDefense.rating,
      rv.redScore,
      DefenseRatings,
    );

    // Singles for solo player
    await updateRating(
      rv.date,
      rv.boId,
      rv.lastBoSingles.rating,
      redRating,
      rv.lastBoSingles.rating,
      rv.blueScore,
      SinglesRatings,
    );

    // Team rating for the 2-player side
    const lastRedTeam = await getLastTeamRating(rv.roId, rv.rdId);
    await updateTeamRating(
      rv.date,
      rv.roId,
      rv.rdId,
      lastRedTeam.rating,
      rv.lastBoCombined.rating,
      lastRedTeam.rating,
      rv.redScore,
    );
  } else {
    // 1 red v 2 blue
    const blueRating = (rv.lastBoCombined.rating + rv.lastBdCombined.rating) / 1.5;

    // Combined
    await updateRating(
      rv.date,
      rv.roId,
      rv.lastRoCombined.rating,
      blueRating,
      rv.lastRoCombined.rating,
      rv.redScore,
      CombinedRatings,
    );
    await updateRating(
      rv.date,
      rv.boId,
      blueRating,
      rv.lastRoCombined.rating,
      rv.lastBoCombined.rating,
      rv.blueScore,
      CombinedRatings,
    );
    await updateRating(
      rv.date,
      rv.bdId,
      blueRating,
      rv.lastRoCombined.rating,
      rv.lastBdCombined.rating,
      rv.blueScore,
      CombinedRatings,
    );

    // Singles for solo player
    await updateRating(
      rv.date,
      rv.roId,
      rv.lastRoSingles.rating,
      blueRating,
      rv.lastRoSingles.rating,
      rv.redScore,
      SinglesRatings,
    );

    // Offense/Defense for team side
    await updateRating(
      rv.date,
      rv.boId,
      blueRating,
      rv.lastRoSingles.rating,
      rv.lastBoOffense.rating,
      rv.blueScore,
      OffenseRatings,
    );
    await updateRating(
      rv.date,
      rv.bdId,
      blueRating,
      rv.lastRoSingles.rating,
      rv.lastBdDefense.rating,
      rv.blueScore,
      DefenseRatings,
    );

    // Team rating for the 2-player side
    const lastBlueTeam = await getLastTeamRating(rv.boId, rv.bdId);
    await updateTeamRating(
      rv.date,
      rv.boId,
      rv.bdId,
      lastBlueTeam.rating,
      rv.lastRoCombined.rating,
      lastBlueTeam.rating,
      rv.blueScore,
    );
  }
}

async function updateAllRatings(doc, date) {
  if (!doc) {
    console.log('updateAllRatings: error: found empty doc');
    return;
  }

  // Result from red's perspective as an Elo score S: win = 1, loss = 0, tie = 0.5.
  // Blue's score is the complement (1 - redScore). A draw still moves unequal
  // ratings toward each other; equally rated players are unchanged.
  const rs = parseInt(doc.rs);
  const bs = parseInt(doc.bs);
  const redScore = rs > bs ? 1 : rs < bs ? 0 : 0.5;
  const rv = { date, redScore, blueScore: 1 - redScore };

  if (typeof doc.ro !== 'undefined') {
    rv.roId = await getPlayerId(doc.ro, doc.org_id);
    rv.lastRoCombined = await CombinedRatings.findOneAsync(
      { player_id: rv.roId },
      { sort: { date_time: -1 } },
    );
    rv.lastRoSingles = await SinglesRatings.findOneAsync(
      { player_id: rv.roId },
      { sort: { date_time: -1 } },
    );
    rv.lastRoOffense = await OffenseRatings.findOneAsync(
      { player_id: rv.roId },
      { sort: { date_time: -1 } },
    );
  }
  if (typeof doc.rd !== 'undefined') {
    rv.rdId = await getPlayerId(doc.rd, doc.org_id);
    rv.lastRdCombined = await CombinedRatings.findOneAsync(
      { player_id: rv.rdId },
      { sort: { date_time: -1 } },
    );
    rv.lastRdDefense = await DefenseRatings.findOneAsync(
      { player_id: rv.rdId },
      { sort: { date_time: -1 } },
    );
  }
  if (typeof doc.bo !== 'undefined') {
    rv.boId = await getPlayerId(doc.bo, doc.org_id);
    rv.lastBoCombined = await CombinedRatings.findOneAsync(
      { player_id: rv.boId },
      { sort: { date_time: -1 } },
    );
    rv.lastBoSingles = await SinglesRatings.findOneAsync(
      { player_id: rv.boId },
      { sort: { date_time: -1 } },
    );
    rv.lastBoOffense = await OffenseRatings.findOneAsync(
      { player_id: rv.boId },
      { sort: { date_time: -1 } },
    );
  }
  if (typeof doc.bd !== 'undefined') {
    rv.bdId = await getPlayerId(doc.bd, doc.org_id);
    rv.lastBdCombined = await CombinedRatings.findOneAsync(
      { player_id: rv.bdId },
      { sort: { date_time: -1 } },
    );
    rv.lastBdDefense = await DefenseRatings.findOneAsync(
      { player_id: rv.bdId },
      { sort: { date_time: -1 } },
    );
  }

  if (typeof doc.rd !== 'undefined' && typeof doc.bd !== 'undefined') {
    await update2v2Ratings(rv);
  } else if (typeof doc.rd === 'undefined' && typeof doc.bd === 'undefined') {
    await update1v1Ratings(rv);
  } else {
    await update2v1Ratings(doc, rv);
  }
}

async function addPlayer(playerName, rating, orgId, userId) {
  const existing = await Players.findOneAsync({ name: playerName, org_id: orgId });
  if (existing) {
    return existing._id;
  }

  const doc = {
    date_time: Date.now(),
    name: playerName,
    org_id: orgId,
  };
  if (userId) {
    doc.user_id = userId;
  }

  const id = await Players.insertAsync(doc);

  const initRating = { date_time: Date.now(), player_id: id, rating };
  await CombinedRatings.insertAsync({ ...initRating });
  await SinglesRatings.insertAsync({ ...initRating });
  await OffenseRatings.insertAsync({ ...initRating });
  await DefenseRatings.insertAsync({ ...initRating });

  return id;
}

// `addPlayer` is used by org bootstrap; the rest are exported for the Elo test suite
// (app/imports/api/methods.tests.js). They have no other importers.
export { addPlayer, winExpectancy, updateRating, updateAllRatings };

async function insertMatch(doc, orgId) {
  const roId = typeof doc.ro !== 'undefined' ? await getPlayerId(doc.ro, orgId) : undefined;
  const rdId = typeof doc.rd !== 'undefined' ? await getPlayerId(doc.rd, orgId) : undefined;
  const boId = typeof doc.bo !== 'undefined' ? await getPlayerId(doc.bo, orgId) : undefined;
  const bdId = typeof doc.bd !== 'undefined' ? await getPlayerId(doc.bd, orgId) : undefined;

  await Matches.insertAsync({
    date_time: Date.now(),
    ro_id: roId,
    rd_id: rdId,
    bo_id: boId,
    bd_id: bdId,
    rs: doc.rs,
    bs: doc.bs,
    org_id: orgId,
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
  org_id: String,
};

const playerPattern = {
  playername: String,
  rating: Match.Where((x) => [250, 750, 1250, 1750, 2250].includes(x)),
  org_id: String,
};

Meteor.methods({
  async add_match(doc) {
    check(doc, matchPattern);
    await requireOrgMember(doc.org_id);

    if (doc.rs < 0 || doc.rs > 10 || doc.bs < 0 || doc.bs > 10) {
      throw new Meteor.Error('invalid-score', 'Scores must be between 0 and 10');
    }

    // Verify players exist within the organization
    const roPlayer = await Players.findOneAsync({ name: doc.ro, org_id: doc.org_id });
    if (!roPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.ro}" not found`);
    const boPlayer = await Players.findOneAsync({ name: doc.bo, org_id: doc.org_id });
    if (!boPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.bo}" not found`);
    if (doc.rd) {
      const rdPlayer = await Players.findOneAsync({ name: doc.rd, org_id: doc.org_id });
      if (!rdPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.rd}" not found`);
    }
    if (doc.bd) {
      const bdPlayer = await Players.findOneAsync({ name: doc.bd, org_id: doc.org_id });
      if (!bdPlayer) throw new Meteor.Error('player-not-found', `Player "${doc.bd}" not found`);
    }

    await insertMatch(doc, doc.org_id);
    await updateAllRatings(doc, Date.now());
  },

  async add_player(doc) {
    check(doc, playerPattern);
    await requireOrgMember(doc.org_id);

    if (doc.playername.length < 2) {
      throw new Meteor.Error('invalid-name', 'Player name must be at least 2 characters');
    }

    await addPlayer(doc.playername, doc.rating, doc.org_id);
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
      await TeamRatings.removeAsync({});

      const INITIAL_RATING = 1250;
      const players = await Players.find({}, { sort: { date_time: 1 } }).fetchAsync();

      for (const player of players) {
        console.log('Adding initial rating for player: ' + player.name);
        const initRating = {
          date_time: player.date_time,
          player_id: player._id,
          rating: INITIAL_RATING,
        };
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
          // carry the org so updateAllRatings → getPlayerId resolves names within the
          // match's org; without it a name shared across orgs could match the wrong player
          org_id: match.org_id,
        };
        await updateAllRatings(doc, match.date_time);
      }

      console.log('Rating recalculation complete.');
    }
  });
}
