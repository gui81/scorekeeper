// methods.tests.js — Bonzini USA Elo rating system (K = 50, F = 1000).
//
// `meteor test` (no --full-app) loads this file because it matches *.tests.js, but it
// does NOT auto-load app code, so we import everything we exercise. The pure-math block
// runs on client + server; everything that touches Mongo is server-only (server Mongo is
// async, and the rating writes need a real collection) and guarded by Meteor.isServer.
//
// The Elo functions are otherwise un-exported; methods.js exports them for this suite.

import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { expect } from 'chai';
import { winExpectancy, updateRating, updateAllRatings, addPlayer } from '/imports/api/methods';
import {
  Matches,
  Players,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
  TeamRatings,
} from '/imports/api/collections';
import { OrganizationMembers } from '/imports/api/organizations';

const F = 1000;

// Independent reference for the closed-form win expectancy. winExpectancy itself is unit
// tested below against the literal formula; here we use `we` to predict the *orchestrated*
// outputs of updateAllRatings (which rating gets fed where), which is the thing under test.
function we(rating, opponentRating) {
  return 1 / (Math.pow(10, -(rating - opponentRating) / F) + 1);
}

describe('winExpectancy(rating, opponentRating)', function () {
  it('is exactly 0.5 for equal ratings', function () {
    expect(winExpectancy(1250, 1250)).to.equal(0.5);
  });

  it('favours the higher-rated side and disfavours the lower', function () {
    expect(winExpectancy(1500, 1000)).to.be.greaterThan(0.5);
    expect(winExpectancy(1000, 1500)).to.be.lessThan(0.5);
  });

  it('matches the closed form 1 / (10^(-(r-o)/1000) + 1)', function () {
    const r = 1400;
    const o = 1100;
    expect(winExpectancy(r, o)).to.equal(1 / (Math.pow(10, -(r - o) / 1000) + 1));
  });

  it('is symmetric: We(r,o) + We(o,r) === 1', function () {
    expect(winExpectancy(1300, 900) + winExpectancy(900, 1300)).to.be.closeTo(1, 1e-12);
  });

  it('gives ~0.715 for a 400-point edge', function () {
    expect(winExpectancy(1650, 1250)).to.be.closeTo(0.7153, 0.0005);
  });
});

if (Meteor.isServer) {
  const ORG = 'elo-test-org';
  // A fixed far-future timestamp so the rating row written by a match is unambiguously the
  // latest, regardless of the wall-clock time addPlayer used for the initial seed rows.
  const MATCH_DATE = 9_999_999_999_999;

  async function cleanDb() {
    await Promise.all([
      Matches.removeAsync({}),
      Players.removeAsync({}),
      CombinedRatings.removeAsync({}),
      SinglesRatings.removeAsync({}),
      OffenseRatings.removeAsync({}),
      DefenseRatings.removeAsync({}),
      TeamRatings.removeAsync({}),
      OrganizationMembers.removeAsync({}),
    ]);
  }

  // Seed a player and their initial rating rows (Combined/Singles/Offense/Defense = rating).
  async function seed(name, rating) {
    await addPlayer(name, rating, ORG);
  }

  // Latest rating for a player in a given collection.
  async function ratingOf(collection, name) {
    const p = await Players.findOneAsync({ name, org_id: ORG });
    const row = await collection.findOneAsync({ player_id: p._id }, { sort: { date_time: -1 } });
    return row.rating;
  }

  async function teamRatingOf(offenseName, defenseName) {
    const off = await Players.findOneAsync({ name: offenseName, org_id: ORG });
    const def = await Players.findOneAsync({ name: defenseName, org_id: ORG });
    const row = await TeamRatings.findOneAsync(
      { offense_id: off._id, defense_id: def._id },
      { sort: { date_time: -1 } },
    );
    return row.rating;
  }

  // Make one collection's latest rating diverge from the equal addPlayer seed (date sits
  // between the seed and the match), so a test can prove which row drives which update.
  async function setSeedRating(collection, name, rating) {
    const p = await Players.findOneAsync({ name, org_id: ORG });
    await collection.insertAsync({ date_time: MATCH_DATE - 1, player_id: p._id, rating });
  }

  describe('Elo rating system (server)', function () {
    // fixtures + several awaited rating writes per test can exceed the 2s default
    this.timeout(15000);

    beforeEach(async function () {
      await cleanDb();
    });

    describe('updateRating — one Elo step', function () {
      it('a win between equal ratings returns +25 and inserts the new row', async function () {
        const Rn = await updateRating(MATCH_DATE, 'p1', 1250, 1250, 1250, 1, CombinedRatings);
        expect(Rn).to.equal(1275);
        const row = await CombinedRatings.findOneAsync(
          { player_id: 'p1' },
          { sort: { date_time: -1 } },
        );
        expect(row.rating).to.equal(1275);
      });

      it('a loss between equal ratings returns -25', async function () {
        const Rn = await updateRating(MATCH_DATE, 'p1', 1250, 1250, 1250, 0, CombinedRatings);
        expect(Rn).to.equal(1225);
      });

      it('a tie (S = 0.5) between equal ratings leaves the rating unchanged', async function () {
        const Rn = await updateRating(MATCH_DATE, 'p1', 1250, 1250, 1250, 0.5, CombinedRatings);
        expect(Rn).to.equal(1250);
      });

      it('a favourite gains fewer than 25 points for a win', async function () {
        const Rn = await updateRating(MATCH_DATE, 'p1', 1450, 1250, 1450, 1, CombinedRatings);
        // hand-computed literal (independent of the impl's adj + K*(S - We) shape):
        // 1450 + 50*(1 - 1/(10^(-200/1000)+1)) = 1450 + 50*0.386843 = 1469.342
        expect(Rn).to.be.closeTo(1469.342, 0.01);
        expect(Rn).to.be.closeTo(1450 + 50 * (1 - we(1450, 1250)), 1e-9);
        expect(Rn).to.be.greaterThan(1450);
        expect(Rn - 1450).to.be.lessThan(25);
      });
    });

    describe('updateAllRatings — 1v1 (combined + singles only)', function () {
      it('equal ratings, red wins: +25 / -25 on combined and singles', async function () {
        await seed('Red', 1250);
        await seed('Blue', 1250);
        await updateAllRatings({ ro: 'Red', bo: 'Blue', rs: 10, bs: 0, org_id: ORG }, MATCH_DATE);

        expect(await ratingOf(CombinedRatings, 'Red')).to.equal(1275);
        expect(await ratingOf(CombinedRatings, 'Blue')).to.equal(1225);
        expect(await ratingOf(SinglesRatings, 'Red')).to.equal(1275);
        expect(await ratingOf(SinglesRatings, 'Blue')).to.equal(1225);
      });

      it('leaves offense / defense / team ratings untouched', async function () {
        await seed('Red', 1250);
        await seed('Blue', 1250);
        await updateAllRatings({ ro: 'Red', bo: 'Blue', rs: 10, bs: 0, org_id: ORG }, MATCH_DATE);

        expect(await ratingOf(OffenseRatings, 'Red')).to.equal(1250);
        expect(await ratingOf(DefenseRatings, 'Blue')).to.equal(1250);
        expect(await TeamRatings.find({}).countAsync()).to.equal(0);
      });

      it('a tie between equal ratings is an Elo draw — no change for either side', async function () {
        await seed('Red', 1250);
        await seed('Blue', 1250);
        await updateAllRatings({ ro: 'Red', bo: 'Blue', rs: 5, bs: 5, org_id: ORG }, MATCH_DATE);

        expect(await ratingOf(CombinedRatings, 'Red')).to.equal(1250);
        expect(await ratingOf(CombinedRatings, 'Blue')).to.equal(1250);
      });

      it('a tie between unequal ratings moves them toward each other (zero-sum)', async function () {
        await seed('Strong', 1450);
        await seed('Weak', 1250);
        await updateAllRatings({ ro: 'Strong', bo: 'Weak', rs: 5, bs: 5, org_id: ORG }, MATCH_DATE);

        const strong = await ratingOf(CombinedRatings, 'Strong');
        const weak = await ratingOf(CombinedRatings, 'Weak');
        expect(strong).to.be.lessThan(1450); // favourite drops by only drawing
        expect(weak).to.be.greaterThan(1250);
        expect(strong - 1450 + (weak - 1250)).to.be.closeTo(0, 1e-9); // 1v1 is zero-sum
        expect(1450 - strong).to.be.closeTo(50 * (we(1450, 1250) - 0.5), 1e-9);
      });

      it('a rematch builds on the first result, not the initial seed', async function () {
        await seed('Red', 1250);
        await seed('Blue', 1250);
        const match = { ro: 'Red', bo: 'Blue', rs: 10, bs: 0, org_id: ORG };
        await updateAllRatings(match, MATCH_DATE); // → Red 1275 / Blue 1225
        await updateAllRatings(match, MATCH_DATE + 1); // must read 1275 / 1225, not the 1250 seed

        const red = await ratingOf(CombinedRatings, 'Red');
        expect(red).to.be.closeTo(1275 + 50 * (1 - we(1275, 1225)), 1e-9);
        expect(red).to.be.greaterThan(1275); // accumulation, not a repeated +25 off the seed
        expect(await ratingOf(CombinedRatings, 'Blue')).to.be.closeTo(
          1225 + 50 * (0 - we(1225, 1275)),
          1e-9,
        );
        expect(await ratingOf(SinglesRatings, 'Red')).to.be.closeTo(
          1275 + 50 * (1 - we(1275, 1225)),
          1e-9,
        );
      });
    });

    describe('updateAllRatings — 2v2 (combined, offense/defense, team)', function () {
      it('equal ratings, red wins: winners +25, losers -25 across every collection', async function () {
        await seed('RO', 1250);
        await seed('RD', 1250);
        await seed('BO', 1250);
        await seed('BD', 1250);
        await updateAllRatings(
          { ro: 'RO', rd: 'RD', bo: 'BO', bd: 'BD', rs: 10, bs: 0, org_id: ORG },
          MATCH_DATE,
        );

        expect(await ratingOf(CombinedRatings, 'RO')).to.equal(1275);
        expect(await ratingOf(CombinedRatings, 'RD')).to.equal(1275);
        expect(await ratingOf(CombinedRatings, 'BO')).to.equal(1225);
        expect(await ratingOf(CombinedRatings, 'BD')).to.equal(1225);

        // offense / defense track the seat the player occupied
        expect(await ratingOf(OffenseRatings, 'RO')).to.equal(1275);
        expect(await ratingOf(DefenseRatings, 'RD')).to.equal(1275);
        expect(await ratingOf(OffenseRatings, 'BO')).to.equal(1225);
        expect(await ratingOf(DefenseRatings, 'BD')).to.equal(1225);

        // team ratings start at 1250 (no prior row) and move ±25
        expect(await teamRatingOf('RO', 'RD')).to.equal(1275);
        expect(await teamRatingOf('BO', 'BD')).to.equal(1225);
      });

      it('unequal ratings, red wins: locks the ÷2 team average and per-seat wiring', async function () {
        await seed('RO', 1400);
        await seed('RD', 1200);
        await seed('BO', 1100);
        await seed('BD', 1000);
        // diverge each red seat's offense/defense rating from its combined rating, so the
        // test proves the per-seat row (not combined) is what gets adjusted
        await setSeedRating(OffenseRatings, 'RO', 1500);
        await setSeedRating(DefenseRatings, 'RD', 1150);
        await updateAllRatings(
          { ro: 'RO', rd: 'RD', bo: 'BO', bd: 'BD', rs: 10, bs: 0, org_id: ORG },
          MATCH_DATE,
        );

        const redRating = (1400 + 1200) / 2; // 1300 — team average
        const blueRating = (1100 + 1000) / 2; // 1050
        const redGain = 50 * (1 - we(redRating, blueRating));
        const blueLoss = 50 * (0 - we(blueRating, redRating));

        // combined: own combined seed adjusted, win-expectancy uses the TEAM average
        expect(await ratingOf(CombinedRatings, 'RO')).to.be.closeTo(1400 + redGain, 1e-9);
        expect(await ratingOf(CombinedRatings, 'RD')).to.be.closeTo(1200 + redGain, 1e-9);
        expect(await ratingOf(CombinedRatings, 'BO')).to.be.closeTo(1100 + blueLoss, 1e-9);
        expect(await ratingOf(CombinedRatings, 'BD')).to.be.closeTo(1000 + blueLoss, 1e-9);

        // offense/defense adjust their OWN diverged seed (1500 / 1150) with the same team We
        expect(await ratingOf(OffenseRatings, 'RO')).to.be.closeTo(1500 + redGain, 1e-9);
        expect(await ratingOf(DefenseRatings, 'RD')).to.be.closeTo(1150 + redGain, 1e-9);
        // → they must differ from the same player's combined result
        expect(await ratingOf(OffenseRatings, 'RO')).to.not.be.closeTo(
          await ratingOf(CombinedRatings, 'RO'),
          1,
        );
      });

      it('a tie between equal teams leaves every rating unchanged', async function () {
        await seed('RO', 1250);
        await seed('RD', 1250);
        await seed('BO', 1250);
        await seed('BD', 1250);
        await updateAllRatings(
          { ro: 'RO', rd: 'RD', bo: 'BO', bd: 'BD', rs: 5, bs: 5, org_id: ORG },
          MATCH_DATE,
        );

        expect(await ratingOf(CombinedRatings, 'RO')).to.equal(1250);
        expect(await ratingOf(CombinedRatings, 'BD')).to.equal(1250);
        expect(await ratingOf(OffenseRatings, 'RO')).to.equal(1250);
        expect(await ratingOf(DefenseRatings, 'BD')).to.equal(1250);
        expect(await teamRatingOf('RO', 'RD')).to.equal(1250);
        expect(await teamRatingOf('BO', 'BD')).to.equal(1250);
      });

      it('a rematch reads the accumulated team rating, not the 1250 default', async function () {
        await seed('RO', 1250);
        await seed('RD', 1250);
        await seed('BO', 1250);
        await seed('BD', 1250);
        const match = { ro: 'RO', rd: 'RD', bo: 'BO', bd: 'BD', rs: 10, bs: 0, org_id: ORG };
        await updateAllRatings(match, MATCH_DATE); // red team → 1275, blue → 1225
        await updateAllRatings(match, MATCH_DATE + 1); // rematch must read 1275 / 1225

        expect(await teamRatingOf('RO', 'RD')).to.be.closeTo(
          1275 + 50 * (1 - we(1275, 1225)),
          1e-9,
        );
        expect(await teamRatingOf('BO', 'BD')).to.be.closeTo(
          1225 + 50 * (0 - we(1225, 1275)),
          1e-9,
        );
        expect(await teamRatingOf('RO', 'RD')).to.be.greaterThan(1290); // beyond a single +25
      });
    });

    describe('updateAllRatings — 2v1 / 1v2 handicap (team combined ÷ 1.5)', function () {
      it('2 red v 1 blue, team wins: each team player gains < 25 (they were favoured)', async function () {
        await seed('RO', 1250);
        await seed('RD', 1250);
        await seed('Solo', 1250);
        await updateAllRatings(
          { ro: 'RO', rd: 'RD', bo: 'Solo', rs: 10, bs: 0, org_id: ORG },
          MATCH_DATE,
        );

        const redRating = (1250 + 1250) / 1.5;
        const expTeam = 1250 + 50 * (1 - we(redRating, 1250));
        const expSolo = 1250 + 50 * (0 - we(1250, redRating));

        expect(await ratingOf(CombinedRatings, 'RO')).to.be.closeTo(expTeam, 1e-9);
        expect(await ratingOf(CombinedRatings, 'RD')).to.be.closeTo(expTeam, 1e-9);
        expect(await ratingOf(CombinedRatings, 'Solo')).to.be.closeTo(expSolo, 1e-9);

        // each team player gains less than a fair +25; the solo loser drops less than -25
        expect(await ratingOf(CombinedRatings, 'RO')).to.be.lessThan(1275);
        expect(await ratingOf(CombinedRatings, 'Solo')).to.be.greaterThan(1225);

        // offense/defense seats and the solo singles rating follow the same expectations
        expect(await ratingOf(OffenseRatings, 'RO')).to.be.closeTo(expTeam, 1e-9);
        expect(await ratingOf(DefenseRatings, 'RD')).to.be.closeTo(expTeam, 1e-9);
        expect(await ratingOf(SinglesRatings, 'Solo')).to.be.closeTo(expSolo, 1e-9);

        // team rating uses the raw team rating (1250) vs the solo's combined (1250) → +25
        expect(await teamRatingOf('RO', 'RD')).to.equal(1275);

        // collections this mode must NOT write stay at the seed: the solo has no
        // offense/defense seat, and the team players have no singles row or solo team pair
        expect(await ratingOf(OffenseRatings, 'Solo')).to.equal(1250);
        expect(await ratingOf(DefenseRatings, 'Solo')).to.equal(1250);
        expect(await ratingOf(SinglesRatings, 'RO')).to.equal(1250);
        const solo = await Players.findOneAsync({ name: 'Solo', org_id: ORG });
        expect(await TeamRatings.find({ offense_id: solo._id }).countAsync()).to.equal(0);
      });

      it('1 red v 2 blue, solo wins the upset: solo gains > 25 (mirror branch)', async function () {
        await seed('Solo', 1250);
        await seed('BO', 1250);
        await seed('BD', 1250);
        await updateAllRatings(
          { ro: 'Solo', bo: 'BO', bd: 'BD', rs: 10, bs: 0, org_id: ORG },
          MATCH_DATE,
        );

        const blueRating = (1250 + 1250) / 1.5;
        const expSolo = 1250 + 50 * (1 - we(1250, blueRating));
        const expTeam = 1250 + 50 * (0 - we(blueRating, 1250));

        expect(await ratingOf(CombinedRatings, 'Solo')).to.be.closeTo(expSolo, 1e-9);
        expect(await ratingOf(CombinedRatings, 'BO')).to.be.closeTo(expTeam, 1e-9);
        expect(await ratingOf(CombinedRatings, 'BD')).to.be.closeTo(expTeam, 1e-9);

        expect(await ratingOf(CombinedRatings, 'Solo')).to.be.greaterThan(1275); // boosted upset
        expect(await ratingOf(SinglesRatings, 'Solo')).to.be.closeTo(expSolo, 1e-9);
        expect(await ratingOf(OffenseRatings, 'BO')).to.be.closeTo(expTeam, 1e-9);
        expect(await ratingOf(DefenseRatings, 'BD')).to.be.closeTo(expTeam, 1e-9);

        // blue's team rating: 1250 vs the solo's 1250 → loss → -25
        expect(await teamRatingOf('BO', 'BD')).to.equal(1225);
      });

      it('a tie still moves the handicapped sides — favoured team drops, solo rises', async function () {
        await seed('RO', 1250);
        await seed('RD', 1250);
        await seed('Solo', 1250);
        await updateAllRatings(
          { ro: 'RO', rd: 'RD', bo: 'Solo', rs: 5, bs: 5, org_id: ORG },
          MATCH_DATE,
        );

        const redRating = (1250 + 1250) / 1.5; // 1666.67 — favoured by the ÷1.5 handicap
        // S = 0.5 both sides, but We(redRating,1250) > 0.5, so a draw is NOT neutral here
        expect(await ratingOf(CombinedRatings, 'RO')).to.be.closeTo(
          1250 + 50 * (0.5 - we(redRating, 1250)),
          1e-9,
        );
        expect(await ratingOf(CombinedRatings, 'RO')).to.be.lessThan(1250);
        expect(await ratingOf(CombinedRatings, 'Solo')).to.be.closeTo(
          1250 + 50 * (0.5 - we(1250, redRating)),
          1e-9,
        );
        expect(await ratingOf(CombinedRatings, 'Solo')).to.be.greaterThan(1250);
        // the team pair's own rating (1250 vs solo 1250, S=0.5) is even → unchanged
        expect(await teamRatingOf('RO', 'RD')).to.equal(1250);
      });

      it('feeds the solo combined to team-combined but solo singles to offense/defense', async function () {
        await seed('RO', 1250);
        await seed('RD', 1250);
        await seed('Solo', 1250);
        // diverge the solo's combined (1450) from its singles (still 1250)
        await setSeedRating(CombinedRatings, 'Solo', 1450);
        await updateAllRatings(
          { ro: 'RO', rd: 'RD', bo: 'Solo', rs: 10, bs: 0, org_id: ORG },
          MATCH_DATE,
        );

        const redRating = (1250 + 1250) / 1.5;
        // team COMBINED uses the solo's COMBINED (1450) as opponent...
        expect(await ratingOf(CombinedRatings, 'RO')).to.be.closeTo(
          1250 + 50 * (1 - we(redRating, 1450)),
          1e-9,
        );
        // ...while team OFFENSE/DEFENSE use the solo's SINGLES (1250) as opponent
        expect(await ratingOf(OffenseRatings, 'RO')).to.be.closeTo(
          1250 + 50 * (1 - we(redRating, 1250)),
          1e-9,
        );
        expect(await ratingOf(DefenseRatings, 'RD')).to.be.closeTo(
          1250 + 50 * (1 - we(redRating, 1250)),
          1e-9,
        );
        // the two opponent sources differ → combined and offense results diverge
        expect(await ratingOf(CombinedRatings, 'RO')).to.not.be.closeTo(
          await ratingOf(OffenseRatings, 'RO'),
          0.5,
        );
      });
    });

    describe('updateAllRatings — red/blue symmetry', function () {
      it('1v1 outcome depends on who won, not on the red vs blue seat', async function () {
        // A: strong player on red, wins 10-5
        await seed('Strong', 1400);
        await seed('Weak', 1100);
        await updateAllRatings(
          { ro: 'Strong', bo: 'Weak', rs: 10, bs: 5, org_id: ORG },
          MATCH_DATE,
        );
        const strongA = await ratingOf(CombinedRatings, 'Strong');
        const weakA = await ratingOf(CombinedRatings, 'Weak');

        // B: same players & winner, strong player now on blue
        await cleanDb();
        await seed('Strong', 1400);
        await seed('Weak', 1100);
        await updateAllRatings(
          { ro: 'Weak', bo: 'Strong', rs: 5, bs: 10, org_id: ORG },
          MATCH_DATE,
        );
        const strongB = await ratingOf(CombinedRatings, 'Strong');
        const weakB = await ratingOf(CombinedRatings, 'Weak');

        expect(strongB).to.be.closeTo(strongA, 1e-9);
        expect(weakB).to.be.closeTo(weakA, 1e-9);
        expect(strongA - 1400 + (weakA - 1100)).to.be.closeTo(0, 1e-9); // zero-sum
      });

      it('2v2 outcome is mirror-symmetric when the teams swap colours', async function () {
        // A: team X (red) beats team Y (blue)
        await seed('X1', 1300);
        await seed('X2', 1200);
        await seed('Y1', 1100);
        await seed('Y2', 1000);
        await updateAllRatings(
          { ro: 'X1', rd: 'X2', bo: 'Y1', bd: 'Y2', rs: 10, bs: 0, org_id: ORG },
          MATCH_DATE,
        );
        const x1A = await ratingOf(CombinedRatings, 'X1');
        const y1A = await ratingOf(CombinedRatings, 'Y1');

        // B: same teams & winner, colours swapped (team X now blue)
        await cleanDb();
        await seed('X1', 1300);
        await seed('X2', 1200);
        await seed('Y1', 1100);
        await seed('Y2', 1000);
        await updateAllRatings(
          { ro: 'Y1', rd: 'Y2', bo: 'X1', bd: 'X2', rs: 0, bs: 10, org_id: ORG },
          MATCH_DATE,
        );
        const x1B = await ratingOf(CombinedRatings, 'X1');
        const y1B = await ratingOf(CombinedRatings, 'Y1');

        expect(x1B).to.be.closeTo(x1A, 1e-9);
        expect(y1B).to.be.closeTo(y1A, 1e-9);
      });
    });

    describe('add_match — end to end (validation, auth, rating writes)', function () {
      const userId = Random.id();
      let realUserId;

      before(function () {
        realUserId = Meteor.userId;
        Meteor.userId = () => userId;
      });
      after(function () {
        Meteor.userId = realUserId;
      });

      beforeEach(async function () {
        // outer beforeEach already cleaned the DB; add the member + players this test needs
        await OrganizationMembers.insertAsync({ org_id: ORG, user_id: userId, role: 'member' });
        await seed('Alice', 1250);
        await seed('Bob', 1250);
      });

      it('inserts the match and updates ratings for an org member', async function () {
        await Meteor.callAsync('add_match', { ro: 'Alice', bo: 'Bob', rs: 10, bs: 0, org_id: ORG });

        expect(await Matches.find({ org_id: ORG }).countAsync()).to.equal(1);
        expect(await ratingOf(CombinedRatings, 'Alice')).to.equal(1275);
        expect(await ratingOf(CombinedRatings, 'Bob')).to.equal(1225);
      });

      it('records a tie as an Elo draw (no rating change), not an error', async function () {
        await Meteor.callAsync('add_match', { ro: 'Alice', bo: 'Bob', rs: 5, bs: 5, org_id: ORG });

        expect(await Matches.find({ org_id: ORG }).countAsync()).to.equal(1);
        expect(await ratingOf(CombinedRatings, 'Alice')).to.equal(1250);
        expect(await ratingOf(CombinedRatings, 'Bob')).to.equal(1250);
      });

      it('rejects a non-member (org isolation)', async function () {
        await OrganizationMembers.removeAsync({ org_id: ORG, user_id: userId });
        let caught = null;
        try {
          await Meteor.callAsync('add_match', {
            ro: 'Alice',
            bo: 'Bob',
            rs: 10,
            bs: 0,
            org_id: ORG,
          });
        } catch (e) {
          caught = e.error;
        }
        expect(caught).to.equal('not-authorized');
        expect(await Matches.find({ org_id: ORG }).countAsync()).to.equal(0);
      });

      it('rejects an out-of-range score', async function () {
        let caught = null;
        try {
          await Meteor.callAsync('add_match', {
            ro: 'Alice',
            bo: 'Bob',
            rs: 11,
            bs: 0,
            org_id: ORG,
          });
        } catch (e) {
          caught = e.error;
        }
        expect(caught).to.equal('invalid-score');
      });
    });
  });
}
